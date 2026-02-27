import Foundation

// Stable identifier used for both the macOS LaunchAgent label and Nix-managed defaults suite.
// nix-keanu writes app defaults into this suite to survive app bundle identifier churn.
let launchdLabel = "ai.keanu.mac"
let gatewayLaunchdLabel = "ai.keanu.gateway"
let onboardingVersionKey = "keanu.onboardingVersion"
let onboardingSeenKey = "keanu.onboardingSeen"
let currentOnboardingVersion = 7
let pauseDefaultsKey = "keanu.pauseEnabled"
let iconAnimationsEnabledKey = "keanu.iconAnimationsEnabled"
let swabbleEnabledKey = "keanu.swabbleEnabled"
let swabbleTriggersKey = "keanu.swabbleTriggers"
let voiceWakeTriggerChimeKey = "keanu.voiceWakeTriggerChime"
let voiceWakeSendChimeKey = "keanu.voiceWakeSendChime"
let showDockIconKey = "keanu.showDockIcon"
let defaultVoiceWakeTriggers = ["keanu"]
let voiceWakeMaxWords = 32
let voiceWakeMaxWordLength = 64
let voiceWakeMicKey = "keanu.voiceWakeMicID"
let voiceWakeMicNameKey = "keanu.voiceWakeMicName"
let voiceWakeLocaleKey = "keanu.voiceWakeLocaleID"
let voiceWakeAdditionalLocalesKey = "keanu.voiceWakeAdditionalLocaleIDs"
let voicePushToTalkEnabledKey = "keanu.voicePushToTalkEnabled"
let talkEnabledKey = "keanu.talkEnabled"
let iconOverrideKey = "keanu.iconOverride"
let connectionModeKey = "keanu.connectionMode"
let remoteTargetKey = "keanu.remoteTarget"
let remoteIdentityKey = "keanu.remoteIdentity"
let remoteProjectRootKey = "keanu.remoteProjectRoot"
let remoteCliPathKey = "keanu.remoteCliPath"
let canvasEnabledKey = "keanu.canvasEnabled"
let cameraEnabledKey = "keanu.cameraEnabled"
let systemRunPolicyKey = "keanu.systemRunPolicy"
let systemRunAllowlistKey = "keanu.systemRunAllowlist"
let systemRunEnabledKey = "keanu.systemRunEnabled"
let locationModeKey = "keanu.locationMode"
let locationPreciseKey = "keanu.locationPreciseEnabled"
let peekabooBridgeEnabledKey = "keanu.peekabooBridgeEnabled"
let deepLinkKeyKey = "keanu.deepLinkKey"
let modelCatalogPathKey = "keanu.modelCatalogPath"
let modelCatalogReloadKey = "keanu.modelCatalogReload"
let cliInstallPromptedVersionKey = "keanu.cliInstallPromptedVersion"
let heartbeatsEnabledKey = "keanu.heartbeatsEnabled"
let debugPaneEnabledKey = "keanu.debugPaneEnabled"
let debugFileLogEnabledKey = "keanu.debug.fileLogEnabled"
let appLogLevelKey = "keanu.debug.appLogLevel"
let voiceWakeSupported: Bool = ProcessInfo.processInfo.operatingSystemVersion.majorVersion >= 26
