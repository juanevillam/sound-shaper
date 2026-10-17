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

    AsyncFunction("publish") {
      (appGroup: String, snapshot: String, media: [MediaRecord]) async throws -> Int in
      try await WidgetSnapshotWriter.publish(
        appGroup: appGroup, snapshot: snapshot, media: media)
    }

    AsyncFunction("clear") { (appGroup: String) throws in
      try WidgetSnapshotWriter.clear(appGroup: appGroup)
    }
  }
}
