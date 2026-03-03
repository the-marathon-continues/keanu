import Foundation
import os.log

// Darwin notify functions for cross-process notifications
@_silgen_name("notify_register_dispatch")
private func notify_register_dispatch(
    _ name: UnsafePointer<CChar>,
    _ out_token: UnsafeMutablePointer<Int32>,
    _ queue: DispatchQueue,
    _ handler: @escaping @convention(block) (Int32) -> Void
) -> UInt32

@_silgen_name("notify_cancel")
private func notify_cancel(_ token: Int32) -> UInt32

@_silgen_name("notify_post")
private func notify_post(_ name: UnsafePointer<CChar>) -> UInt32

/// IPC bridge for communication between extensions and the main app.
///
/// Extensions write events to a shared JSONL file in the App Group container.
/// The main app reads events and relays them to the gateway.
/// Darwin notifications wake the main app when new events arrive.
public final class ExtensionIPCBridge: @unchecked Sendable {

    // MARK: - Constants

    public static let appGroupIdentifier = "group.ai.keanu"
    public static let eventsFileName = "extension-events.jsonl"
    public static let policyFileName = "extension-policy.json"
    public static let notificationName = "ai.keanu.extension.event"

    // MARK: - Properties

    private let log = Logger(subsystem: "ai.keanu.extensionkit", category: "ipc")
    private let containerURL: URL?
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private let fileQueue = DispatchQueue(label: "ai.keanu.ipc.file", qos: .utility)

    // MARK: - Initialization

    public init() {
        self.containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: Self.appGroupIdentifier
        )

        if containerURL == nil {
            log.error("Failed to get App Group container URL. IPC will not work.")
        } else {
            log.info("IPC bridge initialized with container: \(self.containerURL!.path)")
        }
    }

    // MARK: - Event Writing (Extension Side)

    /// Sends an event from an extension to the main app.
    /// Thread-safe, can be called from any queue.
    public func send(event: ExtensionEvent) {
        fileQueue.async { [weak self] in
            self?.writeEvent(event)
        }
    }

    private func writeEvent(_ event: ExtensionEvent) {
        guard let containerURL else {
            log.error("Cannot write event: no container URL")
            return
        }

        let eventsURL = containerURL.appendingPathComponent(Self.eventsFileName)

        do {
            // Encode event to JSON line
            let data = try encoder.encode(event)
            guard var line = String(data: data, encoding: .utf8) else {
                log.error("Failed to encode event to UTF-8")
                return
            }
            line.append("\n")

            // Append to file (create if needed)
            if FileManager.default.fileExists(atPath: eventsURL.path) {
                let handle = try FileHandle(forWritingTo: eventsURL)
                defer { try? handle.close() }
                try handle.seekToEnd()
                if let lineData = line.data(using: .utf8) {
                    try handle.write(contentsOf: lineData)
                }
            } else {
                try line.write(to: eventsURL, atomically: true, encoding: .utf8)
            }

            // Notify main app
            notifyMainApp()

        } catch {
            log.error("Failed to write event: \(error.localizedDescription)")
        }
    }

    private func notifyMainApp() {
        // Darwin notification to wake the main app
        let name = Self.notificationName as CFString
        let center = CFNotificationCenterGetDarwinNotifyCenter()
        CFNotificationCenterPostNotification(center, CFNotificationName(name), nil, nil, true)
    }

    // MARK: - Event Reading (Main App Side)

    /// Reads and clears all pending events.
    /// Returns events in chronological order.
    public func readAndClearEvents() -> [ExtensionEvent] {
        guard let containerURL else {
            log.error("Cannot read events: no container URL")
            return []
        }

        let eventsURL = containerURL.appendingPathComponent(Self.eventsFileName)

        guard FileManager.default.fileExists(atPath: eventsURL.path) else {
            return []
        }

        do {
            // Read all content
            let content = try String(contentsOf: eventsURL, encoding: .utf8)

            // Clear the file atomically
            try "".write(to: eventsURL, atomically: true, encoding: .utf8)

            // Parse JSONL
            var events: [ExtensionEvent] = []
            for line in content.components(separatedBy: .newlines) {
                let trimmed = line.trimmingCharacters(in: .whitespaces)
                guard !trimmed.isEmpty else { continue }

                if let data = trimmed.data(using: .utf8) {
                    do {
                        let event = try decoder.decode(ExtensionEvent.self, from: data)
                        events.append(event)
                    } catch {
                        log.warning("Failed to decode event line: \(error.localizedDescription)")
                    }
                }
            }

            log.info("Read \(events.count) events from IPC bridge")
            return events

        } catch {
            log.error("Failed to read events: \(error.localizedDescription)")
            return []
        }
    }

    // MARK: - Policy (Main App → Extension)

    /// Saves the current policy for extensions to read.
    public func savePolicy(_ policy: ExtensionPolicy) {
        guard let containerURL else {
            log.error("Cannot save policy: no container URL")
            return
        }

        let policyURL = containerURL.appendingPathComponent(Self.policyFileName)

        do {
            let data = try encoder.encode(policy)
            try data.write(to: policyURL, options: .atomic)
            log.info("Saved extension policy")
        } catch {
            log.error("Failed to save policy: \(error.localizedDescription)")
        }
    }

    /// Loads the current policy (called by extensions).
    public func loadPolicy() -> ExtensionPolicy {
        guard let containerURL else {
            log.warning("Cannot load policy: no container URL, using defaults")
            return .default
        }

        let policyURL = containerURL.appendingPathComponent(Self.policyFileName)

        guard FileManager.default.fileExists(atPath: policyURL.path) else {
            return .default
        }

        do {
            let data = try Data(contentsOf: policyURL)
            let policy = try decoder.decode(ExtensionPolicy.self, from: data)
            log.info("Loaded extension policy: mode=\(policy.mode.rawValue)")
            return policy
        } catch {
            log.error("Failed to load policy: \(error.localizedDescription)")
            return .default
        }
    }

    // MARK: - Darwin Notification Registration (Main App Side)

    /// Registers for Darwin notifications when extensions send events.
    /// Call from main app to get notified of new events.
    public func registerForNotifications(handler: @escaping () -> Void) -> Int32 {
        var token: Int32 = 0
        let name = Self.notificationName

        notify_register_dispatch(
            name,
            &token,
            DispatchQueue.main
        ) { _ in
            handler()
        }

        log.info("Registered for extension notifications with token: \(token)")
        return token
    }

    /// Unregisters from Darwin notifications.
    public func unregisterNotifications(token: Int32) {
        notify_cancel(token)
        log.info("Unregistered extension notification token: \(token)")
    }
}
