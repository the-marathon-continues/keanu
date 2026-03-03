import Foundation

/// Configuration policy for system extensions
public struct ExtensionPolicy: Codable, Sendable {
    /// Operating mode for the extension
    public var mode: ExtensionMode

    /// Paths to exclude from monitoring
    public var excludedPaths: [String]

    /// Bundle IDs to exclude from monitoring
    public var excludedApps: [String]

    /// Process paths to exclude from monitoring
    public var excludedProcesses: [String]

    /// Whether to monitor keanu's own processes
    public var monitorSelf: Bool

    /// Retention settings
    public var retention: RetentionPolicy

    public init(
        mode: ExtensionMode = .observe,
        excludedPaths: [String] = [],
        excludedApps: [String] = [],
        excludedProcesses: [String] = [],
        monitorSelf: Bool = false,
        retention: RetentionPolicy = RetentionPolicy()
    ) {
        self.mode = mode
        self.excludedPaths = excludedPaths
        self.excludedApps = excludedApps
        self.excludedProcesses = excludedProcesses
        self.monitorSelf = monitorSelf
        self.retention = retention
    }

    /// Default policy with sensible defaults
    public static let `default` = ExtensionPolicy(
        mode: .observe,
        excludedPaths: [
            "/private/var/db",
            "/System/",
            "/.Spotlight-",
            "/Library/Caches",
        ],
        excludedApps: [],
        excludedProcesses: [
            "/usr/libexec/secinitd",
            "/usr/libexec/trustd",
            "/System/Library/Frameworks/CoreServices.framework/",
        ],
        monitorSelf: false,
        retention: .default
    )
}

/// Operating mode for extensions
public enum ExtensionMode: String, Codable, Sendable {
    /// Log events but never block anything (DEFAULT)
    case observe

    /// Log events and prompt user for suspicious items
    case audit

    /// Can block based on rules (requires explicit user opt-in)
    case protect
}
