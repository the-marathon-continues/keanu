import Foundation

/// Privacy and retention policy for extension events.
///
/// Controls what gets logged, how long it's kept, and what paths/apps are excluded.
public struct RetentionPolicy: Codable, Sendable {
    // MARK: - Buffer Limits

    /// Maximum DNS query events to retain
    public var maxDNSQueries: Int = 1000

    /// Maximum network flow events to retain
    public var maxNetworkFlows: Int = 1000

    /// Maximum file access events to retain (higher due to volume)
    public var maxFileAccess: Int = 5000

    /// Maximum process execution events to retain
    public var maxProcessExec: Int = 1000

    // MARK: - Time-Based Retention

    /// Maximum age for events in seconds (default: 24 hours)
    public var maxAgeSeconds: TimeInterval = 86400

    // MARK: - Privacy Exclusions

    /// Exclude events from user documents/desktop (privacy)
    public var excludeUserDocuments: Bool = true

    /// Exclude events from Downloads folder
    public var excludeDownloads: Bool = false

    /// Hash sensitive paths instead of storing plaintext
    public var hashSensitivePaths: Bool = true

    /// Bundle IDs to exclude from monitoring
    public var excludedBundleIds: [String] = []

    /// Path prefixes to exclude from file monitoring
    public var excludedPathPrefixes: [String] = []

    /// Domain suffixes to exclude from DNS monitoring
    public var excludedDomainSuffixes: [String] = []

    // MARK: - Initializer

    public init(
        maxDNSQueries: Int = 1000,
        maxNetworkFlows: Int = 1000,
        maxFileAccess: Int = 5000,
        maxProcessExec: Int = 1000,
        maxAgeSeconds: TimeInterval = 86400,
        excludeUserDocuments: Bool = true,
        excludeDownloads: Bool = false,
        hashSensitivePaths: Bool = true,
        excludedBundleIds: [String] = [],
        excludedPathPrefixes: [String] = [],
        excludedDomainSuffixes: [String] = []
    ) {
        self.maxDNSQueries = maxDNSQueries
        self.maxNetworkFlows = maxNetworkFlows
        self.maxFileAccess = maxFileAccess
        self.maxProcessExec = maxProcessExec
        self.maxAgeSeconds = maxAgeSeconds
        self.excludeUserDocuments = excludeUserDocuments
        self.excludeDownloads = excludeDownloads
        self.hashSensitivePaths = hashSensitivePaths
        self.excludedBundleIds = excludedBundleIds
        self.excludedPathPrefixes = excludedPathPrefixes
        self.excludedDomainSuffixes = excludedDomainSuffixes
    }

    // MARK: - Default Policy

    public static let `default` = RetentionPolicy()

    /// Minimal privacy policy - excludes most user data
    public static let minimal: RetentionPolicy = {
        var policy = RetentionPolicy()
        policy.maxDNSQueries = 100
        policy.maxNetworkFlows = 100
        policy.maxFileAccess = 500
        policy.maxProcessExec = 100
        policy.maxAgeSeconds = 3600 // 1 hour
        policy.excludeUserDocuments = true
        policy.excludeDownloads = true
        policy.hashSensitivePaths = true
        policy.excludedPathPrefixes = [
            "~/Documents",
            "~/Desktop",
            "~/Pictures",
            "~/Movies",
            "~/Music",
        ]
        return policy
    }()

    /// Full monitoring policy - keeps more data
    public static let full: RetentionPolicy = {
        var policy = RetentionPolicy()
        policy.maxDNSQueries = 5000
        policy.maxNetworkFlows = 5000
        policy.maxFileAccess = 20000
        policy.maxProcessExec = 5000
        policy.maxAgeSeconds = 86400 * 7 // 7 days
        policy.excludeUserDocuments = false
        policy.excludeDownloads = false
        policy.hashSensitivePaths = false
        return policy
    }()

    // MARK: - Path Evaluation

    /// Check if a path should be excluded based on policy
    public func shouldExcludePath(_ path: String) -> Bool {
        // Always exclude these system paths
        let alwaysExclude = [
            "/private/var/db/",
            "/System/Library/Caches/",
            "/.Spotlight-V100/",
            "/private/var/folders/",
        ]
        for prefix in alwaysExclude {
            if path.hasPrefix(prefix) {
                return true
            }
        }

        // Check user document exclusion
        if excludeUserDocuments {
            let userDirs = ["Documents", "Desktop", "Pictures", "Movies", "Music"]
            let home = FileManager.default.homeDirectoryForCurrentUser.path
            for dir in userDirs {
                if path.hasPrefix("\(home)/\(dir)/") {
                    return true
                }
            }
        }

        // Check downloads exclusion
        if excludeDownloads {
            let home = FileManager.default.homeDirectoryForCurrentUser.path
            if path.hasPrefix("\(home)/Downloads/") {
                return true
            }
        }

        // Check custom exclusions
        for prefix in excludedPathPrefixes {
            let expandedPrefix = prefix.replacingOccurrences(of: "~", with: FileManager.default.homeDirectoryForCurrentUser.path)
            if path.hasPrefix(expandedPrefix) {
                return true
            }
        }

        return false
    }

    /// Check if a domain should be excluded
    public func shouldExcludeDomain(_ domain: String) -> Bool {
        let lowercased = domain.lowercased()
        for suffix in excludedDomainSuffixes {
            if lowercased.hasSuffix(suffix.lowercased()) {
                return true
            }
        }
        return false
    }

    /// Check if an app bundle ID should be excluded
    public func shouldExcludeApp(_ bundleId: String) -> Bool {
        // Always exclude Keanu's own processes
        if bundleId.hasPrefix("ai.keanu") {
            return true
        }

        for excluded in excludedBundleIds {
            if bundleId == excluded || bundleId.hasPrefix(excluded) {
                return true
            }
        }
        return false
    }

    /// Apply privacy transformation to a path (hash if needed)
    public func transformPath(_ path: String) -> String {
        guard hashSensitivePaths else { return path }

        let sensitivePatterns = [
            "/.ssh/",
            "/.aws/",
            "/.gnupg/",
            "/keychain",
            "/password",
            "/credential",
            "/secret",
            "/.env",
            "/token",
        ]

        for pattern in sensitivePatterns {
            if path.lowercased().contains(pattern.lowercased()) {
                // Hash the filename, keep the directory
                let url = URL(fileURLWithPath: path)
                let dir = url.deletingLastPathComponent().path
                let filename = url.lastPathComponent
                let hash = filename.data(using: .utf8)?.base64EncodedString().prefix(8) ?? "***"
                return "\(dir)/[hashed:\(hash)]"
            }
        }

        return path
    }
}
