import AppKit

@MainActor
final class InstallerViewController: NSViewController {
    static let minimumContentWidth: CGFloat = 540
    static let preferredContentSize = NSSize(width: 680, height: 760)
    static let technicalDetailsHeight: CGFloat = 110

    private static let projectURL = URL(
        string: "https://github.com/maximtop/kode-injector"
    )!

    private let viewModel: InstallerViewModel

    private let statusTitleLabel = NSTextField(labelWithString: "")
    private let statusExplanationLabel = NSTextField(wrappingLabelWithString: "")
    private let versionLabel = NSTextField(labelWithString: "")
    private let hostPathLabel = NSTextField(labelWithString: "")
    private let applicationLocationLabel = NSTextField(wrappingLabelWithString: "")
    private let registrationStack = NSStackView()
    private let progressIndicator = NSProgressIndicator()
    private let progressLabel = NSTextField(labelWithString: "Working…")
    private let resultLabel = NSTextField(wrappingLabelWithString: "")
    private let friendlyErrorLabel = NSTextField(wrappingLabelWithString: "")
    private let technicalDisclosureButton = NSButton()
    private let technicalErrorTextView = NSTextView()
    private let technicalErrorScrollView = NSScrollView()
    private let primaryButton = NSButton()
    private let reinstallButton = NSButton()
    private let uninstallButton = NSButton()
    private let refreshButton = NSButton()
    private let revealButton = NSButton()
    private let helpButton = NSButton()
    private let closeButton = NSButton()
    private let contentScrollView = NSScrollView()

    init(viewModel: InstallerViewModel) {
        self.viewModel = viewModel
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) is unavailable")
    }

    override func loadView() {
        view = NSView(frame: NSRect(origin: .zero, size: Self.preferredContentSize))
        configureControls()

        let contentStack = makeVerticalStack(spacing: 18)
        contentStack.alignment = .width
        contentStack.addArrangedSubview(makeHeader())
        contentStack.addArrangedSubview(makeIntroduction())
        contentStack.addArrangedSubview(applicationLocationLabel)
        contentStack.addArrangedSubview(makeStatusSection())
        contentStack.addArrangedSubview(makeRegistrationSection())
        contentStack.addArrangedSubview(makeFeedbackSection())
        contentStack.addArrangedSubview(makeActionSection())

        let documentView = NSView()
        documentView.translatesAutoresizingMaskIntoConstraints = false
        contentStack.translatesAutoresizingMaskIntoConstraints = false
        documentView.addSubview(contentStack)

        contentScrollView.translatesAutoresizingMaskIntoConstraints = false
        contentScrollView.hasVerticalScroller = true
        contentScrollView.autohidesScrollers = true
        contentScrollView.drawsBackground = false
        contentScrollView.documentView = documentView
        contentScrollView.setAccessibilityLabel("Kode Injector Helper content")
        view.addSubview(contentScrollView)

        NSLayoutConstraint.activate([
            view.widthAnchor.constraint(greaterThanOrEqualToConstant: Self.minimumContentWidth),
            contentScrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            contentScrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            contentScrollView.topAnchor.constraint(equalTo: view.topAnchor),
            contentScrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            documentView.leadingAnchor.constraint(equalTo: contentScrollView.contentView.leadingAnchor),
            documentView.trailingAnchor.constraint(equalTo: contentScrollView.contentView.trailingAnchor),
            documentView.topAnchor.constraint(equalTo: contentScrollView.contentView.topAnchor),
            documentView.widthAnchor.constraint(equalTo: contentScrollView.contentView.widthAnchor),
            contentStack.leadingAnchor.constraint(equalTo: documentView.leadingAnchor, constant: 28),
            contentStack.trailingAnchor.constraint(equalTo: documentView.trailingAnchor, constant: -28),
            contentStack.topAnchor.constraint(equalTo: documentView.topAnchor, constant: 26),
            contentStack.bottomAnchor.constraint(equalTo: documentView.bottomAnchor, constant: -24),
        ])

        viewModel.onChange = { [weak self] in
            self?.render()
        }
        render()
    }

    override func viewDidAppear() {
        super.viewDidAppear()
        Task { [weak self] in
            await self?.viewModel.refresh()
        }
    }

    private func configureControls() {
        applicationLocationLabel.textColor = .systemOrange
        applicationLocationLabel.font = .systemFont(ofSize: 13, weight: .medium)
        applicationLocationLabel.setAccessibilityLabel("Application location guidance")

        statusTitleLabel.font = .systemFont(ofSize: 18, weight: .semibold)
        statusTitleLabel.setAccessibilityLabel("Helper status")
        statusExplanationLabel.textColor = .secondaryLabelColor

        versionLabel.font = .monospacedSystemFont(ofSize: 12, weight: .medium)
        versionLabel.textColor = .secondaryLabelColor
        versionLabel.setAccessibilityLabel("Bundled helper version")

        configureSelectablePathField(
            hostPathLabel,
            accessibilityLabel: "Native helper executable path"
        )

        registrationStack.orientation = .vertical
        registrationStack.alignment = .leading
        registrationStack.spacing = 10
        registrationStack.setAccessibilityLabel("Browser registrations")

        progressIndicator.style = .spinning
        progressIndicator.controlSize = .small
        progressIndicator.isDisplayedWhenStopped = false
        progressIndicator.setAccessibilityLabel("Operation in progress")
        progressLabel.textColor = .secondaryLabelColor

        resultLabel.textColor = .systemGreen
        resultLabel.setAccessibilityLabel("Operation result")
        friendlyErrorLabel.textColor = .systemRed
        friendlyErrorLabel.setAccessibilityLabel("Operation error")

        technicalDisclosureButton.title = "Technical details"
        technicalDisclosureButton.setButtonType(.pushOnPushOff)
        technicalDisclosureButton.bezelStyle = .disclosure
        technicalDisclosureButton.target = self
        technicalDisclosureButton.action = #selector(toggleTechnicalDetails)
        technicalDisclosureButton.setAccessibilityLabel("Show technical error details")
        technicalErrorTextView.font = .monospacedSystemFont(ofSize: 11, weight: .regular)
        technicalErrorTextView.textColor = .secondaryLabelColor
        technicalErrorTextView.drawsBackground = false
        technicalErrorTextView.isEditable = false
        technicalErrorTextView.isSelectable = true
        technicalErrorTextView.isHorizontallyResizable = false
        technicalErrorTextView.isVerticallyResizable = true
        technicalErrorTextView.autoresizingMask = [.width]
        technicalErrorTextView.textContainer?.widthTracksTextView = true
        technicalErrorTextView.textContainer?.containerSize = NSSize(
            width: 0,
            height: CGFloat.greatestFiniteMagnitude
        )
        technicalErrorTextView.textContainerInset = NSSize(width: 5, height: 5)
        technicalErrorTextView.setAccessibilityLabel("Technical error details")

        technicalErrorScrollView.hasVerticalScroller = true
        technicalErrorScrollView.hasHorizontalScroller = false
        technicalErrorScrollView.autohidesScrollers = true
        technicalErrorScrollView.borderType = .bezelBorder
        technicalErrorScrollView.documentView = technicalErrorTextView
        technicalErrorScrollView.heightAnchor.constraint(
            equalToConstant: Self.technicalDetailsHeight
        ).isActive = true

        configureButton(primaryButton, action: #selector(performPrimaryAction))
        primaryButton.keyEquivalent = "\r"
        configureButton(reinstallButton, action: #selector(reinstallHelper))
        configureButton(uninstallButton, action: #selector(requestUninstall))
        configureButton(refreshButton, title: "Check Again", action: #selector(refreshStatus))
        configureButton(revealButton, title: "Reveal in Finder", action: #selector(revealInFinder))
        configureButton(helpButton, title: "Help", action: #selector(openHelp))
        configureButton(closeButton, title: "Close", action: #selector(closeWindow))
        closeButton.keyEquivalent = "\u{1b}"
    }

    private func makeHeader() -> NSView {
        let iconView = NSImageView(image: NSApp.applicationIconImage)
        iconView.imageScaling = .scaleProportionallyUpOrDown
        iconView.setAccessibilityLabel("Kode Injector icon")
        NSLayoutConstraint.activate([
            iconView.widthAnchor.constraint(equalToConstant: 64),
            iconView.heightAnchor.constraint(equalToConstant: 64),
        ])

        let titleLabel = NSTextField(labelWithString: viewModel.productTitle)
        titleLabel.font = .systemFont(ofSize: 25, weight: .bold)
        titleLabel.setAccessibilityLabel(viewModel.productTitle)

        let subtitleLabel = NSTextField(
            wrappingLabelWithString: "A local-file companion for the Kode Injector browser extension"
        )
        subtitleLabel.textColor = .secondaryLabelColor

        let textStack = makeVerticalStack(spacing: 3)
        textStack.addArrangedSubview(titleLabel)
        textStack.addArrangedSubview(subtitleLabel)

        let header = NSStackView(views: [iconView, textStack])
        header.orientation = .horizontal
        header.alignment = .centerY
        header.spacing = 16
        return header
    }

    private func makeIntroduction() -> NSView {
        let purposeLabel = NSTextField(
            wrappingLabelWithString: viewModel.purposeExplanation
        )
        let securityLabel = NSTextField(
            wrappingLabelWithString: viewModel.readOnlyExplanation
        )
        securityLabel.font = .systemFont(ofSize: 13, weight: .medium)
        securityLabel.textColor = .secondaryLabelColor
        securityLabel.setAccessibilityLabel("Read-only security boundary")

        let stack = makeVerticalStack(spacing: 7)
        stack.addArrangedSubview(purposeLabel)
        stack.addArrangedSubview(securityLabel)
        return stack
    }

    private func makeStatusSection() -> NSView {
        let heading = makeSectionHeading("Installation status")
        let headingSpacer = NSView()
        headingSpacer.setContentHuggingPriority(.defaultLow, for: .horizontal)
        headingSpacer.setContentCompressionResistancePriority(
            .defaultLow,
            for: .horizontal
        )
        let headingRow = NSStackView(views: [heading, headingSpacer, refreshButton])
        headingRow.orientation = .horizontal
        headingRow.alignment = .centerY
        headingRow.spacing = 8
        let hostHeading = NSTextField(labelWithString: "Browser helper path")
        hostHeading.font = .systemFont(ofSize: 12, weight: .semibold)

        let progressStack = NSStackView(views: [progressIndicator, progressLabel])
        progressStack.orientation = .horizontal
        progressStack.alignment = .centerY
        progressStack.spacing = 7

        let stack = makeVerticalStack(spacing: 6)
        stack.alignment = .width
        stack.addArrangedSubview(headingRow)
        stack.addArrangedSubview(statusTitleLabel)
        stack.addArrangedSubview(statusExplanationLabel)
        stack.addArrangedSubview(versionLabel)
        stack.addArrangedSubview(hostHeading)
        stack.addArrangedSubview(hostPathLabel)
        stack.addArrangedSubview(progressStack)
        return makeCard(containing: stack)
    }

    private func makeRegistrationSection() -> NSView {
        let stack = makeVerticalStack(spacing: 9)
        stack.addArrangedSubview(makeSectionHeading("Browser registrations"))
        stack.addArrangedSubview(registrationStack)
        return stack
    }

    private func makeFeedbackSection() -> NSView {
        let stack = makeVerticalStack(spacing: 7)
        stack.alignment = .width
        stack.addArrangedSubview(resultLabel)
        stack.addArrangedSubview(friendlyErrorLabel)
        stack.addArrangedSubview(technicalDisclosureButton)
        stack.addArrangedSubview(technicalErrorScrollView)
        return stack
    }

    private func makeActionSection() -> NSView {
        let mutationButtons = NSStackView(
            views: [primaryButton, reinstallButton, uninstallButton]
        )
        mutationButtons.orientation = .horizontal
        mutationButtons.alignment = .centerY
        mutationButtons.spacing = 8

        let utilityButtons = NSStackView(views: [revealButton, helpButton, closeButton])
        utilityButtons.orientation = .horizontal
        utilityButtons.alignment = .centerY
        utilityButtons.spacing = 8

        let mutationSpacer = NSView()
        mutationSpacer.setContentHuggingPriority(.defaultLow, for: .horizontal)
        mutationSpacer.setContentCompressionResistancePriority(
            .defaultLow,
            for: .horizontal
        )
        let mutationRow = NSStackView(views: [mutationButtons, mutationSpacer])
        mutationRow.orientation = .horizontal
        mutationRow.alignment = .centerY

        let utilitySpacer = NSView()
        utilitySpacer.setContentHuggingPriority(.defaultLow, for: .horizontal)
        utilitySpacer.setContentCompressionResistancePriority(
            .defaultLow,
            for: .horizontal
        )
        let utilityRow = NSStackView(views: [utilitySpacer, utilityButtons])
        utilityRow.orientation = .horizontal
        utilityRow.alignment = .centerY

        let rows = makeVerticalStack(spacing: 10)
        rows.alignment = .width
        rows.addArrangedSubview(mutationRow)
        rows.addArrangedSubview(utilityRow)
        return rows
    }

    private func render() {
        applicationLocationLabel.stringValue = viewModel.applicationLocationInstruction ?? ""
        applicationLocationLabel.isHidden = viewModel.applicationLocationInstruction == nil

        statusTitleLabel.stringValue = viewModel.statusTitle
        statusTitleLabel.textColor = statusColor
        statusExplanationLabel.stringValue = viewModel.statusExplanation
        versionLabel.stringValue = viewModel.packageVersionText
        hostPathLabel.stringValue = viewModel.hostPath ?? "Unavailable until status is checked"
        hostPathLabel.toolTip = viewModel.hostPath

        renderRegistrationRows()
        renderFeedback()
        renderActions()

        if viewModel.isBusy {
            progressIndicator.startAnimation(nil)
        } else {
            progressIndicator.stopAnimation(nil)
        }
        progressLabel.isHidden = !viewModel.isBusy
        view.needsLayout = true
    }

    private func renderRegistrationRows() {
        for arrangedSubview in registrationStack.arrangedSubviews {
            registrationStack.removeArrangedSubview(arrangedSubview)
            arrangedSubview.removeFromSuperview()
        }
        guard !viewModel.registrationRows.isEmpty else {
            let placeholder = NSTextField(
                wrappingLabelWithString: "Registration details will appear after the status check."
            )
            placeholder.textColor = .secondaryLabelColor
            registrationStack.addArrangedSubview(placeholder)
            return
        }
        for row in viewModel.registrationRows {
            let rowView = makeRegistrationRow(row)
            registrationStack.addArrangedSubview(rowView)
            rowView.widthAnchor.constraint(equalTo: registrationStack.widthAnchor).isActive = true
        }
    }

    private func makeRegistrationRow(_ row: RegistrationRowPresentation) -> NSView {
        let nameLabel = NSTextField(labelWithString: row.browserName)
        nameLabel.font = .systemFont(ofSize: 13, weight: .semibold)
        let statusLabel = NSTextField(labelWithString: row.status)
        statusLabel.textColor = row.status == "Registered"
            ? .systemGreen
            : .systemOrange

        let heading = NSStackView(views: [nameLabel, statusLabel])
        heading.orientation = .horizontal
        heading.alignment = .firstBaseline
        heading.spacing = 10

        let manifestPathLabel = NSTextField(labelWithString: row.manifestPath)
        configureSelectablePathField(
            manifestPathLabel,
            accessibilityLabel: "\(row.browserName) registration manifest path"
        )
        manifestPathLabel.toolTip = row.manifestPath

        let rowStack = makeVerticalStack(spacing: 3)
        rowStack.addArrangedSubview(heading)
        rowStack.addArrangedSubview(manifestPathLabel)
        if let registeredHostPath = row.registeredHostPath {
            let registeredPathLabel = NSTextField(
                labelWithString: "Registered helper: \(registeredHostPath)"
            )
            configureSelectablePathField(
                registeredPathLabel,
                accessibilityLabel: "\(row.browserName) registered helper path"
            )
            registeredPathLabel.toolTip = registeredHostPath
            rowStack.addArrangedSubview(registeredPathLabel)
        }
        rowStack.setAccessibilityElement(true)
        rowStack.setAccessibilityLabel("\(row.browserName): \(row.status)")
        return makeCard(containing: rowStack, compact: true)
    }

    private func renderFeedback() {
        let result = viewModel.postUninstallInstruction ?? viewModel.successInstruction
        resultLabel.stringValue = result ?? ""
        resultLabel.isHidden = result == nil

        friendlyErrorLabel.stringValue = viewModel.friendlyError ?? ""
        friendlyErrorLabel.isHidden = viewModel.friendlyError == nil

        technicalDisclosureButton.isHidden = viewModel.technicalError == nil
        technicalErrorTextView.string = viewModel.technicalError ?? ""
        technicalErrorScrollView.isHidden = viewModel.technicalError == nil
            || technicalDisclosureButton.state != .on
    }

    private func renderActions() {
        primaryButton.title = viewModel.primaryActionTitle
        primaryButton.setAccessibilityLabel(viewModel.primaryActionTitle)
        primaryButton.isHidden = viewModel.primaryAction == .none
            || viewModel.primaryAction == .ready
        primaryButton.isEnabled = viewModel.canPerformPrimaryAction

        reinstallButton.title = viewModel.reinstallActionTitle
        reinstallButton.setAccessibilityLabel(viewModel.reinstallActionTitle)
        reinstallButton.isHidden = viewModel.primaryAction != .ready
        reinstallButton.isEnabled = viewModel.canReinstall

        uninstallButton.title = viewModel.uninstallActionTitle
        uninstallButton.setAccessibilityLabel(viewModel.uninstallActionTitle)
        uninstallButton.isHidden = viewModel.snapshot?.state == .notInstalled
            || viewModel.snapshot == nil
        uninstallButton.isEnabled = viewModel.canUninstall

        refreshButton.isEnabled = viewModel.canRefresh
        revealButton.isEnabled = FileManager.default.fileExists(
            atPath: Bundle.main.bundleURL.path
        )
        closeButton.isEnabled = !viewModel.isBusy
    }

    private var statusColor: NSColor {
        switch viewModel.state {
        case .ready:
            return .systemGreen
        case .failed:
            return .systemRed
        case .repairRequired:
            return .systemOrange
        case .loading, .notInstalled:
            return .labelColor
        }
    }

    private func makeSectionHeading(_ title: String) -> NSTextField {
        let label = NSTextField(labelWithString: title)
        label.font = .systemFont(ofSize: 14, weight: .semibold)
        label.setAccessibilityLabel(title)
        return label
    }

    private func makeVerticalStack(spacing: CGFloat) -> NSStackView {
        let stack = NSStackView()
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = spacing
        return stack
    }

    private func makeCard(containing content: NSView, compact: Bool = false) -> NSBox {
        let box = NSBox()
        box.boxType = .custom
        box.borderColor = .separatorColor
        box.borderWidth = 1
        box.cornerRadius = 8
        box.fillColor = .controlBackgroundColor
        box.contentViewMargins = compact
            ? NSSize(width: 12, height: 9)
            : NSSize(width: 14, height: 12)
        box.contentView = content
        return box
    }

    private func configureSelectablePathField(
        _ field: NSTextField,
        accessibilityLabel: String
    ) {
        field.font = .monospacedSystemFont(ofSize: 11, weight: .regular)
        field.textColor = .secondaryLabelColor
        field.lineBreakMode = .byTruncatingMiddle
        field.usesSingleLineMode = true
        field.isSelectable = true
        field.setAccessibilityLabel(accessibilityLabel)
    }

    private func configureButton(
        _ button: NSButton,
        title: String = "",
        action: Selector
    ) {
        button.title = title
        button.bezelStyle = .rounded
        button.target = self
        button.action = action
        if !title.isEmpty {
            button.setAccessibilityLabel(title)
        }
    }

    @objc
    private func performPrimaryAction() {
        Task { [weak self] in
            await self?.viewModel.performPrimaryAction()
        }
    }

    @objc
    private func reinstallHelper() {
        Task { [weak self] in
            await self?.viewModel.reinstall()
        }
    }

    @objc
    private func refreshStatus() {
        Task { [weak self] in
            await self?.viewModel.refresh()
        }
    }

    @objc
    private func requestUninstall() {
        viewModel.requestUninstall()
        guard viewModel.isUninstallConfirmationPresented else {
            return
        }

        let alert = NSAlert()
        alert.alertStyle = .warning
        alert.messageText = "Uninstall Kode Injector Helper?"
        alert.informativeText = "This removes the Firefox, Chrome, and Edge registrations for your account. It keeps extension rules, settings, and local files. You can move the app to Trash afterward."
        alert.addButton(withTitle: viewModel.uninstallActionTitle)
        alert.addButton(withTitle: "Cancel")

        guard let window = view.window else {
            if alert.runModal() == .alertFirstButtonReturn {
                Task { [weak self] in
                    await self?.viewModel.confirmUninstall()
                }
            } else {
                viewModel.cancelUninstall()
            }
            return
        }
        alert.beginSheetModal(for: window) { [weak self] response in
            Task { @MainActor in
                guard let self else {
                    return
                }
                if response == .alertFirstButtonReturn {
                    await self.viewModel.confirmUninstall()
                } else {
                    self.viewModel.cancelUninstall()
                }
            }
        }
    }

    @objc
    private func revealInFinder() {
        NSWorkspace.shared.activateFileViewerSelecting([Bundle.main.bundleURL])
    }

    @objc
    private func openHelp() {
        NSWorkspace.shared.open(Self.projectURL)
    }

    @objc
    private func closeWindow() {
        view.window?.close()
    }

    @objc
    private func toggleTechnicalDetails() {
        technicalErrorScrollView.isHidden = technicalDisclosureButton.state != .on
        technicalDisclosureButton.setAccessibilityLabel(
            technicalDisclosureButton.state == .on
                ? "Hide technical error details"
                : "Show technical error details"
        )
        view.needsLayout = true
    }
}
