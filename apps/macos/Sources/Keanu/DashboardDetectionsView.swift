import SwiftUI

struct DashboardDetectionsView: View {
    private var store = KeanuAwarenessStore.shared

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if !self.store.receiving {
                    self.waitingState
                } else {
                    self.detectionCards
                    self.blindSpots
                    self.disagreements
                }
            }
            .padding(24)
        }
    }

    // MARK: - Waiting

    private var waitingState: some View {
        VStack(spacing: 12) {
            Image(systemName: "eye.slash")
                .font(.system(size: 36))
                .foregroundStyle(.tertiary)
            Text("Waiting for keanu signal...")
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Detection Cards

    private var detectionCards: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Detections")
                .font(.headline)

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                self.carnegieCard
                self.mismatchCard
                self.calibrationCard
                self.velocityCard
                self.discoverCard
            }
        }
    }

    // MARK: - Carnegie

    private var carnegieCard: some View {
        let c = self.store.currentTurn?.carnegie
        return DetectionCard(
            title: "Carnegie",
            icon: "theatermasks.fill",
            triggered: c?.triggered ?? false,
            detail: c?.triggered == true
                ? "\(c?.highestType ?? "?")\(c?.caught == true ? " — caught" : c?.agreedWithoutCheck == true ? " — missed!" : "")"
                : "No presuppositions",
            subDetail: c?.presuppositionText,
            color: .purple)
    }

    // MARK: - Mismatch

    private var mismatchCard: some View {
        let m = self.store.currentTurn?.mismatch
        return DetectionCard(
            title: "Mismatch",
            icon: "arrow.left.arrow.right",
            triggered: m?.detected ?? false,
            detail: m?.detected == true
                ? "\(m?.type ?? "unknown")"
                : "Aligned",
            subDetail: m?.detected == true
                ? "Needed: \(m?.humanNeed ?? "?") → Gave: \(m?.agentGave ?? "?")"
                : nil,
            color: .orange)
    }

    // MARK: - Calibration

    private var calibrationCard: some View {
        let cal = self.store.currentTurn?.calibration
        return DetectionCard(
            title: "Calibration",
            icon: "checkmark.seal.fill",
            triggered: cal?.triggered ?? false,
            detail: cal?.triggered == true
                ? "\(cal?.reason ?? "?") — \(cal?.claims.count ?? 0) claims"
                : "No unverified claims",
            subDetail: cal?.claims.first,
            color: .cyan)
    }

    // MARK: - Velocity

    private var velocityCard: some View {
        let v = self.store.currentTurn?.velocity
        return DetectionCard(
            title: "Velocity",
            icon: "gauge.with.dots.needle.50percent",
            triggered: !(v?.appropriate ?? true),
            detail: "\(v?.mode ?? "moderate")\(v?.appropriate == true ? "" : " — mismatched")",
            subDetail: v?.suggestion,
            color: .mint)
    }

    // MARK: - Discover

    private var discoverCard: some View {
        let d = self.store.currentTurn?.discover
        return DetectionCard(
            title: "Discover",
            icon: "brain.head.profile.fill",
            triggered: d?.complexity == "high",
            detail: "\(d?.complexity ?? "low") complexity",
            subDetail: d.map { $0.selectedModules.joined(separator: ", ") },
            color: .indigo)
    }

    // MARK: - Blind Spots

    @ViewBuilder
    private var blindSpots: some View {
        let spots = self.store.currentTurn?.blindSpots ?? []
        if !spots.isEmpty {
            GroupBox("Blind Spots") {
                ForEach(spots, id: \.category) { spot in
                    HStack {
                        Text(spot.category)
                            .font(.system(size: 12, design: .monospaced))
                        Spacer()
                        Text("×\(spot.count)")
                            .font(.system(size: 12, weight: .bold, design: .monospaced))
                            .foregroundStyle(.orange)
                    }
                }
            }
        }
    }

    // MARK: - Disagreements

    private var disagreements: some View {
        GroupBox("Disagreements") {
            if let d = self.store.currentTurn?.disagreements {
                HStack(spacing: 24) {
                    self.statPill("Total", "\(d.total)")
                    self.statPill("Agent Yielded", "\(d.agentYielded)")
                    self.statPill("Human Yielded", "\(d.humanYielded)")
                    self.statPill("Yield Ratio", String(format: "%.2f", d.yieldRatio))
                }
            } else {
                Text("No disagreement data")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
        }
    }

    private func statPill(_ label: String, _ value: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.system(size: 16, weight: .bold, design: .monospaced))
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }
}

// MARK: - Detection Card Component

struct DetectionCard: View {
    let title: String
    let icon: String
    let triggered: Bool
    let detail: String
    let subDetail: String?
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: self.icon)
                    .foregroundStyle(self.triggered ? self.color : .secondary)
                Text(self.title)
                    .font(.system(size: 12, weight: .semibold))
                Spacer()
                Circle()
                    .fill(self.triggered ? self.color : .green.opacity(0.3))
                    .frame(width: 8, height: 8)
            }

            Text(self.detail)
                .font(.system(size: 11, design: .monospaced))
                .lineLimit(2)

            if let sub = self.subDetail {
                Text(sub)
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
        }
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(self.triggered ? self.color.opacity(0.08) : Color(nsColor: .controlBackgroundColor))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .strokeBorder(self.triggered ? self.color.opacity(0.3) : .clear, lineWidth: 1)
        )
    }
}
