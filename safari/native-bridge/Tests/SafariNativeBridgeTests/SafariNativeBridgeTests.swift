import Foundation
import XCTest
@testable import SafariNativeBridge

final class SafariNativeBridgeTests: XCTestCase {
    func testRoutesPingAndReturnsSafariResponse() throws {
        let process = try GoNativeHostProcess(
            bundleURL: URL(fileURLWithPath: "/tmp/Extension.appex")
        ) { invocation in
            let request = try XCTUnwrap(
                JSONSerialization.jsonObject(
                    with: invocation.standardInput.dropFirst(4)
                ) as? [String: Any]
            )
            let requestId = try XCTUnwrap(request["requestId"] as? String)
            return NativeHostProcessResult(
                standardOutput: self.frames([self.json([
                    "protocolVersion": 1,
                    "requestId": requestId,
                    "type": "status",
                    "ok": true,
                    "hostVersion": "0.9.1",
                ])]),
                standardError: Data(),
                terminationStatus: 0
            )
        }
        let bridge = SafariNativeBridge(process: process)

        let response = bridge.handle(message: [
            "protocolVersion": 1,
            "requestId": "ping_1",
            "operation": "ping",
        ])

        XCTAssertEqual(response["type"] as? String, "status")
        XCTAssertEqual(response["hostVersion"] as? String, "0.9.1")
        XCTAssertEqual(response["ok"] as? Bool, true)
    }

    func testReturnsClosedErrorWithoutThrowingOrEchoingInput() throws {
        let process = try GoNativeHostProcess(
            bundleURL: URL(fileURLWithPath: "/tmp/Extension.appex")
        ) { _ in
            XCTFail("Invalid messages must not launch the host")
            return NativeHostProcessResult(
                standardOutput: Data(),
                standardError: Data(),
                terminationStatus: 1
            )
        }
        let bridge = SafariNativeBridge(process: process)

        let response = bridge.handle(message: [
            "protocolVersion": 1,
            "requestId": "invalid id",
            "operation": "ping",
            "localContent": "must not be echoed",
        ])

        let error = try XCTUnwrap(response["error"] as? [String: Any])
        XCTAssertEqual(error["code"] as? String, "INVALID_MESSAGE")
        XCTAssertNil(response["localContent"])
    }

    func testPreservesRequestIdForErrorAfterValidRequestIsDecoded() throws {
        let process = try GoNativeHostProcess(
            bundleURL: URL(fileURLWithPath: "/tmp/Extension.appex")
        ) { _ in
            NativeHostProcessResult(
                standardOutput: Data(),
                standardError: Data(),
                terminationStatus: 1
            )
        }
        let bridge = SafariNativeBridge(process: process)

        let response = bridge.handle(message: [
            "protocolVersion": 1,
            "requestId": "ping_error_1",
            "operation": "ping",
        ])

        let error = try XCTUnwrap(response["error"] as? [String: Any])
        XCTAssertEqual(response["requestId"] as? String, "ping_error_1")
        XCTAssertEqual(error["code"] as? String, "READ_FAILED")
    }

    func testReturnsAuthorizationRequiredBeforeLaunchingHost() throws {
        let suiteName = "SafariNativeBridgeTests.\(UUID().uuidString)"
        let userDefaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
        defer { userDefaults.removePersistentDomain(forName: suiteName) }
        let store = FolderAuthorizationStore(userDefaults: userDefaults)
        let process = try GoNativeHostProcess(
            bundleURL: URL(fileURLWithPath: "/tmp/Extension.appex")
        ) { _ in
            XCTFail("Unauthorized paths must not launch the host")
            return NativeHostProcessResult(
                standardOutput: Data(),
                standardError: Data(),
                terminationStatus: 1
            )
        }
        let bridge = SafariNativeBridge(
            process: process,
            authorizationStore: store
        )

        let response = bridge.handle(message: [
            "protocolVersion": 1,
            "requestId": "read_auth_1",
            "operation": "readMetadata",
            "fileUrl": "file:///tmp/project/source.js",
        ])

        let error = try XCTUnwrap(response["error"] as? [String: Any])
        XCTAssertEqual(response["requestId"] as? String, "read_auth_1")
        XCTAssertEqual(error["code"] as? String, "AUTHORIZATION_REQUIRED")
    }

    func testReadMetadataReusesOnlyAnUnchangedFileSnapshot() throws {
        let content = Data("console.log('cached')".utf8)
        var hostLaunchCount = 0
        var fingerprint = makeFingerprint(
            size: content.count,
            modificationNanoseconds: 1
        )
        let process = try GoNativeHostProcess(
            bundleURL: URL(fileURLWithPath: "/tmp/Extension.appex")
        ) { invocation in
            hostLaunchCount += 1
            let request = try XCTUnwrap(
                JSONSerialization.jsonObject(
                    with: invocation.standardInput.dropFirst(4)
                ) as? [String: Any]
            )
            let requestId = try XCTUnwrap(request["requestId"] as? String)
            return self.readSnapshotResult(requestId: requestId, content: content)
        }
        let bridge = SafariNativeBridge(
            process: process,
            snapshotCache: SafariSnapshotCache(),
            fileFingerprint: { _ in fingerprint }
        )

        let first = bridge.handle(message: readMetadataRequest(requestId: "cache_1"))
        let second = bridge.handle(message: readMetadataRequest(requestId: "cache_2"))

        XCTAssertEqual(first["ok"] as? Bool, true)
        XCTAssertEqual(second["ok"] as? Bool, true)
        XCTAssertEqual(hostLaunchCount, 1)

        fingerprint = makeFingerprint(
            size: content.count,
            modificationNanoseconds: 2
        )
        let changed = bridge.handle(message: readMetadataRequest(requestId: "cache_3"))

        XCTAssertEqual(changed["ok"] as? Bool, true)
        XCTAssertEqual(hostLaunchCount, 2)
    }

    func testRunsExplicitAuthorizationPromptAndReturnsClosedSuccess() throws {
        let suiteName = "SafariNativeBridgeTests.\(UUID().uuidString)"
        let userDefaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
        defer { userDefaults.removePersistentDomain(forName: suiteName) }
        let bridge = SafariNativeBridge(
            process: nil,
            authorizationStore: FolderAuthorizationStore(userDefaults: userDefaults)
        )
        var promptCount = 0
        let fileURL = FileManager.default.temporaryDirectory.appendingPathComponent("test.js")

        let response = bridge.handle(message: [
            "protocolVersion": 1,
            "requestId": "authorize_1",
            "operation": "authorizeFolder",
            "fileUrl": fileURL.absoluteString,
        ]) { promptedFileURL in
            XCTAssertEqual(promptedFileURL.standardizedFileURL, fileURL.standardizedFileURL)
            promptCount += 1
            return true
        }

        XCTAssertEqual(promptCount, 1)
        XCTAssertEqual(response["requestId"] as? String, "authorize_1")
        XCTAssertEqual(response["type"] as? String, "authorization")
        XCTAssertEqual(response["ok"] as? Bool, true)
    }

    func testReturnsClosedErrorWhenAuthorizationIsCancelled() throws {
        let suiteName = "SafariNativeBridgeTests.\(UUID().uuidString)"
        let userDefaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
        defer { userDefaults.removePersistentDomain(forName: suiteName) }
        let bridge = SafariNativeBridge(
            process: nil,
            authorizationStore: FolderAuthorizationStore(userDefaults: userDefaults)
        )
        let fileURL = FileManager.default.temporaryDirectory.appendingPathComponent("test.js")

        let response = bridge.handle(message: [
            "protocolVersion": 1,
            "requestId": "authorize_cancel_1",
            "operation": "authorizeFolder",
            "fileUrl": fileURL.absoluteString,
        ]) { _ in
            false
        }

        let error = try XCTUnwrap(response["error"] as? [String: Any])
        XCTAssertEqual(response["requestId"] as? String, "authorize_cancel_1")
        XCTAssertEqual(error["code"] as? String, "AUTHORIZATION_CANCELLED")
    }

    private func frames(_ payloads: [Data]) -> Data {
        payloads.reduce(into: Data()) { output, payload in
            var length = UInt32(payload.count).littleEndian
            output.append(withUnsafeBytes(of: &length) { Data($0) })
            output.append(payload)
        }
    }

    private func json(_ object: [String: Any]) -> Data {
        try! JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])
    }

    private func readMetadataRequest(requestId: String) -> [String: Any] {
        [
            "protocolVersion": 1,
            "requestId": requestId,
            "operation": "readMetadata",
            "fileUrl": "file:///tmp/cached.js",
        ]
    }

    private func readSnapshotResult(
        requestId: String,
        content: Data
    ) -> NativeHostProcessResult {
        NativeHostProcessResult(
            standardOutput: frames([
                json([
                    "protocolVersion": 1,
                    "requestId": requestId,
                    "type": "readStart",
                    "ok": true,
                    "totalBytes": content.count,
                    "chunkCount": 1,
                ]),
                json([
                    "protocolVersion": 1,
                    "requestId": requestId,
                    "type": "readChunk",
                    "ok": true,
                    "chunkIndex": 0,
                    "data": content.base64EncodedString(),
                ]),
                json([
                    "protocolVersion": 1,
                    "requestId": requestId,
                    "type": "readComplete",
                    "ok": true,
                    "totalBytes": content.count,
                    "chunkCount": 1,
                ]),
            ]),
            standardError: Data(),
            terminationStatus: 0
        )
    }

    private func makeFingerprint(
        size: Int,
        modificationNanoseconds: Int64
    ) -> SafariFileFingerprint {
        SafariFileFingerprint(
            device: 1,
            inode: 2,
            size: Int64(size),
            modificationSeconds: 3,
            modificationNanoseconds: modificationNanoseconds,
            statusChangeSeconds: 4,
            statusChangeNanoseconds: 5
        )
    }
}
