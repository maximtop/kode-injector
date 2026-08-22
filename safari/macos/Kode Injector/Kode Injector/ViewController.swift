import Cocoa
import SafariServices

private let extensionBundleIdentifier = "dev.maximtop.kode-injector.safari.Extension"
private let safariBundleIdentifier = "com.apple.Safari"

/// Message sent to the extension background when the user chooses Try Demo.
/// The background matches both the message name and `userInfo[action]`.
private enum DemoAppMessage {
    static let name = "openDemo"
    static let actionKey = "action"
}

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
    static let tryDemo = NSLocalizedString(
        "demo.button",
        comment: "Button that starts the built-in demo journey"
    )
    static let demoExplanation = NSLocalizedString(
        "demo.explanation",
        comment: "Explains the built-in demo available on the Rules page"
    )
    static let demoStatusDisabled = NSLocalizedString(
        "demo.status.disabled",
        comment: "Demo status shown when the Safari extension must be enabled first"
    )
    static let demoStatusOpening = NSLocalizedString(
        "demo.status.opening",
        comment: "Demo status shown after asking Safari to open the Rules page"
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
    private let demoStatusLabel = NSTextField(wrappingLabelWithString: "")

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

        let demoExplanation = NSTextField(wrappingLabelWithString:
            LocalizedText.demoExplanation
        )
        demoExplanation.textColor = .secondaryLabelColor

        let demoButton = NSButton(
            title: LocalizedText.tryDemo,
            target: self,
            action: #selector(tryDemo)
        )
        demoButton.bezelStyle = .rounded
        demoButton.setAccessibilityIdentifier("try-demo")

        demoStatusLabel.font = .systemFont(ofSize: 12)
        demoStatusLabel.textColor = .secondaryLabelColor
        demoStatusLabel.isHidden = true

        let stack = NSStackView(views: [
            title,
            versionLabel,
            explanation,
            statusLabel,
            buttons,
            demoExplanation,
            demoButton,
            demoStatusLabel,
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
            demoExplanation.widthAnchor.constraint(equalTo: stack.widthAnchor),
            demoStatusLabel.widthAnchor.constraint(equalTo: stack.widthAnchor),
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

    /// Starts the demo journey: a disabled extension is sent to Safari
    /// settings, an enabled one is asked to open the Rules page.
    @objc private func tryDemo() {
        demoStatusLabel.isHidden = false
        demoStatusLabel.stringValue = LocalizedText.checkingStatus
        SFSafariExtensionManager.getStateOfSafariExtension(
            withIdentifier: extensionBundleIdentifier
        ) { [weak self] state, error in
            DispatchQueue.main.async {
                guard let self = self else {
                    return
                }
                self.refreshExtensionState()
                guard error == nil, state?.isEnabled == true else {
                    self.demoStatusLabel.stringValue = LocalizedText.demoStatusDisabled
                    self.openSafariSettings()
                    return
                }
                self.demoStatusLabel.stringValue = LocalizedText.demoStatusOpening
                self.requestRulesPageInSafari()
            }
        }
    }

    /// Asks the extension background to open Rules and brings Safari forward.
    ///
    /// Safari delivers the message only while the extension background is
    /// running, so the status text always names the manual route as well.
    private func requestRulesPageInSafari() {
        SFSafariApplication.dispatchMessage(
            withName: DemoAppMessage.name,
            toExtensionWithIdentifier: extensionBundleIdentifier,
            userInfo: [DemoAppMessage.actionKey: DemoAppMessage.name]
        ) { error in
            if let error = error {
                NSLog("Kode Injector demo message was not delivered: %@", error.localizedDescription)
            }
        }
        guard let safariURL = NSWorkspace.shared.urlForApplication(
            withBundleIdentifier: safariBundleIdentifier
        ) else {
            return
        }
        NSWorkspace.shared.openApplication(
            at: safariURL,
            configuration: NSWorkspace.OpenConfiguration(),
            completionHandler: nil
        )
    }

}
