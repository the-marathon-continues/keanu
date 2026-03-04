import SwiftUI

struct DashboardSignalView: View {
    private var store = KeanuAwarenessStore.shared

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                self.emojiStrip
                self.coefRaw
                self.channelBreakdown
            }
            .padding(24)
        }
    }

    // MARK: - Emoji Signal

    private var emojiStrip: some View {
        GroupBox("Signal") {
            if self.store.coefEmoji.isEmpty {
                Text("Waiting for signal...")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    Text(self.store.coefEmoji)
                        .font(.system(size: 28))
                        .contentTransition(.opacity)
                        .animation(.easeInOut(duration: 0.3), value: self.store.coefEmoji)

                    Text("Turn \(self.store.turn)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    // MARK: - Raw COEF

    private var coefRaw: some View {
        GroupBox("COEF/1 Raw") {
            if self.store.coefText.isEmpty {
                Text("No signal yet")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            } else {
                Text(self.store.coefText)
                    .font(.system(size: 11, design: .monospaced))
                    .textSelection(.enabled)
                    .lineLimit(nil)
            }
        }
    }

    // MARK: - Channel Breakdown

    private var channelBreakdown: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Lossless channel — parsed from the turn snapshot
            if let turn = self.store.currentTurn {
                GroupBox("Channel 1: Lossless") {
                    self.losslessFields(turn)
                }

                GroupBox("Channel 2: Human Reading") {
                    self.humanFields(turn)
                }

                GroupBox("Channel 3: Detections") {
                    self.detectionSummary(turn)
                }

                if let sub = turn.substrate {
                    GroupBox("Channel 4: Substrate") {
                        self.substrateFields(sub)
                    }
                }
            }
        }
    }

    // MARK: - Lossless Fields

    private func losslessFields(_ turn: KeanuTurnSnapshot) -> some View {
        Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 6) {
            self.fieldRow("Pulse", turn.pulse.state.displayName)
            self.fieldRow("Wise Mind", String(format: "%.2f", turn.pulse.wiseMind))
            self.fieldRow("Confidence", String(format: "%.2f", turn.pulse.confidence))
            self.fieldRow("Colors", "R:\(String(format: "%.0f", turn.pulse.colors.red * 100)) Y:\(String(format: "%.0f", turn.pulse.colors.yellow * 100)) B:\(String(format: "%.0f", turn.pulse.colors.blue * 100))")
            self.fieldRow("Tone", turn.humanTone)
            self.fieldRow("Struggle", turn.struggle.dominant ?? "none")
            self.fieldRow("Grey Streak", "\(turn.greyStreak)")
            self.fieldRow("Health", turn.health.status)
        }
    }

    // MARK: - Human Reading Fields

    private func humanFields(_ turn: KeanuTurnSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            if let hr = turn.humanReading {
                ForEach(hr.tones, id: \.tone) { tone in
                    HStack {
                        Text(tone.tone)
                            .font(.system(size: 12, weight: .medium, design: .monospaced))
                            .frame(width: 80, alignment: .leading)
                        ProgressView(value: tone.score)
                            .frame(width: 80)
                        Text(tone.meaning)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                        if let skill = tone.skill {
                            Text(skill)
                                .font(.caption2)
                                .foregroundStyle(.blue)
                                .lineLimit(1)
                        }
                    }
                }
                if let depth = hr.validationDepth {
                    self.fieldRow("Validation Depth", "\(depth)/6")
                }
            } else {
                Text("No human reading this turn")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
        }
    }

    // MARK: - Detection Summary

    private func detectionSummary(_ turn: KeanuTurnSnapshot) -> some View {
        Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 6) {
            if let c = turn.carnegie, c.triggered {
                self.fieldRow("Carnegie", "\(c.highestType ?? "unknown") — \(c.caught == true ? "caught" : "missed")")
            }
            if let m = turn.mismatch, m.detected {
                self.fieldRow("Mismatch", "\(m.type ?? "unknown"): needed \(m.humanNeed ?? "?"), gave \(m.agentGave ?? "?")")
            }
            if let cal = turn.calibration, cal.triggered {
                self.fieldRow("Calibration", "\(cal.reason ?? "unknown"): \(cal.claims.prefix(2).joined(separator: ", "))")
            }
            if let v = turn.velocity {
                self.fieldRow("Velocity", "\(v.mode)\(v.appropriate ? "" : " ⚠️")\(v.suggestion.map { " — \($0)" } ?? "")")
            }
            if let d = turn.discover {
                self.fieldRow("Discover", "\(d.complexity) → \(d.selectedModules.joined(separator: ", "))")
            }

            // Show "all clear" if nothing triggered
            if turn.carnegie?.triggered != true,
               turn.mismatch?.detected != true,
               turn.calibration?.triggered != true
            {
                self.fieldRow("Status", "Clear")
            }
        }
    }

    // MARK: - Substrate Fields

    private func substrateFields(_ sub: KeanuTurnSnapshot.SubstrateSnapshot) -> some View {
        Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 6) {
            self.fieldRow("Regime", sub.regime)
            self.fieldRow("θ (theta)", String(format: "%.4f", sub.theta))
            self.fieldRow("Firing", sub.firing ? "Yes" : "No")
            self.fieldRow("Urgency", String(format: "%.2f", sub.urgency))
            if let nc = sub.noiseClarity {
                self.fieldRow("Noise Clarity", String(format: "%.2f", nc))
            }
            if let rd = sub.resonanceDistance {
                self.fieldRow("Resonance Distance", String(format: "%.3f", rd))
            }
        }
    }

    // MARK: - Helpers

    private func fieldRow(_ label: String, _ value: String) -> some View {
        GridRow {
            Text(label)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.secondary)
            Text(value)
                .font(.system(size: 11, design: .monospaced))
        }
    }
}
