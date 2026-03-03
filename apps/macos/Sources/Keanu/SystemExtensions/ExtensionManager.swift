import Foundation
import AppKit
import SystemExtensions
import os.log

/// Manages the lifecycle of Keanu system extensions.
///
/// Uses OSSystemExtensionRequest API to activate/deactivate extensions.
/// Tracks state: notInstalled → installing → installed/needsApproval/failed
@MainActor
public final class ExtensionManager: NSObject, ObservableObject, @unchecked Sendable {

    // MARK: - Types

    public enum ExtensionState: String, Sendable {
        case notInstalled
        case installing
        case needsApproval
        case installed
        case failed
        case unknown
    }

    // MARK: - Properties

    private let log = Logger(subsystem: "ai.keanu.mac", category: "extensions")

    @Published public private(set) var dnsProxyState: ExtensionState = .notInstalled
    @Published public private(set) var lastError: Error?

    // Use ObjectIdentifier since OSSystemExtensionRequest isn't Sendable
    private var pendingBundleIds: [ObjectIdentifier: String] = [:]

    // MARK: - Extension Bundle IDs

    public static let dnsProxyBundleId = "ai.keanu.dnsproxy"

    // MARK: - Public API

    /// Activates the DNS Proxy extension.
    public func activateDNSProxy() {
        log.info("Requesting DNS Proxy activation...")
        dnsProxyState = .installing
        lastError = nil

        let request = OSSystemExtensionRequest.activationRequest(
            forExtensionWithIdentifier: Self.dnsProxyBundleId,
            queue: .main
        )
        request.delegate = self
        pendingBundleIds[ObjectIdentifier(request)] = Self.dnsProxyBundleId
        OSSystemExtensionManager.shared.submitRequest(request)
    }

    /// Deactivates the DNS Proxy extension.
    public func deactivateDNSProxy() {
        log.info("Requesting DNS Proxy deactivation...")
        dnsProxyState = .installing
        lastError = nil

        let request = OSSystemExtensionRequest.deactivationRequest(
            forExtensionWithIdentifier: Self.dnsProxyBundleId,
            queue: .main
        )
        request.delegate = self
        pendingBundleIds[ObjectIdentifier(request)] = Self.dnsProxyBundleId
        OSSystemExtensionManager.shared.submitRequest(request)
    }

    /// Opens System Settings to the Extensions pane for manual approval.
    public func openSystemSettings() {
        log.info("Opening System Settings for extension approval...")
        // macOS 13+ uses System Settings, older versions use System Preferences
        if let url = URL(string: "x-apple.systempreferences:com.apple.ExtensionsPreferences") {
            NSWorkspace.shared.open(url)
        }
    }

    // MARK: - Internal

    private func updateState(for bundleId: String, to state: ExtensionState) {
        switch bundleId {
        case Self.dnsProxyBundleId:
            dnsProxyState = state
        default:
            log.warning("Unknown extension bundle ID: \(bundleId)")
        }
    }

    private func getBundleId(for request: OSSystemExtensionRequest) -> String? {
        pendingBundleIds[ObjectIdentifier(request)]
    }

    private func removeBundleId(for request: OSSystemExtensionRequest) -> String? {
        pendingBundleIds.removeValue(forKey: ObjectIdentifier(request))
    }
}

// MARK: - OSSystemExtensionRequestDelegate

extension ExtensionManager: OSSystemExtensionRequestDelegate {

    nonisolated public func request(
        _ request: OSSystemExtensionRequest,
        actionForReplacingExtension existing: OSSystemExtensionProperties,
        withExtension ext: OSSystemExtensionProperties
    ) -> OSSystemExtensionRequest.ReplacementAction {
        // This is called on main queue per OSSystemExtensionRequest docs
        return .replace
    }

    nonisolated public func requestNeedsUserApproval(_ request: OSSystemExtensionRequest) {
        // Get bundle ID on this thread while we have request
        let requestId = ObjectIdentifier(request)

        DispatchQueue.main.async {
            MainActor.assumeIsolated {
                guard let bundleId = self.pendingBundleIds[requestId] else { return }
                self.log.info("Extension \(bundleId) needs user approval")
                self.updateState(for: bundleId, to: .needsApproval)
                self.openSystemSettings()
            }
        }
    }

    nonisolated public func request(
        _ request: OSSystemExtensionRequest,
        didFinishWithResult result: OSSystemExtensionRequest.Result
    ) {
        let requestId = ObjectIdentifier(request)
        let resultValue = result

        DispatchQueue.main.async {
            MainActor.assumeIsolated {
                guard let bundleId = self.pendingBundleIds.removeValue(forKey: requestId) else { return }

                switch resultValue {
                case .completed:
                    self.log.info("Extension \(bundleId) activated successfully")
                    self.updateState(for: bundleId, to: .installed)

                case .willCompleteAfterReboot:
                    self.log.info("Extension \(bundleId) will complete after reboot")
                    self.updateState(for: bundleId, to: .installed)

                @unknown default:
                    self.log.warning("Extension \(bundleId) finished with unknown result")
                    self.updateState(for: bundleId, to: .unknown)
                }
            }
        }
    }

    nonisolated public func request(_ request: OSSystemExtensionRequest, didFailWithError error: Error) {
        let requestId = ObjectIdentifier(request)
        let errorMessage = error.localizedDescription

        DispatchQueue.main.async {
            MainActor.assumeIsolated {
                guard let bundleId = self.pendingBundleIds.removeValue(forKey: requestId) else { return }

                self.log.error("Extension \(bundleId) failed: \(errorMessage)")
                // Note: Can't capture error directly, it's not Sendable
                self.updateState(for: bundleId, to: .failed)
            }
        }
    }
}
