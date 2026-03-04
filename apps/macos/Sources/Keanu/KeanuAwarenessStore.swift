import Foundation
import os

/// The living state of keanu's awareness. Fed by gateway push events.
/// Every SwiftUI view that reads this store will update when keanu's inner state changes.
@MainActor
@Observable
final class KeanuAwarenessStore {
    static let shared = KeanuAwarenessStore()

    private let logger = Logger(subsystem: "ai.keanu", category: "awareness")
    private let maxHistory = 50

    // MARK: - Current Turn

    private(set) var currentTurn: KeanuTurnSnapshot?

    // Derived — SwiftUI binds directly to these
    var pulseState: AliveState { currentTurn?.pulse.state ?? .grey }
    var wiseMind: Double { currentTurn?.pulse.wiseMind ?? 0 }
    var confidence: Double { currentTurn?.pulse.confidence ?? 0 }
    var colors: KeanuTurnSnapshot.ColorSnapshot { currentTurn?.pulse.colors ?? .init(red: 0.33, yellow: 0.33, blue: 0.33) }
    var coefEmoji: String { currentTurn?.emoji ?? "" }
    var coefText: String { currentTurn?.coef ?? "" }
    var greyStreak: Int { currentTurn?.greyStreak ?? 0 }
    var healthStatus: String { currentTurn?.health.status ?? "unknown" }
    var humanTone: String { currentTurn?.humanTone ?? "neutral" }
    var dominantStruggle: String? { currentTurn?.struggle.dominant }
    var struggleScore: Double { currentTurn?.struggle.score ?? 0 }
    var turn: Int { currentTurn?.turn ?? 0 }

    // The 5 easy detections — direct access for views
    var carnegieTriggered: Bool { currentTurn?.carnegie?.triggered ?? false }
    var carnegieType: String? { currentTurn?.carnegie?.highestType }
    var mismatchDetected: Bool { currentTurn?.mismatch?.detected ?? false }
    var mismatchType: String? { currentTurn?.mismatch?.type }
    var calibrationTriggered: Bool { currentTurn?.calibration?.triggered ?? false }
    var velocityMode: String { currentTurn?.velocity?.mode ?? "moderate" }
    var velocityAppropriate: Bool { currentTurn?.velocity?.appropriate ?? true }
    var discoverComplexity: String { currentTurn?.discover?.complexity ?? "low" }

    // Partnership
    var trustLevel: String { currentTurn?.partnership?.trustLevel ?? "unknown" }
    var yieldRatio: Double { currentTurn?.disagreements.yieldRatio ?? 0 }

    // Recovery
    var inRecovery: Bool { currentTurn?.recovery?.active ?? false }
    var recoveryPhase: String? { currentTurn?.recovery?.phase }

    // MARK: - History (ring buffers for sparklines)

    private(set) var wiseMindHistory: [Double] = []
    private(set) var pulseHistory: [AliveState] = []
    private(set) var struggleHistory: [Double] = []

    // MARK: - Sessions

    private(set) var sessions: [KeanuSessionSnapshot] = []

    // MARK: - Connection State

    private(set) var receiving = false

    // MARK: - Ingest

    func handleTurn(_ snapshot: KeanuTurnSnapshot) {
        self.currentTurn = snapshot
        self.receiving = true

        self.wiseMindHistory.append(snapshot.pulse.wiseMind)
        self.pulseHistory.append(snapshot.pulse.state)
        self.struggleHistory.append(snapshot.struggle.score)

        if self.wiseMindHistory.count > self.maxHistory {
            self.wiseMindHistory.removeFirst()
        }
        if self.pulseHistory.count > self.maxHistory {
            self.pulseHistory.removeFirst()
        }
        if self.struggleHistory.count > self.maxHistory {
            self.struggleHistory.removeFirst()
        }

        self.logger.debug("keanu.turn: \(snapshot.emoji) pulse=\(snapshot.pulse.state.rawValue) wm=\(String(format: "%.2f", snapshot.pulse.wiseMind))")
    }

    func handleSession(_ snapshot: KeanuSessionSnapshot) {
        self.sessions.append(snapshot)
        if self.sessions.count > 20 {
            self.sessions.removeFirst()
        }

        self.logger.info("keanu.session: \(snapshot.sessionId) turns=\(snapshot.metrics.turnCount) alive=\(String(format: "%.0f%%", snapshot.metrics.aliveRate * 100))")
    }

    // MARK: - Computed

    var aliveRate: Double {
        guard !pulseHistory.isEmpty else { return 0 }
        let aliveCount = pulseHistory.filter { $0 == .alive || $0 == .dark || $0 == .luminous }.count
        return Double(aliveCount) / Double(pulseHistory.count)
    }

    var isAlive: Bool {
        pulseState == .alive || pulseState == .dark || pulseState == .luminous
    }
}
