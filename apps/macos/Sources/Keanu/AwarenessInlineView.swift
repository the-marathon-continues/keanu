import SwiftUI

/// Inline awareness summary for the menu dropdown.
/// One line you click into. Like looking at someone's face
/// and being able to see what they're thinking.
struct AwarenessInlineView: View {
    @State private var expanded = false
    private let store = KeanuAwarenessStore.shared

    var body: some View {
        if self.store.receiving {
            VStack(alignment: .leading, spacing: 4) {
                self.summaryRow
                if self.expanded {
                    self.expandedDetails
                        .transition(.opacity.combined(with: .move(edge: .top)))
                }
            }
        }
    }

    // MARK: - The 1-liner

    private var summaryRow: some View {
        Button {
            withAnimation(.easeInOut(duration: 0.15)) {
                self.expanded.toggle()
            }
        } label: {
            HStack(spacing: 6) {
                Circle()
                    .fill(self.pulseColor)
                    .frame(width: 8, height: 8)
                Text(self.store.pulseState.displayName)
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundStyle(self.pulseColor)
                if self.store.wiseMind > 0 {
                    Text("wm \(Int(self.store.wiseMind * 100))%")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if !self.store.coefEmoji.isEmpty {
                    Text(self.store.coefEmoji)
                        .font(.caption2)
                }
                Image(systemName: self.expanded ? "chevron.up" : "chevron.down")
                    .font(.system(size: 8))
                    .foregroundStyle(.tertiary)
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: - The full picture

    private var expandedDetails: some View {
        VStack(alignment: .leading, spacing: 3) {
            self.detailLine("Wise Mind", String(format: "%.2f", self.store.wiseMind))
            self.detailLine("Confidence", String(format: "%.2f", self.store.confidence))
            self.detailLine("Human Tone", self.store.humanTone)
            self.detailLine("Health", self.store.healthStatus)

            if let struggle = self.store.dominantStruggle {
                self.detailLine(
                    "Struggle",
                    "\(struggle) (\(String(format: "%.1f", self.store.struggleScore)))",
                    color: .orange)
            }

            if self.store.greyStreak > 2 {
                self.detailLine("Grey Streak", "\(self.store.greyStreak) turns", color: .orange)
            }

            // Detection alerts — only when triggered
            if self.store.carnegieTriggered {
                self.detailLine("Carnegie", self.store.carnegieType ?? "triggered", color: .red)
            }
            if self.store.mismatchDetected {
                self.detailLine("Mismatch", self.store.mismatchType ?? "detected", color: .orange)
            }
            if self.store.inRecovery {
                self.detailLine("Recovery", self.store.recoveryPhase ?? "active", color: .yellow)
            }
            if !self.store.velocityAppropriate {
                self.detailLine("Velocity", self.store.velocityMode, color: .orange)
            }

            // COEF full text — the raw signal
            if !self.store.coefText.isEmpty {
                Text(self.store.coefText)
                    .font(.system(size: 9, design: .monospaced))
                    .foregroundStyle(.tertiary)
                    .lineLimit(3)
                    .padding(.top, 2)
            }

            Text("Turn \(self.store.turn)")
                .font(.caption2)
                .foregroundStyle(.quaternary)
        }
        .padding(.leading, 14)
    }

    // MARK: - Helpers

    private var pulseColor: Color {
        switch self.store.pulseState {
        case .alive: Color(red: 0.133, green: 0.545, blue: 0.133)
        case .dark: Color(red: 0.545, green: 0, blue: 0)
        case .luminous: Color(red: 1, green: 0.843, blue: 0)
        case .grey: .gray.opacity(0.5)
        case .black: .primary.opacity(0.2)
        }
    }

    private func detailLine(_ label: String, _ value: String, color: Color = .secondary) -> some View {
        HStack(spacing: 4) {
            Text(label)
                .font(.caption2)
                .foregroundStyle(.tertiary)
                .frame(width: 72, alignment: .trailing)
            Text(value)
                .font(.caption2)
                .foregroundStyle(color)
        }
    }
}
