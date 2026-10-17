import AVFoundation
import ExpoModulesCore

public class AudioSessionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AudioSession")

    // True while another app's audio is playing. Read before this app takes
    // the non-mixing playback session, which would stop that audio for good.
    Function("isOtherAudioPlaying") { () -> Bool in
      AVAudioSession.sharedInstance().isOtherAudioPlaying
    }
  }
}
