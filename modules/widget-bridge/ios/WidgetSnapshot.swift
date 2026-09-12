import CryptoKit
import Foundation
import WidgetKit

/// THE WIRE FORMAT BETWEEN TWO PROCESSES, AND IT IS WRITTEN TWICE ON PURPOSE.
///
/// The app and the widget are separate binaries in separate sandboxes; they
/// share a container, not a module, so neither can import the other's types.
/// The reader is `targets/widget/LibrarySnapshot.swift` and it declares the
/// same three shapes. **Change one and you must change the other** — nothing in
/// the toolchain will tell you, because a decode failure is silent by design
/// (the widget falls back to its empty state rather than crashing on a Home
/// Screen).
///
/// `version` is what makes that survivable: bump it on any incompatible change
/// and the reader drops a snapshot it does not understand instead of decoding
/// half of one.
enum SharedContainer {
  /// Must match `ios.entitlements` in `app.json` AND the widget target's own
  /// entitlements in `targets/widget/expo-target.config.js`. All three.
  static let appGroup = "group.com.juanevillam.soundshaper"
  static let snapshotFile = "library.json"
  static let artworkDirectory = "artwork"
}

struct SnapshotItem: Codable {
  let id: String
  let name: String
  /// File NAME inside `artwork/`, not a path — the container's URL differs
  /// between the two processes' views of it, so a stored absolute path would
  /// resolve in the writer and not in the reader.
  let artwork: String?
}

struct LibrarySnapshot: Codable {
  static let version = 1

  let version: Int
  /// Every user-facing word the widget draws. THE WIDGET OWNS NO COPY: it
  /// cannot reach `src/i18n/translations.ts` across the process boundary, so
  /// the app resolves the strings in the person's own language and ships them
  /// with the data. The widget's only hardcoded English is the fallback it
  /// draws before the app has ever run. See `useWidgetSync`.
  let strings: [String: String]
  let items: [SnapshotItem]
  let updatedAt: Double
}

enum WidgetSnapshotError: Error, LocalizedError {
  case noContainer

  var errorDescription: String? {
    switch self {
    case .noContainer:
      return
        "No App Group container for \(SharedContainer.appGroup). The entitlement is missing from this build."
    }
  }
}

enum WidgetSnapshotWriter {
  static func containerURL() throws -> URL {
    guard
      let url = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: SharedContainer.appGroup)
    else {
      throw WidgetSnapshotError.noContainer
    }

    return url
  }

  /// Publish the library. Artwork is CONTENT-ADDRESSED by the hash of its URL,
  /// so replacing a cover writes a new file rather than racing a cached one,
  /// and an unchanged cover is never re-downloaded. Anything no longer
  /// referenced is pruned in the same pass — the container is not the app's
  /// cache and nothing else ever cleans it.
  static func write(items: [LibraryItemRecord], strings: [String: String]) async throws {
    let root = try containerURL()
    let artworkDirectory = root.appendingPathComponent(
      SharedContainer.artworkDirectory, isDirectory: true)

    try FileManager.default.createDirectory(
      at: artworkDirectory, withIntermediateDirectories: true)

    var entries: [SnapshotItem] = []
    var referenced = Set<String>()

    for item in items {
      var artworkFile: String?

      if !item.artUrl.isEmpty, let url = URL(string: item.artUrl) {
        let fileName = "\(digest(of: item.artUrl)).img"
        let destination = artworkDirectory.appendingPathComponent(fileName)

        if !FileManager.default.fileExists(atPath: destination.path) {
          if let (data, _) = try? await URLSession.shared.data(from: url) {
            try? data.write(to: destination, options: .atomic)
          }
        }

        if FileManager.default.fileExists(atPath: destination.path) {
          artworkFile = fileName
          referenced.insert(fileName)
        }
      }

      entries.append(SnapshotItem(id: item.id, name: item.name, artwork: artworkFile))
    }

    prune(artworkDirectory, keeping: referenced)

    let snapshot = LibrarySnapshot(
      version: LibrarySnapshot.version,
      strings: strings,
      items: entries,
      updatedAt: Date().timeIntervalSince1970
    )

    let data = try JSONEncoder().encode(snapshot)

    try data.write(
      to: root.appendingPathComponent(SharedContainer.snapshotFile), options: .atomic)

    WidgetCenter.shared.reloadAllTimelines()
  }

  /// Sign-out and account deletion. The widget keeps drawing whatever it last
  /// read until something replaces it, so somebody else's library staying on
  /// the Home Screen after a sign-out is a privacy bug, not a stale cache.
  static func clear() throws {
    let root = try containerURL()

    try? FileManager.default.removeItem(
      at: root.appendingPathComponent(SharedContainer.snapshotFile))
    try? FileManager.default.removeItem(
      at: root.appendingPathComponent(SharedContainer.artworkDirectory, isDirectory: true))

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

  private static func digest(of value: String) -> String {
    SHA256.hash(data: Data(value.utf8))
      .prefix(8)
      .map { String(format: "%02x", $0) }
      .joined()
  }
}
