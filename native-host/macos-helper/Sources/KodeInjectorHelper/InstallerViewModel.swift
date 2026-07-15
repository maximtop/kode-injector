import Foundation

enum HelperApplicationLocation: Equatable, Sendable {
    case systemApplications
    case userApplications
    case readOnlyVolume
    case outsideApplications
    case unavailable

    private static let systemApplicationsURL = URL(
        fileURLWithPath: "/Applications",
        isDirectory: true
    )
    private static let applicationsDirectoryName = "Applications"
    private static let mountedVolumesURL = URL(
        fileURLWithPath: "/Volumes",
        isDirectory: true
    )
    private static let userApplicationsGuidance =
        "Without administrator access, in Finder choose Go > Home, "
        + "create or open Applications, move the app there, and open that copy."

    var allowsRegistrationChanges: Bool {
        switch self {
        case .systemApplications, .userApplications:
            return true
        case .readOnlyVolume, .outsideApplications, .unavailable:
            return false
        }
    }

    var instruction: String? {
        switch self {
        case .systemApplications, .userApplications:
            return nil
        case .readOnlyVolume:
            return "This copy is on a read-only disk image. "
                + "Drag Kode Injector Helper to /Applications, then open that copy. "
                + Self.userApplicationsGuidance
        case .outsideApplications:
            return "Move Kode Injector Helper to /Applications, then open that copy "
                + "to install or remove browser registrations. "
                + Self.userApplicationsGuidance
        case .unavailable:
            return "Kode Injector Helper could not verify its location. "
                + "Move it to /Applications and open that copy before changing "
                + "browser registrations. "
                + Self.userApplicationsGuidance
        }
    }

    static func detect(
        bundleURL: URL = Bundle.main.bundleURL,
        homeDirectoryURL: URL = FileManager.default.homeDirectoryForCurrentUser,
        systemApplicationsURL: URL = HelperApplicationLocation.systemApplicationsURL,
        mountedVolumesURL: URL = HelperApplicationLocation.mountedVolumesURL,
        fileManager: FileManager = .default
    ) -> HelperApplicationLocation {
        let standardizedBundleURL = bundleURL.standardizedFileURL
        guard standardizedBundleURL.pathExtension.lowercased() == "app" else {
            return .unavailable
        }
        guard isExistingDirectoryWithoutSymbolicLinks(
            standardizedBundleURL,
            fileManager: fileManager
        ) else {
            return .unavailable
        }
        let canonicalBundleURL = standardizedBundleURL
            .resolvingSymlinksInPath()
            .standardizedFileURL
        guard canonicalBundleURL.path == standardizedBundleURL.path else {
            return .unavailable
        }
        let isOnMountedVolume = path(
            canonicalBundleURL,
            isInside: mountedVolumesURL.resolvingSymlinksInPath()
        )
        let volumeIsReadOnly: Bool?
        do {
            volumeIsReadOnly = try canonicalBundleURL.resourceValues(
                forKeys: [.volumeIsReadOnlyKey]
            ).volumeIsReadOnly
        } catch {
            volumeIsReadOnly = nil
        }
        if isOnMountedVolume || volumeIsReadOnly == true {
            return .readOnlyVolume
        }
        guard let volumeIsReadOnly else {
            return .unavailable
        }
        return classify(
            bundleURL: canonicalBundleURL,
            homeDirectoryURL: homeDirectoryURL,
            volumeIsReadOnly: volumeIsReadOnly,
            systemApplicationsURL: systemApplicationsURL
        )
    }

    static func classify(
        bundleURL: URL,
        homeDirectoryURL: URL,
        volumeIsReadOnly: Bool,
        systemApplicationsURL: URL = HelperApplicationLocation.systemApplicationsURL
    ) -> HelperApplicationLocation {
        if volumeIsReadOnly {
            return .readOnlyVolume
        }
        let canonicalBundleURL = bundleURL
            .resolvingSymlinksInPath()
            .standardizedFileURL
        let canonicalSystemApplicationsURL = systemApplicationsURL
            .resolvingSymlinksInPath()
            .standardizedFileURL
        if path(canonicalBundleURL, isInside: canonicalSystemApplicationsURL) {
            return .systemApplications
        }
        let userApplicationsURL = homeDirectoryURL
            .appendingPathComponent(applicationsDirectoryName, isDirectory: true)
            .resolvingSymlinksInPath()
            .standardizedFileURL
        if path(canonicalBundleURL, isInside: userApplicationsURL) {
            return .userApplications
        }
        return .outsideApplications
    }

    private static func isExistingDirectoryWithoutSymbolicLinks(
        _ url: URL,
        fileManager: FileManager
    ) -> Bool {
        let components = url.standardizedFileURL.pathComponents
        guard components.first == "/" else {
            return false
        }
        var currentPath = "/"
        for component in components.dropFirst() {
            currentPath = (currentPath as NSString).appendingPathComponent(component)
            let attributes: [FileAttributeKey: Any]
            do {
                attributes = try fileManager.attributesOfItem(atPath: currentPath)
            } catch {
                return false
            }
            guard attributes[.type] as? FileAttributeType != .typeSymbolicLink else {
                return false
            }
        }
        guard let finalType = try? fileManager.attributesOfItem(
            atPath: url.path
        )[.type] as? FileAttributeType else {
            return false
        }
        return finalType == .typeDirectory
    }

    private static func path(_ candidate: URL, isInside directory: URL) -> Bool {
        let candidateComponents = candidate.standardizedFileURL.pathComponents
        let directoryComponents = directory.standardizedFileURL.pathComponents
        guard candidateComponents.count > directoryComponents.count else {
            return false
        }
        return candidateComponents.prefix(directoryComponents.count)
            .elementsEqual(directoryComponents)
    }
}

enum InstallerViewState: Equatable, Sendable {
    case loading
    case notInstalled
    case ready
    case repairRequired
    case failed
}

enum InstallerPrimaryAction: Equatable, Sendable {
    case none
    case install
    case ready
    case update
    case repair
}

struct RegistrationRowPresentation: Equatable, Sendable {
    let browser: Browser
    let browserName: String
    let status: String
    let manifestPath: String
    let registeredHostPath: String?
}

@MainActor
final class InstallerViewModel {
    private let client: any InstallerRunning
    let applicationLocation: HelperApplicationLocation

    private(set) var state: InstallerViewState = .loading
    private(set) var response: LifecycleResponse?
    private(set) var snapshot: InstallationSnapshot?
    private(set) var packageVersion: String?
    private(set) var isBusy = false
    private(set) var isUninstallConfirmationPresented = false
    private(set) var friendlyError: String?
    private(set) var technicalError: String?
    private(set) var completedAction: InstallerAction?

    var onChange: (@MainActor () -> Void)?

    init(
        client: any InstallerRunning,
        applicationLocation: HelperApplicationLocation
    ) {
        self.client = client
        self.applicationLocation = applicationLocation
    }

    var productTitle: String {
        "Kode Injector Helper"
    }

    var purposeExplanation: String {
        "Kode Injector uses this helper to read the local JavaScript and CSS files you choose."
    }

    var readOnlyExplanation: String {
        "The helper is read-only: it cannot write files, run programs, list directories, or access the network."
    }

    var packageVersionText: String {
        guard let packageVersion else {
            return "Version unavailable"
        }
        return "Version \(packageVersion)"
    }

    var applicationLocationInstruction: String? {
        applicationLocation.instruction
    }

    var primaryAction: InstallerPrimaryAction {
        guard let snapshot else {
            return .none
        }
        switch snapshot.state {
        case .notInstalled:
            return .install
        case .ready:
            return .ready
        case .repairRequired:
            return snapshot.registrations.contains(where: { $0.state == .stale })
                ? .update
                : .repair
        }
    }

    var canPerformPrimaryAction: Bool {
        guard !isBusy, applicationLocation.allowsRegistrationChanges else {
            return false
        }
        switch primaryAction {
        case .install, .update, .repair:
            return true
        case .none, .ready:
            return false
        }
    }

    var canRefresh: Bool {
        !isBusy
    }

    var canReinstall: Bool {
        !isBusy
            && applicationLocation.allowsRegistrationChanges
            && snapshot?.state == .ready
    }

    var canUninstall: Bool {
        guard !isBusy,
              applicationLocation.allowsRegistrationChanges,
              let snapshot else {
            return false
        }
        return snapshot.state == .ready || snapshot.state == .repairRequired
    }

    var hostPath: String? {
        snapshot?.host.path
    }

    var registrations: [BrowserRegistration] {
        snapshot?.registrations ?? []
    }

    var registrationRows: [RegistrationRowPresentation] {
        registrations.map { registration in
            RegistrationRowPresentation(
                browser: registration.browser,
                browserName: browserName(for: registration.browser),
                status: registrationStatus(for: registration.state),
                manifestPath: registration.manifestPath,
                registeredHostPath: registration.registeredHostPath
            )
        }
    }

    var statusTitle: String {
        switch state {
        case .loading:
            return "Checking status…"
        case .notInstalled:
            return "Not installed"
        case .ready:
            return "Ready"
        case .repairRequired:
            return primaryAction == .update ? "Update required" : "Repair required"
        case .failed:
            return "Action needed"
        }
    }

    var statusExplanation: String {
        switch state {
        case .loading:
            return "Checking the helper and browser registrations for this user."
        case .notInstalled:
            return "The helper is bundled with this app but is not registered with your browsers."
        case .ready:
            return "The helper and all browser registrations match this copy of the app."
        case .repairRequired:
            return primaryAction == .update
                ? "One or more browsers point to a different copy of Kode Injector Helper."
                : "One or more browser registrations are missing or damaged."
        case .failed:
            return friendlyError ?? "Kode Injector Helper could not check the current installation."
        }
    }

    var primaryActionTitle: String {
        switch primaryAction {
        case .none:
            return ""
        case .install:
            return "Install Helper"
        case .ready:
            return "Ready"
        case .update:
            return "Update Helper"
        case .repair:
            return "Repair Helper"
        }
    }

    var reinstallActionTitle: String {
        "Reinstall Helper"
    }

    var uninstallActionTitle: String {
        "Uninstall Helper"
    }

    var successInstruction: String? {
        guard completedAction == .install else {
            return nil
        }
        return "Firefox, Chrome, and Edge now use the read-only helper in this app. Return to Kode Injector Options and select Check again."
    }

    var postUninstallInstruction: String? {
        guard completedAction == .uninstall else {
            return nil
        }
        return "Firefox, Chrome, and Edge registrations were removed. Your extension rules, settings, and local files were not changed. You can now move Kode Injector Helper to Trash."
    }

    func refresh() async {
        await perform(.status)
    }

    func performPrimaryAction() async {
        guard canPerformPrimaryAction else {
            return
        }
        await perform(.install)
    }

    func reinstall() async {
        guard canReinstall else {
            return
        }
        await perform(.install)
    }

    func requestUninstall() {
        guard canUninstall else {
            return
        }
        isUninstallConfirmationPresented = true
        notifyChange()
    }

    func cancelUninstall() {
        isUninstallConfirmationPresented = false
        notifyChange()
    }

    func confirmUninstall() async {
        guard isUninstallConfirmationPresented, canUninstall else {
            return
        }
        isUninstallConfirmationPresented = false
        notifyChange()
        await perform(.uninstall)
    }

    private func perform(_ action: InstallerAction) async {
        guard !isBusy else {
            return
        }
        isBusy = true
        friendlyError = nil
        technicalError = nil
        completedAction = nil
        if action == .status, snapshot == nil {
            state = .loading
        }
        notifyChange()
        defer {
            isBusy = false
            notifyChange()
        }

        do {
            let result = try await client.run(action)
            response = result
            packageVersion = result.packageVersion
            guard result.success, let installation = result.installation else {
                applyLifecycleFailure(result.error)
                return
            }
            snapshot = installation
            state = viewState(for: installation.state)
            if action != .status {
                completedAction = action
            }
        } catch {
            state = .failed
            friendlyError = (error as? LocalizedError)?.errorDescription
                ?? "Kode Injector Helper could not complete the operation."
            technicalError = String(describing: error)
        }
    }

    private func browserName(for browser: Browser) -> String {
        switch browser {
        case .firefox:
            return "Firefox"
        case .chrome:
            return "Google Chrome"
        case .edge:
            return "Microsoft Edge"
        }
    }

    private func registrationStatus(for state: RegistrationState) -> String {
        switch state {
        case .missing:
            return "Not registered"
        case .registered:
            return "Registered"
        case .stale:
            return "Points to another app"
        case .invalid:
            return "Needs repair"
        }
    }

    private func notifyChange() {
        onChange?()
    }

    private func applyLifecycleFailure(_ error: LifecycleError?) {
        state = .failed
        friendlyError = error?.message
            ?? "Kode Injector Helper could not complete the operation."
        technicalError = error?.code.rawValue ?? "invalidResponse"
    }

    private func viewState(for state: InstallationState) -> InstallerViewState {
        switch state {
        case .notInstalled:
            return .notInstalled
        case .ready:
            return .ready
        case .repairRequired:
            return .repairRequired
        }
    }
}
