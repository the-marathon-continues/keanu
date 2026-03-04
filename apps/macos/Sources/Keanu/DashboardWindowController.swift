import AppKit
import SwiftUI

@MainActor
final class DashboardWindowController {
    static let shared = DashboardWindowController()

    private var window: NSWindow?

    func show() {
        if let existing = self.window, existing.isVisible {
            existing.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
            return
        }

        let contentView = NSHostingView(rootView: DashboardRootView())
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 900, height: 600),
            styleMask: [.titled, .closable, .resizable, .miniaturizable],
            backing: .buffered,
            defer: false)
        window.title = "Keanu Awareness"
        window.contentView = contentView
        window.center()
        window.setFrameAutosaveName("KeanuDashboard")
        window.isReleasedWhenClosed = false
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        self.window = window
    }

    func toggle() {
        if let window = self.window, window.isVisible {
            window.close()
        } else {
            self.show()
        }
    }
}
