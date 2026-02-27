import SwiftUI

/// A guided setup wizard for configuring integrations.
/// Each integration has specific steps with helpful instructions and links.
struct IntegrationSetupWizard: View {
    @Bindable var store: ChannelsStore
    let channelId: String
    @Binding var isPresented: Bool

    @State private var currentStep: Int = 0
    @State private var tokenValue: String = ""
    @State private var secondaryValue: String = ""
    @State private var isValidating: Bool = false
    @State private var validationError: String?
    @State private var setupComplete: Bool = false

    var body: some View {
        VStack(spacing: 0) {
            // Header
            self.header
            Divider()

            // Content
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    if self.setupComplete {
                        self.successView
                    } else {
                        self.wizardContent
                    }
                }
                .padding(24)
            }

            Divider()
            // Footer
            self.footer
        }
        .frame(width: 500, height: 480)
        .background(Color(nsColor: .windowBackgroundColor))
    }

    private var header: some View {
        HStack {
            Image(systemName: self.iconFor(self.channelId))
                .font(.title2)
                .foregroundStyle(Color.accentColor)
            Text("Set Up \(self.titleFor(self.channelId))")
                .font(.title2.weight(.semibold))
            Spacer()
            Button {
                self.isPresented = false
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.title2)
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
        }
        .padding(20)
    }

    @ViewBuilder
    private var wizardContent: some View {
        switch self.channelId {
        case "telegram":
            self.telegramWizard
        case "discord":
            self.discordWizard
        case "slack":
            self.slackWizard
        case "signal":
            self.signalWizard
        case "googlechat":
            self.googleChatWizard
        case "imessage":
            self.iMessageWizard
        default:
            self.genericWizard
        }
    }

    private var footer: some View {
        HStack {
            if self.currentStep > 0, !self.setupComplete {
                Button("Back") {
                    self.currentStep -= 1
                }
                .buttonStyle(.bordered)
            }

            Spacer()

            if self.setupComplete {
                Button("Done") {
                    self.isPresented = false
                }
                .buttonStyle(.borderedProminent)
            } else if self.isLastStep {
                Button {
                    self.saveConfiguration()
                } label: {
                    if self.isValidating {
                        ProgressView().controlSize(.small)
                    } else {
                        Text("Save & Connect")
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(self.isValidating || !self.canProceed)
            } else {
                Button("Next") {
                    self.currentStep += 1
                }
                .buttonStyle(.borderedProminent)
                .disabled(!self.canProceed)
            }
        }
        .padding(20)
    }

    private var successView: some View {
        VStack(spacing: 20) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 64))
                .foregroundStyle(.green)

            Text("\(self.titleFor(self.channelId)) Connected!")
                .font(.title2.weight(.semibold))

            Text("Your integration is now configured. Messages will start flowing shortly.")
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(40)
    }

    // MARK: - Telegram Wizard

    private var telegramWizard: some View {
        VStack(alignment: .leading, spacing: 16) {
            self.stepIndicator(current: self.currentStep, total: 2)

            if self.currentStep == 0 {
                self.wizardStep(
                    title: "Create a Telegram Bot",
                    instructions: """
                    1. Open Telegram and search for **@BotFather**
                    2. Send `/newbot` to create a new bot
                    3. Follow the prompts to name your bot
                    4. Copy the **API token** BotFather gives you
                    """,
                    link: ("Open BotFather", "https://t.me/BotFather")
                )
            } else {
                self.wizardStep(
                    title: "Enter Your Bot Token",
                    instructions: "Paste the API token from BotFather below. It looks like `123456789:ABCdefGHI...`"
                )

                SecureField("Bot Token", text: self.$tokenValue)
                    .textFieldStyle(.roundedBorder)
                    .font(.body.monospaced())

                if let error = self.validationError {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.red)
                }
            }
        }
    }

    // MARK: - Discord Wizard

    private var discordWizard: some View {
        VStack(alignment: .leading, spacing: 16) {
            self.stepIndicator(current: self.currentStep, total: 2)

            if self.currentStep == 0 {
                self.wizardStep(
                    title: "Create a Discord Application",
                    instructions: """
                    1. Go to the **Discord Developer Portal**
                    2. Click **New Application** and name it
                    3. Go to the **Bot** section
                    4. Click **Add Bot**
                    5. Under Token, click **Copy**
                    """,
                    link: ("Open Developer Portal", "https://discord.com/developers/applications")
                )
            } else {
                self.wizardStep(
                    title: "Enter Your Bot Token",
                    instructions: "Paste your Discord bot token below."
                )

                SecureField("Bot Token", text: self.$tokenValue)
                    .textFieldStyle(.roundedBorder)
                    .font(.body.monospaced())

                if let error = self.validationError {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.red)
                }

                Divider().padding(.vertical, 8)

                Text("Don't forget to invite your bot!")
                    .font(.callout.weight(.medium))

                Text("Go to OAuth2 → URL Generator, select `bot` scope, then use the generated URL to add the bot to your server.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - Slack Wizard

    private var slackWizard: some View {
        VStack(alignment: .leading, spacing: 16) {
            self.stepIndicator(current: self.currentStep, total: 3)

            if self.currentStep == 0 {
                self.wizardStep(
                    title: "Create a Slack App",
                    instructions: """
                    1. Go to the **Slack API** website
                    2. Click **Create New App**
                    3. Choose **From scratch**
                    4. Name your app and select a workspace
                    """,
                    link: ("Open Slack API", "https://api.slack.com/apps")
                )
            } else if self.currentStep == 1 {
                self.wizardStep(
                    title: "Configure Permissions",
                    instructions: """
                    1. Go to **OAuth & Permissions**
                    2. Add these **Bot Token Scopes**:
                       • `chat:write`
                       • `channels:history`
                       • `channels:read`
                       • `users:read`
                    3. Click **Install to Workspace**
                    4. Copy the **Bot User OAuth Token**
                    """
                )
            } else {
                self.wizardStep(
                    title: "Enter Credentials",
                    instructions: "Enter your Slack app credentials."
                )

                VStack(alignment: .leading, spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Bot Token").font(.caption.weight(.medium))
                        SecureField("xoxb-...", text: self.$tokenValue)
                            .textFieldStyle(.roundedBorder)
                            .font(.body.monospaced())
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Signing Secret").font(.caption.weight(.medium))
                        SecureField("From Basic Information page", text: self.$secondaryValue)
                            .textFieldStyle(.roundedBorder)
                            .font(.body.monospaced())
                    }
                }

                if let error = self.validationError {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.red)
                }
            }
        }
    }

    // MARK: - Signal Wizard

    private var signalWizard: some View {
        VStack(alignment: .leading, spacing: 16) {
            self.stepIndicator(current: self.currentStep, total: 2)

            if self.currentStep == 0 {
                self.wizardStep(
                    title: "Set Up signal-cli-rest-api",
                    instructions: """
                    Signal integration requires **signal-cli-rest-api** running locally or on a server.

                    **Option 1: Docker (Recommended)**
                    ```
                    docker run -d --name signal-api \\
                      -p 8080:8080 \\
                      -v signal-cli-config:/home/.local/share/signal-cli \\
                      bbernhard/signal-cli-rest-api
                    ```

                    **Option 2: Manual Installation**
                    See the signal-cli-rest-api documentation.
                    """,
                    link: ("View Documentation", "https://github.com/bbernhard/signal-cli-rest-api")
                )
            } else {
                self.wizardStep(
                    title: "Enter API URL",
                    instructions: "Enter the URL where signal-cli-rest-api is running."
                )

                TextField("http://localhost:8080", text: self.$tokenValue)
                    .textFieldStyle(.roundedBorder)
                    .font(.body.monospaced())

                if let error = self.validationError {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.red)
                }

                Text("After connecting, you'll need to register or link a phone number through the Signal API.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - Google Chat Wizard

    private var googleChatWizard: some View {
        VStack(alignment: .leading, spacing: 16) {
            self.stepIndicator(current: self.currentStep, total: 2)

            if self.currentStep == 0 {
                self.wizardStep(
                    title: "Create a Google Cloud Project",
                    instructions: """
                    1. Go to the **Google Cloud Console**
                    2. Create a new project or select existing
                    3. Enable the **Google Chat API**
                    4. Go to **APIs & Services → Credentials**
                    5. Create a **Service Account**
                    6. Download the JSON key file
                    """,
                    link: ("Open Cloud Console", "https://console.cloud.google.com")
                )
            } else {
                self.wizardStep(
                    title: "Service Account Credentials",
                    instructions: "Paste the contents of your service account JSON key file, or provide the file path."
                )

                TextField("Path to credentials.json or paste JSON", text: self.$tokenValue, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .lineLimit(4...8)
                    .font(.body.monospaced())

                if let error = self.validationError {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.red)
                }
            }
        }
    }

    // MARK: - iMessage Wizard

    private var iMessageWizard: some View {
        VStack(alignment: .leading, spacing: 16) {
            self.stepIndicator(current: self.currentStep, total: 2)

            if self.currentStep == 0 {
                self.wizardStep(
                    title: "Set Up BlueBubbles",
                    instructions: """
                    iMessage integration requires **BlueBubbles** server running on a Mac.

                    1. Download BlueBubbles Server
                    2. Install and run it on your Mac
                    3. Complete the setup wizard in BlueBubbles
                    4. Note the server URL and password
                    """,
                    link: ("Download BlueBubbles", "https://bluebubbles.app")
                )
            } else {
                self.wizardStep(
                    title: "Enter BlueBubbles Details",
                    instructions: "Enter your BlueBubbles server details."
                )

                VStack(alignment: .leading, spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Server URL").font(.caption.weight(.medium))
                        TextField("http://localhost:1234", text: self.$tokenValue)
                            .textFieldStyle(.roundedBorder)
                            .font(.body.monospaced())
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Password").font(.caption.weight(.medium))
                        SecureField("BlueBubbles password", text: self.$secondaryValue)
                            .textFieldStyle(.roundedBorder)
                    }
                }

                if let error = self.validationError {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.red)
                }
            }
        }
    }

    // MARK: - Generic Wizard

    private var genericWizard: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Configure \(self.titleFor(self.channelId))")
                .font(.title3.weight(.semibold))

            Text("Use the configuration form below to set up this integration.")
                .font(.body)
                .foregroundStyle(.secondary)

            Divider()

            ChannelConfigForm(store: self.store, channelId: self.channelId)
        }
    }

    // MARK: - Helpers

    private func stepIndicator(current: Int, total: Int) -> some View {
        HStack(spacing: 8) {
            ForEach(0..<total, id: \.self) { index in
                Circle()
                    .fill(index <= current ? Color.accentColor : Color.secondary.opacity(0.3))
                    .frame(width: 8, height: 8)
            }
            Spacer()
            Text("Step \(current + 1) of \(total)")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private func wizardStep(
        title: String,
        instructions: String,
        link: (String, String)? = nil
    ) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.title3.weight(.semibold))

            Text(LocalizedStringKey(instructions))
                .font(.body)
                .foregroundStyle(.secondary)
                .textSelection(.enabled)

            if let (linkTitle, linkURL) = link {
                Link(destination: URL(string: linkURL)!) {
                    HStack(spacing: 4) {
                        Text(linkTitle)
                        Image(systemName: "arrow.up.right.square")
                    }
                }
                .font(.callout)
            }
        }
    }

    private var isLastStep: Bool {
        switch self.channelId {
        case "telegram", "discord", "signal", "googlechat", "imessage":
            return self.currentStep == 1
        case "slack":
            return self.currentStep == 2
        default:
            return true
        }
    }

    private var canProceed: Bool {
        if self.isLastStep {
            return !self.tokenValue.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }
        return true
    }

    private func saveConfiguration() {
        self.isValidating = true
        self.validationError = nil

        let token = self.tokenValue.trimmingCharacters(in: .whitespacesAndNewlines)

        Task {
            do {
                // Update config based on channel type
                switch self.channelId {
                case "telegram":
                    self.store.updateConfigValue(
                        path: [.key("channels"), .key("telegram"), .key("token")],
                        value: token
                    )
                case "discord":
                    self.store.updateConfigValue(
                        path: [.key("channels"), .key("discord"), .key("token")],
                        value: token
                    )
                case "slack":
                    self.store.updateConfigValue(
                        path: [.key("channels"), .key("slack"), .key("botToken")],
                        value: token
                    )
                    if !self.secondaryValue.isEmpty {
                        self.store.updateConfigValue(
                            path: [.key("channels"), .key("slack"), .key("signingSecret")],
                            value: self.secondaryValue.trimmingCharacters(in: .whitespacesAndNewlines)
                        )
                    }
                case "signal":
                    self.store.updateConfigValue(
                        path: [.key("channels"), .key("signal"), .key("baseUrl")],
                        value: token
                    )
                case "googlechat":
                    self.store.updateConfigValue(
                        path: [.key("channels"), .key("googlechat"), .key("credentials")],
                        value: token
                    )
                case "imessage":
                    self.store.updateConfigValue(
                        path: [.key("channels"), .key("imessage"), .key("baseUrl")],
                        value: token
                    )
                    if !self.secondaryValue.isEmpty {
                        self.store.updateConfigValue(
                            path: [.key("channels"), .key("imessage"), .key("password")],
                            value: self.secondaryValue.trimmingCharacters(in: .whitespacesAndNewlines)
                        )
                    }
                default:
                    break
                }

                // Save the config
                await self.store.saveConfigDraft()

                // Refresh to check status
                await self.store.refresh(probe: true)

                await MainActor.run {
                    self.isValidating = false
                    self.setupComplete = true
                }
            } catch {
                await MainActor.run {
                    self.isValidating = false
                    self.validationError = "Failed to save: \(error.localizedDescription)"
                }
            }
        }
    }

    private func titleFor(_ channelId: String) -> String {
        switch channelId {
        case "telegram": return "Telegram"
        case "discord": return "Discord"
        case "slack": return "Slack"
        case "whatsapp": return "WhatsApp"
        case "signal": return "Signal"
        case "googlechat": return "Google Chat"
        case "imessage": return "iMessage"
        default: return channelId.capitalized
        }
    }

    private func iconFor(_ channelId: String) -> String {
        switch channelId {
        case "telegram": return "paperplane.fill"
        case "discord": return "bubble.left.and.bubble.right.fill"
        case "slack": return "number.square.fill"
        case "whatsapp": return "phone.fill"
        case "signal": return "lock.shield.fill"
        case "googlechat": return "message.fill"
        case "imessage": return "message.fill"
        default: return "bubble.left.fill"
        }
    }
}
