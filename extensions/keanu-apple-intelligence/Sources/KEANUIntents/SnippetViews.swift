// KEANUIntents/SnippetViews.swift
// These views render directly in Siri's UI, Spotlight, and Shortcuts.
// Compact, information-dense, KEANU-branded.

import SwiftUI
import KEANUCore

// MARK: - Response Snippet (shown after AskKEANU)

struct KEANUResponseSnippet: View {
    let response: String
    let routedTo: RoutingDestination
    let latency: TimeInterval
    let privacy: RoutingDecision.PrivacyLevel
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Header
            HStack {
                Image(systemName: "brain.head.profile")
                    .foregroundStyle(.blue)
                Text("KEANU")
                    .font(.headline)
                    .bold()
                Spacer()
                routingBadge
            }
            
            Divider()
            
            // Response text
            Text(response)
                .font(.body)
                .lineLimit(6)
            
            // Footer metadata
            HStack {
                Label("\(String(format: "%.1f", latency))s", systemImage: "clock")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Spacer()
                privacyBadge
            }
        }
        .padding()
    }
    
    @ViewBuilder
    private var routingBadge: some View {
        switch routedTo {
        case .appleOnDevice:
            Label("On-Device", systemImage: "iphone")
                .font(.caption2)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(.green.opacity(0.15))
                .clipShape(Capsule())
        case .claudeCloud:
            Label("Claude", systemImage: "cloud")
                .font(.caption2)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(.purple.opacity(0.15))
                .clipShape(Capsule())
        case .hybrid:
            Label("Hybrid", systemImage: "arrow.triangle.branch")
                .font(.caption2)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(.orange.opacity(0.15))
                .clipShape(Capsule())
        default:
            EmptyView()
        }
    }
    
    @ViewBuilder
    private var privacyBadge: some View {
        switch privacy {
        case .onDevice:
            Label("Private", systemImage: "lock.shield")
                .font(.caption2)
                .foregroundStyle(.green)
        case .privateCloud:
            Label("PCC", systemImage: "lock.icloud")
                .font(.caption2)
                .foregroundStyle(.blue)
        case .cloudAPI:
            Label("Cloud", systemImage: "cloud")
                .font(.caption2)
                .foregroundStyle(.orange)
        }
    }
}

// MARK: - Status Snippet (shown for KEANUStatus)

struct KEANUStatusSnippet: View {
    let signal: String
    let turnCount: Int
    let lastInteraction: Date?
    let contextSummary: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Signal display (big, prominent)
            HStack {
                Text(signal)
                    .font(.title2)
                Spacer()
                VStack(alignment: .trailing) {
                    Text("KEANU")
                        .font(.caption)
                        .bold()
                    Text("\(turnCount) turns")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            
            Divider()
            
            // Context summary
            Text(contextSummary)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(4)
            
            // Last interaction
            if let last = lastInteraction {
                HStack {
                    Spacer()
                    Text("Last: \(last, style: .relative) ago")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }
        }
        .padding()
    }
}
