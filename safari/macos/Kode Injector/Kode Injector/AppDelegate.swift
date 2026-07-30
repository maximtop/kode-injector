import Cocoa

/// Containing-app lifecycle used to host the Safari extension onboarding window.
@main
final class AppDelegate: NSObject, NSApplicationDelegate {
    /// Closes the onboarding app when its only window closes.
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }

    /// Opts into secure state restoration on every supported macOS version.
    func applicationSupportsSecureRestorableState(_ app: NSApplication) -> Bool {
        true
    }

}
