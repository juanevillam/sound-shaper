const fs = require('fs');
const path = require('path');

const { withDangerousMod } = require('expo/config-plugins');

const MARKER = '# @portfolio/with-ios-swiftui-link-fix';

const SNIPPET = `
    ${MARKER} — do not edit by hand (plugins/with-ios-swiftui-link-fix.js)
    #
    # \`import SwiftUI\` makes swiftc emit an implicit \`-framework SwiftUICore\`
    # autolink (an LC_LINKER_OPTION in every object file). Xcode 26.6's
    # \`SwiftUICore.tbd\` allows only SwiftUI itself as a direct client, so the app
    # binary fails to link: "cannot link directly with 'SwiftUICore' because
    # product being built is not an allowed client of it". Dropping the autolink
    # is safe — SwiftUI.tbd re-exports SwiftUICore, so the symbols still resolve.
    #
    # Xcode 26 also splits Debug builds into an app \`.debug.dylib\`, which both
    # trips the same SwiftUICore gate and leaves React dev symbols
    # (RCTPackagerConnection, DebugStringConvertible) undefined. Disabling it
    # reverts Debug to a single binary; Metro / Fast Refresh are unaffected and
    # only SwiftUI Previews (unused here) stop working.
    swiftuicore_fix = '$(inherited) -Xfrontend -disable-autolink-framework -Xfrontend SwiftUICore'

    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |bc|
        bc.build_settings['OTHER_SWIFT_FLAGS'] = swiftuicore_fix
      end
    end
    installer.pods_project.save

    installer.aggregate_targets.each do |aggregate_target|
      user_project = aggregate_target.user_project
      next unless user_project
      user_project.native_targets.each do |target|
        target.build_configurations.each do |bc|
          bc.build_settings['ENABLE_DEBUG_DYLIB'] = 'NO'
          bc.build_settings['OTHER_SWIFT_FLAGS'] = swiftuicore_fix
        end
      end
      user_project.save
    end
`;

/**
 * ios/ is gitignored CNG output, so the Podfile is regenerated on every
 * `expo prebuild --clean`. This plugin re-injects the SwiftUICore link fix into
 * the Podfile's `post_install` hook (CocoaPods allows only one, so it has to be
 * an injection rather than a second hook).
 */
const withIosSwiftUiLinkFix = config =>
  withDangerousMod(config, [
    'ios',
    cfg => {
      const podfilePath = path.join(
        cfg.modRequest.platformProjectRoot,
        'Podfile',
      );
      const podfile = fs.readFileSync(podfilePath, 'utf8');

      if (podfile.includes(MARKER)) return cfg;

      // Insert after the `react_native_post_install(...)` call so React Native's
      // own settings are in place before ours override them.
      const anchor = /\n(\s*)react_native_post_install\([\s\S]*?\n\s*\)\n/;
      if (!anchor.test(podfile)) {
        throw new Error(
          '[with-ios-swiftui-link-fix] could not find react_native_post_install in the Podfile',
        );
      }

      fs.writeFileSync(
        podfilePath,
        podfile.replace(anchor, match => `${match}${SNIPPET}`),
      );

      return cfg;
    },
  ]);

module.exports = withIosSwiftUiLinkFix;
