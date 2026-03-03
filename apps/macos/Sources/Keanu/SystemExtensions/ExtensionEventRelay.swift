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
        let (text, params) = systemEventPayload(for: event)
        log.info("\(text)")

        Task {
            do {
                try await ControlChannel.shared.sendSystemEvent(text, params: params)
            } catch {
                log.warning("Failed to relay extension event: \(error.localizedDescription)")
            }
        }
    }

    private func systemEventPayload(for event: ExtensionEvent) -> (String, [String: AnyHashable]) {
        let iso = ISO8601DateFormatter()

        switch event {
        case .dnsQuery(let dns):
            var params: [String: AnyHashable] = [
                "type": "dns.query",
                "domain": dns.domain,
                "queryType": dns.queryType,
                "timestamp": iso.string(from: dns.timestamp),
            ]
            if let app = dns.sourceApp { params["sourceApp"] = app }
            if let proc = dns.sourceProcess { params["sourceProcess"] = proc }
            return ("DNS query: \(dns.domain) (\(dns.queryType))", params)

        case .networkFlow(let flow):
            var params: [String: AnyHashable] = [
                "type": "network.flow",
                "host": flow.destinationHost,
                "port": Int(flow.destinationPort),
                "protocol": flow.`protocol`,
                "direction": flow.direction.rawValue,
                "bytesIn": Int(flow.bytesIn),
                "bytesOut": Int(flow.bytesOut),
                "timestamp": iso.string(from: flow.timestamp),
            ]
            if let app = flow.sourceApp { params["sourceApp"] = app }
            return ("Network flow: \(flow.`protocol`) \(flow.direction.rawValue) \(flow.destinationHost):\(flow.destinationPort)", params)

        case .fileAccess(let file):
            let params: [String: AnyHashable] = [
                "type": "file.access",
                "path": file.path,
                "operation": file.operation.rawValue,
                "processPath": file.processPath,
                "pid": Int(file.processId),
                "uid": Int(file.userId),
                "allowed": file.allowed,
                "timestamp": iso.string(from: file.timestamp),
            ]
            return ("File access: \(file.operation.rawValue) \(file.path)", params)

        case .processExec(let proc):
            var params: [String: AnyHashable] = [
                "type": "process.exec",
                "path": proc.path,
                "args": proc.args,
                "pid": Int(proc.processId),
                "ppid": Int(proc.parentProcessId),
                "uid": Int(proc.userId),
                "allowed": proc.allowed,
                "timestamp": iso.string(from: proc.timestamp),
            ]
            if let user = proc.userName { params["userName"] = user }
            if let signing = proc.signingInfo {
                var info: [String: AnyHashable] = ["isTrusted": signing.isTrusted]
                if let team = signing.teamId { info["teamId"] = team }
                if let sid = signing.signingId { info["signingId"] = sid }
                params["signingInfo"] = info
            }
            return ("Process exec: \(proc.path) pid=\(proc.processId)", params)
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
