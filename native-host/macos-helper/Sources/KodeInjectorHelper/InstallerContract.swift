import Foundation

enum InstallerClientError: Error, Equatable, Sendable {
    case unsupportedContract
    case invalidResponse
    case malformedResponse
    case outputLimitExceeded(ProcessOutputStream)
    case timedOut
    case launchFailed(String)
    case exitStatusMismatch
}

enum ProcessOutputStream: String, Equatable, Sendable {
    case standardOutput
    case standardError
}

extension InstallerClientError: LocalizedError {
    var errorDescription: String? {
        switch self {
        case .unsupportedContract:
            return "This Kode Injector Helper uses an unsupported installer contract."
        case .invalidResponse:
            return "The installer returned an invalid response."
        case .malformedResponse:
            return "The installer returned unreadable data."
        case let .outputLimitExceeded(stream):
            return "The installer exceeded the allowed \(stream.rawValue) size."
        case .timedOut:
            return "The installer did not finish in time."
        case .launchFailed:
            return "The bundled installer could not be started."
        case .exitStatusMismatch:
            return "The installer result did not match its process status."
        }
    }
}

enum InstallerAction: String, Decodable, Equatable, Sendable {
    case status
    case install
    case uninstall
}

enum InstallationState: String, Decodable, Equatable, Sendable {
    case notInstalled
    case ready
    case repairRequired
}

enum ManagedHostState: String, Decodable, Equatable, Sendable {
    case ready
    case invalid
}

enum Browser: String, Decodable, Equatable, Sendable {
    case firefox
    case chrome
    case edge
}

enum RegistrationState: String, Decodable, Equatable, Sendable {
    case missing
    case registered
    case stale
    case invalid
}

enum LifecycleErrorCode: String, Decodable, Equatable, Sendable {
    case pathResolutionFailed
    case statusFailed
    case installFailed
    case uninstallFailed
    case postconditionFailed
}

struct ManagedHost: Decodable, Equatable, Sendable {
    let state: ManagedHostState
    let path: String

    private enum CodingKeys: String, CodingKey, CaseIterable {
        case state
        case path
    }

    init(from decoder: Decoder) throws {
        try rejectUnknownKeys(decoder, allowed: CodingKeys.self)
        let container = try decoder.container(keyedBy: CodingKeys.self)
        state = try container.decode(ManagedHostState.self, forKey: .state)
        path = try container.decode(String.self, forKey: .path)
    }

    func validated() throws -> Self {
        guard isAbsoluteNonemptyPath(path) else {
            throw InstallerClientError.invalidResponse
        }
        return self
    }
}

struct BrowserRegistration: Decodable, Equatable, Sendable {
    let browser: Browser
    let state: RegistrationState
    let manifestPath: String
    let registeredHostPath: String?

    private enum CodingKeys: String, CodingKey, CaseIterable {
        case browser
        case state
        case manifestPath
        case registeredHostPath
    }

    init(from decoder: Decoder) throws {
        try rejectUnknownKeys(decoder, allowed: CodingKeys.self)
        let container = try decoder.container(keyedBy: CodingKeys.self)
        browser = try container.decode(Browser.self, forKey: .browser)
        state = try container.decode(RegistrationState.self, forKey: .state)
        manifestPath = try container.decode(String.self, forKey: .manifestPath)
        registeredHostPath = try decodePresentOptional(
            String.self,
            from: container,
            forKey: .registeredHostPath
        )
    }

    func validated() throws -> Self {
        guard isAbsoluteNonemptyPath(manifestPath) else {
            throw InstallerClientError.invalidResponse
        }
        if let registeredHostPath, !isAbsoluteNonemptyPath(registeredHostPath) {
            throw InstallerClientError.invalidResponse
        }
        switch state {
        case .registered, .stale:
            guard registeredHostPath != nil else {
                throw InstallerClientError.invalidResponse
            }
        case .missing:
            guard registeredHostPath == nil else {
                throw InstallerClientError.invalidResponse
            }
        case .invalid:
            break
        }
        return self
    }
}

struct InstallationSnapshot: Decodable, Equatable, Sendable {
    let state: InstallationState
    let host: ManagedHost
    let registrations: [BrowserRegistration]
    let legacySupportPresent: Bool

    private enum CodingKeys: String, CodingKey, CaseIterable {
        case state
        case host
        case registrations
        case legacySupportPresent
    }

    init(from decoder: Decoder) throws {
        try rejectUnknownKeys(decoder, allowed: CodingKeys.self)
        let container = try decoder.container(keyedBy: CodingKeys.self)
        state = try container.decode(InstallationState.self, forKey: .state)
        host = try container.decode(ManagedHost.self, forKey: .host)
        registrations = try container.decode(
            [BrowserRegistration].self,
            forKey: .registrations
        )
        legacySupportPresent = try container.decode(
            Bool.self,
            forKey: .legacySupportPresent
        )
    }

    func validated() throws -> Self {
        _ = try host.validated()
        for registration in registrations {
            _ = try registration.validated()
        }
        guard registrations.map(\.browser) == [.firefox, .chrome, .edge] else {
            throw InstallerClientError.invalidResponse
        }
        let allMissing = registrations.allSatisfy { registration in
            registration.state == .missing
        }
        let allRegisteredToBundledHost = !legacySupportPresent
            && host.state == .ready
            && registrations.allSatisfy { registration in
                registration.state == .registered
                    && registration.registeredHostPath == host.path
            }
        let derivedState: InstallationState
        if allMissing && !legacySupportPresent {
            derivedState = .notInstalled
        } else if allRegisteredToBundledHost {
            derivedState = .ready
        } else {
            derivedState = .repairRequired
        }
        guard state == derivedState else {
            throw InstallerClientError.invalidResponse
        }
        return self
    }
}

struct LifecycleError: Decodable, Equatable, Sendable {
    static let maximumMessageLength = 4_096

    let code: LifecycleErrorCode
    let message: String

    private enum CodingKeys: String, CodingKey, CaseIterable {
        case code
        case message
    }

    init(from decoder: Decoder) throws {
        try rejectUnknownKeys(decoder, allowed: CodingKeys.self)
        let container = try decoder.container(keyedBy: CodingKeys.self)
        code = try container.decode(LifecycleErrorCode.self, forKey: .code)
        message = try container.decode(String.self, forKey: .message)
    }

    func validated() throws -> Self {
        guard !message.isEmpty, message.count <= Self.maximumMessageLength else {
            throw InstallerClientError.invalidResponse
        }
        return self
    }
}

struct LifecycleResponse: Decodable, Equatable, Sendable {
    static let contractVersion = 1

    let contractVersion: Int
    let action: InstallerAction
    let success: Bool
    let packageVersion: String
    let installation: InstallationSnapshot?
    let error: LifecycleError?

    private enum CodingKeys: String, CodingKey, CaseIterable {
        case contractVersion
        case action
        case success
        case packageVersion
        case installation
        case error
    }

    init(from decoder: Decoder) throws {
        try rejectUnknownKeys(decoder, allowed: CodingKeys.self)
        let container = try decoder.container(keyedBy: CodingKeys.self)
        contractVersion = try container.decode(Int.self, forKey: .contractVersion)
        action = try container.decode(InstallerAction.self, forKey: .action)
        success = try container.decode(Bool.self, forKey: .success)
        packageVersion = try container.decode(String.self, forKey: .packageVersion)
        installation = try decodePresentOptional(
            InstallationSnapshot.self,
            from: container,
            forKey: .installation
        )
        error = try decodePresentOptional(
            LifecycleError.self,
            from: container,
            forKey: .error
        )
    }

    static func decodeValidated(_ data: Data) throws -> LifecycleResponse {
        try JSONDecoder().decode(LifecycleResponse.self, from: data).validated()
    }

    func validated() throws -> Self {
        guard contractVersion == Self.contractVersion else {
            throw InstallerClientError.unsupportedContract
        }
        guard isSemanticVersion(packageVersion) else {
            throw InstallerClientError.invalidResponse
        }
        guard success == (error == nil), !success || installation != nil else {
            throw InstallerClientError.invalidResponse
        }
        if let installation {
            _ = try installation.validated()
        }
        if let error {
            _ = try error.validated()
        }
        return self
    }
}

private struct DynamicCodingKey: CodingKey {
    let stringValue: String
    let intValue: Int?

    init?(stringValue: String) {
        self.stringValue = stringValue
        intValue = nil
    }

    init?(intValue: Int) {
        stringValue = String(intValue)
        self.intValue = intValue
    }
}

private func rejectUnknownKeys<Keys>(
    _ decoder: Decoder,
    allowed: Keys.Type
) throws where Keys: CodingKey & CaseIterable, Keys.AllCases: Collection {
    let container = try decoder.container(keyedBy: DynamicCodingKey.self)
    let allowedNames = Set(Keys.allCases.map(\.stringValue))
    guard container.allKeys.allSatisfy({ allowedNames.contains($0.stringValue) }) else {
        throw InstallerClientError.invalidResponse
    }
}

private func decodePresentOptional<Value, Key>(
    _ type: Value.Type,
    from container: KeyedDecodingContainer<Key>,
    forKey key: Key
) throws -> Value? where Value: Decodable, Key: CodingKey {
    guard container.contains(key) else {
        return nil
    }
    return try container.decode(Value.self, forKey: key)
}

private func isAbsoluteNonemptyPath(_ path: String) -> Bool {
    !path.isEmpty && (path as NSString).isAbsolutePath
}

private func isSemanticVersion(_ version: String) -> Bool {
    let pattern = #"^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$"#
    return version.range(of: pattern, options: .regularExpression) != nil
}
