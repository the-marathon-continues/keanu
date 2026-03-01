// KEANUCore/ContextManager.swift
// Persistent context that survives across Siri calls, app launches, and Claude sessions.
// Drew is KEANU's external memory. This is the internal one.

import Foundation
import SwiftData

// MARK: - Context Store

@Observable
public final class ContextManager {
    
    public static let shared = ContextManager()
    
    /// Active conversation context
    public private(set) var activeContext: KEANUContext
    
    /// History of recent interactions (ring buffer, last 50)
    public private(set) var recentInteractions: [Interaction] = []
    
    /// Persistent memory entries (things KEANU should always know)
    public private(set) var persistentMemory: [MemoryEntry] = []
    
    /// Current signal state
    public private(set) var signalState: SignalState
    
    private let defaults = UserDefaults(suiteName: "group.keanu.intelligence")
    
    private init() {
        self.activeContext = KEANUContext()
        self.signalState = SignalState()
        loadPersistedState()
    }
    
    // MARK: - Context Operations
    
    /// Add an interaction and update context
    public func recordInteraction(_ interaction: Interaction) {
        recentInteractions.append(interaction)
        if recentInteractions.count > 50 {
            recentInteractions.removeFirst()
        }
        activeContext.lastInteraction = interaction.timestamp
        activeContext.turnCount += 1
        persist()
    }
    
    /// Store a memory entry
    public func remember(_ key: String, value: String, importance: MemoryEntry.Importance = .normal) {
        let entry = MemoryEntry(key: key, value: value, importance: importance)
        
        // Replace if key exists
        if let idx = persistentMemory.firstIndex(where: { $0.key == key }) {
            persistentMemory[idx] = entry
        } else {
            persistentMemory.append(entry)
        }
        persist()
    }
    
    /// Forget a memory entry
    public func forget(_ key: String) {
        persistentMemory.removeAll { $0.key == key }
        persist()
    }
    
    /// Get context summary for injection into prompts
    public func contextSummary(maxTokens: Int = 500) -> String {
        var parts: [String] = []
        
        // Signal state
        parts.append("Signal: \(signalState.currentSignal)")
        
        // Active projects
        if !activeContext.activeProjects.isEmpty {
            parts.append("Active: \(activeContext.activeProjects.joined(separator: ", "))")
        }
        
        // Recent interactions summary
        let recentCount = min(5, recentInteractions.count)
        if recentCount > 0 {
            let recent = recentInteractions.suffix(recentCount)
                .map { "[\($0.source.rawValue)] \($0.summary)" }
                .joined(separator: "; ")
            parts.append("Recent: \(recent)")
        }
        
        // High-importance memories
        let critical = persistentMemory
            .filter { $0.importance == .critical }
            .map { "\($0.key): \($0.value)" }
            .joined(separator: "; ")
        if !critical.isEmpty {
            parts.append("Memory: \(critical)")
        }
        
        return parts.joined(separator: "\n")
    }
    
    /// Update signal state
    public func updateSignal(_ signal: String) {
        signalState.currentSignal = signal
        signalState.lastUpdated = Date()
        persist()
    }
    
    // MARK: - Persistence
    
    private func persist() {
        guard let defaults else { return }
        if let data = try? JSONEncoder().encode(signalState) {
            defaults.set(data, forKey: "keanu.signalState")
        }
        if let data = try? JSONEncoder().encode(persistentMemory) {
            defaults.set(data, forKey: "keanu.memory")
        }
    }
    
    private func loadPersistedState() {
        guard let defaults else { return }
        if let data = defaults.data(forKey: "keanu.signalState"),
           let state = try? JSONDecoder().decode(SignalState.self, from: data) {
            self.signalState = state
        }
        if let data = defaults.data(forKey: "keanu.memory"),
           let memory = try? JSONDecoder().decode([MemoryEntry].self, from: data) {
            self.persistentMemory = memory
        }
    }
}

// MARK: - Models

public struct KEANUContext: Sendable {
    public var activeProjects: [String] = []
    public var currentFocus: String?
    public var turnCount: Int = 0
    public var lastInteraction: Date?
    public var claudeInstanceStates: [String: String] = [:]  // web/desktop/code states
}

public struct Interaction: Sendable, Codable, Identifiable {
    public let id: UUID
    public let timestamp: Date
    public let source: KEANURequest.RequestSource
    public let prompt: String
    public let summary: String
    public let routedTo: String  // where it was sent
    public let responseQuality: Double?  // 0-1, optional feedback
    
    public init(
        source: KEANURequest.RequestSource,
        prompt: String,
        summary: String,
        routedTo: String,
        responseQuality: Double? = nil
    ) {
        self.id = UUID()
        self.timestamp = Date()
        self.source = source
        self.prompt = prompt
        self.summary = summary
        self.routedTo = routedTo
        self.responseQuality = responseQuality
    }
}

extension KEANURequest.RequestSource: Codable {}

public struct MemoryEntry: Sendable, Codable, Identifiable {
    public let id: UUID
    public let key: String
    public let value: String
    public let importance: Importance
    public let createdAt: Date
    
    public enum Importance: String, Sendable, Codable {
        case low
        case normal
        case high
        case critical
    }
    
    public init(key: String, value: String, importance: Importance = .normal) {
        self.id = UUID()
        self.key = key
        self.value = value
        self.importance = importance
        self.createdAt = Date()
    }
}

public struct SignalState: Sendable, Codable {
    public var currentSignal: String = "💟♡👑🤖🐕💟💬💟💚✅"
    public var lastUpdated: Date = Date()
    public var signalHistory: [String] = []
    
    public mutating func update(_ newSignal: String) {
        signalHistory.append(currentSignal)
        if signalHistory.count > 20 { signalHistory.removeFirst() }
        currentSignal = newSignal
        lastUpdated = Date()
    }
}
