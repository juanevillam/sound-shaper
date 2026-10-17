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

    // Keep a directory (and so everything in it) out of iCloud and Finder
    // backups. For RE-DOWNLOADABLE content kept in Documents, which Apple's
    // data-storage guidance asks to be excluded. Takes a `file://` URI or a
    // plain path; throws if the attribute could not be set.
    Function("excludeFromBackup") { (path: String) throws in
      var url = path.hasPrefix("file://")
        ? (URL(string: path) ?? URL(fileURLWithPath: path))
        : URL(fileURLWithPath: path)
      var values = URLResourceValues()
      values.isExcludedFromBackup = true
      try url.setResourceValues(values)
    }
  }
}
