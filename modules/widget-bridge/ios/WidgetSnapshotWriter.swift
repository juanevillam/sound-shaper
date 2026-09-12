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

      guard let url = URL(string: entry.url),
        let (data, _) = try? await URLSession.shared.data(from: url)
      else { continue }

      try? data.write(to: destination, options: .atomic)
    }

    prune(mediaRoot, keeping: referenced)

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
