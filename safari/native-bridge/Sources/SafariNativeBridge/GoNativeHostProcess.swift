import CryptoKit
import Darwin
import Foundation

/// Complete validated local-source snapshot returned by the embedded Go helper.
public struct SafariReadSnapshot: Equatable, Sendable {
    /// Raw source bytes.
    public let bytes: Data
    /// SHA-256 digest of `bytes`.
    public let digest: String
    /// Exact logical source size.
    public let totalBytes: Int
    /// Number of bounded raw chunks.
    public let chunkCount: Int
}

/// Readiness response returned to the Safari WebExtension.
public struct SafariStatusResponse: Encodable, Sendable {
    /// Native protocol version.
    public let protocolVersion = 1
    /// Caller-generated request identifier.
    public let requestId: String
    /// Response discriminator.
    public let type = "status"
    /// Success flag fixed to true.
    public let ok = true
    /// Version reported by the embedded Go helper.
    public let hostVersion: String

    /// Creates a validated readiness response.
    public init(requestId: String, hostVersion: String) {
        self.requestId = requestId
        self.hostVersion = hostVersion
    }
}

/// Metadata response carrying the first source chunk in the same round trip.
public struct SafariReadMetadataResponse: Encodable, Sendable {
    /// Native protocol version.
    public let protocolVersion = 1
    /// Caller-generated request identifier.
    public let requestId: String
    /// Response discriminator.
    public let type = "readMetadata"
    /// Success flag fixed to true.
    public let ok = true
    /// Exact logical source size.
    public let totalBytes: Int
    /// Number of bounded raw chunks.
    public let chunkCount: Int
    /// SHA-256 digest binding subsequent chunk requests.
    public let digest: String
    /// Base64-encoded first source chunk.
    public let firstChunk: String

    /// Creates metadata from one complete validated snapshot.
    public init(requestId: String, snapshot: SafariReadSnapshot) {
        self.requestId = requestId
        self.totalBytes = snapshot.totalBytes
        self.chunkCount = snapshot.chunkCount
        self.digest = snapshot.digest
        let firstChunkEnd = min(
            SafariNativeLimit.rawChunkBytes,
            snapshot.bytes.count
        )
        self.firstChunk = Data(snapshot.bytes.prefix(firstChunkEnd))
            .base64EncodedString()
    }
}

/// One bounded source-chunk response.
public struct SafariReadChunkResponse: Encodable, Sendable {
    /// Native protocol version.
    public let protocolVersion = 1
    /// Caller-generated request identifier.
    public let requestId: String
    /// Response discriminator.
    public let type = "readChunk"
    /// Success flag fixed to true.
    public let ok = true
    /// Zero-based chunk index.
    public let chunkIndex: Int
    /// Base64-encoded chunk bytes.
    public let data: String

    /// Creates a response for one validated chunk.
    public init(requestId: String, chunkIndex: Int, data: String) {
        self.requestId = requestId
        self.chunkIndex = chunkIndex
        self.data = data
    }
}

/// Successful folder-authorization response.
public struct SafariAuthorizationResponse: Encodable, Sendable {
    /// Native protocol version.
    public let protocolVersion = 1
    /// Caller-generated request identifier.
    public let requestId: String
    /// Response discriminator.
    public let type = "authorization"
    /// Success flag fixed to true.
    public let ok = true

    /// Creates a successful authorization response.
    public init(requestId: String) {
        self.requestId = requestId
    }
}

struct NativeHostInvocation {
    let executableURL: URL
    let arguments: [String]
    let environment: [String: String]
    let standardInput: Data
    let timeout: TimeInterval
}

struct NativeHostProcessResult {
    let standardOutput: Data
    let standardError: Data
    let terminationStatus: Int32
}

typealias NativeHostProcessRunner = (NativeHostInvocation) throws -> NativeHostProcessResult

struct GoNativeHostProcess {
    private static let hostName = "kode-injector-native"
    private static let maximumProcessOutputBytes = 8 * 1024 * 1024
    private static let maximumDiagnosticBytes = 64 * 1024
    private static let defaultTimeout: TimeInterval = 2

    private let executableURL: URL
    private let timeout: TimeInterval
    private let runner: NativeHostProcessRunner

    init(
        bundleURL: URL = Bundle.main.bundleURL,
        executableURL: URL? = nil,
        timeout: TimeInterval = GoNativeHostProcess.defaultTimeout,
        runner: @escaping NativeHostProcessRunner = GoNativeHostProcess.runProcess
    ) throws {
        let helpersURL = bundleURL
            .appendingPathComponent("Contents", isDirectory: true)
            .appendingPathComponent("Helpers", isDirectory: true)
        let expectedURL = helpersURL
            .appendingPathComponent(Self.hostName, isDirectory: false)
            .standardizedFileURL
        let selectedURL = (executableURL ?? expectedURL).standardizedFileURL
        guard selectedURL == expectedURL else {
            throw SafariNativeBridgeError(code: .internalError)
        }
        self.executableURL = selectedURL
        self.timeout = timeout
        self.runner = runner
    }

    func ping(requestId: String) throws -> String {
        let output = try invoke(GoRequest(
            protocolVersion: 1,
            requestId: requestId,
            operation: "ping",
            fileUrl: nil
        ))
        let messages = try decodeMessages(output)
        guard messages.count == 1 else {
            throw SafariNativeBridgeError(code: .invalidMessage)
        }
        let message = messages[0]
        try validateCommon(message, requestId: requestId)
        if try throwIfError(message) {
            throw SafariNativeBridgeError(code: .invalidMessage)
        }
        try requireKeys(
            message,
            ["protocolVersion", "requestId", "type", "ok", "hostVersion"]
        )
        guard message["type"] as? String == "status",
              message["ok"] as? Bool == true,
              let hostVersion = message["hostVersion"] as? String,
              !hostVersion.isEmpty else {
            throw SafariNativeBridgeError(code: .invalidMessage)
        }
        return hostVersion
    }

    func snapshot(fileURL: String, requestId: String) throws -> SafariReadSnapshot {
        let output = try invoke(GoRequest(
            protocolVersion: 1,
            requestId: requestId,
            operation: "readFile",
            fileUrl: fileURL
        ))
        return try decodeSnapshot(output, requestId: requestId)
    }

    func chunk(
        fileURL: String,
        expectedDigest: String,
        chunkIndex: Int,
        requestId: String
    ) throws -> Data {
        let snapshot = try snapshot(fileURL: fileURL, requestId: requestId)
        guard snapshot.digest == expectedDigest else {
            throw SafariNativeBridgeError(code: .fileChanged)
        }
        guard (0..<snapshot.chunkCount).contains(chunkIndex) else {
            throw SafariNativeBridgeError(code: .invalidMessage)
        }
        let start = chunkIndex * SafariNativeLimit.rawChunkBytes
        let end = min(start + SafariNativeLimit.rawChunkBytes, snapshot.bytes.count)
        return snapshot.bytes.subdata(in: start..<end)
    }

    func decodeSnapshot(_ output: Data, requestId: String) throws -> SafariReadSnapshot {
        let messages = try decodeMessages(output)
        guard let first = messages.first else {
            throw SafariNativeBridgeError(code: .invalidFrame)
        }
        try validateCommon(first, requestId: requestId)
        if try throwIfError(first) {
            throw SafariNativeBridgeError(code: .invalidMessage)
        }
        guard messages.count >= 2 else {
            throw SafariNativeBridgeError(code: .invalidMessage)
        }

        try requireKeys(
            first,
            ["protocolVersion", "requestId", "type", "ok", "totalBytes", "chunkCount"]
        )
        guard first["type"] as? String == "readStart",
              first["ok"] as? Bool == true,
              let totalBytes = integer(first["totalBytes"]),
              let chunkCount = integer(first["chunkCount"]),
              (0...SafariNativeLimit.logicalFileBytes).contains(totalBytes),
              (0...SafariNativeLimit.maximumChunkCount).contains(chunkCount),
              chunkCount == expectedChunkCount(totalBytes: totalBytes),
              messages.count == chunkCount + 2 else {
            throw SafariNativeBridgeError(code: .invalidMessage)
        }

        var bytes = Data()
        bytes.reserveCapacity(totalBytes)
        for index in 0..<chunkCount {
            let message = messages[index + 1]
            try validateCommon(message, requestId: requestId)
            try requireKeys(
                message,
                ["protocolVersion", "requestId", "type", "ok", "chunkIndex", "data"]
            )
            guard message["type"] as? String == "readChunk",
                  message["ok"] as? Bool == true,
                  integer(message["chunkIndex"]) == index,
                  let encoded = message["data"] as? String,
                  let chunk = Data(base64Encoded: encoded),
                  chunk.count <= SafariNativeLimit.rawChunkBytes else {
                throw SafariNativeBridgeError(code: .invalidMessage)
            }
            let expectedBytes = min(
                SafariNativeLimit.rawChunkBytes,
                totalBytes - bytes.count
            )
            guard chunk.count == expectedBytes else {
                throw SafariNativeBridgeError(code: .invalidMessage)
            }
            bytes.append(chunk)
        }

        let complete = messages[messages.count - 1]
        try validateCommon(complete, requestId: requestId)
        try requireKeys(
            complete,
            ["protocolVersion", "requestId", "type", "ok", "totalBytes", "chunkCount"]
        )
        guard complete["type"] as? String == "readComplete",
              complete["ok"] as? Bool == true,
              integer(complete["totalBytes"]) == totalBytes,
              integer(complete["chunkCount"]) == chunkCount,
              bytes.count == totalBytes,
              String(data: bytes, encoding: .utf8) != nil else {
            throw SafariNativeBridgeError(code: .invalidMessage)
        }

        return SafariReadSnapshot(
            bytes: bytes,
            digest: SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined(),
            totalBytes: totalBytes,
            chunkCount: chunkCount
        )
    }

    private func invoke(_ request: GoRequest) throws -> Data {
        let payload: Data
        do {
            payload = try JSONEncoder().encode(request)
        } catch {
            throw SafariNativeBridgeError(code: .invalidMessage)
        }
        guard payload.count <= SafariNativeLimit.requestBytes else {
            throw SafariNativeBridgeError(code: .messageTooLarge)
        }
        var length = UInt32(payload.count).littleEndian
        var standardInput = withUnsafeBytes(of: &length) { Data($0) }
        standardInput.append(payload)

        let invocation = NativeHostInvocation(
            executableURL: executableURL,
            arguments: [],
            environment: [
                "HOME": FileManager.default.homeDirectoryForCurrentUser.path,
                "TMPDIR": NSTemporaryDirectory(),
            ],
            standardInput: standardInput,
            timeout: timeout
        )

        let result: NativeHostProcessResult
        do {
            result = try runner(invocation)
        } catch let error as SafariNativeBridgeError {
            throw error
        } catch {
            throw SafariNativeBridgeError(code: .readFailed)
        }
        guard result.terminationStatus == 0 else {
            throw SafariNativeBridgeError(code: .readFailed)
        }
        return result.standardOutput
    }

    private func decodeMessages(_ output: Data) throws -> [[String: Any]] {
        var offset = 0
        var messages: [[String: Any]] = []
        while offset < output.count {
            guard output.count - offset >= MemoryLayout<UInt32>.size else {
                throw SafariNativeBridgeError(code: .invalidFrame)
            }
            let lengthData = output.subdata(in: offset..<(offset + 4))
            let length = lengthData.withUnsafeBytes { rawBuffer -> UInt32 in
                var value: UInt32 = 0
                withUnsafeMutableBytes(of: &value) { destination in
                    destination.copyBytes(from: rawBuffer)
                }
                return UInt32(littleEndian: value)
            }
            offset += 4
            guard length < SafariNativeLimit.responseBytes else {
                throw SafariNativeBridgeError(code: .messageTooLarge)
            }
            let frameLength = Int(length)
            guard output.count - offset >= frameLength else {
                throw SafariNativeBridgeError(code: .invalidFrame)
            }
            let frame = output.subdata(in: offset..<(offset + frameLength))
            offset += frameLength
            let object: Any
            do {
                object = try JSONSerialization.jsonObject(with: frame)
            } catch {
                throw SafariNativeBridgeError(code: .invalidMessage)
            }
            guard let message = object as? [String: Any] else {
                throw SafariNativeBridgeError(code: .invalidMessage)
            }
            messages.append(message)
        }
        return messages
    }

    private func validateCommon(_ message: [String: Any], requestId: String) throws {
        guard integer(message["protocolVersion"]) == 1 else {
            throw SafariNativeBridgeError(code: .unsupportedProtocol)
        }
        guard message["requestId"] as? String == requestId else {
            throw SafariNativeBridgeError(code: .invalidRequestId)
        }
    }

    @discardableResult
    private func throwIfError(_ message: [String: Any]) throws -> Bool {
        guard message["type"] as? String == "error" else {
            return false
        }
        try requireKeys(
            message,
            ["protocolVersion", "requestId", "type", "ok", "error"]
        )
        guard message["ok"] as? Bool == false,
              let detail = message["error"] as? [String: Any],
              Set(detail.keys) == ["code"],
              let rawCode = detail["code"] as? String,
              let code = SafariNativeErrorCode(rawValue: rawCode) else {
            throw SafariNativeBridgeError(code: .invalidMessage)
        }
        throw SafariNativeBridgeError(code: code)
    }

    private func requireKeys(_ message: [String: Any], _ keys: Set<String>) throws {
        guard Set(message.keys) == keys else {
            throw SafariNativeBridgeError(code: .invalidMessage)
        }
    }

    private func integer(_ value: Any?) -> Int? {
        guard let number = value as? NSNumber,
              CFGetTypeID(number) != CFBooleanGetTypeID() else {
            return nil
        }
        return number.intValue
    }

    private func expectedChunkCount(totalBytes: Int) -> Int {
        guard totalBytes > 0 else {
            return 0
        }
        return (totalBytes + SafariNativeLimit.rawChunkBytes - 1)
            / SafariNativeLimit.rawChunkBytes
    }

    private static func runProcess(
        invocation: NativeHostInvocation
    ) throws -> NativeHostProcessResult {
        let process = Process()
        process.executableURL = invocation.executableURL
        process.arguments = invocation.arguments
        process.environment = invocation.environment

        let standardInput = Pipe()
        let standardOutput = BoundedPipeCapture(
            maximumBytes: maximumProcessOutputBytes
        )
        let standardError = BoundedPipeCapture(
            maximumBytes: maximumDiagnosticBytes
        )
        process.standardInput = standardInput
        process.standardOutput = standardOutput.pipe
        process.standardError = standardError.pipe

        do {
            try process.run()
        } catch {
            throw SafariNativeBridgeError(code: .readFailed)
        }
        standardOutput.start()
        standardError.start()
        do {
            try standardInput.fileHandleForWriting.write(contentsOf: invocation.standardInput)
            try standardInput.fileHandleForWriting.close()
        } catch {
            terminate(process)
            throw SafariNativeBridgeError(code: .readFailed)
        }

        let deadline = Date().addingTimeInterval(max(0, invocation.timeout))
        while process.isRunning, Date() < deadline {
            Thread.sleep(forTimeInterval: 0.005)
        }
        if process.isRunning {
            terminate(process)
            standardOutput.waitUntilFinished()
            standardError.waitUntilFinished()
            throw SafariNativeBridgeError(code: .readFailed)
        }
        process.waitUntilExit()
        standardOutput.waitUntilFinished()
        standardError.waitUntilFinished()

        guard !standardOutput.exceededLimit,
              !standardError.exceededLimit else {
            throw SafariNativeBridgeError(code: .messageTooLarge)
        }
        return NativeHostProcessResult(
            standardOutput: standardOutput.data,
            standardError: standardError.data,
            terminationStatus: process.terminationStatus
        )
    }

    private static func terminate(_ process: Process) {
        if process.isRunning {
            process.terminate()
        }
        let deadline = Date().addingTimeInterval(0.5)
        while process.isRunning, Date() < deadline {
            Thread.sleep(forTimeInterval: 0.005)
        }
        if process.isRunning {
            Darwin.kill(process.processIdentifier, SIGKILL)
            process.waitUntilExit()
        }
    }
}

private struct GoRequest: Encodable {
    let protocolVersion: Int
    let requestId: String
    let operation: String
    let fileUrl: String?
}

private final class BoundedPipeCapture: @unchecked Sendable {
    let pipe = Pipe()

    private let maximumBytes: Int
    private let queue = DispatchQueue(
        label: "dev.maximtop.kode-injector.safari.native-output",
        qos: .userInitiated
    )
    private let finished = DispatchSemaphore(value: 0)
    private let lock = NSLock()
    private var captured = Data()
    private var didExceedLimit = false

    init(maximumBytes: Int) {
        self.maximumBytes = maximumBytes
    }

    var data: Data {
        lock.withLock { captured }
    }

    var exceededLimit: Bool {
        lock.withLock { didExceedLimit }
    }

    func start() {
        queue.async { [self] in
            while true {
                let chunk = pipe.fileHandleForReading.availableData
                if chunk.isEmpty {
                    break
                }
                lock.withLock {
                    let remaining = max(0, maximumBytes - captured.count)
                    if remaining > 0 {
                        captured.append(chunk.prefix(remaining))
                    }
                    if chunk.count > remaining {
                        didExceedLimit = true
                    }
                }
            }
            finished.signal()
        }
    }

    func waitUntilFinished() {
        finished.wait()
    }
}
