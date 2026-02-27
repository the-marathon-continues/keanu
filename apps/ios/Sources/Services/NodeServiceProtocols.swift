import CoreLocation
import Foundation
import KeanuKit
import UIKit

protocol CameraServicing: Sendable {
    func listDevices() async -> [CameraController.CameraDeviceInfo]
    func snap(params: KeanuCameraSnapParams) async throws -> (format: String, base64: String, width: Int, height: Int)
    func clip(params: KeanuCameraClipParams) async throws -> (format: String, base64: String, durationMs: Int, hasAudio: Bool)
}

protocol ScreenRecordingServicing: Sendable {
    func record(
        screenIndex: Int?,
        durationMs: Int?,
        fps: Double?,
        includeAudio: Bool?,
        outPath: String?) async throws -> String
}

@MainActor
protocol LocationServicing: Sendable {
    func authorizationStatus() -> CLAuthorizationStatus
    func accuracyAuthorization() -> CLAccuracyAuthorization
    func ensureAuthorization(mode: KeanuLocationMode) async -> CLAuthorizationStatus
    func currentLocation(
        params: KeanuLocationGetParams,
        desiredAccuracy: KeanuLocationAccuracy,
        maxAgeMs: Int?,
        timeoutMs: Int?) async throws -> CLLocation
    func startLocationUpdates(
        desiredAccuracy: KeanuLocationAccuracy,
        significantChangesOnly: Bool) -> AsyncStream<CLLocation>
    func stopLocationUpdates()
    func startMonitoringSignificantLocationChanges(onUpdate: @escaping @Sendable (CLLocation) -> Void)
    func stopMonitoringSignificantLocationChanges()
}

protocol DeviceStatusServicing: Sendable {
    func status() async throws -> KeanuDeviceStatusPayload
    func info() -> KeanuDeviceInfoPayload
}

protocol PhotosServicing: Sendable {
    func latest(params: KeanuPhotosLatestParams) async throws -> KeanuPhotosLatestPayload
}

protocol ContactsServicing: Sendable {
    func search(params: KeanuContactsSearchParams) async throws -> KeanuContactsSearchPayload
    func add(params: KeanuContactsAddParams) async throws -> KeanuContactsAddPayload
}

protocol CalendarServicing: Sendable {
    func events(params: KeanuCalendarEventsParams) async throws -> KeanuCalendarEventsPayload
    func add(params: KeanuCalendarAddParams) async throws -> KeanuCalendarAddPayload
}

protocol RemindersServicing: Sendable {
    func list(params: KeanuRemindersListParams) async throws -> KeanuRemindersListPayload
    func add(params: KeanuRemindersAddParams) async throws -> KeanuRemindersAddPayload
}

protocol MotionServicing: Sendable {
    func activities(params: KeanuMotionActivityParams) async throws -> KeanuMotionActivityPayload
    func pedometer(params: KeanuPedometerParams) async throws -> KeanuPedometerPayload
}

struct WatchMessagingStatus: Sendable, Equatable {
    var supported: Bool
    var paired: Bool
    var appInstalled: Bool
    var reachable: Bool
    var activationState: String
}

struct WatchQuickReplyEvent: Sendable, Equatable {
    var replyId: String
    var promptId: String
    var actionId: String
    var actionLabel: String?
    var sessionKey: String?
    var note: String?
    var sentAtMs: Int?
    var transport: String
}

struct WatchNotificationSendResult: Sendable, Equatable {
    var deliveredImmediately: Bool
    var queuedForDelivery: Bool
    var transport: String
}

protocol WatchMessagingServicing: AnyObject, Sendable {
    func status() async -> WatchMessagingStatus
    func setReplyHandler(_ handler: (@Sendable (WatchQuickReplyEvent) -> Void)?)
    func sendNotification(
        id: String,
        params: KeanuWatchNotifyParams) async throws -> WatchNotificationSendResult
}

extension CameraController: CameraServicing {}
extension ScreenRecordService: ScreenRecordingServicing {}
extension LocationService: LocationServicing {}
