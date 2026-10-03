# La Bête · France — native client candidate

One public France canon, two native projections. SwiftUI + SceneKit on iOS; Android Activity + OpenGL ES. No main-screen WebView. No financial transformations, runtime, event bus or source scheduler added. The bundled public snapshot is a named fallback projection; it retains its original evidence age.

Identity: `com.novaera.france.beast`. iOS candidate: version `0.1.1`, build `2026100202`. Android preview: version `0.1.1`, versionCode `2026100202`. This is a separate France candidate, never a rename or update of Hélène/KRIMI/SUPRA. Existing main SUPRA sources are untouched.

## Reproduce

Run `python3 mobile/tools/prepare_assets.py` from this repository. This pins assets to the repository canon and generates optional artistic audio. Its six sinusoidal voices adapt the published resonance contract; sound has no financial meaning.

With existing Xcode 27 and XcodeGen 2.45.4: `cd mobile/ios && xcodegen generate`; build/test scheme `LaBete` on an available iPhone simulator. Archive `generic/platform=iOS`. Real distribution requires a valid existing Apple account/profile; an unsigned archive is not an installable IPA. The recorded developer team is inherited from the reconciled existing iOS packaging and does not prove App Store Connect access.

With existing JDK 17 and Android SDK 35: `ANDROID_HOME=/path/to/sdk bash mobile/android/build.sh`. This reuses the examined KRIMI Java/aapt2/d8 packaging, preserving its independent product identity. Output is unsigned; use the authorized existing signing configuration outside this repository. No private key, password, signing configuration or private product data belongs here. Instrumentation package uses the same certificate and runs with `adb shell am instrument -w com.novaera.france.beast.tests/com.novaera.france.beast.TestInstrumentation`.

## Scope of proof

Native tests cover canon validation/replacement, missing values, political/territorial constraints, byte-preserving export, native screens, audio opt-in and interruption handling. Emulator/simulator evidence does not certify physical haptics, headphones/Bluetooth, accessibility with a human reader, TestFlight, Google Play, or production distribution. Keep these verdicts separate.

Android refresh retains the active scene and scroll position when the verified snapshot is unchanged or the network fails. New verified snapshots replace the presentation while preserving its position and camera. To run the additional OS network outage recipe, disable networking only on the isolated test emulator, run instrumentation with `-e offline_recipe true`, then restore its recorded network settings. This checks the visibly retained snapshot and exact cache provenance after an actual network failure.

External official source documents open through the OS. Optional haptics only acknowledge presentation gestures. Audio stops on inactive/background, focus loss and headphone removal; it never resumes automatically. Android observes the public client feed only while foreground; iOS observes on opening/foreground/manual refresh. No server heartbeat is inferred from the app lifecycle.

Rollback: remove this additive module or check out its parent commit. Cache format v1 is a disposable public projection and never changes the canon.

iOS client tests exercise loader failure, HTTP failure, malformed/stale/conflicting snapshots, corrupted cache, exact-byte fresh replacement, cache reopening, write failure and unchanged-snapshot reverification. Loader failures use a controlled URLProtocol, not an OS-wide network outage. An unchanged snapshot is persisted if needed without republishing the scene. Native AVAudioPlayer tests record the actual engine duration, sample rate, channels, bounded volume and elapsed playback; these do not certify physical perception or peripherals. LaunchPerformanceTests runs three Release simulator measurements with Apple's XCTApplicationLaunchMetric(waitUntilResponsive: true); keep the measurement run separate from functional assertion counts and physical performance.
