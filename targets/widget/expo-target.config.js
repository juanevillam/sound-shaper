/**
 * THE WIDGET MUST DECLARE THE APP GROUP ITSELF.
 *
 * The plugin documents that App-Group-capable targets mirror the app's
 * `ios.entitlements` automatically; on this version it did not — the generated
 * project gave the extension no `CODE_SIGN_ENTITLEMENTS` at all, which reads
 * as "builds fine, container is nil at runtime, widget draws its empty state
 * forever". Declaring it here is explicit and cannot silently stop happening.
 *
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = config => ({
  type: 'widget',
  name: 'SoundShaperWidgets',
  displayName: 'Sound Shaper',
  // iOS 17 is the floor for `containerBackground`, which WidgetKit requires of
  // any widget built against a modern SDK.
  deploymentTarget: '17.0',
  frameworks: ['SwiftUI', 'WidgetKit'],
  entitlements: {
    'com.apple.security.application-groups':
      config.ios.entitlements['com.apple.security.application-groups'],
  },
});
