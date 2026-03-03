import SwiftUI
import KeanuExtensionKit

/// Settings view for managing Keanu system extensions.
struct ExtensionSettingsView: View {
    @StateObject private var extensionManager = ExtensionManager()
    @StateObject private var eventRelay = ExtensionEventRelay()

    @State private var showingEvents = false

    var body: some View {
        Form {
            Section {
                dnsProxyRow
            } header: {
                Text("Network Extensions")
            } footer: {
                Text("DNS Proxy logs all DNS queries to help keanu understand network activity.")
            }

            Section {
                policySection
            } header: {
                Text("Policy")
            }

            if !eventRelay.recentEvents.isEmpty {
                Section {
                    recentEventsSection
                } header: {
                    Text("Recent Events")
                }
            }

            Section {
                statsSection
            } header: {
                Text("Statistics")
            }
        }
        .formStyle(.grouped)
        .frame(minWidth: 400, minHeight: 300)
        .onAppear {
            eventRelay.start()
        }
        .onDisappear {
            eventRelay.stop()
        }
    }

    // MARK: - DNS Proxy Row

    @ViewBuilder
    private var dnsProxyRow: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("DNS Proxy")
                    .font(.headline)

                Text(dnsProxyStatusText)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            dnsProxyControl
        }
        .padding(.vertical, 4)
    }

    private var dnsProxyStatusText: String {
        switch extensionManager.dnsProxyState {
        case .notInstalled:
            return "Not installed"
        case .installing:
            return "Installing..."
        case .needsApproval:
            return "Waiting for approval in System Settings"
        case .installed:
            return "Active"
        case .failed:
            if let error = extensionManager.lastError {
                return "Failed: \(error.localizedDescription)"
            }
            return "Failed"
        case .unknown:
            return "Unknown state"
        }
    }

    @ViewBuilder
    private var dnsProxyControl: some View {
        switch extensionManager.dnsProxyState {
        case .notInstalled, .failed:
            Button("Enable") {
                extensionManager.activateDNSProxy()
            }

        case .installing:
            ProgressView()
                .controlSize(.small)

        case .needsApproval:
            Button("Open Settings") {
                extensionManager.openSystemSettings()
            }

        case .installed:
            Button("Disable") {
                extensionManager.deactivateDNSProxy()
            }
            .tint(.red)

        case .unknown:
            Button("Retry") {
                extensionManager.activateDNSProxy()
            }
        }
    }

    // MARK: - Policy Section

    @ViewBuilder
    private var policySection: some View {
        let policy = eventRelay.currentPolicy()

        LabeledContent("Mode") {
            Text(policy.mode.rawValue.capitalized)
                .foregroundStyle(.secondary)
        }

        LabeledContent("Monitor Self") {
            Text(policy.monitorSelf ? "Yes" : "No")
                .foregroundStyle(.secondary)
        }

        LabeledContent("Max DNS Events") {
            Text("\(policy.retention.maxDNSQueries)")
                .foregroundStyle(.secondary)
        }
    }

    // MARK: - Recent Events

    @ViewBuilder
    private var recentEventsSection: some View {
        ForEach(Array(eventRelay.recentEvents.prefix(5).enumerated()), id: \.offset) { _, event in
            eventRow(event)
        }

        if eventRelay.recentEvents.count > 5 {
            Button("Show All (\(eventRelay.recentEvents.count))") {
                showingEvents = true
            }
            .sheet(isPresented: $showingEvents) {
                EventsListView(events: eventRelay.recentEvents)
            }
        }
    }

    @ViewBuilder
    private func eventRow(_ event: ExtensionEvent) -> some View {
        switch event {
        case .dnsQuery(let dns):
            HStack {
                Image(systemName: "network")
                    .foregroundStyle(.blue)
                VStack(alignment: .leading) {
                    Text(dns.domain)
                        .font(.system(.body, design: .monospaced))
                    Text("\(dns.queryType) • \(dns.sourceApp ?? "unknown")")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

        case .processExec(let proc):
            HStack {
                Image(systemName: "terminal")
                    .foregroundStyle(.green)
                VStack(alignment: .leading) {
                    Text(proc.path)
                        .font(.system(.body, design: .monospaced))
                        .lineLimit(1)
                    Text("PID \(proc.processId)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

        case .fileAccess(let file):
            HStack {
                Image(systemName: "doc")
                    .foregroundStyle(.orange)
                VStack(alignment: .leading) {
                    Text(file.path)
                        .font(.system(.body, design: .monospaced))
                        .lineLimit(1)
                    Text(file.operation.rawValue)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

        case .networkFlow(let flow):
            HStack {
                Image(systemName: "arrow.up.arrow.down")
                    .foregroundStyle(.purple)
                VStack(alignment: .leading) {
                    Text(flow.destinationHost ?? "unknown")
                        .font(.system(.body, design: .monospaced))
                    Text("\(flow.protocol ?? "?") • \(flow.direction.rawValue)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    // MARK: - Stats

    @ViewBuilder
    private var statsSection: some View {
        LabeledContent("Events Relayed") {
            Text("\(eventRelay.totalEventsRelayed)")
                .foregroundStyle(.secondary)
        }

        LabeledContent("Relay Status") {
            HStack(spacing: 4) {
                Circle()
                    .fill(eventRelay.isRunning ? .green : .gray)
                    .frame(width: 8, height: 8)
                Text(eventRelay.isRunning ? "Running" : "Stopped")
                    .foregroundStyle(.secondary)
            }
        }
    }
}

// MARK: - Events List View

struct EventsListView: View {
    let events: [ExtensionEvent]
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                ForEach(Array(events.enumerated()), id: \.offset) { _, event in
                    eventDetailRow(event)
                }
            }
            .navigationTitle("Extension Events")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
        .frame(minWidth: 500, minHeight: 400)
    }

    @ViewBuilder
    private func eventDetailRow(_ event: ExtensionEvent) -> some View {
        switch event {
        case .dnsQuery(let dns):
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Image(systemName: "network")
                        .foregroundStyle(.blue)
                    Text("DNS Query")
                        .font(.headline)
                    Spacer()
                    Text(dns.timestamp, style: .time)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Text(dns.domain)
                    .font(.system(.body, design: .monospaced))
                HStack {
                    Text("Type: \(dns.queryType)")
                    Spacer()
                    Text("App: \(dns.sourceApp ?? "unknown")")
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            .padding(.vertical, 4)

        default:
            Text("Event")
        }
    }
}

#Preview {
    ExtensionSettingsView()
}
