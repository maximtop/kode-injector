import Foundation
import XCTest

@testable import KodeInjectorHelper

@MainActor
final class InstallerViewModelTests: XCTestCase {
    func testApplicationLocationAcceptsOnlyWritableApplicationsDirectories() {
        let home = URL(fileURLWithPath: "/Users/example", isDirectory: true)

        XCTAssertEqual(
            HelperApplicationLocation.classify(
                bundleURL: URL(fileURLWithPath: "/Applications/Kode Injector Helper.app"),
                homeDirectoryURL: home,
                volumeIsReadOnly: false
            ),
            .systemApplications
        )
        XCTAssertEqual(
            HelperApplicationLocation.classify(
                bundleURL: URL(fileURLWithPath: "/Users/example/Applications/Kode Injector Helper.app"),
                homeDirectoryURL: home,
                volumeIsReadOnly: false
            ),
            .userApplications
        )
        XCTAssertEqual(
            HelperApplicationLocation.classify(
                bundleURL: URL(fileURLWithPath: "/Volumes/Kode Injector Helper/Kode Injector Helper.app"),
                homeDirectoryURL: home,
                volumeIsReadOnly: true
            ),
            .readOnlyVolume
        )
        XCTAssertEqual(
            HelperApplicationLocation.classify(
                bundleURL: URL(fileURLWithPath: "/Users/example/Downloads/Kode Injector Helper.app"),
                homeDirectoryURL: home,
                volumeIsReadOnly: false
            ),
            .outsideApplications
        )
    }

    func testApplicationLocationDetectsCanonicalSystemAndUserApplications() throws {
        let fileManager = FileManager.default
        let root = fileManager.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Caches", isDirectory: true)
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        defer { try? fileManager.removeItem(at: root) }
        let systemApplications = root.appendingPathComponent(
            "System Applications",
            isDirectory: true
        )
        let home = root.appendingPathComponent("home", isDirectory: true)
        let userApplications = home.appendingPathComponent(
            "Applications",
            isDirectory: true
        )
        let systemBundle = systemApplications.appendingPathComponent(
            "Kode Injector Helper.app",
            isDirectory: true
        )
        let userBundle = userApplications.appendingPathComponent(
            "Kode Injector Helper.app",
            isDirectory: true
        )
        let renamedBundle = systemApplications.appendingPathComponent(
            "My Local Files Helper.app",
            isDirectory: true
        )
        try fileManager.createDirectory(
            at: systemBundle,
            withIntermediateDirectories: true
        )
        try fileManager.createDirectory(
            at: userBundle,
            withIntermediateDirectories: true
        )
        try fileManager.createDirectory(
            at: renamedBundle,
            withIntermediateDirectories: true
        )

        XCTAssertEqual(
            HelperApplicationLocation.detect(
                bundleURL: systemBundle,
                homeDirectoryURL: home,
                systemApplicationsURL: systemApplications,
                mountedVolumesURL: root.appendingPathComponent("Volumes"),
                fileManager: fileManager
            ),
            .systemApplications
        )
        XCTAssertEqual(
            HelperApplicationLocation.detect(
                bundleURL: userBundle,
                homeDirectoryURL: home,
                systemApplicationsURL: systemApplications,
                mountedVolumesURL: root.appendingPathComponent("Volumes"),
                fileManager: fileManager
            ),
            .userApplications
        )
        XCTAssertEqual(
            HelperApplicationLocation.detect(
                bundleURL: renamedBundle,
                homeDirectoryURL: home,
                systemApplicationsURL: systemApplications,
                mountedVolumesURL: root.appendingPathComponent("Volumes"),
                fileManager: fileManager
            ),
            .systemApplications,
            "renaming a trusted non-symlink app must not prevent repair"
        )
    }

    func testApplicationLocationRejectsSymlinkedBundleAndParentComponents() throws {
        let fileManager = FileManager.default
        let root = fileManager.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Caches", isDirectory: true)
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        defer { try? fileManager.removeItem(at: root) }
        let systemApplications = root.appendingPathComponent(
            "System Applications",
            isDirectory: true
        )
        let home = root.appendingPathComponent("home", isDirectory: true)
        let externalParent = root.appendingPathComponent("external", isDirectory: true)
        let externalBundle = externalParent.appendingPathComponent(
            "Kode Injector Helper.app",
            isDirectory: true
        )
        try fileManager.createDirectory(
            at: systemApplications,
            withIntermediateDirectories: true
        )
        try fileManager.createDirectory(
            at: externalBundle,
            withIntermediateDirectories: true
        )

        let linkedBundle = systemApplications.appendingPathComponent(
            "Linked Helper.app",
            isDirectory: true
        )
        try fileManager.createSymbolicLink(
            at: linkedBundle,
            withDestinationURL: externalBundle
        )
        let linkedParent = systemApplications.appendingPathComponent(
            "Linked Parent",
            isDirectory: true
        )
        try fileManager.createSymbolicLink(
            at: linkedParent,
            withDestinationURL: externalParent
        )
        let bundleThroughLinkedParent = linkedParent.appendingPathComponent(
            "Kode Injector Helper.app",
            isDirectory: true
        )

        for bundleURL in [linkedBundle, bundleThroughLinkedParent] {
            XCTAssertEqual(
                HelperApplicationLocation.detect(
                    bundleURL: bundleURL,
                    homeDirectoryURL: home,
                    systemApplicationsURL: systemApplications,
                    mountedVolumesURL: root.appendingPathComponent("Volumes"),
                    fileManager: fileManager
                ),
                .unavailable
            )
        }
    }

    func testUnsupportedApplicationLocationDisablesRegistrationChanges() async throws {
        let client = FixtureInstaller(responses: [
            .status: try fixture(state: .notInstalled),
        ])
        let model = InstallerViewModel(
            client: client,
            applicationLocation: .outsideApplications
        )

        await model.refresh()

        XCTAssertFalse(model.canPerformPrimaryAction)
        XCTAssertFalse(model.canReinstall)
        XCTAssertFalse(model.canUninstall)
        XCTAssertEqual(
            model.applicationLocationInstruction,
            "Move Kode Injector Helper to /Applications, then open that copy to install or remove browser registrations. Without administrator access, in Finder choose Go > Home, create or open Applications, move the app there, and open that copy."
        )
    }

    func testUnsupportedLocationGuidanceIncludesAdminFreeUserApplicationsRoute() {
        for location in [
            HelperApplicationLocation.readOnlyVolume,
            .outsideApplications,
            .unavailable,
        ] {
            XCTAssertTrue(location.instruction?.contains("/Applications") == true)
            XCTAssertTrue(
                location.instruction?.contains(
                    "Finder choose Go > Home, create or open Applications"
                ) == true
            )
        }
    }

    func testPresentationDataExplainsProductAndExactRegistrationState() async throws {
        let client = FixtureInstaller(responses: [
            .status: try fixture(state: .ready),
        ])
        let model = makeModel(client: client)

        await model.refresh()

        XCTAssertEqual(model.productTitle, "Kode Injector Helper")
        XCTAssertEqual(
            model.purposeExplanation,
            "Kode Injector uses this helper to read the local JavaScript and CSS files you choose."
        )
        XCTAssertEqual(
            model.readOnlyExplanation,
            "The helper is read-only: it cannot write files, run programs, list directories, or access the network."
        )
        XCTAssertEqual(model.packageVersionText, "Version 0.8.2")
        XCTAssertEqual(
            model.hostPath,
            "/Applications/Kode Injector Helper.app/Contents/Helpers/kode-injector-native"
        )
        XCTAssertEqual(
            model.registrationRows,
            [
                RegistrationRowPresentation(
                    browser: .firefox,
                    browserName: "Firefox",
                    status: "Registered",
                    manifestPath: "/tmp/firefox.json",
                    registeredHostPath: model.hostPath
                ),
                RegistrationRowPresentation(
                    browser: .chrome,
                    browserName: "Google Chrome",
                    status: "Registered",
                    manifestPath: "/tmp/chrome.json",
                    registeredHostPath: model.hostPath
                ),
                RegistrationRowPresentation(
                    browser: .edge,
                    browserName: "Microsoft Edge",
                    status: "Registered",
                    manifestPath: "/tmp/edge.json",
                    registeredHostPath: model.hostPath
                ),
            ]
        )
        XCTAssertEqual(model.statusTitle, "Ready")
        XCTAssertEqual(model.primaryActionTitle, "Ready")
        XCTAssertEqual(model.uninstallActionTitle, "Uninstall Helper")
        XCTAssertTrue(model.canUninstall)
    }

    func testSuccessfulInstallProvidesReturnToOptionsInstruction() async throws {
        let client = FixtureInstaller(responses: [
            .status: try fixture(state: .notInstalled),
            .install: try fixture(state: .ready, action: .install),
        ])
        let model = makeModel(client: client)
        await model.refresh()

        await model.performPrimaryAction()

        XCTAssertEqual(
            model.successInstruction,
            "Firefox, Chrome, and Edge now use the read-only helper in this app. Return to Kode Injector Options and select Check again."
        )
        XCTAssertNil(model.postUninstallInstruction)
    }

    func testSuccessfulUninstallProvidesTrashInstruction() async throws {
        let client = FixtureInstaller(responses: [
            .status: try fixture(state: .ready),
            .uninstall: try fixture(state: .notInstalled, action: .uninstall),
        ])
        let model = makeModel(client: client)
        await model.refresh()
        model.requestUninstall()

        await model.confirmUninstall()

        XCTAssertNil(model.successInstruction)
        XCTAssertEqual(
            model.postUninstallInstruction,
            "Firefox, Chrome, and Edge registrations were removed. Your extension rules, settings, and local files were not changed. You can now move Kode Injector Helper to Trash."
        )
    }

    func testNotInstalledStateOffersInstall() async throws {
        let client = FixtureInstaller(responses: [
            .status: try fixture(state: .notInstalled),
        ])
        let model = makeModel(client: client)

        await model.refresh()

        XCTAssertEqual(model.primaryAction, .install)
        XCTAssertTrue(model.canPerformPrimaryAction)
        XCTAssertFalse(model.canUninstall)
        XCTAssertFalse(model.canReinstall)
    }

    func testReadyStateReportsReadyAndAllowsReinstallAndUninstall() async throws {
        let client = FixtureInstaller(responses: [
            .status: try fixture(state: .ready),
        ])
        let model = makeModel(client: client)

        await model.refresh()

        XCTAssertEqual(model.primaryAction, .ready)
        XCTAssertFalse(model.canPerformPrimaryAction)
        XCTAssertTrue(model.canReinstall)
        XCTAssertTrue(model.canUninstall)
    }

    func testRepairStateOffersRepairAndUninstall() async throws {
        let client = FixtureInstaller(responses: [
            .status: try fixture(state: .repairRequired),
        ])
        let model = makeModel(client: client)

        await model.refresh()

        XCTAssertEqual(model.primaryAction, .repair)
        XCTAssertTrue(model.canPerformPrimaryAction)
        XCTAssertTrue(model.canUninstall)
    }

    func testStaleRegistrationOffersUpdate() async throws {
        let client = FixtureInstaller(responses: [
            .status: try fixture(state: .repairRequired, staleRegistration: true),
        ])
        let model = makeModel(client: client)

        await model.refresh()

        XCTAssertEqual(model.primaryAction, .update)
        XCTAssertTrue(model.canPerformPrimaryAction)
    }

    func testInstallTransitionsToReady() async throws {
        let client = FixtureInstaller(responses: [
            .status: try fixture(state: .notInstalled),
            .install: try fixture(state: .ready, action: .install),
        ])
        let model = makeModel(client: client)
        await model.refresh()

        await model.performPrimaryAction()

        let actions = await client.recordedActions()
        XCTAssertEqual(actions, [.status, .install])
        XCTAssertEqual(model.primaryAction, .ready)
        XCTAssertTrue(model.canUninstall)
    }

    func testMutationsAreDisabledWhileBusy() async throws {
        let gate = OperationGate()
        let response = try fixture(state: .notInstalled)
        let client = FixtureInstaller { action in
            if action == .status {
                await gate.wait()
            }
            return response
        }
        let model = makeModel(client: client)

        let refresh = Task { await model.refresh() }
        await gate.waitUntilEntered()

        XCTAssertTrue(model.isBusy)
        XCTAssertFalse(model.canRefresh)
        XCTAssertFalse(model.canPerformPrimaryAction)
        XCTAssertFalse(model.canUninstall)
        await model.performPrimaryAction()
        let busyActions = await client.recordedActions()
        XCTAssertEqual(busyActions, [.status])

        await gate.open()
        await refresh.value
        XCTAssertFalse(model.isBusy)
        XCTAssertTrue(model.canRefresh)
    }

    func testUninstallRequiresConfirmationAndThenTransitions() async throws {
        let client = FixtureInstaller(responses: [
            .status: try fixture(state: .ready),
            .uninstall: try fixture(state: .notInstalled, action: .uninstall),
        ])
        let model = makeModel(client: client)
        await model.refresh()

        model.requestUninstall()

        XCTAssertTrue(model.isUninstallConfirmationPresented)
        let unconfirmedActions = await client.recordedActions()
        XCTAssertEqual(unconfirmedActions, [.status])

        await model.confirmUninstall()

        XCTAssertFalse(model.isUninstallConfirmationPresented)
        let confirmedActions = await client.recordedActions()
        XCTAssertEqual(confirmedActions, [.status, .uninstall])
        XCTAssertEqual(model.primaryAction, .install)
        XCTAssertFalse(model.canUninstall)
    }

    func testCancelUninstallDoesNotInvokeClient() async throws {
        let client = FixtureInstaller(responses: [
            .status: try fixture(state: .ready),
        ])
        let model = makeModel(client: client)
        await model.refresh()

        model.requestUninstall()
        model.cancelUninstall()

        XCTAssertFalse(model.isUninstallConfirmationPresented)
        let actions = await client.recordedActions()
        XCTAssertEqual(actions, [.status])
    }

    func testKeepsFriendlyAndTechnicalErrorsSeparate() async {
        let client = FixtureInstaller { _ in
            throw InstallerClientError.timedOut
        }
        let model = makeModel(client: client)

        await model.refresh()

        XCTAssertEqual(model.state, .failed)
        XCTAssertEqual(model.friendlyError, "The installer did not finish in time.")
        XCTAssertEqual(model.technicalError, "timedOut")
        XCTAssertFalse(model.isBusy)
        XCTAssertTrue(model.canRefresh)
    }

    func testRefreshRemainsAvailableAfterInitialStatusFailure() async {
        let client = FixtureInstaller { _ in
            throw InstallerClientError.timedOut
        }
        let model = makeModel(client: client)

        await model.refresh()
        XCTAssertEqual(model.state, .failed)
        XCTAssertTrue(model.canRefresh)

        await model.refresh()

        let actions = await client.recordedActions()
        XCTAssertEqual(actions, [.status, .status])
        XCTAssertEqual(model.state, .failed)
        XCTAssertTrue(model.canRefresh)
    }

    func testStructuredFailureRemainsActionable() async throws {
        let client = FixtureInstaller(responses: [
            .status: try failureFixture(action: .status),
        ])
        let model = makeModel(client: client)

        await model.refresh()

        XCTAssertEqual(model.state, .failed)
        XCTAssertEqual(model.friendlyError, "The browser registrations could not be inspected.")
        XCTAssertEqual(model.technicalError, "statusFailed")
    }

    private func makeModel(client: any InstallerRunning) -> InstallerViewModel {
        InstallerViewModel(
            client: client,
            applicationLocation: .systemApplications
        )
    }

    private func fixture(
        state: InstallationState,
        action: InstallerAction = .status,
        staleRegistration: Bool = false
    ) throws -> LifecycleResponse {
        let hostPath = "/Applications/Kode Injector Helper.app/Contents/Helpers/kode-injector-native"
        let registrationStates: [RegistrationState]
        switch state {
        case .notInstalled:
            registrationStates = [.missing, .missing, .missing]
        case .ready:
            registrationStates = [.registered, .registered, .registered]
        case .repairRequired:
            registrationStates = staleRegistration
                ? [.stale, .registered, .registered]
                : [.missing, .registered, .invalid]
        }
        let browsers: [Browser] = [.firefox, .chrome, .edge]
        let registrations = zip(browsers, registrationStates).map { browser, registrationState in
            let registeredPath: String
            if registrationState == .registered {
                registeredPath = #", "registeredHostPath":"\#(hostPath)""#
            } else if registrationState == .stale {
                registeredPath = #", "registeredHostPath":"/Applications/Old Kode Injector Helper.app/Contents/Helpers/kode-injector-native""#
            } else {
                registeredPath = ""
            }
            return #"{"browser":"\#(browser.rawValue)","state":"\#(registrationState.rawValue)","manifestPath":"/tmp/\#(browser.rawValue).json"\#(registeredPath)}"#
        }.joined(separator: ",")
        let json = #"{"contractVersion":1,"action":"\#(action.rawValue)","success":true,"packageVersion":"0.8.2","installation":{"state":"\#(state.rawValue)","host":{"state":"ready","path":"\#(hostPath)"},"registrations":[\#(registrations)],"legacySupportPresent":false}}"#
        return try LifecycleResponse.decodeValidated(Data(json.utf8))
    }

    private func failureFixture(action: InstallerAction) throws -> LifecycleResponse {
        let json = #"{"contractVersion":1,"action":"\#(action.rawValue)","success":false,"packageVersion":"0.8.2","error":{"code":"statusFailed","message":"The browser registrations could not be inspected."}}"#
        return try LifecycleResponse.decodeValidated(Data(json.utf8))
    }
}

private actor FixtureInstaller: InstallerRunning {
    typealias Handler = @Sendable (InstallerAction) async throws -> LifecycleResponse

    private let handler: Handler
    private var actions: [InstallerAction] = []

    init(responses: [InstallerAction: LifecycleResponse]) {
        handler = { action in
            guard let response = responses[action] else {
                throw InstallerClientError.invalidResponse
            }
            return response
        }
    }

    init(handler: @escaping Handler) {
        self.handler = handler
    }

    func run(_ action: InstallerAction) async throws -> LifecycleResponse {
        actions.append(action)
        return try await handler(action)
    }

    func recordedActions() -> [InstallerAction] {
        actions
    }
}

private actor OperationGate {
    private var continuation: CheckedContinuation<Void, Never>?
    private var enteredContinuation: CheckedContinuation<Void, Never>?
    private var entered = false
    private var opened = false

    func wait() async {
        entered = true
        enteredContinuation?.resume()
        enteredContinuation = nil
        guard !opened else {
            return
        }
        await withCheckedContinuation { continuation = $0 }
    }

    func waitUntilEntered() async {
        guard !entered else {
            return
        }
        await withCheckedContinuation { enteredContinuation = $0 }
    }

    func open() {
        opened = true
        continuation?.resume()
        continuation = nil
    }
}
