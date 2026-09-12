import Foundation

/// THE READER HALF OF A WIRE FORMAT WRITTEN TWICE ON PURPOSE.
///
/// The writer is `src/hooks/useWidgetSync.ts`, in the app's process — the SHAPE
/// is this app's, and `@portfolio/widget-bridge` only carries it across.
/// Two binaries, two sandboxes, no shared module, so these shapes are declared
/// in both places and **a change to one is a change to both**. Nothing in the
/// toolchain will say so: a mismatch decodes to `nil` and the widget quietly
/// draws its empty state, which is the correct failure on a Home Screen but a
/// silent one.
enum SharedContainer {
  static let appGroup = "group.com.juanevillam.soundshaper"
  // Both names are the package's — see `WidgetSnapshotWriter`.
  static let snapshotFile = "snapshot.json"
  static let mediaDirectory = "media"
}

struct SnapshotItem: Decodable {
  let id: String
  let name: String
  /// File NAME inside `artwork/`. The container resolves to a different
  /// absolute path in each process, so the snapshot never stores one.
  let artwork: String?
}

struct LibrarySnapshot: Decodable {
  /// Bumped by the writer on any incompatible change; a snapshot that does not
  /// match is dropped whole rather than half-decoded.
  static let supportedVersion = 1

  let version: Int
  let strings: [String: String]
  let items: [SnapshotItem]

  // NOTHING ELSE. Every field declared here is one the widget DRAWS, and that
  // is a rule rather than tidiness: a field the reader requires and the writer
  // stopped sending fails the WHOLE decode, and the widget's only symptom is
  // its empty state. This struct carried an `updatedAt` that nothing read, and
  // when the writer moved from Swift to TypeScript and quietly dropped it, both
  // widgets went blank with no error anywhere (2026-09-11).
}

enum SnapshotReader {
  static func read() -> LibrarySnapshot? {
    guard
      let root = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: SharedContainer.appGroup),
      let data = try? Data(
        contentsOf: root.appendingPathComponent(SharedContainer.snapshotFile)),
      let snapshot = try? JSONDecoder().decode(LibrarySnapshot.self, from: data),
      snapshot.version == LibrarySnapshot.supportedVersion
    else { return nil }

    return snapshot
  }

  static func artworkPath(_ fileName: String) -> String? {
    FileManager.default
      .containerURL(forSecurityApplicationGroupIdentifier: SharedContainer.appGroup)?
      .appendingPathComponent(SharedContainer.mediaDirectory, isDirectory: true)
      .appendingPathComponent(fileName)
      .path
  }
}

/// THE WIDGET'S ONLY HARDCODED ENGLISH, and it is a fallback rather than copy.
///
/// Every word the widget draws is resolved by the APP, in the person's own
/// language, and shipped inside the snapshot — the extension cannot reach
/// `src/i18n/translations.ts` across the process boundary, and a second copy of
/// the strings in the target would be a second place for the voice rules to be
/// applied. These are what the gallery shows before the app has ever run.
enum FallbackStrings {
  static let displayName = "Library"
  static let description = "Your sounds, a tap away."
  static let empty = "No Sounds Yet"
}

extension Optional where Wrapped == LibrarySnapshot {
  func string(_ key: String, fallback: String) -> String {
    self?.strings[key] ?? fallback
  }
}
