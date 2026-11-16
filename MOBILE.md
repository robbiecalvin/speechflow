# SpeechFlow for iOS and Android

SpeechFlow is packaged with Capacitor 8. The HTML/CSS/JavaScript app is bundled
inside each native app; it does not load a hosted website. Map editing, Outline,
persistence, and JSON import work without a web server or an account.

App name: **SpeechFlow**. Provisional application/bundle ID:
**app.speechflow.mobile**. Version: **0.1.0**, build **1**.
Confirm an ID owned by your organization before the first store release; changing
it later creates a different app with a different local data store.

## Install prerequisites

- Node.js 22 or newer; use the committed package-lock.json with `npm ci`.
- Android: JDK **21** (not just a JRE), Android Studio, Android SDK platform **36**,
  and SDK build tools **35.0.0**/**36.0.0**. The Gradle wrapper downloads Gradle
  **8.14.3**, with the official distribution SHA-256 enforced.
- iOS: a Mac with **Xcode 26+**, an installed iOS SDK, and Swift Package Manager.
  The app deployment target is iOS **16+**, matching the canvas/browser APIs used by the existing UI. No CocoaPods installation is required.
- Python 3 is needed only for the optional source-ZIP packaging command.

From the existing checkout (each cloud task is already isolated; do not create
another Git worktree unless requested):

```sh
npm ci
npm run mobile:sync
```

This creates `www/` from an explicit allowlist and synchronizes both projects.
It excludes the repository metadata, tests, build tools, signing material, and
node_modules from the app's web assets. Run sync after changing web or bridge
code. Native projects and custom speech implementations are committed; do not
run `cap add` again over them.

## Android

```sh
npm run mobile:android
```

Open Android Studio's device selector and Run. For a command-line test APK:

```sh
npm run android:debug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`.
This APK uses a development signing key. Install it on a test device by opening
the APK and granting that file manager permission to install apps, or with:

```sh
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

For an unsigned release App Bundle:

```sh
npm run android:bundle
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`.
It is **not installable** and cannot be uploaded to Play until signed with your
upload key. Use Android Studio's **Generate Signed Bundle / APK** workflow,
selecting Android App Bundle, your own upload keystore, and the release variant.
Keep the upload key and passwords outside the repository. A Google Play
Console developer account is required for store distribution.

The native speech plugin requests RECORD_AUDIO only after explicit microphone
activation. No broad filesystem/storage permission is required. File sharing
uses a private cache directory exposed through a non-exported FileProvider.
Automatic Android OS backup is disabled; use explicit JSON backups.

## iOS

```sh
npm run mobile:ios
```

Open `ios/App/App.xcodeproj` on the Mac. Allow Swift packages to resolve. Select
the **App** target, then **Signing & Capabilities**; choose your Apple developer
team and an owned bundle identifier. Use a physical iPhone to test recognition.
Run for development, or choose **Any iOS Device** and **Product → Archive** for
TestFlight/App Store distribution. Distribution requires your Apple Developer
Program account, signing certificates/profiles, and App Store Connect access.

An installable `.ipa` cannot be built on Linux or produced without the required
Apple signing setup. The checked-in Xcode project is source, not a tested iOS
binary. Its Swift sources, microphone/speech usage descriptions, native plugin
registration, and privacy manifest are included. Review privacy disclosures in
App Store Connect against the final speech providers, plugins, and behavior;
the manifest does not replace that declaration.

## Native behavior and data

- Native speech capture feeds the existing command parser and uses session IDs
  to reject results from a stopped or replaced recording. iOS commits final
  transcripts or a stable recognition result after a 1.4-second pause; pauses
  can split a long thought. Android uses final recognition results.
- The microphone is off on launch. Permission requests start only after explicit
  activation. Backgrounding stops recording/playback; returning does not resume
  recording automatically. A pending permission dialog can still appear after
  Stop, but granting it must not restart recording.
- Android speech availability depends on an installed speech-recognition service.
  Apple/Android recognition may process audio through their provider and may
  require Internet access. Typing and editing remain available when speech fails.
  Audio is not saved by SpeechFlow or sent to a SpeechFlow backend.
- iOS uses WebKit system synthesis with pause/resume when available. Android
  uses native text-to-speech. Android resume restarts at the current word boundary
  and can repeat that word. A platform fallback without word progress may repeat
  the current thought. Speech-engine/language/voice availability varies by device.
- JSON and PNG exports open the system share sheet. Choose Files/Save to keep a
  copy. Closing the share sheet does not prove a file was saved, so it does not
  mark a downloaded backup as current. Export staging retains at most 20 cache
  files, which the OS may remove.
- JSON import uses the system document picker. On some Android file providers,
  changing the file-type filter may be necessary to select a JSON file.
- Native app storage is separate from browser storage. Export a browser JSON
  backup and import it into the app. Maps persist locally across normal launches
  and same-ID updates; deleting app data/uninstalling can delete them. Keep an
  independent JSON backup before updates or reinstalling.
- Android Back closes a panel or presentation first, then minimizes the app.
  Done typing dismisses the native keyboard. Insets accommodate safe areas.

## Branding and packaging

Icons and launch screens use the existing `spflowlogosmall.png` artwork. Replace
`native/assets/logo.png` with approved higher-resolution artwork and regenerate:

```sh
npm run mobile:icons
```

Change IDs consistently in capacitor.config.json, Android's namespace/applicationId
and Java package paths, and the iOS target's PRODUCT_BUNDLE_IDENTIFIER. Increment
Android versionCode/versionName and iOS CURRENT_PROJECT_VERSION/MARKETING_VERSION
for store updates. Do not overwrite the custom MainActivity or iOS bridge controller.

Create a shareable source bundle, including synchronized app assets:

```sh
npm run package:mobile
```

Output: `dist/speechflow-mobile-source.zip`. Build caches, SDK paths, signing keys,
node_modules, and compiled app binaries are excluded. After unpacking, run `npm ci`
and `npm run mobile:sync` before building.

## Validation and release checks

Run `npm run build:web` first. Keep a local server running for the existing web
regressions (for example `python3 -m http.server 8080 --bind 127.0.0.1`), then:

```sh
node --test --test-concurrency=1 tests/*.test.cjs
node tests/browser-smoke.cjs
```

Use SPEECHFLOW_URL/CHROMIUM_PATH for another server/browser. Native-shell tests
start their own temporary server. Adapter and shell tests mock native services;
they validate command integration, permission failures, stale-session handling,
sharing and background behavior, not OS permissions or microphone accuracy.

Before distributing a release, test physical iOS and Android devices: first
launch, allow/deny/revoke speech permissions, start then stop while permission
is pending, repeated dictation, native speech playback/pause, background/return,
keyboard and rotation, JSON save/import, PNG share, persisted maps after restart,
large maps, and VoiceOver/TalkBack. Confirm that failure paths leave typing and
backups available. Review store screenshots, privacy/data-safety declarations,
speech-provider disclosures, supported-device requirements, and signing.

### Validation of this development package

The cloud build completed Android debug APK, unsigned release AAB, and Android
lint (zero errors; 28 generated icon/splash/resource warnings remain). APK signing
verification passed. The full automated suite passed 77 tests with no skips or
failures, including mocked Android/iOS shells, and the Chromium smoke check passed.
Archive checks verified the current bundled web code, native speech class,
third-party notices, and exclusion of local SDK settings and signing material.

No iOS compilation, simulator run, physical-device microphone/keyboard/permission
test, accessibility audit, or App Store/Play submission was performed. These are
development packages, not store-approved releases. The release AAB is unsigned;
the APK is development-signed. Follow the device checklist above before release.
