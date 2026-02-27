import Foundation

public enum KeanuDeviceCommand: String, Codable, Sendable {
    case status = "device.status"
    case info = "device.info"
}

public enum KeanuBatteryState: String, Codable, Sendable {
    case unknown
    case unplugged
    case charging
    case full
}

public enum KeanuThermalState: String, Codable, Sendable {
    case nominal
    case fair
    case serious
    case critical
}

public enum KeanuNetworkPathStatus: String, Codable, Sendable {
    case satisfied
    case unsatisfied
    case requiresConnection
}

public enum KeanuNetworkInterfaceType: String, Codable, Sendable {
    case wifi
    case cellular
    case wired
    case other
}

public struct KeanuBatteryStatusPayload: Codable, Sendable, Equatable {
    public var level: Double?
    public var state: KeanuBatteryState
    public var lowPowerModeEnabled: Bool

    public init(level: Double?, state: KeanuBatteryState, lowPowerModeEnabled: Bool) {
        self.level = level
        self.state = state
        self.lowPowerModeEnabled = lowPowerModeEnabled
    }
}

public struct KeanuThermalStatusPayload: Codable, Sendable, Equatable {
    public var state: KeanuThermalState

    public init(state: KeanuThermalState) {
        self.state = state
    }
}

public struct KeanuStorageStatusPayload: Codable, Sendable, Equatable {
    public var totalBytes: Int64
    public var freeBytes: Int64
    public var usedBytes: Int64

    public init(totalBytes: Int64, freeBytes: Int64, usedBytes: Int64) {
        self.totalBytes = totalBytes
        self.freeBytes = freeBytes
        self.usedBytes = usedBytes
    }
}

public struct KeanuNetworkStatusPayload: Codable, Sendable, Equatable {
    public var status: KeanuNetworkPathStatus
    public var isExpensive: Bool
    public var isConstrained: Bool
    public var interfaces: [KeanuNetworkInterfaceType]

    public init(
        status: KeanuNetworkPathStatus,
        isExpensive: Bool,
        isConstrained: Bool,
        interfaces: [KeanuNetworkInterfaceType])
    {
        self.status = status
        self.isExpensive = isExpensive
        self.isConstrained = isConstrained
        self.interfaces = interfaces
    }
}

public struct KeanuDeviceStatusPayload: Codable, Sendable, Equatable {
    public var battery: KeanuBatteryStatusPayload
    public var thermal: KeanuThermalStatusPayload
    public var storage: KeanuStorageStatusPayload
    public var network: KeanuNetworkStatusPayload
    public var uptimeSeconds: Double

    public init(
        battery: KeanuBatteryStatusPayload,
        thermal: KeanuThermalStatusPayload,
        storage: KeanuStorageStatusPayload,
        network: KeanuNetworkStatusPayload,
        uptimeSeconds: Double)
    {
        self.battery = battery
        self.thermal = thermal
        self.storage = storage
        self.network = network
        self.uptimeSeconds = uptimeSeconds
    }
}

public struct KeanuDeviceInfoPayload: Codable, Sendable, Equatable {
    public var deviceName: String
    public var modelIdentifier: String
    public var systemName: String
    public var systemVersion: String
    public var appVersion: String
    public var appBuild: String
    public var locale: String

    public init(
        deviceName: String,
        modelIdentifier: String,
        systemName: String,
        systemVersion: String,
        appVersion: String,
        appBuild: String,
        locale: String)
    {
        self.deviceName = deviceName
        self.modelIdentifier = modelIdentifier
        self.systemName = systemName
        self.systemVersion = systemVersion
        self.appVersion = appVersion
        self.appBuild = appBuild
        self.locale = locale
    }
}
