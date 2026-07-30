import CryptoKit
import Foundation
import XCTest
@testable import SafariNativeBridge

final class GoNativeHostProcessTests: XCTestCase {
    private var temporaryDirectory: URL!

    override func setUpWithError() throws {
        temporaryDirectory = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(
            at: temporaryDirectory,
            withIntermediateDirectories: true
        )
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: temporaryDirectory)
        temporaryDirectory = nil
    }

    func testPingUsesOnlyFixedBundleRelativeHostAndSanitizedRequest() throws {
        let bundleURL = URL(fileURLWithPath: "/tmp/Kode Injector Extension.appex")
        var invocation: NativeHostInvocation?
        let process = try GoNativeHostProcess(bundleURL: bundleURL) { value in
            invocation = value
            return NativeHostProcessResult(
                standardOutput: self.frames([
                    self.status(requestId: "safari_1"),
                ]),
                standardError: Data(),
                terminationStatus: 0
            )
        }

        let version = try process.ping(requestId: "safari_1")

        XCTAssertEqual(version, "0.9.1")
        XCTAssertEqual(
            invocation?.executableURL.path,
            "/tmp/Kode Injector Extension.appex/Contents/Helpers/kode-injector-native"
        )
        XCTAssertEqual(invocation?.arguments, [])
        XCTAssertEqual(Set(invocation?.environment.keys.map { $0 } ?? []), ["HOME", "TMPDIR"])
        let request = try XCTUnwrap(invocation?.standardInput.dropFirst(4))
        let object = try XCTUnwrap(
            JSONSerialization.jsonObject(with: request) as? [String: Any]
        )
        XCTAssertEqual(object["operation"] as? String, "ping")
        XCTAssertEqual(object["requestId"] as? String, "safari_1")
    }

    func testRejectsExecutableOutsideExpectedHelpersDirectory() {
        XCTAssertThrowsError(try GoNativeHostProcess(
            bundleURL: URL(fileURLWithPath: "/tmp/Extension.appex"),
            executableURL: URL(fileURLWithPath: "/tmp/kode-injector-native"),
            runner: { _ in fatalError("runner must not execute") }
        )) { error in
            XCTAssertEqual((error as? SafariNativeBridgeError)?.code, .internalError)
        }
    }

    func testDecodesEmptyOneAndMultipleChunkSnapshots() throws {
        let process = try makeProcess(outputs: [])

        let empty = try process.decodeSnapshot(
            self.frames([
                readStart(requestId: "empty", totalBytes: 0, chunkCount: 0),
                readComplete(requestId: "empty", totalBytes: 0, chunkCount: 0),
            ]),
            requestId: "empty"
        )
        XCTAssertEqual(empty.bytes, Data())

        let one = try process.decodeSnapshot(
            self.frames([
                readStart(requestId: "one", totalBytes: 3, chunkCount: 1),
                readChunk(requestId: "one", index: 0, bytes: Data("abc".utf8)),
                readComplete(requestId: "one", totalBytes: 3, chunkCount: 1),
            ]),
            requestId: "one"
        )
        XCTAssertEqual(one.bytes, Data("abc".utf8))

        let first = Data(repeating: 0x61, count: SafariNativeLimit.rawChunkBytes)
        let second = Data("b".utf8)
        let multiple = try process.decodeSnapshot(
            self.frames([
                readStart(
                    requestId: "multiple",
                    totalBytes: first.count + second.count,
                    chunkCount: 2
                ),
                readChunk(requestId: "multiple", index: 0, bytes: first),
                readChunk(requestId: "multiple", index: 1, bytes: second),
                readComplete(
                    requestId: "multiple",
                    totalBytes: first.count + second.count,
                    chunkCount: 2
                ),
            ]),
            requestId: "multiple"
        )
        XCTAssertEqual(multiple.bytes, first + second)
    }

    func testRejectsMalformedFrameAndChunkSequence() throws {
        let process = try makeProcess(outputs: [])
        var oversizedLength = UInt32(SafariNativeLimit.responseBytes).littleEndian
        let oversizedFrame = withUnsafeBytes(of: &oversizedLength) { Data($0) }

        assertBridgeError(.messageTooLarge) {
            _ = try process.decodeSnapshot(oversizedFrame, requestId: "bad")
        }
        assertBridgeError(.invalidFrame) {
            _ = try process.decodeSnapshot(Data([1, 0, 0]), requestId: "bad")
        }
        assertBridgeError(.invalidMessage) {
            _ = try process.decodeSnapshot(
                self.frames([Data("not-json".utf8)]),
                requestId: "bad"
            )
        }
        assertBridgeError(.invalidMessage) {
            _ = try process.decodeSnapshot(
                self.frames([
                    self.readStart(requestId: "bad", totalBytes: 1, chunkCount: 1),
                    self.readChunk(requestId: "bad", index: 1, bytes: Data("a".utf8)),
                    self.readComplete(requestId: "bad", totalBytes: 1, chunkCount: 1),
                ]),
                requestId: "bad"
            )
        }
    }

    func testMapsNativeErrorAndRejectsFailedProcess() throws {
        let nativeError = try makeProcess(outputs: [NativeHostProcessResult(
            standardOutput: frames([errorResponse(requestId: "read_1", code: "FILE_NOT_FOUND")]),
            standardError: Data(),
            terminationStatus: 0
        )])
        assertBridgeError(.fileNotFound) {
            _ = try nativeError.snapshot(fileURL: "file:///tmp/missing", requestId: "read_1")
        }

        let failed = try makeProcess(outputs: [NativeHostProcessResult(
            standardOutput: Data(),
            standardError: Data("diagnostic".utf8),
            terminationStatus: 1
        )])
        assertBridgeError(.readFailed) {
            _ = try failed.ping(requestId: "ping_1")
        }
    }

    func testRejectsChangedFileAndOutOfRangeChunk() throws {
        let first = Data("first".utf8)
        let changed = Data("changed".utf8)
        let process = try makeProcess(outputs: [
            readResult(requestId: "metadata_1", bytes: first),
            readResult(requestId: "chunk_1", bytes: changed),
        ])
        let metadata = try process.snapshot(
            fileURL: "file:///tmp/test.js",
            requestId: "metadata_1"
        )

        assertBridgeError(.fileChanged) {
            _ = try process.chunk(
                fileURL: "file:///tmp/test.js",
                expectedDigest: metadata.digest,
                chunkIndex: 0,
                requestId: "chunk_1"
            )
        }

        let stable = try makeProcess(outputs: [
            readResult(requestId: "metadata_2", bytes: first),
            readResult(requestId: "chunk_2", bytes: first),
        ])
        let stableMetadata = try stable.snapshot(
            fileURL: "file:///tmp/test.js",
            requestId: "metadata_2"
        )
        assertBridgeError(.invalidMessage) {
            _ = try stable.chunk(
                fileURL: "file:///tmp/test.js",
                expectedDigest: stableMetadata.digest,
                chunkIndex: 1,
                requestId: "chunk_2"
            )
        }
    }

    func testMaximumChunkResponseRemainsBelowOneMiB() throws {
        let response = SafariReadChunkResponse(
            requestId: "chunk_1",
            chunkIndex: 0,
            data: Data(repeating: 0x61, count: SafariNativeLimit.rawChunkBytes).base64EncodedString()
        )
        XCTAssertLessThan(
            try SafariNativeMessageCodec.encodeResponse(response).count,
            SafariNativeLimit.responseBytes
        )
    }

    func testDefaultRunnerExecutesBundleRelativeHost() throws {
        let bundleURL = try makeBundle(with: """
        /bin/cat >/dev/null
        printf '%b' '\(shellBytes(frames([status(requestId: "ping_1")])))'
        """)
        let process = try GoNativeHostProcess(bundleURL: bundleURL, timeout: 1)

        XCTAssertEqual(try process.ping(requestId: "ping_1"), "0.9.1")
    }

    func testDefaultRunnerRejectsTimeoutOversizedDiagnosticsAndEarlyEof() throws {
        let timeoutBundle = try makeBundle(with: "/bin/sleep 2")
        assertBridgeError(.readFailed) {
            _ = try GoNativeHostProcess(bundleURL: timeoutBundle, timeout: 0.05)
                .ping(requestId: "ping_1")
        }

        let diagnosticsBundle = try makeBundle(
            with: "/bin/dd if=/dev/zero bs=65537 count=1 1>&2 2>/dev/null"
        )
        assertBridgeError(.messageTooLarge) {
            _ = try GoNativeHostProcess(bundleURL: diagnosticsBundle, timeout: 1)
                .ping(requestId: "ping_1")
        }

        let earlyEofBundle = try makeBundle(with: "printf '\\001\\000\\000'")
        assertBridgeError(.invalidFrame) {
            _ = try GoNativeHostProcess(bundleURL: earlyEofBundle, timeout: 1)
                .ping(requestId: "ping_1")
        }
    }

    private func makeProcess(
        outputs: [NativeHostProcessResult]
    ) throws -> GoNativeHostProcess {
        var remaining = outputs
        return try GoNativeHostProcess(
            bundleURL: URL(fileURLWithPath: "/tmp/Extension.appex")
        ) { _ in
            guard !remaining.isEmpty else {
                XCTFail("Unexpected process invocation")
                return NativeHostProcessResult(
                    standardOutput: Data(),
                    standardError: Data(),
                    terminationStatus: 1
                )
            }
            return remaining.removeFirst()
        }
    }

    private func makeBundle(with scriptBody: String) throws -> URL {
        let bundleURL = temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
            .appendingPathExtension("appex")
        let helpersURL = bundleURL
            .appendingPathComponent("Contents", isDirectory: true)
            .appendingPathComponent("Helpers", isDirectory: true)
        try FileManager.default.createDirectory(
            at: helpersURL,
            withIntermediateDirectories: true
        )
        let executableURL = helpersURL
            .appendingPathComponent("kode-injector-native", isDirectory: false)
        try Data("#!/bin/sh\n\(scriptBody)\n".utf8).write(to: executableURL)
        try FileManager.default.setAttributes(
            [.posixPermissions: 0o700],
            ofItemAtPath: executableURL.path
        )
        return bundleURL
    }

    private func shellBytes(_ data: Data) -> String {
        data.map { String(format: "\\%03o", $0) }.joined()
    }

    private func readResult(requestId: String, bytes: Data) -> NativeHostProcessResult {
        let chunks = stride(
            from: 0,
            to: bytes.count,
            by: SafariNativeLimit.rawChunkBytes
        ).map { offset in
            bytes.subdata(in: offset..<min(offset + SafariNativeLimit.rawChunkBytes, bytes.count))
        }
        let messages = [readStart(
            requestId: requestId,
            totalBytes: bytes.count,
            chunkCount: chunks.count
        )] + chunks.enumerated().map { index, chunk in
            readChunk(requestId: requestId, index: index, bytes: chunk)
        } + [readComplete(
            requestId: requestId,
            totalBytes: bytes.count,
            chunkCount: chunks.count
        )]
        return NativeHostProcessResult(
            standardOutput: frames(messages),
            standardError: Data(),
            terminationStatus: 0
        )
    }

    private func frames(_ payloads: [Data]) -> Data {
        payloads.reduce(into: Data()) { output, payload in
            var length = UInt32(payload.count).littleEndian
            output.append(withUnsafeBytes(of: &length) { Data($0) })
            output.append(payload)
        }
    }

    private func status(requestId: String) -> Data {
        json([
            "protocolVersion": 1,
            "requestId": requestId,
            "type": "status",
            "ok": true,
            "hostVersion": "0.9.1",
        ])
    }

    private func readStart(requestId: String, totalBytes: Int, chunkCount: Int) -> Data {
        json([
            "protocolVersion": 1,
            "requestId": requestId,
            "type": "readStart",
            "ok": true,
            "totalBytes": totalBytes,
            "chunkCount": chunkCount,
        ])
    }

    private func readChunk(requestId: String, index: Int, bytes: Data) -> Data {
        json([
            "protocolVersion": 1,
            "requestId": requestId,
            "type": "readChunk",
            "ok": true,
            "chunkIndex": index,
            "data": bytes.base64EncodedString(),
        ])
    }

    private func readComplete(requestId: String, totalBytes: Int, chunkCount: Int) -> Data {
        json([
            "protocolVersion": 1,
            "requestId": requestId,
            "type": "readComplete",
            "ok": true,
            "totalBytes": totalBytes,
            "chunkCount": chunkCount,
        ])
    }

    private func errorResponse(requestId: String, code: String) -> Data {
        json([
            "protocolVersion": 1,
            "requestId": requestId,
            "type": "error",
            "ok": false,
            "error": ["code": code],
        ])
    }

    private func json(_ object: [String: Any]) -> Data {
        try! JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])
    }

    private func assertBridgeError(
        _ code: SafariNativeErrorCode,
        _ operation: () throws -> Void,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        XCTAssertThrowsError(try operation(), file: file, line: line) { error in
            XCTAssertEqual(
                (error as? SafariNativeBridgeError)?.code,
                code,
                file: file,
                line: line
            )
        }
    }
}
