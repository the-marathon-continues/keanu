import AppKit
import SwiftUI

/// Controls for configuring OpenRouter API key.
@MainActor
struct OpenRouterAuthControls: View {
    @State private var apiKey: String = ""
    @State private var hasKey: Bool = false
    @State private var isSaving: Bool = false
    @State private var statusText: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                Circle()
                    .fill(self.hasKey ? Color.green : Color.orange)
                    .frame(width: 8, height: 8)
                Text(self.hasKey ? "API key configured" : "Not configured")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.secondary)
                Spacer()
                if self.hasKey {
                    Button("Reveal") {
                        self.revealKey()
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                }
            }

            Text("OpenRouter provides access to many AI models (Claude, GPT-4, Llama, etc.) through a single API.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            SecureField("sk-or-v1-...", text: self.$apiKey)
                .textFieldStyle(.roundedBorder)
                .disabled(self.isSaving)

            HStack(spacing: 12) {
                Button {
                    self.saveKey()
                } label: {
                    if self.isSaving {
                        ProgressView().controlSize(.small)
                    } else {
                        Text("Save")
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(self.apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || self.isSaving)

                if self.hasKey {
                    Button("Clear") {
                        self.clearKey()
                    }
                    .buttonStyle(.bordered)
                    .disabled(self.isSaving)
                }

                Spacer()

                Link(destination: URL(string: "https://openrouter.ai/keys")!) {
                    HStack(spacing: 4) {
                        Text("Get API key")
                        Image(systemName: "arrow.up.right.square")
                    }
                }
                .font(.callout)
            }

            if let status = self.statusText {
                Text(status)
                    .font(.caption)
                    .foregroundStyle(status.contains("Error") ? .red : .secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .onAppear {
            self.checkKey()
        }
    }

    private func checkKey() {
        self.hasKey = KeychainHelper.exists(key: KeychainHelper.openRouterAPIKey)
    }

    private func saveKey() {
        let trimmed = self.apiKey.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        self.isSaving = true
        defer { self.isSaving = false }

        do {
            try KeychainHelper.save(key: KeychainHelper.openRouterAPIKey, value: trimmed)
            self.hasKey = true
            self.apiKey = ""
            self.statusText = "API key saved. Restart the gateway to apply."

            // Notify gateway to restart with new credentials
            NotificationCenter.default.post(name: .keanuAPIKeyChanged, object: nil)
        } catch {
            self.statusText = "Error: \(error.localizedDescription)"
        }
    }

    private func clearKey() {
        do {
            try KeychainHelper.delete(key: KeychainHelper.openRouterAPIKey)
            self.hasKey = false
            self.apiKey = ""
            self.statusText = "API key cleared."

            NotificationCenter.default.post(name: .keanuAPIKeyChanged, object: nil)
        } catch {
            self.statusText = "Error: \(error.localizedDescription)"
        }
    }

    private func revealKey() {
        guard let key = KeychainHelper.read(key: KeychainHelper.openRouterAPIKey) else {
            self.statusText = "Could not read key from Keychain."
            return
        }

        // Show masked preview
        let preview = Self.maskAPIKey(key)
        self.statusText = "Current key: \(preview)"
    }

    private static func maskAPIKey(_ key: String) -> String {
        guard key.count > 12 else { return String(repeating: "*", count: key.count) }
        let prefix = String(key.prefix(8))
        let suffix = String(key.suffix(4))
        return "\(prefix)...\(suffix)"
    }
}

extension Notification.Name {
    static let keanuAPIKeyChanged = Notification.Name("keanuAPIKeyChanged")
}

#if DEBUG
struct OpenRouterAuthControls_Previews: PreviewProvider {
    static var previews: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("OpenRouter")
                .font(.title3.weight(.semibold))
            OpenRouterAuthControls()
        }
        .padding()
        .frame(width: 500)
    }
}
#endif
