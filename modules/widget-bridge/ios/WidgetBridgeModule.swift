import ExpoModulesCore

struct MediaRecord: Record {
  /// File name inside the container's media directory — chosen by the caller,
  /// because the widget resolves it out of the snapshot.
  @Field var file: String = ""
  @Field var url: String = ""
}

public class WidgetBridgeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WidgetBridge")

    // `scope` is a subfolder of the container, "" for the container itself —
    // so one app can carry several widgets without their snapshots and
    // media overwriting each other.
    AsyncFunction("publish") {
      (appGroup: String, scope: String, snapshot: String, media: [MediaRecord]) async throws in
      try await WidgetSnapshotWriter.publish(
        appGroup: appGroup, scope: scope, snapshot: snapshot, media: media)
    }

    AsyncFunction("clear") { (appGroup: String, scope: String) throws in
      try WidgetSnapshotWriter.clear(appGroup: appGroup, scope: scope)
    }
  }
}
