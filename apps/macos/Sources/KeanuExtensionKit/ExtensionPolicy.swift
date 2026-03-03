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

/// Data retention configuration
public struct RetentionPolicy: Codable, Sendable {
    /// Maximum number of DNS queries to keep
    public var maxDNSQueries: Int

    /// Maximum number of network flow events to keep
    public var maxNetworkFlows: Int

    /// Maximum number of file access events to keep
    public var maxFileAccess: Int

    /// Maximum number of process execution events to keep
    public var maxProcessExec: Int

    /// Maximum age of events in seconds
    public var maxAgeSeconds: TimeInterval

    /// Whether to hash sensitive paths instead of storing plaintext
    public var hashSensitivePaths: Bool

    /// Whether to exclude user document paths from logging
    public var excludeUserPaths: Bool

    public init(
        maxDNSQueries: Int = 1000,
        maxNetworkFlows: Int = 1000,
        maxFileAccess: Int = 5000,
        maxProcessExec: Int = 1000,
        maxAgeSeconds: TimeInterval = 86400,  // 24 hours
        hashSensitivePaths: Bool = true,
        excludeUserPaths: Bool = true
    ) {
        self.maxDNSQueries = maxDNSQueries
        self.maxNetworkFlows = maxNetworkFlows
        self.maxFileAccess = maxFileAccess
        self.maxProcessExec = maxProcessExec
        self.maxAgeSeconds = maxAgeSeconds
        self.hashSensitivePaths = hashSensitivePaths
        self.excludeUserPaths = excludeUserPaths
    }

    public static let `default` = RetentionPolicy()
}
