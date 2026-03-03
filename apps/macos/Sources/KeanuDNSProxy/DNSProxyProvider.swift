import NetworkExtension
import Network
import os.log
import KeanuExtensionKit

/// Keanu DNS Proxy Provider
///
/// Logs DNS queries to help the AI agent understand network activity.
/// Every DNS query flows through here, giving keanu visibility into
/// what domains the system is resolving.
final class DNSProxyProvider: NEDNSProxyProvider {

    // MARK: - Properties

    private let log = Logger(subsystem: "ai.keanu.dnsproxy", category: "provider")
    private let ipcBridge = ExtensionIPCBridge()
    private var policy: ExtensionPolicy = .default

    // Rate limiting to avoid flooding
    private var eventCount = 0
    private var lastResetTime = Date()
    private let maxEventsPerSecond = 100

    // MARK: - Lifecycle

    override init() {
        super.init()
        log.info("DNSProxyProvider initialized")
    }

    override func startProxy(options: [String: Any]? = nil, completionHandler: @escaping (Error?) -> Void) {
        log.info("DNS Proxy starting...")

        // Load policy from App Group
        policy = ipcBridge.loadPolicy()
        log.info("Loaded policy: mode=\(self.policy.mode.rawValue)")

        log.info("DNS Proxy started successfully")
        completionHandler(nil)
    }

    override func stopProxy(with reason: NEProviderStopReason, completionHandler: @escaping () -> Void) {
        log.info("DNS Proxy stopping, reason: \(String(describing: reason))")
        log.info("DNS Proxy stopped")
        completionHandler()
    }

    // MARK: - Flow Handling

    override func handleNewFlow(_ flow: NEAppProxyFlow) -> Bool {
        guard let udpFlow = flow as? NEAppProxyUDPFlow else {
            // Only handle UDP (DNS uses UDP port 53)
            return false
        }

        // Extract source app (may be empty string, not nil)
        let sourceApp = udpFlow.metaData.sourceAppSigningIdentifier
        let sourceAppOptional: String? = sourceApp.isEmpty ? nil : sourceApp

        // Check if we should filter this app
        if !sourceApp.isEmpty && shouldExcludeApp(sourceApp) {
            return false  // Let system handle it
        }

        // Open the flow and start reading
        udpFlow.open(withLocalFlowEndpoint: nil) { [weak self] error in
            if let error {
                self?.log.error("Failed to open flow: \(error.localizedDescription)")
                return
            }
            self?.readAndForwardDatagrams(flow: udpFlow, sourceApp: sourceAppOptional)
        }

        return true  // We're handling this flow
    }

    // MARK: - DNS Processing

    private func readAndForwardDatagrams(flow: NEAppProxyUDPFlow, sourceApp: String?) {
        flow.readDatagrams { [weak self] (result: [(Data, NWEndpoint)]?, readError: (any Error)?) in
            guard let self else { return }

            if let readError {
                self.log.error("Read error: \(readError.localizedDescription)")
                return
            }

            guard let result, !result.isEmpty else {
                // Flow closed
                return
            }

            // Process each datagram
            for (datagram, endpoint) in result {
                // Parse DNS query
                if let query = self.parseDNSQuery(datagram) {
                    self.logDNSQuery(query, sourceApp: sourceApp, endpoint: endpoint)
                }
            }

            // Forward datagrams to their destinations
            flow.writeDatagrams(result) { [weak self] (writeError: (any Error)?) in
                if let writeError {
                    self?.log.error("Write error: \(writeError.localizedDescription)")
                }

                // Continue reading
                self?.readAndForwardDatagrams(flow: flow, sourceApp: sourceApp)
            }
        }
    }

    // MARK: - DNS Parsing

    private struct DNSQuery {
        let domain: String
        let type: String
        let id: UInt16
    }

    private func parseDNSQuery(_ data: Data) -> DNSQuery? {
        // DNS header is 12 bytes minimum
        guard data.count >= 12 else { return nil }

        let bytes = [UInt8](data)

        // Transaction ID (2 bytes)
        let id = UInt16(bytes[0]) << 8 | UInt16(bytes[1])

        // Flags (2 bytes) - check if this is a query (QR bit = 0)
        let flags = UInt16(bytes[2]) << 8 | UInt16(bytes[3])
        let isQuery = (flags & 0x8000) == 0
        guard isQuery else { return nil }

        // Question count (2 bytes)
        let qdCount = UInt16(bytes[4]) << 8 | UInt16(bytes[5])
        guard qdCount > 0 else { return nil }

        // Parse domain name starting at byte 12
        var offset = 12
        var domainParts: [String] = []

        while offset < data.count {
            let length = Int(bytes[offset])
            if length == 0 {
                offset += 1
                break
            }

            // Check for compression pointer (starts with 11xxxxxx)
            if length & 0xC0 == 0xC0 {
                // Compression not fully handled in this simple parser
                offset += 2
                break
            }

            guard offset + 1 + length <= data.count else { break }

            let start = offset + 1
            let end = start + length
            if let part = String(bytes: bytes[start..<end], encoding: .utf8) {
                domainParts.append(part)
            }
            offset = end
        }

        guard !domainParts.isEmpty, offset + 4 <= data.count else { return nil }

        let domain = domainParts.joined(separator: ".")

        // Query type (2 bytes)
        let qtype = UInt16(bytes[offset]) << 8 | UInt16(bytes[offset + 1])
        let typeString = queryTypeToString(qtype)

        return DNSQuery(domain: domain, type: typeString, id: id)
    }

    private func queryTypeToString(_ qtype: UInt16) -> String {
        switch qtype {
        case 1: return "A"
        case 28: return "AAAA"
        case 5: return "CNAME"
        case 15: return "MX"
        case 16: return "TXT"
        case 2: return "NS"
        case 6: return "SOA"
        case 12: return "PTR"
        case 33: return "SRV"
        case 65: return "HTTPS"
        default: return "TYPE\(qtype)"
        }
    }

    // MARK: - Event Logging

    private func logDNSQuery(_ query: DNSQuery, sourceApp: String?, endpoint: NWEndpoint) {
        // Rate limiting
        if !shouldLogEvent() {
            return
        }

        let event = DNSQueryEvent(
            timestamp: Date(),
            domain: query.domain,
            queryType: query.type,
            sourceApp: sourceApp
        )

        // Send to main app via IPC
        ipcBridge.send(event: .dnsQuery(event))

        log.debug("DNS: \(query.domain) (\(query.type)) from \(sourceApp ?? "unknown")")
    }

    // MARK: - Filtering

    private func shouldExcludeApp(_ bundleId: String) -> Bool {
        // Don't log our own app's queries
        if !policy.monitorSelf && bundleId.hasPrefix("ai.keanu") {
            return true
        }

        // Check excluded processes
        for excluded in policy.excludedProcesses {
            if bundleId.contains(excluded) {
                return true
            }
        }

        return false
    }

    private func shouldLogEvent() -> Bool {
        let now = Date()
        let elapsed = now.timeIntervalSince(lastResetTime)

        if elapsed >= 1.0 {
            // Reset counter every second
            eventCount = 0
            lastResetTime = now
        }

        if eventCount >= maxEventsPerSecond {
            return false
        }

        eventCount += 1
        return true
    }
}
