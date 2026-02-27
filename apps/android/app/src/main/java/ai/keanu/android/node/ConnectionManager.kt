package ai.keanu.android.node

import android.os.Build
import ai.keanu.android.BuildConfig
import ai.keanu.android.SecurePrefs
import ai.keanu.android.gateway.GatewayClientInfo
import ai.keanu.android.gateway.GatewayConnectOptions
import ai.keanu.android.gateway.GatewayEndpoint
import ai.keanu.android.gateway.GatewayTlsParams
import ai.keanu.android.protocol.KeanuCanvasA2UICommand
import ai.keanu.android.protocol.KeanuCanvasCommand
import ai.keanu.android.protocol.KeanuCameraCommand
import ai.keanu.android.protocol.KeanuLocationCommand
import ai.keanu.android.protocol.KeanuScreenCommand
import ai.keanu.android.protocol.KeanuSmsCommand
import ai.keanu.android.protocol.KeanuCapability
import ai.keanu.android.LocationMode
import ai.keanu.android.VoiceWakeMode

class ConnectionManager(
  private val prefs: SecurePrefs,
  private val cameraEnabled: () -> Boolean,
  private val locationMode: () -> LocationMode,
  private val voiceWakeMode: () -> VoiceWakeMode,
  private val smsAvailable: () -> Boolean,
  private val hasRecordAudioPermission: () -> Boolean,
  private val manualTls: () -> Boolean,
) {
  companion object {
    internal fun resolveTlsParamsForEndpoint(
      endpoint: GatewayEndpoint,
      storedFingerprint: String?,
      manualTlsEnabled: Boolean,
    ): GatewayTlsParams? {
      val stableId = endpoint.stableId
      val stored = storedFingerprint?.trim().takeIf { !it.isNullOrEmpty() }
      val isManual = stableId.startsWith("manual|")

      if (isManual) {
        if (!manualTlsEnabled) return null
        if (!stored.isNullOrBlank()) {
          return GatewayTlsParams(
            required = true,
            expectedFingerprint = stored,
            allowTOFU = false,
            stableId = stableId,
          )
        }
        return GatewayTlsParams(
          required = true,
          expectedFingerprint = null,
          allowTOFU = false,
          stableId = stableId,
        )
      }

      // Prefer stored pins. Never let discovery-provided TXT override a stored fingerprint.
      if (!stored.isNullOrBlank()) {
        return GatewayTlsParams(
          required = true,
          expectedFingerprint = stored,
          allowTOFU = false,
          stableId = stableId,
        )
      }

      val hinted = endpoint.tlsEnabled || !endpoint.tlsFingerprintSha256.isNullOrBlank()
      if (hinted) {
        // TXT is unauthenticated. Do not treat the advertised fingerprint as authoritative.
        return GatewayTlsParams(
          required = true,
          expectedFingerprint = null,
          allowTOFU = false,
          stableId = stableId,
        )
      }

      return null
    }
  }

  fun buildInvokeCommands(): List<String> =
    buildList {
      add(KeanuCanvasCommand.Present.rawValue)
      add(KeanuCanvasCommand.Hide.rawValue)
      add(KeanuCanvasCommand.Navigate.rawValue)
      add(KeanuCanvasCommand.Eval.rawValue)
      add(KeanuCanvasCommand.Snapshot.rawValue)
      add(KeanuCanvasA2UICommand.Push.rawValue)
      add(KeanuCanvasA2UICommand.PushJSONL.rawValue)
      add(KeanuCanvasA2UICommand.Reset.rawValue)
      add(KeanuScreenCommand.Record.rawValue)
      if (cameraEnabled()) {
        add(KeanuCameraCommand.Snap.rawValue)
        add(KeanuCameraCommand.Clip.rawValue)
      }
      if (locationMode() != LocationMode.Off) {
        add(KeanuLocationCommand.Get.rawValue)
      }
      if (smsAvailable()) {
        add(KeanuSmsCommand.Send.rawValue)
      }
      if (BuildConfig.DEBUG) {
        add("debug.logs")
        add("debug.ed25519")
      }
      add("app.update")
    }

  fun buildCapabilities(): List<String> =
    buildList {
      add(KeanuCapability.Canvas.rawValue)
      add(KeanuCapability.Screen.rawValue)
      if (cameraEnabled()) add(KeanuCapability.Camera.rawValue)
      if (smsAvailable()) add(KeanuCapability.Sms.rawValue)
      if (voiceWakeMode() != VoiceWakeMode.Off && hasRecordAudioPermission()) {
        add(KeanuCapability.VoiceWake.rawValue)
      }
      if (locationMode() != LocationMode.Off) {
        add(KeanuCapability.Location.rawValue)
      }
    }

  fun resolvedVersionName(): String {
    val versionName = BuildConfig.VERSION_NAME.trim().ifEmpty { "dev" }
    return if (BuildConfig.DEBUG && !versionName.contains("dev", ignoreCase = true)) {
      "$versionName-dev"
    } else {
      versionName
    }
  }

  fun resolveModelIdentifier(): String? {
    return listOfNotNull(Build.MANUFACTURER, Build.MODEL)
      .joinToString(" ")
      .trim()
      .ifEmpty { null }
  }

  fun buildUserAgent(): String {
    val version = resolvedVersionName()
    val release = Build.VERSION.RELEASE?.trim().orEmpty()
    val releaseLabel = if (release.isEmpty()) "unknown" else release
    return "KeanuAndroid/$version (Android $releaseLabel; SDK ${Build.VERSION.SDK_INT})"
  }

  fun buildClientInfo(clientId: String, clientMode: String): GatewayClientInfo {
    return GatewayClientInfo(
      id = clientId,
      displayName = prefs.displayName.value,
      version = resolvedVersionName(),
      platform = "android",
      mode = clientMode,
      instanceId = prefs.instanceId.value,
      deviceFamily = "Android",
      modelIdentifier = resolveModelIdentifier(),
    )
  }

  fun buildNodeConnectOptions(): GatewayConnectOptions {
    return GatewayConnectOptions(
      role = "node",
      scopes = emptyList(),
      caps = buildCapabilities(),
      commands = buildInvokeCommands(),
      permissions = emptyMap(),
      client = buildClientInfo(clientId = "keanu-android", clientMode = "node"),
      userAgent = buildUserAgent(),
    )
  }

  fun buildOperatorConnectOptions(): GatewayConnectOptions {
    return GatewayConnectOptions(
      role = "operator",
      scopes = listOf("operator.read", "operator.write", "operator.talk.secrets"),
      caps = emptyList(),
      commands = emptyList(),
      permissions = emptyMap(),
      client = buildClientInfo(clientId = "keanu-android", clientMode = "ui"),
      userAgent = buildUserAgent(),
    )
  }

  fun resolveTlsParams(endpoint: GatewayEndpoint): GatewayTlsParams? {
    val stored = prefs.loadGatewayTlsFingerprint(endpoint.stableId)
    return resolveTlsParamsForEndpoint(endpoint, storedFingerprint = stored, manualTlsEnabled = manualTls())
  }
}
