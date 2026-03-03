import Foundation

/// Events emitted by system extensions to the main app
public enum ExtensionEvent: Codable, Sendable {
    case dnsQuery(DNSQueryEvent)
    case networkFlow(NetworkFlowEvent)
    case fileAccess(FileAccessEvent)
    case processExec(ProcessExecEvent)
}

// MARK: - DNS Events

public struct DNSQueryEvent: Codable, Sendable {
    public let timestamp: Date
    public let domain: String
    public let queryType: String  // A, AAAA, CNAME, etc.
    public let sourceApp: String?
    public let sourceProcess: String?

    public init(
        timestamp: Date = Date(),
        domain: String,
        queryType: String,
        sourceApp: String? = nil,
        sourceProcess: String? = nil
    ) {
        self.timestamp = timestamp
        self.domain = domain
        self.queryType = queryType
        self.sourceApp = sourceApp
        self.sourceProcess = sourceProcess
    }
}

// MARK: - Network Flow Events

public struct NetworkFlowEvent: Codable, Sendable {
    public let timestamp: Date
    public let sourceApp: String?
    public let destinationHost: String
    public let destinationPort: UInt16
    public let `protocol`: String  // tcp, udp
    public let direction: FlowDirection
    public let bytesIn: UInt64
    public let bytesOut: UInt64

    public init(
        timestamp: Date = Date(),
        sourceApp: String? = nil,
        destinationHost: String,
        destinationPort: UInt16,
        protocol: String,
        direction: FlowDirection,
        bytesIn: UInt64 = 0,
        bytesOut: UInt64 = 0
    ) {
        self.timestamp = timestamp
        self.sourceApp = sourceApp
        self.destinationHost = destinationHost
        self.destinationPort = destinationPort
        self.protocol = `protocol`
        self.direction = direction
        self.bytesIn = bytesIn
        self.bytesOut = bytesOut
    }
}

public enum FlowDirection: String, Codable, Sendable {
    case inbound
    case outbound
}

// MARK: - File Access Events (Endpoint Security)

public struct FileAccessEvent: Codable, Sendable {
    public let timestamp: Date
    public let path: String
    public let operation: FileOperation
    public let processPath: String
    public let processId: Int32
    public let userId: UInt32
    public let allowed: Bool

    public init(
        timestamp: Date = Date(),
        path: String,
        operation: FileOperation,
        processPath: String,
        processId: Int32,
        userId: UInt32,
        allowed: Bool = true
    ) {
        self.timestamp = timestamp
        self.path = path
        self.operation = operation
        self.processPath = processPath
        self.processId = processId
        self.userId = userId
        self.allowed = allowed
    }
}

public enum FileOperation: String, Codable, Sendable {
    case open
    case read
    case write
    case delete
    case rename
    case create
    case link
    case unlink
}

// MARK: - Process Execution Events (Endpoint Security)

public struct ProcessExecEvent: Codable, Sendable {
    public let timestamp: Date
    public let path: String
    public let args: [String]
    public let processId: Int32
    public let parentProcessId: Int32
    public let userId: UInt32
    public let userName: String?
    public let signingInfo: ProcessSigningInfo?
    public let allowed: Bool

    public init(
        timestamp: Date = Date(),
        path: String,
        args: [String] = [],
        processId: Int32,
        parentProcessId: Int32,
        userId: UInt32,
        userName: String? = nil,
        signingInfo: ProcessSigningInfo? = nil,
        allowed: Bool = true
    ) {
        self.timestamp = timestamp
        self.path = path
        self.args = args
        self.processId = processId
        self.parentProcessId = parentProcessId
        self.userId = userId
        self.userName = userName
        self.signingInfo = signingInfo
        self.allowed = allowed
    }
}

public struct ProcessSigningInfo: Codable, Sendable {
    public let teamId: String?
    public let signingId: String?
    public let isTrusted: Bool

    public init(teamId: String? = nil, signingId: String? = nil, isTrusted: Bool = false) {
        self.teamId = teamId
        self.signingId = signingId
        self.isTrusted = isTrusted
    }
}
