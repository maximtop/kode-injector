import Foundation
import XCTest

@testable import KodeInjectorHelper

final class InstallerClientTests: XCTestCase {
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

    func testUsesOnlyFixedArgumentsAndSanitizedEnvironment() async throws {
        let recordURL = temporaryDirectory.appendingPathComponent("invocation.txt")
        let executableURL = try makeExecutable(
            body: """
            {
              printf 'arg-count=%s\\n' "$#"
              printf 'arg-1=%s\\n' "$1"
              printf 'arg-2=%s\\n' "$2"
              printf 'arg-3=%s\\n' "$3"
              printf 'path=%s\\n' "$PATH"
              printf 'edge-id-set=%s\\n' "${KODE_INJECTOR_EDGE_ID+x}"
              printf 'home=%s\\n' "$HOME"
              printf 'tmpdir=%s\\n' "$TMPDIR"
            } > \(shellQuote(recordURL.path))
            printf '%s\\n' \(shellQuote(successResponse(action: "install")))
            """
        )
        let client = InstallerClient(helperURL: executableURL, timeout: .seconds(2))

        let response = try await client.run(.install)

        XCTAssertTrue(response.success)
        let record = try String(contentsOf: recordURL, encoding: .utf8)
        XCTAssertTrue(record.contains("arg-count=3\n"))
        XCTAssertTrue(record.contains("arg-1=application\n"))
        XCTAssertTrue(record.contains("arg-2=install\n"))
        XCTAssertTrue(record.contains("arg-3=--json\n"))
        XCTAssertFalse(
            record.contains("path=\(ProcessInfo.processInfo.environment["PATH"] ?? "")\n")
        )
        XCTAssertTrue(record.contains("edge-id-set=\n"))
        XCTAssertTrue(
            record.contains("home=\(FileManager.default.homeDirectoryForCurrentUser.path)\n")
        )
        XCTAssertTrue(record.contains("tmpdir=\(NSTemporaryDirectory())\n"))
    }

    func testResolvesOnlyTheBundleRelativeInstaller() {
        let bundleURL = URL(fileURLWithPath: "/Applications/Kode Injector Helper.app")
        let renamedBundleURL = URL(fileURLWithPath: "/Applications/My Local Files Helper.app")

        XCTAssertEqual(
            InstallerClient.bundledHelperURL(bundleURL: bundleURL).path,
            "/Applications/Kode Injector Helper.app/Contents/Helpers/kode-injector-installer"
        )
        XCTAssertEqual(
            InstallerClient.bundledHelperURL(bundleURL: renamedBundleURL).path,
            "/Applications/My Local Files Helper.app/Contents/Helpers/kode-injector-installer"
        )
    }

    func testAcceptsMatchingStructuredFailureAndExitStatus() async throws {
        let executableURL = try makeExecutable(
            body: """
            printf '%s\\n' \(shellQuote(failureResponse(action: "uninstall")))
            exit 1
            """
        )
        let client = InstallerClient(helperURL: executableURL, timeout: .seconds(2))

        let response = try await client.run(.uninstall)

        XCTAssertFalse(response.success)
        XCTAssertEqual(response.error?.code, .uninstallFailed)
    }

    func testRejectsOversizedStandardOutput() async throws {
        let executableURL = try makeExecutable(
            body: "/bin/dd if=/dev/zero bs=65537 count=1 2>/dev/null"
        )
        let client = InstallerClient(helperURL: executableURL, timeout: .seconds(2))

        await XCTAssertThrowsErrorAsync(try await client.run(.status)) { error in
            XCTAssertEqual(
                error as? InstallerClientError,
                .outputLimitExceeded(.standardOutput)
            )
        }
    }

    func testRejectsOversizedStandardError() async throws {
        let executableURL = try makeExecutable(
            body: """
            /bin/dd if=/dev/zero bs=65537 count=1 1>&2 2>/dev/null
            printf '%s\\n' \(shellQuote(successResponse(action: "status")))
            """
        )
        let client = InstallerClient(helperURL: executableURL, timeout: .seconds(2))

        await XCTAssertThrowsErrorAsync(try await client.run(.status)) { error in
            XCTAssertEqual(
                error as? InstallerClientError,
                .outputLimitExceeded(.standardError)
            )
        }
    }

    func testTerminatesAfterTimeout() async throws {
        let executableURL = try makeExecutable(body: "/bin/sleep 2")
        let client = InstallerClient(helperURL: executableURL, timeout: .milliseconds(100))
        let started = Date()

        await XCTAssertThrowsErrorAsync(try await client.run(.status)) { error in
            XCTAssertEqual(error as? InstallerClientError, .timedOut)
        }

        XCTAssertLessThan(Date().timeIntervalSince(started), 1)
    }

    func testRejectsMalformedJSONAndUnknownContract() async throws {
        let malformedURL = try makeExecutable(body: "printf 'not-json\\n'")
        let unknownContractURL = try makeExecutable(
            body: "printf '%s\\n' \(shellQuote(successResponse(action: "status", contractVersion: 2)))"
        )

        await XCTAssertThrowsErrorAsync(
            try await InstallerClient(helperURL: malformedURL, timeout: .seconds(2)).run(.status)
        ) { error in
            XCTAssertEqual(error as? InstallerClientError, .malformedResponse)
        }
        await XCTAssertThrowsErrorAsync(
            try await InstallerClient(helperURL: unknownContractURL, timeout: .seconds(2)).run(.status)
        ) { error in
            XCTAssertEqual(error as? InstallerClientError, .unsupportedContract)
        }
    }

    func testRejectsSuccessAndExitStatusMismatch() async throws {
        let successfulFailureExit = try makeExecutable(
            body: """
            printf '%s\\n' \(shellQuote(successResponse(action: "status")))
            exit 1
            """
        )
        let failedSuccessExit = try makeExecutable(
            body: "printf '%s\\n' \(shellQuote(failureResponse(action: "status")))"
        )

        for executableURL in [successfulFailureExit, failedSuccessExit] {
            await XCTAssertThrowsErrorAsync(
                try await InstallerClient(helperURL: executableURL, timeout: .seconds(2)).run(.status)
            ) { error in
                XCTAssertEqual(error as? InstallerClientError, .exitStatusMismatch)
            }
        }
    }

    private func makeExecutable(body: String) throws -> URL {
        let executableURL = temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: false)
        try Data("#!/bin/sh\n\(body)\n".utf8).write(to: executableURL)
        try FileManager.default.setAttributes(
            [.posixPermissions: 0o700],
            ofItemAtPath: executableURL.path
        )
        return executableURL
    }

    private func successResponse(
        action: String,
        contractVersion: Int = LifecycleResponse.contractVersion
    ) -> String {
        #"{"contractVersion":\#(contractVersion),"action":"\#(action)","success":true,"packageVersion":"0.8.2","installation":{"state":"ready","host":{"state":"ready","path":"/Applications/Kode Injector Helper.app/Contents/Helpers/kode-injector-native"},"registrations":[{"browser":"firefox","state":"registered","manifestPath":"/tmp/firefox.json","registeredHostPath":"/Applications/Kode Injector Helper.app/Contents/Helpers/kode-injector-native"},{"browser":"chrome","state":"registered","manifestPath":"/tmp/chrome.json","registeredHostPath":"/Applications/Kode Injector Helper.app/Contents/Helpers/kode-injector-native"},{"browser":"edge","state":"registered","manifestPath":"/tmp/edge.json","registeredHostPath":"/Applications/Kode Injector Helper.app/Contents/Helpers/kode-injector-native"}],"legacySupportPresent":false}}"#
    }

    private func failureResponse(action: String) -> String {
        #"{"contractVersion":1,"action":"\#(action)","success":false,"packageVersion":"0.8.2","error":{"code":"uninstallFailed","message":"The registrations could not be removed."}}"#
    }

    private func shellQuote(_ value: String) -> String {
        "'\(value.replacingOccurrences(of: "'", with: "'\\''"))'"
    }
}

private func XCTAssertThrowsErrorAsync<T>(
    _ expression: @autoclosure () async throws -> T,
    _ errorHandler: (Error) -> Void = { _ in }
) async {
    do {
        _ = try await expression()
        XCTFail("Expected expression to throw")
    } catch {
        errorHandler(error)
    }
}
