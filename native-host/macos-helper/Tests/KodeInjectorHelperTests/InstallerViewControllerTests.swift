import AppKit
import XCTest

@testable import KodeInjectorHelper

@MainActor
final class InstallerViewControllerTests: XCTestCase {
    func testContentAndLongTechnicalDetailsRemainScrollableAtSmallHeight() async {
        _ = NSApplication.shared
        let model = InstallerViewModel(
            client: LongFailureInstaller(),
            applicationLocation: .systemApplications
        )
        await model.refresh()
        let controller = InstallerViewController(viewModel: model)
        let rootView = controller.view
        let container = constrain(
            rootView,
            to: NSSize(width: 540, height: 320)
        )

        let scrollViews = descendants(of: rootView).compactMap { $0 as? NSScrollView }
        let technicalScrollView = try? XCTUnwrap(
            scrollViews.first(where: { $0.documentView is NSTextView })
        )
        let contentScrollView = scrollViews.first { $0 !== technicalScrollView }

        XCTAssertEqual(scrollViews.count, 2)
        XCTAssertTrue(contentScrollView?.hasVerticalScroller == true)
        XCTAssertEqual(contentScrollView?.frame.height ?? 0, 320, accuracy: 1)
        XCTAssertTrue(technicalScrollView?.hasVerticalScroller == true)
        XCTAssertFalse(technicalScrollView?.hasHorizontalScroller == true)
        XCTAssertTrue(
            technicalScrollView?.constraints.contains(where: {
                $0.firstAttribute == .height
                    && $0.relation == .equal
                    && $0.constant == InstallerViewController.technicalDetailsHeight
            }) == true
        )
        XCTAssertGreaterThan(
            (technicalScrollView?.documentView as? NSTextView)?.string.count ?? 0,
            4_000
        )

        let disclosure = descendants(of: rootView)
            .compactMap { $0 as? NSButton }
            .first { $0.title == "Technical details" }
        disclosure?.performClick(nil)
        container.layoutSubtreeIfNeeded()
        XCTAssertFalse(technicalScrollView?.isHidden ?? true)
        XCTAssertEqual(
            technicalScrollView?.frame.height ?? 0,
            InstallerViewController.technicalDetailsHeight,
            accuracy: 1
        )
        XCTAssertGreaterThan(
            contentScrollView?.documentView?.frame.height ?? 0,
            contentScrollView?.contentView.bounds.height ?? .greatestFiniteMagnitude
        )
    }

    func testCheckAgainIsVisibleAndEnabledAfterInitialFailure() async {
        _ = NSApplication.shared
        let model = InstallerViewModel(
            client: LongFailureInstaller(),
            applicationLocation: .systemApplications
        )
        await model.refresh()
        let controller = InstallerViewController(viewModel: model)

        let refreshButton = descendants(of: controller.view)
            .compactMap { $0 as? NSButton }
            .first { $0.title == "Check Again" }

        XCTAssertNotNil(refreshButton)
        XCTAssertFalse(refreshButton?.isHidden ?? true)
        XCTAssertTrue(refreshButton?.isEnabled == true)
    }

    func testActionRowsFitWithoutOverlapAtMinimumWidth() async throws {
        _ = NSApplication.shared
        let model = InstallerViewModel(
            client: ReadyInstaller(),
            applicationLocation: .systemApplications
        )
        await model.refresh()
        let controller = InstallerViewController(viewModel: model)
        let rootView = controller.view
        let container = constrain(rootView, to: NSSize(width: 540, height: 1_000))
        XCTAssertEqual(container.bounds.width, 540)

        let contentScrollView = descendants(of: rootView)
            .compactMap { $0 as? NSScrollView }
            .first { !($0.documentView is NSTextView) }
        XCTAssertEqual(contentScrollView?.frame.width, rootView.bounds.width)

        let buttons = descendants(of: rootView).compactMap { $0 as? NSButton }
        let mutationButtons = try ["Reinstall Helper", "Uninstall Helper"].map { title in
            try XCTUnwrap(buttons.first { $0.title == title && !$0.isHidden })
        }
        let utilityButtons = try ["Reveal in Finder", "Help", "Close"].map { title in
            try XCTUnwrap(buttons.first { $0.title == title && !$0.isHidden })
        }
        let mutationFrames = mutationButtons.map { $0.convert($0.bounds, to: rootView) }
        let utilityFrames = utilityButtons.map { $0.convert($0.bounds, to: rootView) }

        for frame in mutationFrames + utilityFrames {
            XCTAssertGreaterThanOrEqual(frame.minX, rootView.bounds.minX)
            XCTAssertLessThanOrEqual(frame.maxX, rootView.bounds.maxX)
        }
        let mutationUnion = mutationFrames.reduce(NSRect.null) { $0.union($1) }
        let utilityUnion = utilityFrames.reduce(NSRect.null) { $0.union($1) }
        XCTAssertFalse(mutationUnion.intersects(utilityUnion))
    }

    private func descendants(of view: NSView) -> [NSView] {
        view.subviews.flatMap { child in
            [child] + descendants(of: child)
        }
    }

    private func constrain(_ view: NSView, to size: NSSize) -> NSView {
        view.translatesAutoresizingMaskIntoConstraints = false
        let container = NSView(frame: NSRect(origin: .zero, size: size))
        container.addSubview(view)
        NSLayoutConstraint.activate([
            view.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            view.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            view.topAnchor.constraint(equalTo: container.topAnchor),
            view.bottomAnchor.constraint(equalTo: container.bottomAnchor),
        ])
        container.layoutSubtreeIfNeeded()
        return container
    }
}

private actor LongFailureInstaller: InstallerRunning {
    func run(_ action: InstallerAction) async throws -> LifecycleResponse {
        throw InstallerClientError.launchFailed(String(repeating: "x", count: 4_096))
    }
}

private actor ReadyInstaller: InstallerRunning {
    func run(_ action: InstallerAction) async throws -> LifecycleResponse {
        let hostPath = "/Applications/Kode Injector Helper.app/Contents/Helpers/kode-injector-native"
        let registrations = ["firefox", "chrome", "edge"].map { browser in
            #"{"browser":"\#(browser)","state":"registered","manifestPath":"/tmp/\#(browser).json","registeredHostPath":"\#(hostPath)"}"#
        }.joined(separator: ",")
        let json = #"{"contractVersion":1,"action":"\#(action.rawValue)","success":true,"packageVersion":"0.8.2","installation":{"state":"ready","host":{"state":"ready","path":"\#(hostPath)"},"registrations":[\#(registrations)],"legacySupportPresent":false}}"#
        return try LifecycleResponse.decodeValidated(Data(json.utf8))
    }
}
