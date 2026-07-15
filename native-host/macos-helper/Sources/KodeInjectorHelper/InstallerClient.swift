import Darwin
import Foundation

protocol InstallerRunning: Sendable {
    func run(_ action: InstallerAction) async throws -> LifecycleResponse
}

struct InstallerTimeout: Equatable, Sendable {
    let timeInterval: TimeInterval

    static func seconds(_ value: Int) -> InstallerTimeout {
        InstallerTimeout(timeInterval: TimeInterval(value))
    }

    static func milliseconds(_ value: Int) -> InstallerTimeout {
        InstallerTimeout(timeInterval: TimeInterval(value) / 1_000)
    }
}

struct InstallerClient: InstallerRunning, Sendable {
    static let maximumOutputBytes = 64 * 1_024
    static let defaultTimeout: InstallerTimeout = .seconds(30)

    let helperURL: URL
    let timeout: InstallerTimeout

    init(
        helperURL: URL,
        timeout: InstallerTimeout = InstallerClient.defaultTimeout
    ) {
        self.helperURL = helperURL
        self.timeout = timeout
    }

    static func bundled(
        bundleURL: URL = Bundle.main.bundleURL,
        timeout: InstallerTimeout = defaultTimeout
    ) -> InstallerClient {
        InstallerClient(
            helperURL: bundledHelperURL(bundleURL: bundleURL),
            timeout: timeout
        )
    }

    static func bundledHelperURL(bundleURL: URL) -> URL {
        bundleURL
            .appendingPathComponent("Contents", isDirectory: true)
            .appendingPathComponent("Helpers", isDirectory: true)
            .appendingPathComponent("kode-injector-installer", isDirectory: false)
    }

    func run(_ action: InstallerAction) async throws -> LifecycleResponse {
        try await Task.detached {
            try runSynchronously(action)
        }.value
    }

    private func runSynchronously(_ action: InstallerAction) throws -> LifecycleResponse {
        let process = Process()
        process.executableURL = helperURL
        process.arguments = ["application", action.rawValue, "--json"]
        process.environment = [
            "HOME": FileManager.default.homeDirectoryForCurrentUser.path,
            "TMPDIR": NSTemporaryDirectory(),
        ]

        let standardOutput = BoundedPipeCapture(
            maximumBytes: Self.maximumOutputBytes
        )
        let standardError = BoundedPipeCapture(
            maximumBytes: Self.maximumOutputBytes
        )
        process.standardOutput = standardOutput.pipe
        process.standardError = standardError.pipe

        do {
            try process.run()
        } catch {
            throw InstallerClientError.launchFailed(String(describing: error))
        }

        standardOutput.start()
        standardError.start()

        let deadline = Date().addingTimeInterval(max(0, timeout.timeInterval))
        while process.isRunning, Date() < deadline {
            Thread.sleep(forTimeInterval: 0.005)
        }
        let timedOut = process.isRunning
        if timedOut {
            terminate(process)
        } else {
            process.waitUntilExit()
        }

        standardOutput.waitUntilFinished()
        standardError.waitUntilFinished()

        if timedOut {
            throw InstallerClientError.timedOut
        }
        if standardOutput.exceededLimit {
            throw InstallerClientError.outputLimitExceeded(.standardOutput)
        }
        if standardError.exceededLimit {
            throw InstallerClientError.outputLimitExceeded(.standardError)
        }

        let response: LifecycleResponse
        do {
            response = try LifecycleResponse.decodeValidated(standardOutput.data)
        } catch let error as InstallerClientError {
            throw error
        } catch {
            throw InstallerClientError.malformedResponse
        }

        guard response.action == action else {
            throw InstallerClientError.invalidResponse
        }
        let exitedSuccessfully = process.terminationReason == .exit
            && process.terminationStatus == 0
        guard response.success == exitedSuccessfully else {
            throw InstallerClientError.exitStatusMismatch
        }
        return response
    }

    private func terminate(_ process: Process) {
        if process.isRunning {
            process.terminate()
        }
        let gracefulDeadline = Date().addingTimeInterval(0.5)
        while process.isRunning, Date() < gracefulDeadline {
            Thread.sleep(forTimeInterval: 0.005)
        }
        if process.isRunning {
            Darwin.kill(process.processIdentifier, SIGKILL)
            process.waitUntilExit()
        }
    }
}

private final class BoundedPipeCapture: @unchecked Sendable {
    let pipe = Pipe()

    private let maximumBytes: Int
    private let queue = DispatchQueue(
        label: "dev.maximtop.kode-injector.helper.output",
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
