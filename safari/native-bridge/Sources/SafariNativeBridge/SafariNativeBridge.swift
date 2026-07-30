import Foundation
import OSLog
import SafariServices

/// Validates Safari messages and coordinates authorization, caching, and helper reads.
public final class SafariNativeBridge {
    private static let logger = Logger(
        subsystem: "dev.maximtop.kode-injector.safari",
        category: "native-bridge"
    )
    private let process: GoNativeHostProcess?
    private let authorizationStore: FolderAuthorizationStore?
    private let snapshotCache: SafariSnapshotCache
    private let fileFingerprint: (URL) -> SafariFileFingerprint?

    /// Creates the production bridge using the fixed helper inside the current bundle.
    ///
    /// - Parameter bundleURL: App-extension bundle containing `Contents/Helpers`.
    public convenience init(bundleURL: URL = Bundle.main.bundleURL) {
        self.init(
            process: try? GoNativeHostProcess(bundleURL: bundleURL),
            authorizationStore: FolderAuthorizationStore(),
            snapshotCache: SafariSnapshotCache(),
            fileFingerprint: SafariFileFingerprint.read
        )
    }

    init(
        process: GoNativeHostProcess?,
        authorizationStore: FolderAuthorizationStore? = nil,
        snapshotCache: SafariSnapshotCache = SafariSnapshotCache(),
        fileFingerprint: @escaping (URL) -> SafariFileFingerprint? = SafariFileFingerprint.read
    ) {
        self.process = process
        self.authorizationStore = authorizationStore
        self.snapshotCache = snapshotCache
        self.fileFingerprint = fileFingerprint
    }

    /// Handles one Safari extension context and completes it with a closed response.
    ///
    /// - Parameters:
    ///   - context: Safari native-message extension context.
    ///   - authorizationPrompt: Explicit user-driven folder prompt used only by
    ///     `authorizeFolder` requests.
    public func handle(
        context: NSExtensionContext,
        authorizationPrompt: ((URL) throws -> Bool)? = nil
    ) {
        let input = context.inputItems.first as? NSExtensionItem
        let message = input?.userInfo?[SFExtensionMessageKey]
        let response = NSExtensionItem()
        response.userInfo = [
            SFExtensionMessageKey: handle(
                message: message,
                authorizationPrompt: authorizationPrompt
            ),
        ]
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }

    func handle(
        message: Any?,
        authorizationPrompt: ((URL) throws -> Bool)? = nil
    ) -> [String: Any] {
        let startedAt = ProcessInfo.processInfo.systemUptime
        var requestId: String?
        var operation: SafariNativeOperation?
        do {
            guard let message,
                  JSONSerialization.isValidJSONObject(message) else {
                throw SafariNativeBridgeError(code: .invalidMessage)
            }
            let data = try JSONSerialization.data(withJSONObject: message)
            let request = try SafariNativeMessageCodec.decodeRequest(data)
            requestId = request.requestId
            operation = request.operation
            Self.logger.notice(
                "Request started: \(request.operation.rawValue, privacy: .public)"
            )
            let responseData: Data
            switch request.operation {
            case .ping:
                guard let process else {
                    throw SafariNativeBridgeError(code: .internalError)
                }
                let hostVersion = try process.ping(requestId: request.requestId)
                responseData = try SafariNativeMessageCodec.encodeResponse(
                    SafariStatusResponse(
                        requestId: request.requestId,
                        hostVersion: hostVersion
                    )
                )
            case .readMetadata:
                guard let process else {
                    throw SafariNativeBridgeError(code: .internalError)
                }
                guard let fileURL = request.fileUrl else {
                    throw SafariNativeBridgeError(code: .invalidMessage)
                }
                let snapshot = try withAuthorizedAccess(to: fileURL) { authorizedURL in
                    let cacheKey = authorizedURL.absoluteString
                    let fingerprintBeforeRead = self.fileFingerprint(authorizedURL)
                    if let fingerprintBeforeRead,
                       let cached = self.snapshotCache.snapshot(
                           for: cacheKey,
                           fingerprint: fingerprintBeforeRead
                       ) {
                        Self.logger.notice("Snapshot cache hit")
                        return cached
                    }

                    let snapshot = try process.snapshot(
                        fileURL: authorizedURL.absoluteString,
                        requestId: request.requestId
                    )
                    let fingerprintAfterRead = self.fileFingerprint(authorizedURL)
                    let stableFingerprint: SafariFileFingerprint?
                    if let fingerprintBeforeRead,
                       let fingerprintAfterRead,
                       fingerprintBeforeRead == fingerprintAfterRead,
                       fingerprintAfterRead.size == Int64(snapshot.totalBytes) {
                        stableFingerprint = fingerprintAfterRead
                    } else {
                        stableFingerprint = nil
                    }
                    self.snapshotCache.store(
                        snapshot,
                        for: cacheKey,
                        fingerprint: stableFingerprint
                    )
                    return snapshot
                }
                responseData = try SafariNativeMessageCodec.encodeResponse(
                    SafariReadMetadataResponse(
                        requestId: request.requestId,
                        snapshot: snapshot
                    )
                )
            case .readChunk:
                guard let process else {
                    throw SafariNativeBridgeError(code: .internalError)
                }
                guard let fileURL = request.fileUrl,
                      let digest = request.digest,
                      let chunkIndex = request.chunkIndex else {
                    throw SafariNativeBridgeError(code: .invalidMessage)
                }
                let chunk = try withAuthorizedAccess(to: fileURL) { authorizedURL in
                    let cacheKey = authorizedURL.absoluteString
                    let snapshot: SafariReadSnapshot
                    if let cached = self.snapshotCache.snapshot(
                        for: cacheKey,
                        digest: digest
                    ) {
                        snapshot = cached
                    } else {
                        snapshot = try process.snapshot(
                            fileURL: cacheKey,
                            requestId: request.requestId
                        )
                        guard snapshot.digest == digest else {
                            throw SafariNativeBridgeError(code: .fileChanged)
                        }
                        self.snapshotCache.store(snapshot, for: cacheKey)
                    }
                    guard (0..<snapshot.chunkCount).contains(chunkIndex) else {
                        throw SafariNativeBridgeError(code: .invalidMessage)
                    }
                    let start = chunkIndex * SafariNativeLimit.rawChunkBytes
                    let end = min(
                        start + SafariNativeLimit.rawChunkBytes,
                        snapshot.bytes.count
                    )
                    return snapshot.bytes.subdata(in: start..<end)
                }
                responseData = try SafariNativeMessageCodec.encodeResponse(
                    SafariReadChunkResponse(
                        requestId: request.requestId,
                        chunkIndex: chunkIndex,
                        data: chunk.base64EncodedString()
                    )
                )
            case .authorizeFolder:
                guard let fileURL = request.fileUrl else {
                    throw SafariNativeBridgeError(code: .invalidMessage)
                }
                let targetURL: URL
                do {
                    targetURL = try authorizationStore?.authorizationTarget(for: fileURL)
                        ?? FolderAuthorizationStore.validatedFileURL(fileURL)
                } catch let error as FolderAuthorizationError {
                    throw Self.mapAuthorizationError(error)
                }

                if authorizationStore?.isAuthorized(fileURL: targetURL) == true {
                    responseData = try SafariNativeMessageCodec.encodeResponse(
                        SafariAuthorizationResponse(requestId: request.requestId)
                    )
                    break
                }
                guard let authorizationPrompt else {
                    throw SafariNativeBridgeError(code: .internalError)
                }
                do {
                    guard try authorizationPrompt(targetURL) else {
                        throw SafariNativeBridgeError(code: .authorizationCancelled)
                    }
                } catch let error as FolderAuthorizationError {
                    throw Self.mapAuthorizationError(error)
                }
                responseData = try SafariNativeMessageCodec.encodeResponse(
                    SafariAuthorizationResponse(requestId: request.requestId)
                )
            }
            let response = try responseDictionary(responseData)
            let durationMs = Self.elapsedMilliseconds(since: startedAt)
            Self.logger.notice(
                "Request completed: \(request.operation.rawValue, privacy: .public) durationMs=\(durationMs, privacy: .public)"
            )
            return response
        } catch let error as SafariNativeBridgeError {
            let durationMs = Self.elapsedMilliseconds(since: startedAt)
            Self.logger.error(
                "Request failed: operation=\(operation?.rawValue ?? "undecoded", privacy: .public) code=\(error.code.rawValue, privacy: .public) durationMs=\(durationMs, privacy: .public)"
            )
            return errorDictionary(error.code, requestId: requestId)
        } catch {
            let durationMs = Self.elapsedMilliseconds(since: startedAt)
            Self.logger.fault(
                "Request failed unexpectedly: operation=\(operation?.rawValue ?? "undecoded", privacy: .public) errorType=\(String(describing: type(of: error)), privacy: .public) durationMs=\(durationMs, privacy: .public)"
            )
            return errorDictionary(.internalError, requestId: requestId)
        }
    }

    private static func elapsedMilliseconds(since startedAt: TimeInterval) -> Int {
        Int((ProcessInfo.processInfo.systemUptime - startedAt) * 1_000)
    }

    private static func mapAuthorizationError(
        _ error: FolderAuthorizationError
    ) -> SafariNativeBridgeError {
        switch error {
        case .invalidFileURL:
            return SafariNativeBridgeError(code: .invalidFileUrl)
        case .remoteFileURL:
            return SafariNativeBridgeError(code: .remoteFileUrl)
        case .authorizationRequired:
            return SafariNativeBridgeError(code: .authorizationRequired)
        case .authorizationTargetNotFound:
            return SafariNativeBridgeError(code: .authorizationTargetNotFound)
        case .storageUnavailable, .invalidFolder, .bookmarkFailed:
            return SafariNativeBridgeError(code: .authorizationFailed)
        }
    }

    private func withAuthorizedAccess<T>(
        to fileURL: String,
        operation: (URL) throws -> T
    ) throws -> T {
        guard let authorizationStore else {
            guard let parsedURL = URL(string: fileURL) else {
                throw SafariNativeBridgeError(code: .invalidFileUrl)
            }
            return try operation(parsedURL)
        }
        do {
            return try authorizationStore.withAccess(to: fileURL, operation: operation)
        } catch let error as FolderAuthorizationError {
            switch error {
            case .invalidFileURL:
                throw SafariNativeBridgeError(code: .invalidFileUrl)
            case .remoteFileURL:
                throw SafariNativeBridgeError(code: .remoteFileUrl)
            case .authorizationRequired:
                throw SafariNativeBridgeError(code: .authorizationRequired)
            case .authorizationTargetNotFound:
                throw SafariNativeBridgeError(code: .authorizationTargetNotFound)
            case .storageUnavailable, .invalidFolder, .bookmarkFailed:
                throw SafariNativeBridgeError(code: .internalError)
            }
        }
    }

    private func errorDictionary(
        _ code: SafariNativeErrorCode,
        requestId: String?
    ) -> [String: Any] {
        do {
            let data = try SafariNativeMessageCodec.encodeResponse(
                SafariErrorResponse(requestId: requestId, code: code)
            )
            return try responseDictionary(data)
        } catch {
            return [
                "protocolVersion": 1,
                "requestId": requestId ?? NSNull(),
                "type": "error",
                "ok": false,
                "error": ["code": SafariNativeErrorCode.internalError.rawValue],
            ]
        }
    }

    private func responseDictionary(_ data: Data) throws -> [String: Any] {
        guard let dictionary = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw SafariNativeBridgeError(code: .internalError)
        }
        return dictionary
    }
}
