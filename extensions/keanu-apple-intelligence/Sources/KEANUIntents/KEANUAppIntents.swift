// KEANUIntents/KEANUAppIntents.swift
// DIRECTION 1: Apple → KEANU
// Siri, Shortcuts, Spotlight, Action Button can all trigger these.
// "Hey Siri, ask KEANU about my deployment status"

import AppIntents
import KEANUCore

// MARK: - Ask KEANU (Primary Intent)

/// The main entry point. User asks KEANU anything via Siri or Shortcuts.
struct AskKEANUIntent: AppIntent {
    static let title: LocalizedStringResource = "Ask KEANU"
    static let description: IntentDescription = "Route a question through KEANU's intelligence pipeline"
    
    @Parameter(title: "Question")
    var question: String
    
    static var parameterSummary: some ParameterSummary {
        Summary("Ask KEANU \(\.$question)")
    }
    
    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        let request = KEANURequest(
            prompt: question,
            taskType: classifyTask(question),
            source: .siri
        )
        
        // Route through KEANU's engine
        let decision = RouterEngine.shared.route(request)
        
        // Execute based on routing decision
        let response = await executeRouted(request: request, decision: decision)
        
        // Record interaction
        ContextManager.shared.recordInteraction(Interaction(
            source: .siri,
            prompt: question,
            summary: String(response.prefix(100)),
            routedTo: "\(decision.destination)"
        ))
        
        return .result(
            dialog: "\(response)"
        ) {
            KEANUResponseSnippet(
                response: response,
                routedTo: decision.destination,
                latency: decision.estimatedLatency,
                privacy: decision.privacyLevel
            )
        }
    }
    
    private func classifyTask(_ input: String) -> TaskType {
        let lower = input.lowercased()
        if lower.contains("status") || lower.contains("signal") { return .status }
        if lower.contains("summarize") || lower.contains("summary") { return .summarize }
        if lower.contains("remember") || lower.contains("memory") { return .memory }
        if lower.contains("code") || lower.contains("script") || lower.contains("function") { return .code }
        return .general
    }
    
    private func executeRouted(request: KEANURequest, decision: RoutingDecision) async -> String {
        switch decision.destination {
        case .appleOnDevice:
            // Will be handled by KEANUFoundation layer
            return "🍎 [On-device] Processing: \(request.prompt)"
        case .claudeCloud:
            // Will be handled by Claude API integration
            return "☁️ [Claude] Processing: \(request.prompt)"
        case .hybrid(let primary, _):
            return "🔀 [Hybrid → \(primary)] Processing: \(request.prompt)"
        case .appleWritingTools:
            return "✍️ [Writing Tools] Processing: \(request.prompt)"
        case .appleImagePlayground:
            return "🎨 [Image Playground] Processing: \(request.prompt)"
        }
    }
}

// MARK: - KEANU Status Check

/// Quick status: signal state, active projects, cognitive state
struct KEANUStatusIntent: AppIntent {
    static let title: LocalizedStringResource = "KEANU Status"
    static let description: IntentDescription = "Check KEANU's current state and signal"
    
    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        let context = ContextManager.shared
        let signal = context.signalState.currentSignal
        let summary = context.contextSummary(maxTokens: 200)
        
        return .result(
            dialog: "Signal: \(signal). \(context.activeContext.turnCount) interactions this session."
        ) {
            KEANUStatusSnippet(
                signal: signal,
                turnCount: context.activeContext.turnCount,
                lastInteraction: context.activeContext.lastInteraction,
                contextSummary: summary
            )
        }
    }
}

// MARK: - KEANU Signal Protocol

/// Send a compressed signal command: "topic 8, topic 3"
struct KEANUSignalIntent: AppIntent {
    static let title: LocalizedStringResource = "KEANU Signal"
    static let description: IntentDescription = "Send a compressed signal protocol command to KEANU"
    
    @Parameter(title: "Signal")
    var signal: String
    
    static var parameterSummary: some ParameterSummary {
        Summary("Signal KEANU \(\.$signal)")
    }
    
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let message = SignalProtocol.parse(signal)
        let response = SignalProtocol.respond(to: message)
        
        // Update signal state if it's an emoji update
        if message.type == .signalUpdate {
            ContextManager.shared.updateSignal(signal)
        }
        
        return .result(dialog: "\(response)")
    }
}

// MARK: - KEANU Memory

/// Store something in KEANU's persistent memory
struct KEANUMemoryIntent: AppIntent {
    static let title: LocalizedStringResource = "KEANU Remember"
    static let description: IntentDescription = "Store information in KEANU's persistent memory"
    
    @Parameter(title: "Key")
    var key: String
    
    @Parameter(title: "Value")
    var value: String
    
    static var parameterSummary: some ParameterSummary {
        Summary("Remember \(\.$key) is \(\.$value)")
    }
    
    func perform() async throws -> some IntentResult & ProvidesDialog {
        ContextManager.shared.remember(key, value: value, importance: .high)
        return .result(dialog: "Stored: \(key) = \(value)")
    }
}

// MARK: - KEANU Route (Clipboard/Text Processing)

/// Take selected text or clipboard content and route through KEANU
struct KEANURouteIntent: AppIntent {
    static let title: LocalizedStringResource = "Route to KEANU"
    static let description: IntentDescription = "Process text through KEANU's intelligence pipeline"
    
    @Parameter(title: "Text")
    var text: String
    
    @Parameter(title: "Action", default: .summarize)
    var action: KEANUActionType
    
    static var parameterSummary: some ParameterSummary {
        Summary("Route \(\.$text) to KEANU for \(\.$action)")
    }
    
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let taskType: TaskType = switch action {
        case .summarize: .summarize
        case .classify: .classify
        case .rewrite: .rewrite
        case .extract: .extract
        case .analyze: .reason
        }
        
        let request = KEANURequest(
            prompt: text,
            taskType: taskType,
            source: .shortcuts
        )
        
        let decision = RouterEngine.shared.route(request)
        return .result(dialog: "Routed to \(decision.destination) for \(action.rawValue)")
    }
}

// MARK: - Action Type Enum for Intents

enum KEANUActionType: String, AppEnum {
    case summarize
    case classify
    case rewrite
    case extract
    case analyze
    
    static var typeDisplayRepresentation: TypeDisplayRepresentation {
        "KEANU Action"
    }
    
    static var caseDisplayRepresentations: [KEANUActionType: DisplayRepresentation] {
        [
            .summarize: "Summarize",
            .classify: "Classify",
            .rewrite: "Rewrite",
            .extract: "Extract",
            .analyze: "Analyze",
        ]
    }
}
