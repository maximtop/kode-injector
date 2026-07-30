import Foundation

/// Closed failures produced while validating or persisting folder authorization.
public enum FolderAuthorizationError: Error, Equatable {
    /// The source is not a valid absolute local file URL.
    case invalidFileURL
    /// The source file URL contains a non-empty remote host.
    case remoteFileURL
    /// No usable bookmark contains the requested source.
    case authorizationRequired
    /// The source's immediate parent folder does not exist.
    case authorizationTargetNotFound
    /// Bookmark persistence is unavailable.
    case storageUnavailable
    /// The selected authorization target is not a directory.
    case invalidFolder
    /// A bounded read-only bookmark could not be created.
    case bookmarkFailed
}

/// Stores bounded read-only security-scoped bookmarks for local source folders.
public final class FolderAuthorizationStore {
    private static let bookmarksKey = "authorized-folder-bookmarks-v1"
    private static let maximumBookmarks = 64
    private static let maximumBookmarkBytes = 128 * 1024

    private let userDefaults: UserDefaults?

    /// Creates a store backed by the extension's standard user defaults.
    public convenience init() {
        self.init(userDefaults: .standard)
    }

    init(userDefaults: UserDefaults?) {
        self.userDefaults = userDefaults
    }

    /// Runs an operation while a containing folder's security scope is active.
    ///
    /// - Parameters:
    ///   - rawFileURL: Untrusted local source URL from the WebExtension.
    ///   - operation: Read-only operation receiving the validated canonical URL.
    /// - Returns: The operation's result.
    /// - Throws: `FolderAuthorizationError` when the URL or authorization is invalid,
    ///   or any error thrown by `operation`.
    public func withAccess<T>(
        to rawFileURL: String,
        operation: (URL) throws -> T
    ) throws -> T {
        let fileURL = try Self.validatedFileURL(rawFileURL)
        guard let userDefaults else {
            throw FolderAuthorizationError.storageUnavailable
        }

        for (index, bookmark) in storedBookmarks(userDefaults: userDefaults).enumerated() {
            var isStale = false
            guard let folderURL = try? URL(
                resolvingBookmarkData: bookmark,
                options: [.withSecurityScope, .withoutUI],
                relativeTo: nil,
                bookmarkDataIsStale: &isStale
            ), Self.contains(folderURL: folderURL, fileURL: fileURL) else {
                continue
            }

            guard folderURL.startAccessingSecurityScopedResource() else {
                continue
            }
            defer {
                folderURL.stopAccessingSecurityScopedResource()
            }

            let refreshed = isStale
                ? (try? Self.makeBookmark(for: folderURL))
                : nil
            touchBookmark(
                at: index,
                replacement: refreshed ?? bookmark,
                userDefaults: userDefaults
            )
            return try operation(fileURL)
        }

        throw FolderAuthorizationError.authorizationRequired
    }

    /// Validates a source and confirms that its immediate parent folder exists.
    ///
    /// - Parameter rawFileURL: Untrusted local source URL from the WebExtension.
    /// - Returns: Canonical file URL used to derive the exact folder shown in the picker.
    /// - Throws: `FolderAuthorizationError` for an invalid URL or missing parent folder.
    public func authorizationTarget(for rawFileURL: String) throws -> URL {
        let fileURL = try Self.validatedFileURL(rawFileURL)
        let folderURL = fileURL.deletingLastPathComponent().standardizedFileURL
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(
            atPath: folderURL.path,
            isDirectory: &isDirectory
        ), isDirectory.boolValue else {
            throw FolderAuthorizationError.authorizationTargetNotFound
        }
        return fileURL
    }

    /// Checks whether a usable stored bookmark contains a source URL.
    ///
    /// Stale bookmarks are refreshed and successful entries are touched for LRU order.
    ///
    /// - Parameter fileURL: Validated source URL to check.
    /// - Returns: Whether read-only access can currently be started.
    public func isAuthorized(fileURL: URL) -> Bool {
        guard let userDefaults else {
            return false
        }
        for (index, bookmark) in storedBookmarks(userDefaults: userDefaults).enumerated() {
            var isStale = false
            guard let folderURL = try? URL(
                resolvingBookmarkData: bookmark,
                options: [.withSecurityScope, .withoutUI],
                relativeTo: nil,
                bookmarkDataIsStale: &isStale
            ), Self.contains(folderURL: folderURL, fileURL: fileURL) else {
                continue
            }
            guard folderURL.startAccessingSecurityScopedResource() else {
                continue
            }
            folderURL.stopAccessingSecurityScopedResource()
            let refreshed = isStale
                ? (try? Self.makeBookmark(for: folderURL))
                : nil
            touchBookmark(
                at: index,
                replacement: refreshed ?? bookmark,
                userDefaults: userDefaults
            )
            return true
        }
        return false
    }

    /// Persists a bounded read-only bookmark for one exact folder.
    ///
    /// Existing duplicates are replaced and the oldest entry is evicted above the cap.
    ///
    /// - Parameter folderURL: Exact directory explicitly approved by the user.
    /// - Throws: `FolderAuthorizationError` when storage, validation, or bookmarking fails.
    public func saveAuthorization(for folderURL: URL) throws {
        guard let userDefaults else {
            throw FolderAuthorizationError.storageUnavailable
        }
        let values = try folderURL.resourceValues(forKeys: [.isDirectoryKey])
        guard values.isDirectory == true else {
            throw FolderAuthorizationError.invalidFolder
        }

        let bookmark = try Self.makeBookmark(for: folderURL)
        var bookmarks = storedBookmarks(userDefaults: userDefaults).filter { existing in
            var isStale = false
            guard let existingURL = try? URL(
                resolvingBookmarkData: existing,
                options: [.withSecurityScope, .withoutUI],
                relativeTo: nil,
                bookmarkDataIsStale: &isStale
            ) else {
                return false
            }
            return existingURL.standardizedFileURL != folderURL.standardizedFileURL
        }
        bookmarks.append(bookmark)
        if bookmarks.count > Self.maximumBookmarks {
            bookmarks.removeFirst(bookmarks.count - Self.maximumBookmarks)
        }
        userDefaults.set(bookmarks, forKey: Self.bookmarksKey)
    }

    /// Resolves all currently stored bookmarks for diagnostics and tests.
    ///
    /// - Returns: Canonical folder URLs for bookmarks that still resolve.
    /// - Throws: `FolderAuthorizationError.storageUnavailable` without persistence.
    public func authorizedFolderURLs() throws -> [URL] {
        guard let userDefaults else {
            throw FolderAuthorizationError.storageUnavailable
        }
        return storedBookmarks(userDefaults: userDefaults).compactMap { bookmark in
            var isStale = false
            return try? URL(
                resolvingBookmarkData: bookmark,
                options: [.withSecurityScope, .withoutUI],
                relativeTo: nil,
                bookmarkDataIsStale: &isStale
            ).standardizedFileURL
        }
    }

    /// Parses an untrusted URL with the same single percent-decoding semantics as Go.
    ///
    /// - Parameter rawURL: Raw source URL received over native messaging.
    /// - Returns: Canonical absolute local file URL.
    /// - Throws: `FolderAuthorizationError` for malformed or remote URLs.
    static func validatedFileURL(_ rawURL: String) throws -> URL {
        guard let components = URLComponents(string: rawURL),
              components.scheme?.lowercased() == "file",
              components.user == nil,
              components.password == nil,
              components.port == nil,
              components.percentEncodedQuery == nil,
              components.percentEncodedFragment == nil,
              let decodedPath = components.percentEncodedPath.removingPercentEncoding,
              decodedPath.hasPrefix("/"),
              !decodedPath.contains("\0") else {
            throw FolderAuthorizationError.invalidFileURL
        }
        guard (components.host ?? "").isEmpty else {
            throw FolderAuthorizationError.remoteFileURL
        }
        return URL(fileURLWithPath: decodedPath).standardizedFileURL
    }

    /// Checks path-component containment without accepting string-prefix siblings.
    static func contains(folderURL: URL, fileURL: URL) -> Bool {
        let folderComponents = folderURL.standardizedFileURL.pathComponents
        let fileComponents = fileURL.standardizedFileURL.pathComponents
        guard folderComponents.count <= fileComponents.count else {
            return false
        }
        return zip(folderComponents, fileComponents).allSatisfy { pair in
            pair.0 == pair.1
        }
    }

    /// Checks that the picker returned exactly the required folder.
    static func isExactFolderSelection(
        selectedFolderURL: URL,
        requiredFolderURL: URL
    ) -> Bool {
        selectedFolderURL.standardizedFileURL == requiredFolderURL.standardizedFileURL
    }

    private static func makeBookmark(for folderURL: URL) throws -> Data {
        do {
            let bookmark = try folderURL.bookmarkData(
                options: [.withSecurityScope, .securityScopeAllowOnlyReadAccess],
                includingResourceValuesForKeys: [.isDirectoryKey],
                relativeTo: nil
            )
            guard bookmark.count <= maximumBookmarkBytes else {
                throw FolderAuthorizationError.bookmarkFailed
            }
            return bookmark
        } catch let error as FolderAuthorizationError {
            throw error
        } catch {
            throw FolderAuthorizationError.bookmarkFailed
        }
    }

    private func storedBookmarks(userDefaults: UserDefaults) -> [Data] {
        guard let bookmarks = userDefaults.array(forKey: Self.bookmarksKey) as? [Data] else {
            return []
        }
        return Array(bookmarks
            .filter { $0.count <= Self.maximumBookmarkBytes }
            .prefix(Self.maximumBookmarks))
    }

    private func touchBookmark(
        at index: Int,
        replacement: Data,
        userDefaults: UserDefaults
    ) {
        var bookmarks = storedBookmarks(userDefaults: userDefaults)
        guard bookmarks.indices.contains(index) else {
            return
        }
        bookmarks.remove(at: index)
        bookmarks.append(replacement)
        userDefaults.set(bookmarks, forKey: Self.bookmarksKey)
    }
}
