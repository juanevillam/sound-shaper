import SwiftUI
import WidgetKit

/// THE LIBRARY, ON THE HOME SCREEN.
///
/// The app's grid is hand-ordered in both directions (`lib/gridOrder.ts`), and
/// that order is the whole reason this widget is worth having: it is the
/// person's own arrangement, not "recently played".
///
/// COVERS ONLY, NO CAPTIONS. A title under a 70pt cover is unreadable at widget
/// scale, and Apple's own library grids (Music, Photos) caption nothing either.
///
/// GROWING THE WIDGET SHOWS MORE, NOT BIGGER. Small holds 4, medium 8, large
/// 16, at a tile size that stays within a few points across all three — the
/// alternative (one layout scaled up) makes a large widget a small one with
/// everything enlarged, which says nothing extra about the library.
///
/// THE GEOMETRY BELOW IS PROVISIONAL until it is band-scanned on device; the
/// column counts are a choice, the tile size is solved from the family's own
/// box so a row can never overflow it.
private enum Grid {
  static let gap: CGFloat = 8
  /// A picture's corner is a ratio of the picture — `artworkRadius`, the
  /// portfolio's term. This target cannot import it across the process
  /// boundary, so it restates the ratio rather than a size.
  static let artworkRatio: CGFloat = 0.15
  /// `EMPTY_MEDIA_INITIAL_RATIO`, from `@portfolio/mobile-ui/InitialArt`.
  static let initialRatio: CGFloat = 0.42

  static func columns(_ family: WidgetFamily) -> Int {
    family == .systemSmall ? 2 : 4
  }

  static func rows(_ family: WidgetFamily) -> Int {
    family == .systemLarge ? 4 : 2
  }
}

struct LibraryEntry: TimelineEntry {
  let date: Date
  let snapshot: LibrarySnapshot?
}

struct LibraryProvider: TimelineProvider {
  func placeholder(in context: Context) -> LibraryEntry {
    LibraryEntry(date: Date(), snapshot: nil)
  }

  func getSnapshot(in context: Context, completion: @escaping (LibraryEntry) -> Void) {
    completion(LibraryEntry(date: Date(), snapshot: SnapshotReader.read()))
  }

  /// `.never`, deliberately. Nothing here goes stale on a clock — the library
  /// changes when the person changes it, and the app reloads the timeline from
  /// `WidgetBridge` at that moment. A refresh policy would spend the system's
  /// budget re-reading a file that has not moved.
  func getTimeline(in context: Context, completion: @escaping (Timeline<LibraryEntry>) -> Void) {
    completion(
      Timeline(
        entries: [LibraryEntry(date: Date(), snapshot: SnapshotReader.read())],
        policy: .never))
  }
}

struct LibraryWidgetView: View {
  @Environment(\.widgetFamily) private var family

  let entry: LibraryEntry

  private var items: [SnapshotItem] {
    let capacity = Grid.columns(family) * Grid.rows(family)

    return Array((entry.snapshot?.items ?? []).prefix(capacity))
  }

  var body: some View {
    Group {
      if items.isEmpty {
        emptyState
      } else {
        grid
      }
    }
    .containerBackground(.background, for: .widget)
    // A small widget is ONE tap target — WidgetKit ignores `Link` there — so
    // the whole thing opens the library instead of a sound.
    .widgetURL(family == .systemSmall ? DeepLink.library : nil)
  }

  private var emptyState: some View {
    VStack(spacing: 6) {
      Image(systemName: "waveform")
        .font(.title2)
        .foregroundStyle(.secondary)
      Text(entry.snapshot.string("empty", fallback: FallbackStrings.empty))
        .font(.footnote)
        .foregroundStyle(.secondary)
        .multilineTextAlignment(.center)
    }
  }

  private var grid: some View {
    GeometryReader { proxy in
      let columns = Grid.columns(family)
      let rows = Grid.rows(family)
      // Solved against BOTH axes: a tile sized from the width alone overflows
      // a medium widget's height, which is shorter than four columns are wide.
      let byWidth = (proxy.size.width - Grid.gap * CGFloat(columns - 1)) / CGFloat(columns)
      let byHeight = (proxy.size.height - Grid.gap * CGFloat(rows - 1)) / CGFloat(rows)
      let tile = max(min(byWidth, byHeight), 1)

      VStack(spacing: Grid.gap) {
        ForEach(0..<rows, id: \.self) { row in
          HStack(spacing: Grid.gap) {
            ForEach(0..<columns, id: \.self) { column in
              cell(at: row * columns + column, tile: tile)
            }
          }
        }
      }
      .frame(width: proxy.size.width, height: proxy.size.height)
    }
  }

  @ViewBuilder
  private func cell(at index: Int, tile: CGFloat) -> some View {
    if index < items.count {
      let item = items[index]

      if family == .systemSmall {
        cover(item, tile: tile)
      } else {
        Link(destination: DeepLink.play(item.id)) {
          cover(item, tile: tile)
        }
      }
    } else {
      // A slot rather than nothing: the grid keeps its columns when the
      // library is shorter than the family holds.
      Color.clear.frame(width: tile, height: tile)
    }
  }

  private func cover(_ item: SnapshotItem, tile: CGFloat) -> some View {
    artwork(item, tile: tile)
      .frame(width: tile, height: tile)
      .clipShape(
        RoundedRectangle(cornerRadius: tile * Grid.artworkRatio, style: .continuous))
  }

  @ViewBuilder
  private func artwork(_ item: SnapshotItem, tile: CGFloat) -> some View {
    if let file = item.artwork, let path = SnapshotReader.artworkPath(file),
      let image = UIImage(contentsOfFile: path)
    {
      Image(uiImage: image)
        .resizable()
        .aspectRatio(contentMode: .fill)
    } else {
      // AN ART-LESS BOX TAKES ITS MATERIAL FROM ITS CONTAINER, AND A WIDGET IS
      // A CONTAINER THE APP DOES NOT HAVE.
      //
      // `emptyMediaColor` steps systemGray5 by container because the app's own
      // grounds differ (`card` vs a form sheet's elevated row). Shipped here
      // verbatim, it measured a channel delta of SIX against the widget's own
      // background on the Home Screen — (44,44,46) on (50,50,53) — so the
      // placeholder all but disappeared while reading correctly everywhere in
      // the app.
      //
      // `.fill.tertiary` is the answer rather than a fourth hardcoded grey: it
      // is defined RELATIVE to whatever ground it is drawn on, so it separates
      // in the Home Screen's light, dark and tinted renderings without this
      // target guessing any of their values.
      ZStack {
        Rectangle().fill(.tertiary)
        Text(initial(of: item.name))
          .font(.system(size: tile * Grid.initialRatio, weight: .semibold))
          .foregroundStyle(.primary)
      }
    }
  }

  private func initial(of name: String) -> String {
    guard let first = name.trimmingCharacters(in: .whitespacesAndNewlines).first else {
      return ""
    }

    return String(first).uppercased()
  }
}

enum DeepLink {
  static let library = URL(string: "soundshaper://home")!

  static func play(_ soundId: String) -> URL {
    URL(string: "soundshaper://home?play=\(soundId)") ?? library
  }
}

struct LibraryWidget: Widget {
  var body: some WidgetConfiguration {
    let snapshot = SnapshotReader.read()

    return StaticConfiguration(kind: "SoundShaperLibrary", provider: LibraryProvider()) { entry in
      LibraryWidgetView(entry: entry)
    }
    .configurationDisplayName(snapshot.string("displayName", fallback: FallbackStrings.displayName))
    .description(snapshot.string("description", fallback: FallbackStrings.description))
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}
