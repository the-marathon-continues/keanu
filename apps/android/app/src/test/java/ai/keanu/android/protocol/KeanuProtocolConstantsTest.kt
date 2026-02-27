package ai.keanu.android.protocol

import org.junit.Assert.assertEquals
import org.junit.Test

class KeanuProtocolConstantsTest {
  @Test
  fun canvasCommandsUseStableStrings() {
    assertEquals("canvas.present", KeanuCanvasCommand.Present.rawValue)
    assertEquals("canvas.hide", KeanuCanvasCommand.Hide.rawValue)
    assertEquals("canvas.navigate", KeanuCanvasCommand.Navigate.rawValue)
    assertEquals("canvas.eval", KeanuCanvasCommand.Eval.rawValue)
    assertEquals("canvas.snapshot", KeanuCanvasCommand.Snapshot.rawValue)
  }

  @Test
  fun a2uiCommandsUseStableStrings() {
    assertEquals("canvas.a2ui.push", KeanuCanvasA2UICommand.Push.rawValue)
    assertEquals("canvas.a2ui.pushJSONL", KeanuCanvasA2UICommand.PushJSONL.rawValue)
    assertEquals("canvas.a2ui.reset", KeanuCanvasA2UICommand.Reset.rawValue)
  }

  @Test
  fun capabilitiesUseStableStrings() {
    assertEquals("canvas", KeanuCapability.Canvas.rawValue)
    assertEquals("camera", KeanuCapability.Camera.rawValue)
    assertEquals("screen", KeanuCapability.Screen.rawValue)
    assertEquals("voiceWake", KeanuCapability.VoiceWake.rawValue)
  }

  @Test
  fun screenCommandsUseStableStrings() {
    assertEquals("screen.record", KeanuScreenCommand.Record.rawValue)
  }
}
