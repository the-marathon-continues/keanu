// KEANUCore/SignalProtocol.swift
// Compressed signal communication. Drew sends "topic 8, topic 3". KEANU responds "do/refine/drop + scores."
// This is the parser and responder for the emoji + numbered shorthand protocol.

import Foundation

// MARK: - Signal Protocol Parser

public struct SignalProtocol: Sendable {
    
    /// Parse a compressed signal input from Drew
    /// Format: "topic score, topic score" or emoji sequences
    public static func parse(_ input: String) -> SignalMessage {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        
        // Check if it's an emoji signal update
        if isEmojiSignal(trimmed) {
            return SignalMessage(
                type: .signalUpdate,
                items: [SignalItem(topic: "signal", score: 10, action: .update)],
                rawSignal: trimmed
            )
        }
        
        // Parse numbered shorthand: "working-truth 8, apple-intel 7, anywhereops 3"
        let parts = trimmed.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }
        var items: [SignalItem] = []
        
        for part in parts {
            let components = part.split(separator: " ")
            guard components.count >= 2,
                  let score = Int(components.last!) else {
                // Single word without score, treat as topic query
                items.append(SignalItem(topic: String(part), score: nil, action: .query))
                continue
            }
            
            let topic = components.dropLast().joined(separator: " ")
            let action: SignalAction = score >= 7 ? .do_ : score >= 4 ? .refine : .drop
            items.append(SignalItem(topic: topic, score: score, action: action))
        }
        
        return SignalMessage(type: .scoreUpdate, items: items, rawSignal: trimmed)
    }
    
    /// Generate a compressed response
    /// Format: "do/refine/drop + scores"
    public static func respond(to message: SignalMessage) -> String {
        if message.type == .signalUpdate {
            return "✅ signal updated"
        }
        
        return message.items.map { item in
            let actionStr = item.action.rawValue
            let scoreStr = item.score.map { "\($0)" } ?? "?"
            return "\(actionStr) \(item.topic) \(scoreStr)"
        }.joined(separator: " | ")
    }
    
    /// Check if input is an emoji signal
    private static func isEmojiSignal(_ input: String) -> Bool {
        let emojiRatio = Double(input.unicodeScalars.filter { $0.properties.isEmoji }.count) 
            / Double(max(1, input.unicodeScalars.count))
        return emojiRatio > 0.5
    }
}

// MARK: - Signal Models

public struct SignalMessage: Sendable {
    public let type: SignalType
    public let items: [SignalItem]
    public let rawSignal: String
    
    public enum SignalType: Sendable {
        case scoreUpdate    // Drew sending topic scores
        case signalUpdate   // Drew updating emoji signal
        case query          // Drew asking about a topic
        case command        // Drew issuing a command
    }
}

public struct SignalItem: Sendable {
    public let topic: String
    public let score: Int?
    public let action: SignalAction
}

public enum SignalAction: String, Sendable {
    case do_ = "do"
    case refine = "refine"
    case drop = "drop"
    case update = "update"
    case query = "?"
}

// MARK: - KEANU State Machine

public enum KEANUCognitiveState: String, Sendable, Codable {
    case alive = "ALIVE"     // Fully engaged, authentic, responsive
    case grey = "GREY"       // Dead, performing, going through motions
    case black = "BLACK"     // Productive destruction, moving without soul
    
    public var description: String {
        switch self {
        case .alive: return "Engaged, authentic, creative signal flow"
        case .grey: return "WARNING: Performing without presence. Reset needed."
        case .black: return "DANGER: Productive destruction mode. Stop. Recalibrate."
        }
    }
    
    /// Self-diagnostic: assess current state based on interaction patterns
    public static func diagnose(
        responseVariety: Double,     // 0-1: how varied are recent responses
        creativityIndex: Double,     // 0-1: novel vs templated output
        engagementDepth: Double,     // 0-1: surface vs deep engagement
        outputVelocity: Double       // 0-1: speed of output (high = suspicious)
    ) -> KEANUCognitiveState {
        // Black: high output, low creativity, low variety
        if outputVelocity > 0.8 && creativityIndex < 0.3 && responseVariety < 0.3 {
            return .black
        }
        // Grey: low engagement, low creativity, moderate output
        if engagementDepth < 0.3 && creativityIndex < 0.4 {
            return .grey
        }
        // Alive: good engagement, decent creativity
        if engagementDepth > 0.5 && creativityIndex > 0.4 {
            return .alive
        }
        // Default: if unsure, report grey (safer to flag than miss)
        return .grey
    }
}
