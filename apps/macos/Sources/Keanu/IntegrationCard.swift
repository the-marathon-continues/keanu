import SwiftUI

/// A card component for displaying integration status at a glance.
/// Used in the channels settings grid view.
struct IntegrationCard: View {
    let title: String
    let icon: String
    let status: IntegrationStatus
    let isSelected: Bool
    let onTap: () -> Void
    var onSetup: (() -> Void)?

    enum IntegrationStatus: Equatable {
        case connected(detail: String?)
        case running(detail: String?)
        case configured(detail: String?)
        case error(message: String?)
        case notConfigured

        var color: Color {
            switch self {
            case .connected: .green
            case .running: .orange
            case .configured: .blue
            case .error: .red
            case .notConfigured: .secondary
            }
        }

        var label: String {
            switch self {
            case .connected: "Connected"
            case .running: "Running"
            case .configured: "Configured"
            case .error: "Error"
            case .notConfigured: "Not Set Up"
            }
        }

        var detail: String? {
            switch self {
            case .connected(let d), .running(let d), .configured(let d), .error(let d):
                return d
            case .notConfigured:
                return nil
            }
        }

        var isActive: Bool {
            switch self {
            case .connected, .running, .configured:
                return true
            case .error, .notConfigured:
                return false
            }
        }
    }

    var body: some View {
        Button(action: self.onTap) {
            VStack(alignment: .leading, spacing: 0) {
                // Header with icon and status indicator
                HStack(alignment: .top, spacing: 10) {
                    self.iconView
                    Spacer()
                    self.statusIndicator
                }
                .padding(.bottom, 12)

                // Title
                Text(self.title)
                    .font(.headline)
                    .foregroundStyle(.primary)
                    .lineLimit(1)

                // Status badge
                self.statusBadge
                    .padding(.top, 6)

                // Detail text or Set Up button
                if let detail = self.status.detail {
                    Text(detail)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                        .padding(.top, 4)
                } else if case .notConfigured = self.status, let onSetup = self.onSetup {
                    Button {
                        onSetup()
                    } label: {
                        Text("Set Up")
                            .font(.caption.weight(.medium))
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)
                    .padding(.top, 8)
                }

                Spacer(minLength: 0)
            }
            .padding(16)
            .frame(maxWidth: .infinity, minHeight: 140, alignment: .topLeading)
            .background(self.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(
                        self.isSelected ? Color.accentColor : Color.clear,
                        lineWidth: 2
                    )
            )
            .shadow(
                color: self.status.isActive ? self.status.color.opacity(0.15) : .clear,
                radius: 8, x: 0, y: 4
            )
        }
        .buttonStyle(.plain)
    }

    private var iconView: some View {
        Image(systemName: self.icon)
            .font(.system(size: 24, weight: .medium))
            .foregroundStyle(self.status.isActive ? self.status.color : .secondary)
            .frame(width: 40, height: 40)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(self.status.color.opacity(self.status.isActive ? 0.12 : 0.06))
            )
    }

    private var statusIndicator: some View {
        Circle()
            .fill(self.status.color)
            .frame(width: 10, height: 10)
            .overlay(
                Circle()
                    .stroke(Color.white.opacity(0.3), lineWidth: 1)
            )
    }

    private var statusBadge: some View {
        Text(self.status.label)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(
                Capsule()
                    .fill(self.status.color.opacity(0.12))
            )
            .foregroundStyle(self.status.color)
    }

    private var cardBackground: some View {
        Group {
            if self.status.isActive {
                LinearGradient(
                    colors: [
                        Color(nsColor: .controlBackgroundColor),
                        self.status.color.opacity(0.03),
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            } else {
                Color(nsColor: .controlBackgroundColor)
            }
        }
    }
}

#Preview("Integration Cards") {
    HStack(spacing: 16) {
        IntegrationCard(
            title: "Telegram",
            icon: "paperplane.fill",
            status: .connected(detail: "@mybot · 3 chats"),
            isSelected: true,
            onTap: {}
        )
        IntegrationCard(
            title: "Discord",
            icon: "bubble.left.and.bubble.right.fill",
            status: .running(detail: "Connecting..."),
            isSelected: false,
            onTap: {}
        )
        IntegrationCard(
            title: "WhatsApp",
            icon: "phone.fill",
            status: .error(message: "Auth expired"),
            isSelected: false,
            onTap: {}
        )
        IntegrationCard(
            title: "Signal",
            icon: "lock.shield.fill",
            status: .notConfigured,
            isSelected: false,
            onTap: {},
            onSetup: { print("Set up Signal") }
        )
    }
    .padding()
    .frame(width: 800)
}
