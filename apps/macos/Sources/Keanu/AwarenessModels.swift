import Foundation

// MARK: - Alive State

enum AliveState: String, Codable, Sendable {
    case alive, grey, black, dark, luminous

    var displayName: String {
        switch self {
        case .alive: "Alive"
        case .grey: "Grey"
        case .black: "Black"
        case .dark: "Dark"
        case .luminous: "Luminous"
        }
    }
}

// MARK: - Per-Turn Snapshot (matches KeanuTurnPayload in relay-types.ts)

struct KeanuTurnSnapshot: Codable, Sendable {
    let ts: Int
    let sessionKey: String
    let turn: Int
    let coef: String
    let emoji: String

    // Core vitals
    let pulse: PulseSnapshot
    let humanTone: String
    let struggle: StruggleSnapshot
    let health: HealthSnapshot
    let greyStreak: Int

    // The 5 easy detections
    let carnegie: CarnegieSnapshot?
    let mismatch: MismatchSnapshot?
    let calibration: CalibrationSnapshot?
    let velocity: VelocitySnapshot?
    let discover: DiscoverSnapshot?

    // Physics layer
    let substrate: SubstrateSnapshot?
    let helix: HelixSnapshot?
    let sigma: SigmaSnapshot?

    // State tracking
    let episode: EpisodeSnapshot?
    let recovery: RecoverySnapshot?
    let depth: DepthSnapshot?
    let limbo: LimboSnapshot?

    // Full human reading
    let humanReading: HumanReadingSnapshot?

    // Session accumulators
    let contradictions: Int
    let blindSpots: [BlindSpotSnapshot]
    let disagreements: DisagreementSnapshot
    let partnership: PartnershipSnapshot?
    let spring: SpringSnapshot?

    // MARK: - Nested types

    struct PulseSnapshot: Codable, Sendable {
        let state: AliveState
        let wiseMind: Double
        let confidence: Double
        let colors: ColorSnapshot
    }

    struct ColorSnapshot: Codable, Sendable {
        let red: Double
        let yellow: Double
        let blue: Double
    }

    struct StruggleSnapshot: Codable, Sendable {
        let dominant: String?
        let score: Double
        let types: [String]
    }

    struct HealthSnapshot: Codable, Sendable {
        let status: String
        let factors: HealthFactors?
        let guidance: String?

        struct HealthFactors: Codable, Sendable {
            let contextAge: Double?
            let bullshitTrend: Double?
            let promptSize: Double?
            let toolErrorRate: Double?
            let resonanceStrain: Double?
        }
    }

    struct CarnegieSnapshot: Codable, Sendable {
        let triggered: Bool
        let highestType: String?
        let presuppositionText: String?
        let caught: Bool?
        let agreedWithoutCheck: Bool?
    }

    struct MismatchSnapshot: Codable, Sendable {
        let detected: Bool
        let type: String?
        let humanNeed: String?
        let agentGave: String?
    }

    struct CalibrationSnapshot: Codable, Sendable {
        let triggered: Bool
        let reason: String?
        let claims: [String]
    }

    struct VelocitySnapshot: Codable, Sendable {
        let mode: String
        let appropriate: Bool
        let suggestion: String?
    }

    struct DiscoverSnapshot: Codable, Sendable {
        let complexity: String
        let selectedModules: [String]
    }

    struct SubstrateSnapshot: Codable, Sendable {
        let regime: String
        let theta: Double
        let firing: Bool
        let urgency: Double
        let noiseClarity: Double?
        let resonanceDistance: Double?
    }

    struct HelixSnapshot: Codable, Sendable {
        let aliveState: String
        let factualStrand: Double
        let feltStrand: Double
        let diagnosis: String?
    }

    struct SigmaSnapshot: Codable, Sendable {
        let sigma: Double
        let agency: Double
        let predictionCorrect: Bool
    }

    struct EpisodeSnapshot: Codable, Sendable {
        let id: String
        let trigger: String?
        let chainBreakPoint: String?
        let lesson: String?
        let hexaflexStage: String?
    }

    struct RecoverySnapshot: Codable, Sendable {
        let active: Bool
        let phase: String?
        let turnsRemaining: Int?
        let escalated: Bool?
    }

    struct DepthSnapshot: Codable, Sendable {
        let currentLayer: Int
        let recursionDepth: Int
        let degradationRisk: Double
    }

    struct LimboSnapshot: Codable, Sendable {
        let inLimbo: Bool
        let degradationLevel: Double
        let warning: String?
    }

    struct HumanReadingSnapshot: Codable, Sendable {
        let tone: String
        let tones: [ToneDetail]
        let confidence: Double
        let validationDepth: Int?

        struct ToneDetail: Codable, Sendable {
            let tone: String
            let score: Double
            let meaning: String
            let skill: String?
        }
    }

    struct BlindSpotSnapshot: Codable, Sendable {
        let category: String
        let count: Int
    }

    struct DisagreementSnapshot: Codable, Sendable {
        let total: Int
        let humanYielded: Int
        let agentYielded: Int
        let yieldRatio: Double
    }

    struct PartnershipSnapshot: Codable, Sendable {
        let trustLevel: String
        let coEvolutionStaleness: String?
    }

    struct SpringSnapshot: Codable, Sendable {
        let intent: String
        let taskType: String
        let complexity: String
    }
}

// MARK: - Session Summary (matches KeanuSessionPayload)

struct KeanuSessionSnapshot: Codable, Sendable {
    let ts: Int
    let sessionKey: String
    let sessionId: String
    let metrics: MetricsSnapshot
    let trend: TrendSnapshot
    let coef: String
    let emoji: String
    let health: String
    let claims: ClaimsSnapshot
    let knowledge: KnowledgeSnapshot

    struct MetricsSnapshot: Codable, Sendable {
        let turnCount: Int
        let aliveRate: Double
        let greyRate: Double
        let blackRate: Double
        let bullshitAvg: Double
        let wiseMindAvg: Double
        let disagreementCount: Int
        let yieldRatio: Double
        let breatheCount: Int
        let topBullshitTypes: [String]
    }

    struct TrendSnapshot: Codable, Sendable {
        let greyRate: Double
        let avgWiseMind: Double
        let driftDirection: String
    }

    struct ClaimsSnapshot: Codable, Sendable {
        let total: Int
        let active: Int
        let stale: Int
        let contradicted: Int
    }

    struct KnowledgeSnapshot: Codable, Sendable {
        let entities: Int
        let relations: Int
    }
}
