import Foundation
import XCTest

@testable import KodeInjectorHelper

final class InstallerContractTests: XCTestCase {
    func testDecodesValidReadyResponse() throws {
        let response = try LifecycleResponse.decodeValidated(validResponse())

        XCTAssertEqual(response.contractVersion, LifecycleResponse.contractVersion)
        XCTAssertEqual(response.action, .status)
        XCTAssertTrue(response.success)
        XCTAssertEqual(response.packageVersion, "0.8.2")
        XCTAssertEqual(response.installation?.state, .ready)
        XCTAssertEqual(
            response.installation?.registrations.map(\.browser),
            [.firefox, .chrome, .edge]
        )
        XCTAssertNil(response.error)
    }

    func testRejectsUnknownContractVersion() {
        XCTAssertThrowsError(
            try LifecycleResponse.decodeValidated(
                validResponse(replacing: #""contractVersion":1"#, with: #""contractVersion":2"#)
            )
        ) { error in
            XCTAssertEqual(error as? InstallerClientError, .unsupportedContract)
        }
    }

    func testRequiresLegacySupportPresenceSignal() {
        XCTAssertThrowsError(
            try LifecycleResponse.decodeValidated(
                validResponse(
                    replacing: ",\"legacySupportPresent\":false",
                    with: ""
                )
            )
        )
    }

    func testRejectsUnknownFieldsAtEveryLevel() {
        let mutations = [
            (#""success":true"#, #""success":true,"unknown":true"#),
            (#""state":"ready","host"#, #""state":"ready","unknown":true,"host"#),
            (#""state":"ready","path"#, #""state":"ready","unknown":true,"path"#),
            (#""browser":"firefox","state"#, #""browser":"firefox","unknown":true,"state"#),
        ]

        for (needle, replacement) in mutations {
            XCTAssertThrowsError(
                try LifecycleResponse.decodeValidated(
                    validResponse(replacing: needle, with: replacement)
                ),
                "accepted unknown field inserted beside \(needle)"
            )
        }
    }

    func testRejectsInvalidSemanticVersion() {
        XCTAssertThrowsError(
            try LifecycleResponse.decodeValidated(
                validResponse(replacing: "0.8.2", with: "release-current")
            )
        ) { error in
            XCTAssertEqual(error as? InstallerClientError, .invalidResponse)
        }
    }

    func testRejectsInvalidSuccessErrorCombinations() {
        let missingInstallation = Data(
            #"{"contractVersion":1,"action":"status","success":true,"packageVersion":"0.8.2"}"#.utf8
        )
        let failureWithoutError = Data(
            #"{"contractVersion":1,"action":"install","success":false,"packageVersion":"0.8.2"}"#.utf8
        )
        let successWithError = Data(
            #"{"contractVersion":1,"action":"install","success":true,"packageVersion":"0.8.2","installation":{"state":"notInstalled","host":{"state":"ready","path":"/Applications/Kode Injector Helper.app/Contents/Helpers/kode-injector-native"},"registrations":[{"browser":"firefox","state":"missing","manifestPath":"/tmp/firefox.json"},{"browser":"chrome","state":"missing","manifestPath":"/tmp/chrome.json"},{"browser":"edge","state":"missing","manifestPath":"/tmp/edge.json"}],"legacySupportPresent":false},"error":{"code":"installFailed","message":"failed"}}"#.utf8
        )

        for data in [missingInstallation, failureWithoutError, successWithError] {
            XCTAssertThrowsError(try LifecycleResponse.decodeValidated(data))
        }
    }

    func testDecodesStructuredFailure() throws {
        let data = Data(
            #"{"contractVersion":1,"action":"install","success":false,"packageVersion":"0.8.2","error":{"code":"installFailed","message":"The browser registrations could not be written."}}"#.utf8
        )

        let response = try LifecycleResponse.decodeValidated(data)

        XCTAssertFalse(response.success)
        XCTAssertEqual(response.error?.code, .installFailed)
        XCTAssertEqual(response.error?.message, "The browser registrations could not be written.")
    }

    func testRejectsMissingDuplicateAndNoncanonicalRegistrations() {
        let firefox = registration(browser: "firefox")
        let chrome = registration(browser: "chrome")
        let edge = registration(browser: "edge")

        for registrations in [
            "[\(firefox),\(chrome)]",
            "[\(firefox),\(firefox),\(edge)]",
            "[\(chrome),\(firefox),\(edge)]",
        ] {
            XCTAssertThrowsError(
                try LifecycleResponse.decodeValidated(
                    validResponse(registrations: registrations)
                )
            )
        }
    }

    func testRejectsInvalidPathsAndOversizedError() {
        XCTAssertThrowsError(
            try LifecycleResponse.decodeValidated(
                validResponse(replacing: "/tmp/firefox.json", with: "relative/firefox.json")
            )
        )

        let message = String(repeating: "x", count: 4_097)
        let data = Data(
            #"{"contractVersion":1,"action":"uninstall","success":false,"packageVersion":"0.8.2","error":{"code":"uninstallFailed","message":"\#(message)"}}"#.utf8
        )
        XCTAssertThrowsError(try LifecycleResponse.decodeValidated(data))
    }

    func testRejectsInstallationStateThatDoesNotMatchAggregate() {
        let invalidReadyHost = validResponse(
            replacing: #""host":{"state":"ready"#,
            with: #""host":{"state":"invalid"#
        )
        let notInstalledWithRegisteredManifests = validResponse(
            replacing: #""installation":{"state":"ready"#,
            with: #""installation":{"state":"notInstalled"#
        )
        let repairRequiredWithExactManifests = validResponse(
            replacing: #""installation":{"state":"ready"#,
            with: #""installation":{"state":"repairRequired"#
        )
        let missing = "[\(missingRegistration(browser: "firefox")),"
            + "\(missingRegistration(browser: "chrome")),"
            + "\(missingRegistration(browser: "edge"))]"
        let readyWithMissingManifests = validResponse(registrations: missing)
        let readyWithLegacySupport = validResponse(legacySupportPresent: true)

        for data in [
            invalidReadyHost,
            notInstalledWithRegisteredManifests,
            repairRequiredWithExactManifests,
            readyWithMissingManifests,
            readyWithLegacySupport,
        ] {
            XCTAssertThrowsError(try LifecycleResponse.decodeValidated(data))
        }
    }

    func testRejectsRegistrationPathPresenceAndHostMismatch() {
        let registeredWithoutPath = registration(browser: "firefox")
            .replacingOccurrences(
                of: ",\"registeredHostPath\":\"/Applications/Kode Injector Helper.app/Contents/Helpers/kode-injector-native\"",
                with: ""
            )
        let missingWithPath = missingRegistration(browser: "firefox")
            .replacingOccurrences(
                of: "}",
                with: ",\"registeredHostPath\":\"/Applications/Kode Injector Helper.app/Contents/Helpers/kode-injector-native\"}"
            )
        let wrongHost = registration(browser: "firefox")
            .replacingOccurrences(
                of: "Kode Injector Helper.app",
                with: "Other Helper.app"
            )

        for firefox in [registeredWithoutPath, missingWithPath, wrongHost] {
            let registrations = "[\(firefox),\(registration(browser: "chrome")),"
                + "\(registration(browser: "edge"))]"
            XCTAssertThrowsError(
                try LifecycleResponse.decodeValidated(
                    validResponse(registrations: registrations)
                )
            )
        }
    }

    func testAcceptsDerivedNotInstalledAndRepairRequiredStates() throws {
        let missing = "[\(missingRegistration(browser: "firefox")),"
            + "\(missingRegistration(browser: "chrome")),"
            + "\(missingRegistration(browser: "edge"))]"
        let notInstalled = validResponse(
            replacing: #""installation":{"state":"ready"#,
            with: #""installation":{"state":"notInstalled"#,
            registrations: missing
        )
        let repairRegistrations = "[\(missingRegistration(browser: "firefox")),"
            + "\(registration(browser: "chrome")),\(registration(browser: "edge"))]"
        let repairRequired = validResponse(
            replacing: #""installation":{"state":"ready"#,
            with: #""installation":{"state":"repairRequired"#,
            registrations: repairRegistrations
        )
        let orphanedLegacySupport = validResponse(
            replacing: #""installation":{"state":"ready"#,
            with: #""installation":{"state":"repairRequired"#,
            registrations: missing,
            legacySupportPresent: true
        )

        XCTAssertEqual(
            try LifecycleResponse.decodeValidated(notInstalled).installation?.state,
            .notInstalled
        )
        XCTAssertEqual(
            try LifecycleResponse.decodeValidated(repairRequired).installation?.state,
            .repairRequired
        )
        let legacySnapshot = try LifecycleResponse.decodeValidated(
            orphanedLegacySupport
        ).installation
        XCTAssertEqual(legacySnapshot?.state, .repairRequired)
        XCTAssertTrue(legacySnapshot?.legacySupportPresent == true)
    }

    private func validResponse(
        replacing needle: String? = nil,
        with replacement: String = "",
        registrations: String? = nil,
        legacySupportPresent: Bool = false
    ) -> Data {
        var json = #"{"contractVersion":1,"action":"status","success":true,"packageVersion":"0.8.2","installation":{"state":"ready","host":{"state":"ready","path":"/Applications/Kode Injector Helper.app/Contents/Helpers/kode-injector-native"},"registrations":REGISTRATIONS,"legacySupportPresent":LEGACY_SUPPORT_PRESENT}}"#
        let canonical = "[\(registration(browser: "firefox")),\(registration(browser: "chrome")),\(registration(browser: "edge"))]"
        json = json.replacingOccurrences(of: "REGISTRATIONS", with: registrations ?? canonical)
        json = json.replacingOccurrences(
            of: "LEGACY_SUPPORT_PRESENT",
            with: String(legacySupportPresent)
        )
        if let needle {
            json = json.replacingOccurrences(of: needle, with: replacement)
        }
        return Data(json.utf8)
    }

    private func registration(browser: String) -> String {
        #"{"browser":"\#(browser)","state":"registered","manifestPath":"/tmp/\#(browser).json","registeredHostPath":"/Applications/Kode Injector Helper.app/Contents/Helpers/kode-injector-native"}"#
    }

    private func missingRegistration(browser: String) -> String {
        #"{"browser":"\#(browser)","state":"missing","manifestPath":"/tmp/\#(browser).json"}"#
    }
}
