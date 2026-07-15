import AppKit

@MainActor
final class HelperApplicationDelegate: NSObject, NSApplicationDelegate {
    private var window: NSWindow?
    private var installerViewController: InstallerViewController?

    func applicationWillFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        let viewModel = InstallerViewModel(
            client: InstallerClient.bundled(),
            applicationLocation: HelperApplicationLocation.detect()
        )
        let viewController = InstallerViewController(viewModel: viewModel)
        let window = NSWindow(
            contentRect: NSRect(origin: .zero, size: InstallerViewController.preferredContentSize),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = viewModel.productTitle
        window.contentViewController = viewController
        window.contentMinSize = NSSize(
            width: InstallerViewController.minimumContentWidth,
            height: 620
        )
        window.isReleasedWhenClosed = false
        window.center()

        installerViewController = viewController
        self.window = window
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(
        _ sender: NSApplication
    ) -> Bool {
        true
    }
}

let application = NSApplication.shared
let applicationDelegate = HelperApplicationDelegate()
application.delegate = applicationDelegate
application.run()
