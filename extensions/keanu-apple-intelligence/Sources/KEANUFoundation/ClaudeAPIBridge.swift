// KEANUFoundation/ClaudeAPIBridge.swift
// When Apple's on-device model isn't enough, KEANU escalates to Claude.
// This is the cloud arm of the hybrid routing architecture.

import Foundation
import KEANUCore

// MARK: - Claude API Client

public actor ClaudeAPIClient {
    
    public static let shared = ClaudeAPIClient()
    
    private let baseURL = URL(string: "https://api.anthropic.com/v1/messages")!
    private let model = "claude-sonnet-4-5-20250929"  // Default model
    
    /// API key stored in Keychain (never hardcoded)
    private var apiKey: String? {
        // In production: read from Keychain
        // KeychainManager.shared.get("anthropic_api_key")
        return nil  // Must be configured by user
    }
    
    private init() {}
    
    // MARK: - API Calls
    
    /// Send a message to Claude API
    public func send(
        prompt: String,
        systemPrompt: String? = nil,
        maxTokens: Int = 1024,
        model: String? = nil
    ) async throws -> ClaudeResponse {
        guard let key = apiKey else {
            throw ClaudeAPIError.noAPIKey
        }
        
        var request = URLRequest(url: baseURL)
        request.httpMethod = "POST"
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        request.addValue(key, forHTTPHeaderField: "x-api-key")
        request.addValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        
        var body: [String: Any] = [
            "model": model ?? self.model,
            "max_tokens": maxTokens,
            "messages": [
                ["role": "user", "content": prompt]
            ]
        ]
        
        if let system = systemPrompt {
            body["system"] = system
        }
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? 0
            throw ClaudeAPIError.httpError(statusCode)
        }
        
        let result = try JSONDecoder().decode(AnthropicResponse.self, from: data)
        let text = result.content.compactMap { block -> String? in
            if block.type == "text" { return block.text }
            return nil
        }.joined(separator: "\n")
        
        return ClaudeResponse(
            text: text,
            model: result.model,
            inputTokens: result.usage.input_tokens,
            outputTokens: result.usage.output_tokens,
            stopReason: result.stop_reason
        )
    }
    
    /// Send with KEANU context injected
    public func sendWithContext(
        prompt: String,
        context: ContextManager
    ) async throws -> ClaudeResponse {
        let contextSummary = context.contextSummary()
        
        let systemPrompt = """
        You are Claude, working with KEANU (Drew Kemp-Dahlberg's intelligent agent). \
        KEANU has routed this request to you because it requires capabilities beyond \
        the on-device Apple Intelligence model.
        
        Current KEANU context:
        \(contextSummary)
        
        Drew's preferences: Direct, no BS, technically sharp. Full send or clean deny. \
        No disclaimers mid-output. Present optionality (2-4 choices) instead of open questions. \
        Call out over-analysis. Push to ship.
        """
        
        return try await send(
            prompt: prompt,
            systemPrompt: systemPrompt
        )
    }
}

// MARK: - Response Types

public struct ClaudeResponse: Sendable {
    public let text: String
    public let model: String
    public let inputTokens: Int
    public let outputTokens: Int
    public let stopReason: String
}

// MARK: - Anthropic API Models (for JSON decoding)

struct AnthropicResponse: Decodable {
    let id: String
    let type: String
    let role: String
    let model: String
    let content: [ContentBlock]
    let stop_reason: String
    let usage: Usage
    
    struct ContentBlock: Decodable {
        let type: String
        let text: String?
    }
    
    struct Usage: Decodable {
        let input_tokens: Int
        let output_tokens: Int
    }
}

// MARK: - Errors

public enum ClaudeAPIError: Error, LocalizedError {
    case noAPIKey
    case httpError(Int)
    case decodingError
    case rateLimited
    
    public var errorDescription: String? {
        switch self {
        case .noAPIKey: "No Anthropic API key configured. Add one in KEANU Settings."
        case .httpError(let code): "Claude API returned HTTP \(code)"
        case .decodingError: "Failed to decode Claude's response"
        case .rateLimited: "Rate limited. Falling back to on-device."
        }
    }
}

// MARK: - Hybrid Executor

/// Executes requests using the hybrid routing: Apple on-device first, Claude as fallback
public struct HybridExecutor {
    
    private let bridge = AppleIntelligenceBridge.shared
    private let claude = ClaudeAPIClient.shared
    private let context = ContextManager.shared
    
    public init() {}
    
    /// Execute a KEANU request with hybrid routing
    public func execute(_ request: KEANURequest) async throws -> ExecutionResult {
        let decision = RouterEngine.shared.route(request)
        
        switch decision.destination {
        case .appleOnDevice:
            return try await executeOnDevice(request)
            
        case .claudeCloud:
            return try await executeCloud(request)
            
        case .hybrid(_, let fallback):
            // Try on-device first
            do {
                let result = try await executeOnDevice(request)
                // Quality check: if confidence is low, escalate
                if result.confidence < 0.6 {
                    return try await executeCloud(request)
                }
                return result
            } catch {
                // Fallback to Claude
                if case .claudeCloud = fallback {
                    return try await executeCloud(request)
                }
                throw error
            }
            
        case .appleWritingTools:
            return try await executeWritingTools(request)
            
        case .appleImagePlayground:
            return try await executeImageGeneration(request)
        }
    }
    
    private func executeOnDevice(_ request: KEANURequest) async throws -> ExecutionResult {
        let analysis = try await KEANUFoundationSession.shared.analyze(request.prompt)
        return ExecutionResult(
            text: analysis.summary,
            source: .appleOnDevice,
            confidence: Double(analysis.confidenceScore) / 100.0,
            latency: 0.5,
            tokensUsed: 0,
            cost: 0.0  // On-device is free
        )
    }
    
    private func executeCloud(_ request: KEANURequest) async throws -> ExecutionResult {
        let response = try await claude.sendWithContext(
            prompt: request.prompt,
            context: context
        )
        return ExecutionResult(
            text: response.text,
            source: .claudeCloud,
            confidence: 0.9,
            latency: 2.0,
            tokensUsed: response.inputTokens + response.outputTokens,
            cost: Double(response.inputTokens + response.outputTokens) * 0.000003  // rough estimate
        )
    }
    
    private func executeWritingTools(_ request: KEANURequest) async throws -> ExecutionResult {
        let result = try await bridge.rewrite(request.prompt, tone: .drew)
        return ExecutionResult(
            text: result,
            source: .appleOnDevice,
            confidence: 0.8,
            latency: 0.3,
            tokensUsed: 0,
            cost: 0.0
        )
    }
    
    private func executeImageGeneration(_ request: KEANURequest) async throws -> ExecutionResult {
        let result = try await bridge.generateImage(description: request.prompt)
        return ExecutionResult(
            text: result.message,
            source: .appleOnDevice,
            confidence: 0.7,
            latency: 5.0,
            tokensUsed: 0,
            cost: 0.0
        )
    }
}

// MARK: - Execution Result

public struct ExecutionResult: Sendable {
    public let text: String
    public let source: RoutingDestination
    public let confidence: Double
    public let latency: TimeInterval
    public let tokensUsed: Int
    public let cost: Double  // USD
}
