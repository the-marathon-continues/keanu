// KEANUCore/RouterEngine.swift
// The brain. Decides: Apple on-device, Claude cloud, or hybrid.

import Foundation

// MARK: - Task Complexity Assessment

public enum TaskComplexity: Sendable {
    case simple      // Summarize, classify, extract, tag
    case medium      // Multi-step reasoning, context-dependent
    case complex     // Deep reasoning, world knowledge, code generation
    case realtime    // Needs instant response, no network latency tolerance
}

public enum RoutingDestination: Sendable {
    case appleOnDevice          // Foundation Models framework
    case claudeCloud            // Anthropic API
    case hybrid(primary: RoutingDestination, fallback: RoutingDestination)
    case appleWritingTools      // System Writing Tools
    case appleImagePlayground   // Image generation
}

public struct RoutingDecision: Sendable {
    public let destination: RoutingDestination
    public let reasoning: String
    public let estimatedLatency: TimeInterval
    public let privacyLevel: PrivacyLevel
    
    public enum PrivacyLevel: Sendable {
        case onDevice       // Never leaves the device
        case privateCloud   // Apple Private Cloud Compute
        case cloudAPI       // Claude API (encrypted, but leaves device)
    }
}

// MARK: - Router Engine

@Observable
public final class RouterEngine: Sendable {
    
    public static let shared = RouterEngine()
    
    private init() {}
    
    /// Analyze a request and decide where to route it
    public func route(_ request: KEANURequest) -> RoutingDecision {
        let complexity = assessComplexity(request)
        
        switch complexity {
        case .simple:
            return RoutingDecision(
                destination: .appleOnDevice,
                reasoning: "Simple task: \(request.taskType). On-device is instant, free, private.",
                estimatedLatency: 0.5,
                privacyLevel: .onDevice
            )
            
        case .medium:
            // Can Apple FM handle it with tool calling? Or do we need Claude?
            if request.requiresWorldKnowledge || request.requiresCodeGeneration {
                return RoutingDecision(
                    destination: .claudeCloud,
                    reasoning: "Medium task requiring \(request.requiresWorldKnowledge ? "world knowledge" : "code gen"). Claude needed.",
                    estimatedLatency: 2.0,
                    privacyLevel: .cloudAPI
                )
            }
            return RoutingDecision(
                destination: .hybrid(primary: .appleOnDevice, fallback: .claudeCloud),
                reasoning: "Medium task: try on-device first, fall back to Claude if quality insufficient.",
                estimatedLatency: 1.0,
                privacyLevel: .onDevice
            )
            
        case .complex:
            return RoutingDecision(
                destination: .claudeCloud,
                reasoning: "Complex task: deep reasoning required. Claude is the right tool.",
                estimatedLatency: 3.0,
                privacyLevel: .cloudAPI
            )
            
        case .realtime:
            return RoutingDecision(
                destination: .appleOnDevice,
                reasoning: "Realtime constraint: must be on-device for latency.",
                estimatedLatency: 0.3,
                privacyLevel: .onDevice
            )
        }
    }
    
    /// Assess complexity of a request
    private func assessComplexity(_ request: KEANURequest) -> TaskComplexity {
        // Signal protocol compressed commands are always simple/realtime
        if request.isSignalProtocol { return .realtime }
        
        // Classification heuristics
        let simpleTaskTypes: Set<TaskType> = [
            .summarize, .classify, .extract, .tag, .sentiment, .rewrite
        ]
        if simpleTaskTypes.contains(request.taskType) && request.inputTokenEstimate < 2000 {
            return .simple
        }
        
        if request.requiresCodeGeneration || request.requiresAdvancedReasoning {
            return .complex
        }
        
        if request.requiresWorldKnowledge {
            return request.inputTokenEstimate > 3000 ? .complex : .medium
        }
        
        return .medium
    }
}

// MARK: - Request Model

public struct KEANURequest: Sendable {
    public let id: UUID
    public let prompt: String
    public let taskType: TaskType
    public let context: [String: String]
    public let isSignalProtocol: Bool
    public let requiresWorldKnowledge: Bool
    public let requiresCodeGeneration: Bool
    public let requiresAdvancedReasoning: Bool
    public let inputTokenEstimate: Int
    public let source: RequestSource
    public let timestamp: Date
    
    public enum RequestSource: Sendable {
        case siri              // Came from Siri via App Intents
        case shortcuts         // Came from Shortcuts app
        case spotlight         // Came from Spotlight
        case app               // Direct from KEANU app
        case claudeWeb         // Routed from Claude web
        case claudeDesktop     // Routed from Claude desktop
        case claudeCode        // Routed from Claude Code
        case widget            // From a widget
    }
    
    public init(
        prompt: String,
        taskType: TaskType = .general,
        context: [String: String] = [:],
        isSignalProtocol: Bool = false,
        requiresWorldKnowledge: Bool = false,
        requiresCodeGeneration: Bool = false,
        requiresAdvancedReasoning: Bool = false,
        source: RequestSource = .app
    ) {
        self.id = UUID()
        self.prompt = prompt
        self.taskType = taskType
        self.context = context
        self.isSignalProtocol = isSignalProtocol
        self.requiresWorldKnowledge = requiresWorldKnowledge
        self.requiresCodeGeneration = requiresCodeGeneration
        self.requiresAdvancedReasoning = requiresAdvancedReasoning
        self.inputTokenEstimate = prompt.count / 4 // rough estimate
        self.source = source
        self.timestamp = Date()
    }
}

public enum TaskType: String, Sendable, CaseIterable {
    case summarize
    case classify
    case extract
    case tag
    case sentiment
    case rewrite
    case generate
    case reason
    case code
    case general
    case signal      // Signal protocol command
    case route       // Route to specific Claude instance
    case memory      // Memory operation
    case status      // Status check
}
