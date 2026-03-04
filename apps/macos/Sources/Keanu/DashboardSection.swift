import SwiftUI

enum DashboardSection: String, CaseIterable, Identifiable {
    // Living (organic, animated)
    case pulse
    case signal
    case helix
    case detections

    // Awareness (the mirror)
    case struggle
    case humanTone
    case partnership

    // System
    case health
    case sessions
    case integrations

    var id: String { rawValue }

    var label: String {
        switch self {
        case .pulse: "Pulse"
        case .signal: "Signal"
        case .helix: "Helix"
        case .detections: "Detections"
        case .struggle: "Struggle"
        case .humanTone: "Human Tone"
        case .partnership: "Partnership"
        case .health: "Health"
        case .sessions: "Sessions"
        case .integrations: "Integrations"
        }
    }

    var icon: String {
        switch self {
        case .pulse: "heart.fill"
        case .signal: "waveform"
        case .helix: "DNA"
        case .detections: "eye.fill"
        case .struggle: "shield.lefthalf.filled"
        case .humanTone: "person.wave.2"
        case .partnership: "person.2.fill"
        case .health: "stethoscope"
        case .sessions: "clock.fill"
        case .integrations: "puzzlepiece.fill"
        }
    }

    var group: SectionGroup {
        switch self {
        case .pulse, .signal, .helix, .detections: .living
        case .struggle, .humanTone, .partnership: .awareness
        case .health, .sessions, .integrations: .system
        }
    }

    enum SectionGroup: String, CaseIterable {
        case living = "Living"
        case awareness = "Awareness"
        case system = "System"
    }
}
