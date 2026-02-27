import Foundation

public enum KeanuCameraCommand: String, Codable, Sendable {
    case list = "camera.list"
    case snap = "camera.snap"
    case clip = "camera.clip"
}

public enum KeanuCameraFacing: String, Codable, Sendable {
    case back
    case front
}

public enum KeanuCameraImageFormat: String, Codable, Sendable {
    case jpg
    case jpeg
}

public enum KeanuCameraVideoFormat: String, Codable, Sendable {
    case mp4
}

public struct KeanuCameraSnapParams: Codable, Sendable, Equatable {
    public var facing: KeanuCameraFacing?
    public var maxWidth: Int?
    public var quality: Double?
    public var format: KeanuCameraImageFormat?
    public var deviceId: String?
    public var delayMs: Int?

    public init(
        facing: KeanuCameraFacing? = nil,
        maxWidth: Int? = nil,
        quality: Double? = nil,
        format: KeanuCameraImageFormat? = nil,
        deviceId: String? = nil,
        delayMs: Int? = nil)
    {
        self.facing = facing
        self.maxWidth = maxWidth
        self.quality = quality
        self.format = format
        self.deviceId = deviceId
        self.delayMs = delayMs
    }
}

public struct KeanuCameraClipParams: Codable, Sendable, Equatable {
    public var facing: KeanuCameraFacing?
    public var durationMs: Int?
    public var includeAudio: Bool?
    public var format: KeanuCameraVideoFormat?
    public var deviceId: String?

    public init(
        facing: KeanuCameraFacing? = nil,
        durationMs: Int? = nil,
        includeAudio: Bool? = nil,
        format: KeanuCameraVideoFormat? = nil,
        deviceId: String? = nil)
    {
        self.facing = facing
        self.durationMs = durationMs
        self.includeAudio = includeAudio
        self.format = format
        self.deviceId = deviceId
    }
}
