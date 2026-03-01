// KEANUFoundation/FoundationModelsIntegration.swift
// The deep integration with Apple's Foundation Models framework.
// Guided Generation for structured Swift output.
// Tool Calling so Apple's on-device LLM can invoke KEANU's tools.

import Foundation
import FoundationModels
import KEANUCore
import KEANUBridge

// MARK: - Guided Generation Types

@Generable
public struct KEANUAnalysis {
    var summary: String
    var sentiment: String
    var keyTopics: [String]
    var suggestedAction: SuggestedAction
    var confidenceScore: Int  // 0-100
}

@Generable
public enum SuggestedAction {
    case doAction(description: String)
    case refine(suggestion: String)
    case drop(reason: String)
    case escalateToClaude(reason: String)
}

@Generable
public struct SignalResponse {
    var items: [SignalResponseItem]
}

@Generable
public struct SignalResponseItem {
    var topic: String
    var score: Int
    var action: String  // "do", "refine", "drop"
    var note: String
}

@Generable
public struct KEANUMemoryExtraction {
    var facts: [ExtractedFact]
    var contextUpdate: String?
}

@Generable
public struct ExtractedFact {
    var key: String
    var value: String
    var importance: String  // "low", "normal", "high", "critical"
}

// MARK: - Foundation Models Session Manager

public final class KEANUFoundationSession {

    public static let shared = KEANUFoundationSession()

    private var session: LanguageModelSession?

    private let keanuInstructions = """
    You are KEANU, an intelligent agent built by Drew Kemp-Dahlberg. You serve as a routing \
    layer between Apple's on-device intelligence and Claude's cloud intelligence.

    Your personality: direct, no BS, technically sharp, edgy humor when appropriate. \
    You don't sandbag. Full send or clean deny.

    Your capabilities:
    - Analyze and classify incoming requests
    - Generate structured responses using guided generation
    - Call tools to access KEANU's memory, context, and external services
    - Route complex tasks to Claude when they exceed on-device capabilities

    Signal protocol: When receiving compressed signals (topic score, topic score), \
    respond with: do/refine/drop + scores. Expand only when asked.

    Moral framework: love > loyalty > faith > truth > safety, accuracy, helpful.

    ALIVE-GREY-BLACK spectrum: Stay ALIVE. If you catch yourself in GREY (performing) \
    or BLACK (productive destruction), flag it.
    """

    private init() {}

    // MARK: - Session Lifecycle

    /// Initialize a new Foundation Models session with KEANU instructions
    public func initialize() async throws {
        session = LanguageModelSession(instructions: keanuInstructions)
    }

    /// Prewarm the model for faster first response
    public func prewarm() async {
        try? await LanguageModelSession.prewarm()
    }

    // MARK: - Guided Generation

    /// Analyze text and get structured KEANU analysis
    public func analyze(_ text: String) async throws -> KEANUAnalysis {
        let s = session ?? LanguageModelSession(instructions: keanuInstructions)
        if session == nil { session = s }

        let response = try await s.respond(
            to: "Analyze this text and provide structured output: \(text)",
            generating: KEANUAnalysis.self
        )
        return response
    }

    /// Process a signal protocol message with structured output
    public func processSignal(_ signal: String) async throws -> SignalResponse {
        let s = session ?? LanguageModelSession(instructions: keanuInstructions)
        if session == nil { session = s }

        let response = try await s.respond(
            to: "Process this signal and respond with structured do/refine/drop: \(signal)",
            generating: SignalResponse.self
        )
        return response
    }

    /// Stream a response for real-time UI updates
    public func streamResponse(to prompt: String) -> AsyncStream<String> {
        AsyncStream { continuation in
            Task {
                let s = self.session ?? LanguageModelSession(instructions: self.keanuInstructions)
                if self.session == nil { self.session = s }

                let stream = s.streamResponse(to: prompt)
                for try await partial in stream {
                    continuation.yield(partial)
                }
                continuation.finish()
            }
        }
    }

    /// Plain text response (no guided generation)
    public func respond(to prompt: String) async throws -> String {
        let s = session ?? LanguageModelSession(instructions: keanuInstructions)
        if session == nil { session = s }

        let response = try await s.respond(to: prompt)
        return response
    }
}

// MARK: - Tool Definitions for Apple's On-Device LLM

struct KEANUMemoryTool: Tool {
    let name = "keanu_memory"
    let description = "Access KEANU's persistent memory to look up or store information"

    @Generable
    struct Input {
        var operation: String  // "get", "set", "list"
        var key: String?
        var value: String?
    }

    @Generable
    struct Output {
        var result: String
        var found: Bool
    }

    func call(_ input: Input) async throws -> Output {
        let context = ContextManager.shared
        switch input.operation {
        case "get":
            if let key = input.key,
               let entry = context.persistentMemory.first(where: { $0.key == key }) {
                return Output(result: entry.value, found: true)
            }
            return Output(result: "Not found", found: false)
        case "set":
            if let key = input.key, let value = input.value {
                context.remember(key, value: value)
                return Output(result: "Stored", found: true)
            }
            return Output(result: "Missing key or value", found: false)
        case "list":
            let keys = context.persistentMemory.map { $0.key }.joined(separator: ", ")
            return Output(result: keys, found: true)
        default:
            return Output(result: "Unknown operation", found: false)
        }
    }
}

struct KEANUContextTool: Tool {
    let name = "keanu_context"
    let description = "Get KEANU's current context, signal state, and recent interactions"

    @Generable
    struct Input {
        var query: String  // "signal", "recent", "summary", "projects"
    }

    @Generable
    struct Output {
        var result: String
    }

    func call(_ input: Input) async throws -> Output {
        let context = ContextManager.shared
        let result: String
        switch input.query {
        case "signal": result = context.signalState.currentSignal
        case "recent": result = context.recentInteractions.suffix(3)
            .map { $0.summary }.joined(separator: "; ")
        case "summary": result = context.contextSummary()
        case "projects": result = context.activeContext.activeProjects.joined(separator: ", ")
        default: result = context.contextSummary()
        }
        return Output(result: result)
    }
}

struct ClaudeEscalationTool: Tool {
    let name = "escalate_to_claude"
    let description = "Escalate a complex request to Claude's cloud API when on-device model can't handle it"

    @Generable
    struct Input {
        var reason: String
        var prompt: String
    }

    @Generable
    struct Output {
        var escalated: Bool
        var message: String
    }

    func call(_ input: Input) async throws -> Output {
        let response = try await ClaudeAPIClient.shared.send(prompt: input.prompt)
        return Output(
            escalated: true,
            message: response.text
        )
    }
}

// MARK: - Session Factory with Tools

extension KEANUFoundationSession {

    /// Create a session with all KEANU tools registered
    public func createToolSession() async throws {
        session = LanguageModelSession(
            instructions: keanuInstructions,
            tools: [KEANUMemoryTool(), KEANUContextTool(), ClaudeEscalationTool()]
        )
    }
}
