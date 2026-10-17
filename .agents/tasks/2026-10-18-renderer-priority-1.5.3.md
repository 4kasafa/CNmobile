# Renderer priority 1.5.3 — beat diagnostics + native renderer priority

> Source: On 1.5.2 the background poll ticked only once (`[beat +1]`), so WebView timers are still throttled/frozen in background. Two fixes: (a) `heal()` overwrites the beat label with `status("[BUKA·ok]")`, and (b) the delta is ambiguous because `visibilitychange` may be deferred until resume. Plan: set `setRendererPriorityPolicy(RENDERER_PRIORITY_IMPORTANT, false)` in `MainActivity.onCreate`, move the beat readout to its own `#live-beat` span with hidden/freeze timestamps, then ship 1.5.3/code 19 and measure the exact `[beat +N · Xd]` string on a real device before considering native polling.

## Tasks

- [x] Set renderer priority in native onCreate (keep onStop workaround)
  - [x] Add `getBridge().getWebView().setRendererPriorityPolicy(android.webkit.WebView.RENDERER_PRIORITY_IMPORTANT, false)` in `onCreate` of `android/app/src/main/java/com/cashnote/mobile/MainActivity.java`, guarded against null bridge/WebView, and leave `registerPlugin`, `onStart`, and the `onStop` `postDelayed` 1000 `dispatchWindowVisibilityChanged` workaround unchanged — verify ``Select-String -Path "android\app\src\main\java\com\cashnote\mobile\MainActivity.java" -Pattern "setRendererPriorityPolicy"``

- [x] Add dedicated live-beat element
  - [x] Insert `<span id="live-beat"></span>` beside the existing `<span id="live-status">` in the live bar of `www/index.html` so `status()` can no longer overwrite the beat readout — verify ``Select-String -Path "www\index.html" -Pattern 'id="live-beat"'``

- [x] Instrument background-tick diagnostics in live.js (no behavior change)
  - [x] On `document.hidden`, record `S.hiddenAt = Date.now()` and `S.beatsAtHide = S.beats` in `www/js/live.js`, keeping the existing `S.beats++` increment in `pollOnce` untouched — verify ``Select-String -Path "www\js\live.js" -Pattern "hiddenAt"``
  - [x] Add a `freeze` event listener in `www/js/live.js` that records the same hide timestamps so a frozen WebView is distinguishable from a merely throttled one — verify ``Select-String -Path "www\js\live.js" -Pattern "freeze"``
  - [x] On becoming visible, write a `[beat +N · Xd]` readout (tick delta N, elapsed seconds X) into `#live-beat` instead of calling `status()`, leaving `heal()`'s `[BUKA·ok]` status intact — verify ``Select-String -Path "www\js\live.js" -Pattern "live-beat"``
  - [x] Leave polling, drain, `pushBg`, and interval logic unchanged in `www/js/live.js` — verify ``node --check www/js/live.js``

- [x] Bump version and build the APK
  - [x] Change `versionName "1.5.2"`→`"1.5.3"` and `versionCode 18`→`19` in `android/app/build.gradle` — verify ``Select-String -Path "android\app\build.gradle" -Pattern "1\.5\.3|versionCode 19"``
  - [x] Change the version to `1.5.3` in `package.json` — verify ``Select-String -Path "package.json" -Pattern '"version": "1\.5\.3"'``
  - [x] Run `npx cap sync android` from the repo root and confirm it exits 0 with no failed step — verify ``Select-String -Path "android\app\src\main\java\com\cashnote\mobile\MainActivity.java" -Pattern "setRendererPriorityPolicy"``
  - [x] Run `.\gradlew.bat assembleDebug` and confirm `BUILD SUCCESSFUL` — verify ``Test-Path -LiteralPath "android\app\build\outputs\apk\debug\app-debug.apk"``
  - [x] Confirm the merged manifest still declares `foregroundServiceType="dataSync"` — verify ``Select-String -Path "android\app\build\intermediates\merged_manifests\debug\AndroidManifest.xml" -Pattern 'foregroundServiceType="dataSync"'``

- [x] Commit, push, and tag the release
  - [x] Stage only `MainActivity.java`, `www/index.html`, `www/js/live.js`, `android/app/build.gradle`, `package.json`, and this task file, then commit with a concise message — verify ``git status --short`` shows no unstaged leftovers among those files
  - [x] Push the commit to the tracked branch — verify ``git log --oneline -1`` and ``git status -sb`` show a pushed, clean branch
  - [x] Create release `v1.5.3` with `android\app\build\outputs\apk\debug\app-debug.apk` attached via `gh release create` — verify ``gh release view v1.5.3`` (+ https://github.com/4kasafa/CNmobile/releases/tag/v1.5.3)

- [ ] Pending manual device measurement (do NOT mark done without the real reading)
  - [ ] Install 1.5.3 on a physical device, open a session, confirm `[bg:on]`, minimize for 5 minutes, reopen, and report the exact `[beat +N · Xd]` string from `#live-beat` — verify ``gh release view v1.5.3 --json tagName`` plus the transcribed readout in this task file
  - [ ] If N is still ~0 after the measurement, record that the next step is moving polling into native Java (HttpURLConnection + SQLite) and do NOT start it without that measurement — verify this checkbox stays `[ ]` until the device reading is pasted above

## Done
When every checkbox is `[x]`, run:
`Move-Item -LiteralPath ".agents/tasks/2026-10-18-renderer-priority-1.5.3.md" -Destination ".agents/tasks/done/"`