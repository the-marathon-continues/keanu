// KEANUIntents/KEANUAppShortcuts.swift
// These are available the MOMENT the app installs. No setup. No training.
// "Hey Siri, ask KEANU" just works.

import AppIntents

struct KEANUAppShortcuts: AppShortcutsProvider {
    
    static var appShortcuts: [AppShortcut] {
        
        // Primary: Ask KEANU anything
        AppShortcut(
            intent: AskKEANUIntent(),
            phrases: [
                "Ask \(.applicationName) \(\.$question)",
                "Ask \(.applicationName) about \(\.$question)",
                "Hey \(.applicationName) \(\.$question)",
                "\(.applicationName) help with \(\.$question)",
                "What does \(.applicationName) think about \(\.$question)"
            ],
            shortTitle: "Ask KEANU",
            systemImageName: "brain.head.profile"
        )
        
        // Status check
        AppShortcut(
            intent: KEANUStatusIntent(),
            phrases: [
                "\(.applicationName) status",
                "\(.applicationName) status check",
                "What's \(.applicationName) thinking",
                "Check on \(.applicationName)",
                "How's \(.applicationName) doing"
            ],
            shortTitle: "KEANU Status",
            systemImageName: "waveform.circle"
        )
        
        // Signal protocol
        AppShortcut(
            intent: KEANUSignalIntent(),
            phrases: [
                "\(.applicationName) signal \(\.$signal)",
                "Signal \(.applicationName) \(\.$signal)",
                "Send \(.applicationName) \(\.$signal)"
            ],
            shortTitle: "KEANU Signal",
            systemImageName: "antenna.radiowaves.left.and.right"
        )
        
        // Memory storage
        AppShortcut(
            intent: KEANUMemoryIntent(),
            phrases: [
                "\(.applicationName) remember \(\.$key) is \(\.$value)",
                "Tell \(.applicationName) to remember \(\.$key) is \(\.$value)"
            ],
            shortTitle: "KEANU Remember",
            systemImageName: "brain"
        )
        
        // Route text for processing
        AppShortcut(
            intent: KEANURouteIntent(),
            phrases: [
                "Route this to \(.applicationName)",
                "\(.applicationName) process \(\.$text)",
                "Send to \(.applicationName) for \(\.$action)"
            ],
            shortTitle: "Route to KEANU",
            systemImageName: "arrow.triangle.branch"
        )
    }
}
