import Foundation
import WidgetKit

enum WidgetBridgeError: Error, LocalizedError {
  case noContainer(String)

  var errorDescription: String? {
    switch self {
    case .noContainer(let appGroup):
      return
        "No App Group container for \(appGroup). The entitlement is missing from this build."
    }
  }
}

/// THE APP'S HALF OF AN iOS WIDGET: the shared container and the WidgetKit
/// reload. The widget owns nothing but drawing.
///
/// IT KNOWS NOTHING ABOUT WHAT IT IS PUBLISHING. The snapshot arrives as a JSON
/// STRING the caller already serialised, and is written through untouched — so
/// the wire format between an app and its widget stays entirely in that app's
/// own TypeScript and Swift, and this file never has to grow a case per app.
/// Media is likewise named by the caller, for the same reason: the widget has
/// to resolve a file name out of the snapshot it reads, and the only way both
/// sides can agree on one is for the side that writes the snapshot to choose it.
enum WidgetSnapshotWriter {
  static let snapshotFile = "snapshot.json"
  static let mediaDirectory = "media"

  static func containerURL(_ appGroup: String) throws -> URL {
    guard
      let url = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: appGroup)
    else {
      throw WidgetBridgeError.noContainer(appGroup)
    }

    return url
  }

  /// Publish a snapshot and the media it references, then reload every widget.
  ///
  /// Media is CONTENT-ADDRESSED by the caller — a file name derived from the
  /// asset's URL — so replacing an image writes a new file rather than racing a
  /// cached one, and an unchanged image is never downloaded twice. Anything no
  /// longer referenced is pruned in the same pass: the container is not the
  /// app's cache and nothing else ever cleans it.
  static func publish(appGroup: String, snapshot: String, media: [MediaRecord]) async throws {
    let root = try containerURL(appGroup)
    let mediaRoot = root.appendingPathComponent(mediaDirectory, isDirectory: true)

    try FileManager.default.createDirectory(at: mediaRoot, withIntermediateDirectories: true)

    var referenced = Set<String>()

    for entry in media where !entry.file.isEmpty && !entry.url.isEmpty {
      referenced.insert(entry.file)

      let destination = mediaRoot.appendingPathComponent(entry.file)

      if FileManager.default.fileExists(atPath: destination.path) { continue }

      // 2xx ONLY. `data(from:)` resolves for any HTTP status, so a 404 or an
      // error page was saved as the cover — and since the file is named after
      // the URL, the `fileExists` check above kept that broken tile forever.
      guard let url = URL(string: entry.url),
        let (data, response) = try? await URLSession.shared.data(from: url),
        let status = (response as? HTTPURLResponse)?.statusCode,
        (200..<300).contains(status)
      else { continue }

      try? data.write(to: destination, options: .atomic)
    }

    prune(mediaRoot, keeping: referenced)
    sweepContainerRoot(root)

    try Data(snapshot.utf8).write(
      to: root.appendingPathComponent(snapshotFile), options: .atomic)

    WidgetCenter.shared.reloadAllTimelines()
  }

  /// Sign-out and account deletion. A widget keeps drawing its last snapshot
  /// until something replaces it, so leaving one behind is a privacy bug rather
  /// than a stale cache.
  static func clear(appGroup: String) throws {
    let root = try containerURL(appGroup)

    try? FileManager.default.removeItem(at: root.appendingPathComponent(snapshotFile))
    try? FileManager.default.removeItem(
      at: root.appendingPathComponent(mediaDirectory, isDirectory: true))

    WidgetCenter.shared.reloadAllTimelines()
  }

  /// THE BRIDGE OWNS THIS CONTAINER, AND A FORMAT CHANGE MUST CLEAN UP AFTER
  /// ITSELF.
  ///
  /// An App Group container is created for exactly one purpose and nothing else
  /// ever cleans it, so a renamed snapshot or media directory would sit there
  /// forever — which is precisely what happened when the writer moved from
  /// Swift to TypeScript and `library.json` / `artwork/` were left behind
  /// (2026-09-11). Enforcing the invariant on every publish means the next
  /// rename sweeps itself instead of needing a migration nobody will write.
  ///
  /// IT IS A WHITELIST, NOT A WIPE, and that matters: iOS puts its OWN
  /// `Library/` in here — the app group's `UserDefaults` live in
  /// `Library/Preferences` — and the container's metadata is a dotfile.
  /// Deleting either would destroy data that is not ours. Only unhidden
  /// top-level entries that are neither of the two names this file writes are
  /// removed.
  private static func sweepContainerRoot(_ root: URL) {
    guard
      let entries = try? FileManager.default.contentsOfDirectory(
        at: root, includingPropertiesForKeys: nil, options: [.skipsHiddenFiles])
    else { return }

    let ours: Set<String> = [snapshotFile, mediaDirectory]
    // iOS's, not ours.
    let system: Set<String> = ["Library"]

    for entry in entries {
      let name = entry.lastPathComponent

      if ours.contains(name) || system.contains(name) { continue }

      try? FileManager.default.removeItem(at: entry)
    }
  }

  private static func prune(_ directory: URL, keeping referenced: Set<String>) {
    guard
      let existing = try? FileManager.default.contentsOfDirectory(
        at: directory, includingPropertiesForKeys: nil)
    else { return }

    for file in existing where !referenced.contains(file.lastPathComponent) {
      try? FileManager.default.removeItem(at: file)
    }
  }
}
