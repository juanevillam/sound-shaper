# Running the apps on iOS — simulator and a real iPhone, at the same time

Everything needed to get Topper and Expo UI Starter live on **both** the
simulator and the physical iPhone, with one Metro per app so several apps can
run concurrently. Verified end to end 2026-08-11 (Xcode 26.6, iOS 26.5 sim /
26.6 device, Expo SDK 57).

The short version: **build once per app per target, then the daily loop is just
"start the Metro servers and open the apps."**

## The constants

| thing                         | value                                        |
| ----------------------------- | -------------------------------------------- |
| Simulator (iPhone 17)         | `0D6B7E54-D5DD-45CA-9B3A-E504E964AFEB`       |
| iPhone — build/install UDID   | `00008120-000A3CEA28214932`                  |
| iPhone — **devicectl** UUID   | `031212A3-4D83-59BA-8645-CF765C47117E`       |
| Signing team (free, personal) | `C65D64JUZK`                                 |
| Mac LAN IP                    | **drifts** — always `ipconfig getifaddr en0` |

The two iPhone identifiers are **not interchangeable**. `xcodebuild` and
`expo run:ios` take the UDID; `devicectl` takes the CoreDevice UUID. Both come
from `xcrun devicectl list devices`.

### Port map — one Metro per app, never share

| app             | port   | slug              | bundle id                       |
| --------------- | ------ | ----------------- | ------------------------------- |
| topper          | `8081` | `topper`          | `com.juanevillam.topper`        |
| sound-shaper    | `8082` | `sound-shaper`    | `com.juanevillam.soundshaper`   |
| expo-ui-starter | `8083` | `expo-ui-starter` | `com.juanevillam.expouistarter` |

Distinct ports are **mandatory**. Two apps on 8081 does not error — app B
silently loads app A's bundle, which looks healthy and renders the wrong app.

## The daily loop

Once the apps are installed, this is all there is. Two terminals, left open:

```bash
cd apps/topper && npx expo start --dev-client --port 8081 --host lan
```

```bash
cd apps/expo-ui-starter && npx expo start --dev-client --port 8083 --host lan
```

Confirm they are actually up before touching the apps:

```bash
lsof -nP -iTCP:8081 -sTCP:LISTEN; lsof -nP -iTCP:8083 -sTCP:LISTEN
```

Then open the apps on both devices. They remember their server. Edits to
JS/TS hot-reload on all four copies at once.

**iOS shows one app in the foreground per screen**, so "both apps at once"
means installed side by side and swapped between — backgrounded apps stay
connected and keep reloading. For genuinely side-by-side, boot a second
simulator.

## Full rebuild — after `prebuild`, native changes, or new icons

JS/TS edits never need this. Native config does: `app.json`, a new native
dependency, app icons, any `expo prebuild`.

Run these **one at a time** — parallel builds only thrash the CPU.

### 1. Simulator (no code signing involved)

```bash
cd apps/expo-ui-starter && npx expo run:ios --device 0D6B7E54-D5DD-45CA-9B3A-E504E964AFEB --no-bundler
```

`--no-bundler` matters: without it Expo starts its own Metro on 8081 and
fights the one you want.

### 2. iPhone

If a provisioning profile for the bundle id already exists, `expo run:ios`
works the same way as the simulator. **If none exists it fails**, because Expo
never passes `-allowProvisioningUpdates`:

```
No profiles for 'com.juanevillam.topper' were found
```

Minting one requires driving xcodebuild directly:

```bash
cd apps/topper/ios && xcodebuild -workspace Topper.xcworkspace -scheme Topper -configuration Debug -destination 'id=00008120-000A3CEA28214932' -allowProvisioningUpdates DEVELOPMENT_TEAM=C65D64JUZK CODE_SIGN_STYLE=Automatic build
```

Look for `** BUILD SUCCEEDED **`. Then install (any directory — the path is
absolute):

```bash
xcrun devicectl device install app --device 031212A3-4D83-59BA-8645-CF765C47117E ~/Library/Developer/Xcode/DerivedData/Topper-*/Build/Products/Debug-iphoneos/Topper.app
```

The iPhone must be **connected and unlocked** for both. Xcode.app does not need
to be open, and its indexing is irrelevant — `xcodebuild` is a pure CLI.

### 3. Trust, on the first install after wiping the apps

The install succeeds and the launch fails:

> Unable to launch … its profile has not been explicitly trusted by the user

On the iPhone: **Settings → General → VPN & Device Management → Apple
Development: \<apple id\> → Trust**. One tap covers every app from that
certificate.

### 4. Point each app at its Metro

`expo run:ios` auto-opens the app against **port 8081 regardless**, so any app
on another port needs redirecting once. The scheme is `exp+<slug>://`, _not_
the app's own `scheme`:

```bash
xcrun simctl openurl 0D6B7E54-D5DD-45CA-9B3A-E504E964AFEB "exp+expo-ui-starter://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8083"
```

On the iPhone, open the app and pick the server in the dev launcher. **Topper
auto-connects** because 8081 is the port the dev client probes first;
everything else needs _Enter URL manually_ → `http://<mac-ip>:<port>`.

This is a one-time step per app per device — the launcher remembers.

## Provisioning profiles expire every 7 days (free team)

A free personal team caps profiles at 7 days, and they are minted at different
times, so they drift out of sync. Inspect them:

```bash
for f in ~/Library/Developer/Xcode/UserData/Provisioning\ Profiles/*.mobileprovision; do echo "$(security cms -D -i "$f" | plutil -extract Entitlements.application-identifier raw -)  $(security cms -D -i "$f" | plutil -extract ExpirationDate raw -)"; done
```

To re-mint them all on the same day: **delete the ones for our bundle ids**
(leave any work profiles alone), then run the xcodebuild command above for each
app. Deleting is safe — already-installed apps keep working, and Xcode
regenerates on the next signed build. Note that `-allowProvisioningUpdates`
**reuses** a valid existing profile rather than making a fresh one, so deleting
first is what actually resets the clock.

When apps stop launching on the phone, nothing is broken — the profile expired.
Rebuild. The permanent fix is the $99/yr Apple Developer Program.

Free team also caps you at **3 apps** on the device, which is exactly the number
of apps in this repo.

## Sign in with Apple is off, on purpose

The `com.apple.developer.applesignin` entitlement needs a **paid** membership,
so a free team cannot sign any app that declares it. It is stripped by
`plugins/with-strip-apple-signin.js` plus `ios.usesAppleSignIn: false`, and the
button is hidden behind each app's `APPLE_SIGN_IN_ENABLED` flag. See each app's
`AGENTS.md`. The plugin **must be the first entry** in `app.json`'s `plugins`
array — the entitlements mod registered earliest runs last.

## Troubleshooting, by symptom

**Both simulator AND phone say "could not connect"** — the Metro server is not
running. The simulator connects over `localhost`, so Wi-Fi and VPN cannot
affect it; identical failures on both surfaces always mean "no server." Check
with the `lsof` command above. Each `expo start` holds its terminal — they need
separate windows.

**Only the phone fails** — now it is the network. Re-check `ipconfig getifaddr
en0` (it drifts) and re-enter the URL in the dev launcher.

**`osascript … "System Events" … exited with non-zero code: 1`** — the terminal
lacks Automation permission. **System Settings → Privacy & Security →
Automation → \<your terminal\> → System Events**. If the row is missing,
`tccutil reset AppleEvents com.apple.Terminal` to make the prompt reappear.
`expo run:ios` calls this unconditionally; the xcodebuild + `simctl install`
path avoids it entirely.

**`--port` and `--no-bundler` are mutually exclusive** — they are. Use
`--no-bundler` and start Metro yourself.

**`expo run:ios` built fine, then the app opened against ANOTHER app's Metro**
— the port-map rule broken by the build command itself, and it looks completely
healthy. If 8081 is already held by a different app, `run:ios` cannot prompt in
a non-interactive shell, prints `Port 8081 is running <other app>` and
`Skipping dev server`, and then still launches the dev client at
`http://<lan-ip>:8081` — i.e. at the other app's bundler. Caught 2026-08-28
with the starter loading Topper's bundle. Re-point it by hand:

```bash
xcrun simctl openurl booted "exp+expo-ui-starter://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8083"
```

Always confirm which app answered before believing a screenshot —
`curl -H 'expo-platform: ios' localhost:<port>/` returns a manifest whose
`slug` names it.

**CocoaPods: `Unicode Normalization not appropriate for ASCII-8BIT`** — a
non-UTF-8 shell. `export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`.

**`pod install` fails with `Could not resolve host: github.com`** — the VPN's
DNS. Tell: `dig github.com` works while `curl` and `dscacheutil` time out,
because only the latter go through mDNSResponder. The VPN is otherwise
harmless here — it is split-tunnel, so Metro over the LAN is unaffected.

**Edited a file and no new "Bundled" line appears in Metro** — expected. Fast
Refresh pushes over the websocket and logs nothing. Verify by looking at the
app, not the log.

**A new `*.ios.tsx` file is ignored** — Fast Refresh does not re-resolve
platform extensions. Restart Metro with `--clear`.

**`No such module X` in a pod build** — usually a corrupt CocoaPods cache that
installed an empty pod directory. See
[`dev-workflow.md`](dev-workflow.md).

## Widgets, and what the free team turned out to allow

Both Topper and Sound Shaper ship a Home Screen widget as an app extension with
its own bundle id (`com.juanevillam.<app>.widget`), built by
`@bacons/apple-targets` from `apps/<app>/targets/widget`.

**APP GROUPS WORK ON THE FREE PERSONAL TEAM.** This was the open question before
the first device build and the answer is yes: `xcodebuild … -allowProvisioningUpdates`
minted profiles for BOTH the app and the extension, each carrying
`com.apple.security.application-groups`, with no paid membership. Verified on the
built `.app` (2026-09-11):

```bash
codesign -d --entitlements - <App>.app/PlugIns/<Name>.appex | grep -A3 application-groups
```

**Nor did the extension's app id trip the 3-app device limit.** Four ids are now
provisioned for this device (two apps, two widgets) and installs succeed. The
7-day profile clock is unchanged and applies to the widget's profile too, so
BOTH expire together and a rebuild re-mints both.

**The SIMULATOR runs widgets** — gallery, Home Screen, Control Center — and its
ad-hoc signing resolves App Groups with no portal capability at all. That makes
the whole widget loop a simulator loop. Two things only a device (or a switched
Home Screen) shows: the **Tinted / Clear** appearances, and the widget's real
geometry on hardware.

Inspecting a simulator's shared container is the fastest way to tell "the app
never published" from "the widget cannot read":

```bash
BASE=~/Library/Developer/CoreSimulator/Devices/<UDID>/data/Containers/Shared/AppGroup
for d in $BASE/*/; do
  id=$(plutil -extract MCMMetadataIdentifier raw "$d.com.apple.mobile_container_manager.metadata.plist" 2>/dev/null)
  [ "$id" = "group.com.juanevillam.soundshaper" ] && echo "$d" && ls -la "$d"
done
```

A container holding `snapshot.json` + `media/` means the app's half works and
anything still wrong is the reader's.

## Disk

A full set of iOS builds is expensive: DerivedData reached **28 GB** for three
apps (Topper 11G, Sound Shaper 7.9G, Expo UI Starter 4.8G, plus a 4.2G module
cache). Wiping it is always safe — it is pure build output:

```bash
rm -rf ~/Library/Developer/Xcode/DerivedData/*
```

Also worth reclaiming: `xcrun simctl delete unavailable` drops simulators whose
runtime is gone. **Do not** delete the simulator you use — its container holds
the installed apps and their signed-in sessions.
