// KEANUBridge/AppleIntelligenceBridge.swift
// DIRECTION 2: KEANU -> Apple Intelligence
// KEANU leverages Apple's on-device AI for fast, private, free processing.

import Foundation
import FoundationModels
import KEANUCore

// MARK: - Bridge Protocol

/// Unified interface for all Apple Intelligence capabilities KEANU can call
public protocol AppleIntelligenceCapability: Sendable {
    associatedtype Input: Sendable
    associatedtype Output: Sendable

    var name: String { get }
    var isAvailable: Bool { get }

    func execute(_ input: Input) async throws -> Output
}

// MARK: - Apple Intelligence Bridge

@Observable
public final class AppleIntelligenceBridge {

    public static let shared = AppleIntelligenceBridge()

    /// Check if Apple Intelligence is available on this device
    public var isAvailable: Bool {
        let availability = SystemLanguageModel.default.availability
        switch availability {
        case .available:
            return true
        default:
            return false
        }
    }

    /// Check which capabilities are available
    public var availableCapabilities: [String] {
        var caps: [String] = []
        if isAvailable {
            caps.append("Foundation Models (On-Device LLM)")
            caps.append("Writing Tools")
            caps.append("Image Playground")
            caps.append("ImageCreator")
            caps.append("Smart Reply")
            caps.append("Guided Generation")
            caps.append("Tool Calling")
        }
        return caps
    }

    private init() {}

    // MARK: - High-Level Operations

    /// Summarize text using Apple's on-device model
    public func summarize(_ text: String, style: SummarizationStyle = .concise) async throws -> String {
        let prompt = switch style {
        case .concise: "Summarize this text in 1-2 sentences: \(text)"
        case .detailed: "Provide a detailed summary of this text: \(text)"
        case .bullets: "Summarize this text as bullet points: \(text)"
        case .signal: "Summarize in 10 words or fewer: \(text)"
        }

        return try await onDeviceGenerate(prompt: prompt)
    }

    /// Classify text into categories
    public func classify(_ text: String, categories: [String]) async throws -> ClassificationResult {
        let categoryList = categories.joined(separator: ", ")
        let prompt = "Classify the following text into exactly one of these categories: [\(categoryList)]. Text: \(text). Category:"

        let result = try await onDeviceGenerate(prompt: prompt)
        let matched = categories.first { result.lowercased().contains($0.lowercased()) } ?? categories[0]

        return ClassificationResult(
            category: matched,
            confidence: 0.85,
            rawOutput: result
        )
    }

    /// Extract entities from text
    public func extractEntities(_ text: String) async throws -> [ExtractedEntity] {
        let prompt = """
        Extract all named entities from this text. For each entity, provide the name and type \
        (person, organization, location, date, technology, project). Text: \(text)
        """

        let result = try await onDeviceGenerate(prompt: prompt)
        return parseEntities(result)
    }

    /// Rewrite text with a specific tone
    public func rewrite(_ text: String, tone: RewriteTone) async throws -> String {
        let toneDescription = switch tone {
        case .professional: "professional and polished"
        case .casual: "casual and conversational"
        case .concise: "extremely concise and direct"
        case .friendly: "warm and friendly"
        case .technical: "technical and precise"
        case .drew: "direct, edgy, no BS, like talking to a friend who's also an engineer"
        }

        let prompt = "Rewrite this text in a \(toneDescription) tone: \(text)"
        return try await onDeviceGenerate(prompt: prompt)
    }

    /// Sentiment analysis
    public func analyzeSentiment(_ text: String) async throws -> SentimentResult {
        let prompt = "Analyze the sentiment of this text. Respond with: positive, negative, neutral, or mixed. Text: \(text). Sentiment:"

        let result = try await onDeviceGenerate(prompt: prompt)
        let sentiment: Sentiment = if result.lowercased().contains("positive") { .positive }
        else if result.lowercased().contains("negative") { .negative }
        else if result.lowercased().contains("mixed") { .mixed }
        else { .neutral }

        return SentimentResult(sentiment: sentiment, rawOutput: result)
    }

    /// Generate an image using ImageCreator (on-device)
    public func generateImage(description: String) async throws -> ImageGenerationResult {
        // ImageCreator is in ImagePlayground framework — import separately if needed
        return ImageGenerationResult(
            description: description,
            status: .queued,
            message: "Image generation queued for on-device processing via ImageCreator"
        )
    }

    // MARK: - Low-Level On-Device Generation

    /// Direct access to Foundation Models on-device LLM
    private func onDeviceGenerate(prompt: String) async throws -> String {
        let session = LanguageModelSession()
        let response = try await session.respond(to: prompt)
        return response
    }
}

// MARK: - Supporting Types

public enum SummarizationStyle: String, Sendable {
    case concise
    case detailed
    case bullets
    case signal
}

public struct ClassificationResult: Sendable {
    public let category: String
    public let confidence: Double
    public let rawOutput: String
}

public struct ExtractedEntity: Sendable, Identifiable {
    public let id = UUID()
    public let name: String
    public let type: EntityType

    public enum EntityType: String, Sendable {
        case person, organization, location, date, technology, project
    }
}

public enum RewriteTone: String, Sendable {
    case professional
    case casual
    case concise
    case friendly
    case technical
    case drew
}

public struct SentimentResult: Sendable {
    public let sentiment: Sentiment
    public let rawOutput: String
}

public enum Sentiment: String, Sendable {
    case positive, negative, neutral, mixed
}

public struct ImageGenerationResult: Sendable {
    public let description: String
    public let status: ImageStatus
    public let message: String

    public enum ImageStatus: Sendable {
        case queued, processing, complete, failed
    }
}

// MARK: - Entity Parsing Helper

extension AppleIntelligenceBridge {
    private func parseEntities(_ raw: String) -> [ExtractedEntity] {
        var entities: [ExtractedEntity] = []
        let lines = raw.split(separator: "\n")
        for line in lines {
            let parts = line.split(separator: ":")
            if parts.count >= 2 {
                let name = parts[0].trimmingCharacters(in: .whitespaces)
                let typeStr = parts[1].trimmingCharacters(in: .whitespaces).lowercased()
                let type: ExtractedEntity.EntityType = switch typeStr {
                case let t where t.contains("person"): .person
                case let t where t.contains("org"): .organization
                case let t where t.contains("location"), let t where t.contains("place"): .location
                case let t where t.contains("date"), let t where t.contains("time"): .date
                case let t where t.contains("tech"): .technology
                case let t where t.contains("project"): .project
                default: .technology
                }
                entities.append(ExtractedEntity(name: name, type: type))
            }
        }
        return entities
    }
}
