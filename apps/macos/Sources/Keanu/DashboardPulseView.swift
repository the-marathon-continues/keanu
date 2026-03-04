import SwiftUI
import Charts

struct DashboardPulseView: View {
    private var store = KeanuAwarenessStore.shared
    @State private var pulseScale: CGFloat = 1.0

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                self.pulseCircle
                self.vitals
                self.wiseMindChart
                self.recoveryBanner
            }
            .padding(24)
        }
    }

    // MARK: - Breathing Pulse Circle

    private var pulseCircle: some View {
        VStack(spacing: 12) {
            ZStack {
                // Outer glow
                Circle()
                    .fill(self.pulseColor.opacity(0.15))
                    .frame(width: 140, height: 140)
                    .scaleEffect(self.pulseScale * 1.1)

                // Main circle
                Circle()
                    .fill(self.pulseColor.opacity(0.6))
                    .frame(width: 100, height: 100)
                    .scaleEffect(self.pulseScale)

                // Inner core
                Circle()
                    .fill(self.pulseColor)
                    .frame(width: 60, height: 60)
                    .scaleEffect(self.pulseScale)

                // State label
                Text(self.store.pulseState.displayName)
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white)
            }
            .onAppear { self.startBreathing() }
            .onChange(of: self.store.pulseState) { _, _ in self.startBreathing() }

            // Grey streak warning
            if self.store.greyStreak > 0 {
                Text("Grey streak: \(self.store.greyStreak)")
                    .font(.caption)
                    .foregroundStyle(.orange)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(.orange.opacity(0.1), in: Capsule())
            }
        }
    }

    // MARK: - Vital Signs

    private var vitals: some View {
        HStack(spacing: 32) {
            self.vitalGauge("Wise Mind", value: self.store.wiseMind)
            self.vitalGauge("Confidence", value: self.store.confidence)
            self.colorBars
        }
    }

    private func vitalGauge(_ label: String, value: Double) -> some View {
        VStack(spacing: 6) {
            Gauge(value: value) {
                EmptyView()
            }
            .gaugeStyle(.accessoryCircular)
            .tint(value > 0.6 ? .green : value > 0.3 ? .yellow : .red)
            .frame(width: 50, height: 50)

            Text(String(format: "%.0f%%", value * 100))
                .font(.system(size: 14, weight: .medium, design: .monospaced))

            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }

    private var colorBars: some View {
        VStack(spacing: 6) {
            HStack(spacing: 4) {
                self.colorBar(.red, value: self.store.colors.red, label: "R")
                self.colorBar(.yellow, value: self.store.colors.yellow, label: "Y")
                self.colorBar(.blue, value: self.store.colors.blue, label: "B")
            }
            .frame(height: 50)

            Text("Colors")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }

    private func colorBar(_ color: Color, value: Double, label: String) -> some View {
        VStack(spacing: 2) {
            Rectangle()
                .fill(color.opacity(0.7))
                .frame(width: 14, height: CGFloat(value) * 40)
                .clipShape(RoundedRectangle(cornerRadius: 2))
            Text(label)
                .font(.system(size: 8))
                .foregroundStyle(.secondary)
        }
    }

    // MARK: - Wise Mind Sparkline

    private var wiseMindChart: some View {
        GroupBox("Wise Mind — Session") {
            if self.store.wiseMindHistory.isEmpty {
                Text("Waiting for data...")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
                    .frame(height: 100)
            } else {
                Chart {
                    ForEach(Array(self.store.wiseMindHistory.enumerated()), id: \.offset) { index, value in
                        LineMark(
                            x: .value("Turn", index),
                            y: .value("Wise Mind", value)
                        )
                        .foregroundStyle(.green.gradient)
                        .interpolationMethod(.catmullRom)
                    }

                    // Threshold line
                    RuleMark(y: .value("Threshold", 0.5))
                        .foregroundStyle(.orange.opacity(0.3))
                        .lineStyle(StrokeStyle(dash: [4, 4]))
                }
                .chartYScale(domain: 0...1)
                .frame(height: 100)
            }
        }
    }

    // MARK: - Recovery Banner

    @ViewBuilder
    private var recoveryBanner: some View {
        if self.store.inRecovery, let phase = self.store.recoveryPhase {
            HStack {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(.orange)
                Text("Recovery: \(phase)")
                    .font(.callout)
            }
            .padding(12)
            .frame(maxWidth: .infinity)
            .background(.orange.opacity(0.1), in: RoundedRectangle(cornerRadius: 8))
        }
    }

    // MARK: - Helpers

    private var pulseColor: Color {
        switch self.store.pulseState {
        case .alive: Color(red: 0.13, green: 0.55, blue: 0.13)
        case .dark: Color(red: 0.55, green: 0, blue: 0)
        case .luminous: Color(red: 1.0, green: 0.84, blue: 0)
        case .grey: Color.gray
        case .black: Color(white: 0.1)
        }
    }

    private func startBreathing() {
        let duration: Double = switch self.store.pulseState {
        case .alive, .dark, .luminous: 1.2
        case .grey: 2.5
        case .black: 0
        }
        guard duration > 0 else {
            self.pulseScale = 1.0
            return
        }
        withAnimation(.easeInOut(duration: duration).repeatForever(autoreverses: true)) {
            self.pulseScale = 0.92
        }
    }
}
