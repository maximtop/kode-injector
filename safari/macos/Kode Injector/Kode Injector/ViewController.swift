import Cocoa
import SafariServices

private let extensionBundleIdentifier = "dev.maximtop.kode-injector.safari.Extension"

private enum LocalizedText {
    static let checkingStatus = NSLocalizedString(
        "app.status.checking",
        comment: "Status shown while Safari extension state is loading"
    )
    static let explanation = NSLocalizedString(
        "app.explanation",
        comment: "Explanation of Safari extension setup and folder authorization"
    )
    static let openSettings = NSLocalizedString(
        "app.open_settings",
        comment: "Button that opens Safari extension settings"
    )
    static let refresh = NSLocalizedString(
        "app.refresh",
        comment: "Button that refreshes Safari extension state"
    )
    static let statusUnavailable = NSLocalizedString(
        "app.status.unavailable",
        comment: "Status shown when Safari extension state cannot be read"
    )
    static let statusEnabled = NSLocalizedString(
        "app.status.enabled",
        comment: "Status shown when the Safari extension is enabled"
    )
    static let statusDisabled = NSLocalizedString(
        "app.status.disabled",
        comment: "Status shown when the Safari extension is disabled"
    )

    /// Formats the localized version label.
    static func version(_ value: String) -> String {
        let format = NSLocalizedString(
            "app.version_format",
            comment: "Application version label; placeholder is the version number"
        )
        return String(format: format, locale: Locale.current, value)
    }
}

/// Onboarding screen for enabling and checking the Safari extension.
final class ViewController: NSViewController {
    private let statusLabel = NSTextField(labelWithString: LocalizedText.checkingStatus)

    override func viewDidLoad() {
        super.viewDidLoad()
        configureView()
        refreshExtensionState()
    }

    /// Builds the localized onboarding hierarchy and constraints.
    private func configureView() {
        let title = NSTextField(labelWithString: "Kode Injector")
        title.font = .systemFont(ofSize: 24, weight: .bold)

        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString")
            as? String ?? ""
        let versionLabel = NSTextField(labelWithString: LocalizedText.version(version))
        versionLabel.textColor = .secondaryLabelColor

        let explanation = NSTextField(wrappingLabelWithString:
            LocalizedText.explanation
        )
        explanation.textColor = .secondaryLabelColor
        statusLabel.font = .systemFont(ofSize: 13, weight: .medium)

        let settingsButton = NSButton(
            title: LocalizedText.openSettings,
            target: self,
            action: #selector(openSafariSettings)
        )
        settingsButton.bezelStyle = .rounded

        let refreshButton = NSButton(
            title: LocalizedText.refresh,
            target: self,
            action: #selector(refreshExtensionState)
        )
        refreshButton.bezelStyle = .rounded

        let buttons = NSStackView(views: [settingsButton, refreshButton])
        buttons.orientation = .horizontal
        buttons.spacing = 8

        let stack = NSStackView(views: [
            title,
            versionLabel,
            explanation,
            statusLabel,
            buttons,
        ])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 14
        stack.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
            stack.topAnchor.constraint(equalTo: view.topAnchor, constant: 24),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: view.bottomAnchor, constant: -24),
            explanation.widthAnchor.constraint(equalTo: stack.widthAnchor),
        ])
    }

    /// Opens Safari settings for the bundled extension identifier.
    @objc private func openSafariSettings() {
        SFSafariApplication.showPreferencesForExtension(
            withIdentifier: extensionBundleIdentifier,
            completionHandler: nil
        )
    }

    /// Reloads Safari's current extension-enabled state.
    @objc private func refreshExtensionState() {
        statusLabel.stringValue = LocalizedText.checkingStatus
        statusLabel.textColor = .secondaryLabelColor
        SFSafariExtensionManager.getStateOfSafariExtension(
            withIdentifier: extensionBundleIdentifier
        ) { [weak self] state, error in
            DispatchQueue.main.async {
                if error != nil {
                    self?.statusLabel.stringValue = LocalizedText.statusUnavailable
                    self?.statusLabel.textColor = .secondaryLabelColor
                } else if state?.isEnabled == true {
                    self?.statusLabel.stringValue = LocalizedText.statusEnabled
                    self?.statusLabel.textColor = .systemGreen
                } else {
                    self?.statusLabel.stringValue = LocalizedText.statusDisabled
                    self?.statusLabel.textColor = .systemOrange
                }
            }
        }
    }

}
