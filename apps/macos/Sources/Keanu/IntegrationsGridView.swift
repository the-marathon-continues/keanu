import SwiftUI

/// A grid view for displaying all integrations as cards.
/// Provides a visual overview before drilling into details.
struct IntegrationsGridView: View {
    @Bindable var store: ChannelsStore
    @Binding var selectedChannel: ChannelsSettings.ChannelItem?
    @Binding var showDetail: Bool
    @Binding var showSetupWizard: Bool
    @Binding var setupWizardChannelId: String?

    private let columns = [
        GridItem(.adaptive(minimum: 180, maximum: 240), spacing: 16),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                self.header
                self.activeSection
                self.availableSection
            }
            .padding(24)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(nsColor: .windowBackgroundColor))
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Integrations")
                    .font(.largeTitle.weight(.bold))
                Spacer()
                Button {
                    Task { await self.store.refresh(probe: true) }
                } label: {
                    if self.store.isRefreshing {
                        ProgressView().controlSize(.small)
                    } else {
                        Label("Refresh", systemImage: "arrow.clockwise")
                    }
                }
                .buttonStyle(.bordered)
                .controlSize(.regular)
                .disabled(self.store.isRefreshing)
            }

            Text("Connect your messaging platforms to Keanu")
                .font(.body)
                .foregroundStyle(.secondary)
        }
    }

    @ViewBuilder
    private var activeSection: some View {
        let active = self.activeChannels
        if !active.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                self.sectionHeader("Active", count: active.count)
                LazyVGrid(columns: self.columns, spacing: 16) {
                    ForEach(active) { channel in
                        self.cardForChannel(channel)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var availableSection: some View {
        let available = self.availableChannels
        if !available.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                self.sectionHeader("Available", count: available.count)
                LazyVGrid(columns: self.columns, spacing: 16) {
                    ForEach(available) { channel in
                        self.cardForChannel(channel)
                    }
                }
            }
        }
    }

    private func sectionHeader(_ title: String, count: Int) -> some View {
        HStack(spacing: 8) {
            Text(title)
                .font(.title3.weight(.semibold))
            Text("\(count)")
                .font(.caption.weight(.medium))
                .padding(.horizontal, 8)
                .padding(.vertical, 2)
                .background(Capsule().fill(Color.secondary.opacity(0.15)))
                .foregroundStyle(.secondary)
        }
    }

    private func cardForChannel(_ channel: ChannelsSettings.ChannelItem) -> some View {
        IntegrationCard(
            title: channel.title,
            icon: channel.systemImage,
            status: self.statusFor(channel),
            isSelected: self.selectedChannel == channel,
            onTap: {
                self.selectedChannel = channel
                self.showDetail = true
            },
            onSetup: {
                self.setupWizardChannelId = channel.id
                self.showSetupWizard = true
            }
        )
    }

    private func statusFor(_ channel: ChannelsSettings.ChannelItem) -> IntegrationCard.IntegrationStatus {
        guard let snapshot = self.store.snapshot else {
            return .notConfigured
        }

        // Check for errors first
        if let channels = snapshot.channels[channel.id]?.dictionaryValue {
            if let err = channels["lastError"]?.stringValue, !err.isEmpty {
                return .error(message: err.prefix(50).description)
            }
        }

        // Check connection/running state
        let detail = self.detailFor(channel)

        if let channels = snapshot.channels[channel.id]?.dictionaryValue {
            if channels["connected"]?.boolValue == true {
                return .connected(detail: detail)
            }
            if channels["running"]?.boolValue == true {
                return .running(detail: detail)
            }
            if channels["configured"]?.boolValue == true {
                return .configured(detail: detail)
            }
        }

        // Check account-based channels
        if let accounts = snapshot.channelAccounts[channel.id],
           accounts.contains(where: { $0.configured == true || $0.running == true })
        {
            return .configured(detail: detail)
        }

        return .notConfigured
    }

    private func detailFor(_ channel: ChannelsSettings.ChannelItem) -> String? {
        guard let snapshot = self.store.snapshot,
              let channels = snapshot.channels[channel.id]?.dictionaryValue
        else {
            return nil
        }

        // Try to extract meaningful detail based on channel type
        switch channel.id {
        case "telegram":
            if let probe = channels["probe"]?.dictionaryValue,
               let bot = probe["bot"]?.dictionaryValue,
               let username = bot["username"]?.stringValue
            {
                return "@\(username)"
            }
        case "discord":
            if let probe = channels["probe"]?.dictionaryValue,
               let bot = probe["bot"]?.dictionaryValue,
               let username = bot["username"]?.stringValue
            {
                return "@\(username)"
            }
        case "whatsapp":
            if let selfInfo = channels["self"]?.dictionaryValue,
               let e164 = selfInfo["e164"]?.stringValue ?? selfInfo["jid"]?.stringValue
            {
                return e164
            }
        default:
            break
        }

        return nil
    }

    private var activeChannels: [ChannelsSettings.ChannelItem] {
        self.orderedChannels.filter { self.isActive($0) }
    }

    private var availableChannels: [ChannelsSettings.ChannelItem] {
        self.orderedChannels.filter { !self.isActive($0) }
    }

    private var orderedChannels: [ChannelsSettings.ChannelItem] {
        let fallback = ["whatsapp", "telegram", "discord", "googlechat", "slack", "signal", "imessage"]
        let order = self.store.snapshot?.channelOrder ?? fallback
        return order.enumerated().map { index, id in
            ChannelsSettings.ChannelItem(
                id: id,
                title: self.store.resolveChannelLabel(id),
                detailTitle: self.store.resolveChannelDetailLabel(id),
                systemImage: self.store.resolveChannelSystemImage(id),
                sortOrder: index
            )
        }
    }

    private func isActive(_ channel: ChannelsSettings.ChannelItem) -> Bool {
        guard let snapshot = self.store.snapshot else { return false }

        if let channels = snapshot.channels[channel.id]?.dictionaryValue {
            let configured = channels["configured"]?.boolValue ?? false
            let running = channels["running"]?.boolValue ?? false
            let connected = channels["connected"]?.boolValue ?? false
            if configured || running || connected { return true }
        }

        if let accounts = snapshot.channelAccounts[channel.id] {
            return accounts.contains { $0.configured == true || $0.running == true || $0.connected == true }
        }

        return false
    }
}
