import Foundation
import KeanuExtensionKit
import os.log

/// Relays events from system extensions to the gateway.
///
/// Listens for Darwin notifications from extensions, reads events from
/// the IPC bridge, and sends them to the gateway via the existing connection.
@MainActor
public final class ExtensionEventRelay: ObservableObject {

    // MARK: - Properties

    private let log = Logger(subsystem: "ai.keanu.mac", category: "extension-relay")
    private let ipcBridge = ExtensionIPCBridge()
    private var notificationToken: Int32 = 0

    @Published public private(set) var isRunning = false
    @Published public private(set) var totalEventsRelayed: Int = 0
    @Published public private(set) var recentEvents: [ExtensionEvent] = []

    private let maxRecentEvents = 100

    // MARK: - Lifecycle

    public init() {}

    /// Starts listening for extension events.
    public func start() {
        guard !isRunning else { return }

        log.info("Starting extension event relay...")

        notificationToken = ipcBridge.registerForNotifications { [weak self] in
            Task { @MainActor in
                self?.processEvents()
            }
        }

        isRunning = true
        log.info("Extension event relay started")

        // Process any events that arrived before we started
        processEvents()
    }

    /// Stops listening for extension events.
    public func stop() {
        guard isRunning else { return }

        log.info("Stopping extension event relay...")

        ipcBridge.unregisterNotifications(token: notificationToken)
        notificationToken = 0
        isRunning = false

        log.info("Extension event relay stopped")
    }

    // MARK: - Event Processing

    private func processEvents() {
        let events = ipcBridge.readAndClearEvents()

        guard !events.isEmpty else { return }

        log.info("Processing \(events.count) extension events")

        for event in events {
            relayToGateway(event)
            trackEvent(event)
        }

        totalEventsRelayed += events.count
    }

    private func relayToGateway(_ event: ExtensionEvent) {
        // TODO: Send to gateway via existing GatewayConnection
        // For now, just log it
        switch event {
        case .dnsQuery(let dns):
            log.info("DNS Query: \(dns.domain) (\(dns.queryType)) from \(dns.sourceApp ?? "unknown")")
        case .networkFlow(let flow):
            log.info("Network Flow: \(flow.protocol ?? "unknown") \(flow.direction.rawValue)")
        case .fileAccess(let file):
            log.info("File Access: \(file.operation.rawValue) \(file.path)")
        case .processExec(let proc):
            log.info("Process Exec: \(proc.path) pid=\(proc.processId)")
        }
    }

    private func trackEvent(_ event: ExtensionEvent) {
        recentEvents.insert(event, at: 0)
        if recentEvents.count > maxRecentEvents {
            recentEvents.removeLast()
        }
    }

    // MARK: - Policy Management

    /// Updates the extension policy.
    public func updatePolicy(_ policy: ExtensionPolicy) {
        ipcBridge.savePolicy(policy)
        log.info("Updated extension policy: mode=\(policy.mode.rawValue)")
    }

    /// Gets the current extension policy.
    public func currentPolicy() -> ExtensionPolicy {
        ipcBridge.loadPolicy()
    }
}
