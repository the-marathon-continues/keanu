import Foundation

/// Commands sent from the main app to extensions
public enum ExtensionCommand: Codable, Sendable {
    /// Update the extension's policy
    case updatePolicy(ExtensionPolicy)

    /// Query the extension's current status
    case queryStatus

    /// Request the extension to shutdown gracefully
    case shutdown

    /// Clear all stored events
    case clearEvents

    /// Pause event collection without uninstalling
    case pause

    /// Resume event collection
    case resume
}

/// Response from extension to command
public struct ExtensionCommandResponse: Codable, Sendable {
    public let success: Bool
    public let message: String?
    public let status: ExtensionStatus?

    public init(success: Bool, message: String? = nil, status: ExtensionStatus? = nil) {
        self.success = success
        self.message = message
        self.status = status
    }

    public static func ok(_ message: String? = nil) -> ExtensionCommandResponse {
        ExtensionCommandResponse(success: true, message: message)
    }

    public static func error(_ message: String) -> ExtensionCommandResponse {
        ExtensionCommandResponse(success: false, message: message)
    }
}

/// Current status of an extension
public struct ExtensionStatus: Codable, Sendable {
    public let bundleId: String
    public let state: ExtensionState
    public let eventsProcessed: UInt64
    public let lastEventTimestamp: Date?
    public let uptime: TimeInterval
    public let policy: ExtensionPolicy

    public init(
        bundleId: String,
        state: ExtensionState,
        eventsProcessed: UInt64 = 0,
        lastEventTimestamp: Date? = nil,
        uptime: TimeInterval = 0,
        policy: ExtensionPolicy = .default
    ) {
        self.bundleId = bundleId
        self.state = state
        self.eventsProcessed = eventsProcessed
        self.lastEventTimestamp = lastEventTimestamp
        self.uptime = uptime
        self.policy = policy
    }
}

/// State of a system extension
public enum ExtensionState: String, Codable, Sendable {
    /// Extension is not installed
    case notInstalled

    /// Extension is being installed
    case installing

    /// Extension is installed but needs user approval in System Settings
    case needsApproval

    /// Extension is installed and running
    case running

    /// Extension is installed but paused
    case paused

    /// Extension encountered an error
    case error

    /// Extension is being uninstalled
    case uninstalling
}
