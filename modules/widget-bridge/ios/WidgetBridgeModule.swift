import ExpoModulesCore

struct LibraryItemRecord: Record {
  @Field var id: String = ""
  @Field var name: String = ""
  @Field var artUrl: String = ""
}

/// The app's half of the Home Screen widget: it owns the shared container and
/// the WidgetKit reload, and the widget owns nothing but drawing.
///
/// It is a LOCAL module rather than a package because it is one app's wiring to
/// one app's widget — there is no second caller to share it with, and the App
/// Group id it writes to is Sound Shaper's own.
public class WidgetBridgeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WidgetBridge")

    AsyncFunction("syncLibrary") {
      (items: [LibraryItemRecord], strings: [String: String]) async throws in
      try await WidgetSnapshotWriter.write(items: items, strings: strings)
    }

    AsyncFunction("clear") { () throws in
      try WidgetSnapshotWriter.clear()
    }
  }
}
