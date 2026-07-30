import AppKit
import OSLog
import SafariServices

private enum FolderAuthorizationText {
    static let authorize = NSLocalizedString(
        "authorization.button",
        comment: "Button granting read-only access to the required folder"
    )

    /// Formats the folder-specific authorization prompt.
    static func message(folderName: String) -> String {
        let format = NSLocalizedString(
            "authorization.message_format",
            comment: "Folder authorization message; placeholder is the exact folder name"
        )
        return String(format: format, locale: Locale.current, folderName)
    }

    /// Formats the error shown after selecting a different folder.
    static func validationError(folderName: String) -> String {
        let format = NSLocalizedString(
            "authorization.validation_format",
            comment: "Validation error; placeholder is the required folder name"
        )
        return String(format: format, locale: Locale.current, folderName)
    }
}

/// Receives Safari native messages and presents explicit folder authorization.
final class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    private static let logger = Logger(
        subsystem: "dev.maximtop.kode-injector.safari",
        category: "folder-authorization"
    )
    private static let bridge = SafariNativeBridge()
    private let authorizationStore = FolderAuthorizationStore()

    /// Routes one Safari extension request through the shared native bridge.
    func beginRequest(with context: NSExtensionContext) {
        DispatchQueue.main.async {
            Self.bridge.handle(context: context) { fileURL in
                try self.requestFolderAuthorization(for: fileURL)
            }
        }
    }

    /// Presents an exact-folder picker and persists the approved read-only bookmark.
    private func requestFolderAuthorization(for fileURL: URL) throws -> Bool {
        let requiredFolderURL = fileURL.deletingLastPathComponent().standardizedFileURL
        let panelDelegate = ExactFolderOpenPanelDelegate(requiredFolderURL: requiredFolderURL)
        let panel = NSOpenPanel()
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.allowsMultipleSelection = false
        panel.canCreateDirectories = false
        panel.prompt = FolderAuthorizationText.authorize
        panel.message = FolderAuthorizationText.message(
            folderName: requiredFolderURL.lastPathComponent
        )
        panel.directoryURL = requiredFolderURL
        panel.delegate = panelDelegate
        panel.level = .modalPanel

        Self.logger.notice("Presenting read-only folder authorization panel")
        let previousActivationPolicy = NSApp.activationPolicy()
        let activationPolicyChanged = NSApp.setActivationPolicy(.accessory)
        NSApp.activate(ignoringOtherApps: true)
        panel.orderFrontRegardless()
        let response = panel.runModal()
        _ = NSApp.setActivationPolicy(previousActivationPolicy)
        Self.logger.notice(
            "Folder authorization panel returned: accepted=\(response == .OK, privacy: .public) activationPolicyChanged=\(activationPolicyChanged, privacy: .public)"
        )
        guard response == .OK, let folderURL = panel.url else {
            Self.logger.notice("Folder authorization cancelled")
            return false
        }
        guard FolderAuthorizationStore.isExactFolderSelection(
            selectedFolderURL: folderURL,
            requiredFolderURL: requiredFolderURL
        ) else {
            throw FolderAuthorizationError.invalidFolder
        }
        try authorizationStore.saveAuthorization(for: folderURL)
        Self.logger.notice("Folder authorization bookmark stored")
        return true
    }

}

private final class ExactFolderOpenPanelDelegate: NSObject, NSOpenSavePanelDelegate {
    private static let validationErrorDomain = "dev.maximtop.kode-injector.folder-authorization"
    private let requiredFolderURL: URL

    init(requiredFolderURL: URL) {
        self.requiredFolderURL = requiredFolderURL.standardizedFileURL
    }

    /// Rejects every selection except the exact folder requested by the rule.
    func panel(_ sender: Any, validate url: URL) throws {
        guard FolderAuthorizationStore.isExactFolderSelection(
            selectedFolderURL: url,
            requiredFolderURL: requiredFolderURL
        ) else {
            throw NSError(
                domain: Self.validationErrorDomain,
                code: 1,
                userInfo: [
                    NSLocalizedDescriptionKey:
                        FolderAuthorizationText.validationError(
                            folderName: requiredFolderURL.lastPathComponent
                        )
                ]
            )
        }
    }
}
