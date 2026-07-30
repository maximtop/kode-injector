import Foundation

/// Operations accepted from the Safari WebExtension.
public enum SafariNativeOperation: String, Codable, Sendable {
    /// Checks bridge and embedded-helper readiness.
    case ping
    /// Reads metadata plus the first bounded content chunk.
    case readMetadata
    /// Reads one remaining content chunk bound to a digest.
    case readChunk
    /// Presents explicit read-only folder authorization.
    case authorizeFolder
}

/// Shared hard limits enforced at the Safari native boundary.
public enum SafariNativeLimit {
    /// Maximum encoded request size.
    public static let requestBytes = 64 * 1024
    /// Exclusive maximum encoded response size.
    public static let responseBytes = 1024 * 1024
    /// Maximum decoded source bytes carried by one chunk.
    public static let rawChunkBytes = 512 * 1024
    /// Maximum logical local source size.
    public static let logicalFileBytes = 5 * 1024 * 1024
    /// Maximum number of chunks for one logical source.
    public static let maximumChunkCount = (
        logicalFileBytes + rawChunkBytes - 1
    ) / rawChunkBytes
}

/// Closed error codes returned to untrusted WebExtension callers.
public enum SafariNativeErrorCode: String, Codable, CaseIterable, Sendable {
    /// Native framing could not be decoded.
    case invalidFrame = "INVALID_FRAME"
    /// A request or response exceeded its protocol bound.
    case messageTooLarge = "MESSAGE_TOO_LARGE"
    /// A structured message failed strict validation.
    case invalidMessage = "INVALID_MESSAGE"
    /// A request identifier was malformed.
    case invalidRequestId = "INVALID_REQUEST_ID"
    /// The protocol version is unsupported.
    case unsupportedProtocol = "UNSUPPORTED_PROTOCOL"
    /// The requested operation is unsupported.
    case unsupportedOperation = "UNSUPPORTED_OPERATION"
    /// The local source URL is malformed.
    case invalidFileUrl = "INVALID_FILE_URL"
    /// The file URL points to a remote host.
    case remoteFileUrl = "REMOTE_FILE_URL"
    /// The source file does not exist.
    case fileNotFound = "FILE_NOT_FOUND"
    /// The source is not a regular file.
    case notRegularFile = "NOT_REGULAR_FILE"
    /// The source exceeds the logical file limit.
    case fileTooLarge = "FILE_TOO_LARGE"
    /// The source is not valid UTF-8.
    case invalidUtf8 = "INVALID_UTF8"
    /// No stored bookmark authorizes the source.
    case authorizationRequired = "AUTHORIZATION_REQUIRED"
    /// The user cancelled explicit folder authorization.
    case authorizationCancelled = "AUTHORIZATION_CANCELLED"
    /// The immediate source folder does not exist.
    case authorizationTargetNotFound = "AUTHORIZATION_TARGET_NOT_FOUND"
    /// Folder authorization or bookmark persistence failed.
    case authorizationFailed = "AUTHORIZATION_FAILED"
    /// The embedded helper could not read the source.
    case readFailed = "READ_FAILED"
    /// The source changed during a chunked read.
    case fileChanged = "FILE_CHANGED"
    /// An unexpected closed bridge failure occurred.
    case internalError = "INTERNAL_ERROR"
}

/// Swift error wrapper carrying one closed native error code.
public struct SafariNativeBridgeError: Error, Equatable, Sendable {
    /// Error code safe to return across the native boundary.
    public let code: SafariNativeErrorCode

    /// Creates a bridge error for a closed code.
    public init(code: SafariNativeErrorCode) {
        self.code = code
    }
}

/// Strict request decoded from one Safari native message.
public struct SafariNativeRequest: Codable, Equatable, Sendable {
    /// Native protocol version.
    public let protocolVersion: Int
    /// Caller-generated request identifier.
    public let requestId: String
    /// Closed operation to perform.
    public let operation: SafariNativeOperation
    /// Optional local source URL used by file operations.
    public let fileUrl: String?
    /// Optional SHA-256 digest binding a chunk read.
    public let digest: String?
    /// Optional zero-based raw chunk index.
    public let chunkIndex: Int?

    /// Creates a strict native request value.
    public init(
        protocolVersion: Int,
        requestId: String,
        operation: SafariNativeOperation,
        fileUrl: String? = nil,
        digest: String? = nil,
        chunkIndex: Int? = nil
    ) {
        self.protocolVersion = protocolVersion
        self.requestId = requestId
        self.operation = operation
        self.fileUrl = fileUrl
        self.digest = digest
        self.chunkIndex = chunkIndex
    }
}

/// Encodable closed error response returned to Safari.
public struct SafariErrorResponse: Encodable, Sendable {
    /// Native protocol version.
    public let protocolVersion = 1
    /// Request identifier, when decoding reached that field.
    public let requestId: String?
    /// Response discriminator.
    public let type = "error"
    /// Success flag fixed to false for error responses.
    public let ok = false
    /// Closed error payload.
    public let error: ErrorDetail

    /// Creates an error response without exposing arbitrary details.
    public init(requestId: String?, code: SafariNativeErrorCode) {
        self.requestId = requestId
        self.error = ErrorDetail(code: code)
    }

    /// Nested closed error payload.
    public struct ErrorDetail: Encodable, Sendable {
        /// Safe error code returned to the WebExtension.
        public let code: SafariNativeErrorCode
    }
}

/// Strict codec for bounded Safari native requests and responses.
public enum SafariNativeMessageCodec {
    private static let requestIdPattern = try! NSRegularExpression(
        pattern: "^[A-Za-z0-9_-]{1,64}$"
    )
    private static let digestPattern = try! NSRegularExpression(
        pattern: "^[a-f0-9]{64}$"
    )
    private static let commonKeys: Set<String> = [
        "protocolVersion",
        "requestId",
        "operation",
        "fileUrl",
        "digest",
        "chunkIndex",
    ]

    /// Decodes and validates one bounded native request.
    ///
    /// - Parameter data: Encoded request bytes received from Safari.
    /// - Returns: Strict request value.
    /// - Throws: `SafariNativeBridgeError` for every rejected input.
    public static func decodeRequest(_ data: Data) throws -> SafariNativeRequest {
        guard data.count <= SafariNativeLimit.requestBytes else {
            throw SafariNativeBridgeError(code: .messageTooLarge)
        }

        let object: Any
        do {
            object = try JSONSerialization.jsonObject(with: data)
        } catch {
            throw SafariNativeBridgeError(code: .invalidMessage)
        }
        guard let dictionary = object as? [String: Any],
              Set(dictionary.keys).isSubset(of: commonKeys) else {
            throw SafariNativeBridgeError(code: .invalidMessage)
        }
        guard let rawOperation = dictionary["operation"] as? String else {
            throw SafariNativeBridgeError(code: .invalidMessage)
        }
        guard SafariNativeOperation(rawValue: rawOperation) != nil else {
            throw SafariNativeBridgeError(code: .unsupportedOperation)
        }

        let request: SafariNativeRequest
        do {
            request = try JSONDecoder().decode(SafariNativeRequest.self, from: data)
        } catch {
            throw SafariNativeBridgeError(code: .invalidMessage)
        }
        try validate(request)
        return request
    }

    /// Encodes one response while enforcing the response envelope limit.
    ///
    /// - Parameter response: Encodable closed response value.
    /// - Returns: JSON response bytes.
    /// - Throws: `SafariNativeBridgeError` when encoding or bounds validation fails.
    public static func encodeResponse<T: Encodable>(_ response: T) throws -> Data {
        let data: Data
        do {
            data = try JSONEncoder().encode(response)
        } catch {
            throw SafariNativeBridgeError(code: .internalError)
        }
        guard data.count < SafariNativeLimit.responseBytes else {
            throw SafariNativeBridgeError(code: .messageTooLarge)
        }
        return data
    }

    private static func validate(_ request: SafariNativeRequest) throws {
        guard request.protocolVersion == 1 else {
            throw SafariNativeBridgeError(code: .unsupportedProtocol)
        }
        guard matches(request.requestId, pattern: requestIdPattern) else {
            throw SafariNativeBridgeError(code: .invalidRequestId)
        }

        switch request.operation {
        case .ping:
            guard request.fileUrl == nil,
                  request.digest == nil,
                  request.chunkIndex == nil else {
                throw SafariNativeBridgeError(code: .invalidMessage)
            }
        case .readMetadata:
            guard let fileUrl = request.fileUrl,
                  (8...8192).contains(fileUrl.utf8.count),
                  request.digest == nil,
                  request.chunkIndex == nil else {
                throw SafariNativeBridgeError(code: .invalidMessage)
            }
        case .readChunk:
            guard let fileUrl = request.fileUrl,
                  (8...8192).contains(fileUrl.utf8.count),
                  let digest = request.digest,
                  matches(digest, pattern: digestPattern),
                  let chunkIndex = request.chunkIndex,
                  (0..<SafariNativeLimit.maximumChunkCount).contains(chunkIndex) else {
                throw SafariNativeBridgeError(code: .invalidMessage)
            }
        case .authorizeFolder:
            guard let fileUrl = request.fileUrl,
                  (8...8192).contains(fileUrl.utf8.count),
                  request.digest == nil,
                  request.chunkIndex == nil else {
                throw SafariNativeBridgeError(code: .invalidMessage)
            }
        }
    }

    private static func matches(_ value: String, pattern: NSRegularExpression) -> Bool {
        let range = NSRange(value.startIndex..<value.endIndex, in: value)
        return pattern.firstMatch(in: value, range: range)?.range == range
    }
}
