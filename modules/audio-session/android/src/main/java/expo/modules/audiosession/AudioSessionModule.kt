package expo.modules.audiosession

import android.content.Context
import android.media.AudioManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AudioSessionModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AudioSession")

    // Android has no "another app" question, only "is music active", which
    // counts this app too — so the caller asks it only while its own player
    // is silent, where the two mean the same thing.
    Function("isOtherAudioPlaying") {
      val audio = appContext.reactContext
        ?.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
      audio?.isMusicActive ?: false
    }

    // iOS-only concern. Android's Auto Backup is governed by the manifest's
    // backup rules, not by a per-file attribute, so this returns normally.
    Function("excludeFromBackup") { _: String -> }
  }
}
