import Foundation
import XCTest
@testable import SafariNativeBridge

final class FolderAuthorizationStoreTests: XCTestCase {
    private var suiteName: String!
    private var userDefaults: UserDefaults!

    override func setUp() {
        super.setUp()
        suiteName = "FolderAuthorizationStoreTests.\(UUID().uuidString)"
        userDefaults = UserDefaults(suiteName: suiteName)
        userDefaults.removePersistentDomain(forName: suiteName)
    }

    override func tearDown() {
        userDefaults.removePersistentDomain(forName: suiteName)
        userDefaults = nil
        suiteName = nil
        super.tearDown()
    }

    func testMissingAuthorizationDoesNotReadOrPersistTheFileURL() throws {
        let store = FolderAuthorizationStore(userDefaults: userDefaults)
        var didRead = false

        XCTAssertThrowsError(try store.withAccess(to: "file:///tmp/project/source.js") { _ in
            didRead = true
        }) { error in
            XCTAssertEqual(error as? FolderAuthorizationError, .authorizationRequired)
        }

        XCTAssertFalse(didRead)
        XCTAssertNil(userDefaults.persistentDomain(forName: suiteName))
    }

    func testRejectsRemoteAndMalformedURLsWithoutRecordingRequest() throws {
        let store = FolderAuthorizationStore(userDefaults: userDefaults)

        XCTAssertThrowsError(try store.withAccess(
            to: "https://example.com/source.js",
            operation: { _ in }
        )) { error in
            XCTAssertEqual(error as? FolderAuthorizationError, .invalidFileURL)
        }
        XCTAssertThrowsError(try store.withAccess(
            to: "file://example.com/source.js",
            operation: { _ in }
        )) { error in
            XCTAssertEqual(error as? FolderAuthorizationError, .remoteFileURL)
        }
        XCTAssertThrowsError(try store.withAccess(
            to: "file://localhost/tmp/source.js",
            operation: { _ in }
        )) { error in
            XCTAssertEqual(error as? FolderAuthorizationError, .remoteFileURL)
        }
        for invalidURL in [
            "file:///tmp/source.js?variant=one",
            "file:///tmp/source.js#fragment",
            "file:///tmp/source%00.js",
        ] {
            XCTAssertThrowsError(try store.withAccess(
                to: invalidURL,
                operation: { _ in }
            )) { error in
                XCTAssertEqual(error as? FolderAuthorizationError, .invalidFileURL)
            }
        }
        XCTAssertNil(userDefaults.persistentDomain(forName: suiteName))
    }

    func testFolderContainmentUsesPathComponents() {
        let folder = URL(fileURLWithPath: "/tmp/project", isDirectory: true)

        XCTAssertTrue(FolderAuthorizationStore.contains(
            folderURL: folder,
            fileURL: URL(fileURLWithPath: "/tmp/project/source.js")
        ))
        XCTAssertFalse(FolderAuthorizationStore.contains(
            folderURL: folder,
            fileURL: URL(fileURLWithPath: "/tmp/project-other/source.js")
        ))
    }

    func testFolderSelectionMustMatchTheExactRequiredFolder() {
        let required = URL(fileURLWithPath: "/tmp/project/scripts", isDirectory: true)

        XCTAssertTrue(FolderAuthorizationStore.isExactFolderSelection(
            selectedFolderURL: required,
            requiredFolderURL: required
        ))
        XCTAssertFalse(FolderAuthorizationStore.isExactFolderSelection(
            selectedFolderURL: required.deletingLastPathComponent(),
            requiredFolderURL: required
        ))
        XCTAssertFalse(FolderAuthorizationStore.isExactFolderSelection(
            selectedFolderURL: required.appendingPathComponent("nested", isDirectory: true),
            requiredFolderURL: required
        ))
    }

    func testAuthorizationTargetsOnlyTheImmediateExistingFolder() throws {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let nested = root.appendingPathComponent("nested", isDirectory: true)
        try FileManager.default.createDirectory(
            at: nested,
            withIntermediateDirectories: true
        )
        defer { try? FileManager.default.removeItem(at: root) }
        let store = FolderAuthorizationStore(userDefaults: userDefaults)
        let fileURL = nested.appendingPathComponent("future.js")

        XCTAssertEqual(
            try store.authorizationTarget(for: fileURL.absoluteString),
            fileURL.standardizedFileURL
        )

        let encodedSeparatorURL = root.absoluteString
            + "nested%2Ffuture.js"
        XCTAssertEqual(
            try store.authorizationTarget(for: encodedSeparatorURL),
            fileURL.standardizedFileURL
        )

        let missing = nested
            .appendingPathComponent("missing", isDirectory: true)
            .appendingPathComponent("future.js")
        XCTAssertThrowsError(try store.authorizationTarget(for: missing.absoluteString)) { error in
            XCTAssertEqual(
                error as? FolderAuthorizationError,
                .authorizationTargetNotFound
            )
        }
    }

    func testPersistsBookmarksAndUsesLRUEvictionAtThe64FolderCap() throws {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }

        let store = FolderAuthorizationStore(userDefaults: userDefaults)
        var folders: [URL] = []
        for index in 0..<64 {
            let folder = root.appendingPathComponent("scope-\(index)", isDirectory: true)
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            try store.saveAuthorization(for: folder)
            folders.append(folder.standardizedFileURL)
        }

        let reopened = FolderAuthorizationStore(userDefaults: userDefaults)
        XCTAssertEqual(try reopened.authorizedFolderURLs().count, 64)
        XCTAssertTrue(reopened.isAuthorized(
            fileURL: folders[0].appendingPathComponent("source.js")
        ))

        let extra = root.appendingPathComponent("scope-extra", isDirectory: true)
        try FileManager.default.createDirectory(at: extra, withIntermediateDirectories: true)
        try reopened.saveAuthorization(for: extra)

        let authorized = try reopened.authorizedFolderURLs().map(\.standardizedFileURL)
        XCTAssertEqual(authorized.count, 64)
        XCTAssertTrue(authorized.contains(folders[0]))
        XCTAssertFalse(authorized.contains(folders[1]))
        XCTAssertTrue(authorized.contains(extra.standardizedFileURL))
    }
}
