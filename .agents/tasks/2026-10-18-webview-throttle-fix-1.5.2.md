# WebView Throttle Fix — v1.5.2 (BG polling on HP)

> Source: Approved plan. Chromium throttles WebView timers when the app is backgrounded because Capacitor never pauses them (`shouldKeepRunning()` default true → `handlePause` never calls `setPaused(true)`), and `pushBg()` only runs inside `renderTotals()` after a successful `drain()`. Regression came in 1.5.0 when the npm plugin (with its `dispatchWindowVisibilityChanged(View.VISIBLE)` workaround in `onStop`) was removed. Fix: restore the visibility workaround in `MainActivity` behind a `BgSyncService.isRunning()` guard, plus beat-counter diagnostics in `live.js` to prove background ticks, then ship 1.5.2.

## Tasks

- [ ] Expose BG state from `BgSyncService` so the Activity can gate the workaround
  - [ ] Rename `private static boolean running` to a queryable `public static boolean isRunning()` in `android/app/src/main/java/com/cashnote/mobile/BgSyncService.java` and update every in-class reader/writer of that flag to the new form, no other logic changed — verify `Select-String -Path "android\app\src\main\java\com\cashnote\mobile\BgSyncService.java" -Pattern "isRunning"` returns the method definition plus all call sites.

- [ ] Keep the WebView renderer awake while background sync is on
  - [ ] Add `onStop()` to `android/app/src/main/java/com/cashnote/mobile/MainActivity.java` that, only when `BgSyncService.isRunning()`, calls `getBridge().getWebView().dispatchWindowVisibilityChanged(View.VISIBLE)` behind null guards for both bridge and webview; no behavior change when BG sync is off — verify `Select-String -Path "android\app\src\main\java\com\cashnote\mobile\MainActivity.java" -Pattern "onStop|dispatchWindowVisibilityChanged"` shows both, and the build compiles in the Verify task below.
  - [ ] Add `onResume()` to `android/app/src/main/java/com/cashnote/mobile/MainActivity.java` calling `dispatchWindowVisibilityChanged(View.GONE)` with the same null guards so the renderer may sleep again when BG sync is off — verify `Select-String -Path "android\app\src\main\java\com\cashnote\mobile\MainActivity.java" -Pattern "onResume|View.GONE"` shows both.

- [ ] Prove background timer ticks with beat-counter diagnostics (no behavior change)
  - [ ] Increment `S.beats` in `pollOnce` in `www/js/live.js`, initialize `S.beats` alongside the other `S` fields, and leave interval, fetch, `drain()`, and `pushBg()` call sites untouched — verify `Select-String -Path "www\js\live.js" -Pattern "S\.beats"` shows the init and the increment, and `node --check www/js/live.js` exits 0.
  - [ ] Add a `visibilitychange` listener in `www/js/live.js` that records `S.beatsAtHide` on `document.hidden` and, on becoming visible, shows the delta in the status label as `[beat +N]`; diagnostic only, no effect on polling or sync — verify `Select-String -Path "www\js\live.js" -Pattern "visibilitychange|beatsAtHide|\[beat"` shows the listener, the capture, and the label text, and `node --check www/js/live.js` exits 0.

- [ ] Verify build, manifest, and bundled assets before shipping
  - [ ] Run `npx cap sync android` from the repo root and confirm it reports syncing `www` into `android/app/src/main/assets/public` — verify `Select-String -Path "android\app\src\main\assets\public\js\live.js" -Pattern "beatsAtHide"` finds the synced diagnostic code.
  - [ ] Run `.\gradlew.bat assembleDebug` in `android` and confirm BUILD SUCCESSFUL producing `android\app\build\outputs\apk\debug\app-debug.apk` — verify `Test-Path "android\app\build\outputs\apk\debug\app-debug.apk"` returns True.
  - [ ] Confirm the merged manifest still declares `android:foregroundServiceType="dataSync"` after the edits — verify `Select-String -Path "android\app\build\intermediates\merged_manifests\debug\AndroidManifest.xml" -Pattern 'foregroundServiceType="dataSync"'` matches, falling back to `Get-ChildItem "android\app\build" -Recurse -Filter AndroidManifest.xml | Select-String -Pattern 'foregroundServiceType="dataSync"'`.
  - [ ] Confirm the native change is actually inside the built APK by locating `isRunning` in the dex/classes of the debug artifact — verify `Select-String -Path "android\app\build\intermediates\javac\debug\compileDebugJavaWithJavac\classes\com\cashnote\mobile\BgSyncService.class" -Pattern "isRunning" -Encoding Byte -Quiet` or `javap -p android\app\build\intermediates\javac\debug\compileDebugJavaWithJavac\classes\com\cashnote\mobile\BgSyncService.class | Select-String "isRunning"` resolves.

- [ ] Ship v1.5.2
  - [ ] Bump `versionName` to `1.5.2` and `versionCode` to `18` in `android/app/build.gradle` and update `package.json` version to `1.5.2` to match, verify `Select-String -Path "android\app\build.gradle","package.json" -Pattern "1\.5\.2"` and `Select-String -Path "android\app\build.gradle" -Pattern "versionCode 18"` both match, then re-run `.\gradlew.bat assembleDebug` in `android` and confirm `Test-Path "android\app\build\outputs\apk\debug\app-debug.apk"` returns True.
  - [ ] Commit only the intended files (BgSyncService.java, MainActivity.java, live.js, version bumps, this task file) and push to the tracked remote branch — verify `git status --porcelain` is empty after the push and `git log --oneline -1` shows the release commit.
  - [ ] Create the GitHub release with the debug APK attached — verify `gh release create v1.5.2 android\app\build\outputs\apk\debug\app-debug.apk --title "v1.5.2" --notes "WebView background throttle fix + beat diagnostics"` succeeds and `gh release view v1.5.2` lists `app-debug.apk` as an asset.

## Done
When every checkbox is `[x]`, run:
`Move-Item -LiteralPath ".agents/tasks/2026-10-18-webview-throttle-fix-1.5.2.md" -Destination ".agents/tasks/done/"`