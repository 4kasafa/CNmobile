# Statusbar overlay & safe-area for sticky #topbar

> Source: Plan approved to stop the system status bar from covering `#topbar` in the APK. `viewport-fit=cover` is already in `www/index.html:5`, but nothing consumes `safe-area-inset-top`, and the Capacitor WebView defaults to overlay mode — so the `position:sticky; top:0` header sits under the status bar.
> Fix in three places: add `@capacitor/status-bar@^7` to devDependencies, turn off WebView overlay + paint the status bar `--abyss` via the global plugin (no ESM import — no bundler in this repo), and pad `#topbar` with `calc(10px + env(safe-area-inset-top, 0px))` as the CSS-only fallback. `#term` stays untouched; native plugin changes require a full APK rebuild, not just `cap sync`.

## Tasks

- [x] Add `@capacitor/status-bar` to `package.json` devDependencies and install/sync
  - File: `package.json`, `devDependencies` block (currently lines 9-13, all entries on the `^7` major line).
  - Add exactly one entry, alphabetical, after `@capacitor/core`:
    `"@capacitor/status-bar": "^7.0.0"`
  - No new `scripts`, no new runtime dependencies — it stays a devDependency like the other three Capacitor packages.
  - Install + sync:
    `npm i @capacitor/status-bar@^7 && npx cap sync android`
  - Accept: `package.json` diff is exactly one added line; `node_modules/@capacitor/status-bar/package.json` exists.

- [x] Call `StatusBar.setOverlaysWebView({ overlay: false })` + `setBackgroundColor` from the existing `DOMContentLoaded` handler in `www/js/app.js`
  - File: `www/js/app.js`, inside the `document.addEventListener("DOMContentLoaded", function () {` block (lines 16-25). Insert as the first statements of that handler, before `var v = "setoran";`.
  - Insert this snippet verbatim (plain script, no `import`, no `require`):
    ```js
    // ponytail: akses plugin lewat global Capacitor.Plugins — tanpa bundler di repo ini.
    // ESM `import { StatusBar } from '@capacitor/status-bar'` ditolak: butuh build step.
    try {
      var SB = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.StatusBar;
      if (SB) {
        // overlay:false -> WebView mulai DI BAWAH status bar, jadi header sticky tidak ketutup
        SB.setOverlaysWebView({ overlay: false });
        SB.setBackgroundColor({ color: "#050b0f" }); // sama dengan --abyss, hindari flash putih
      }
    } catch (e3) {}
    ```
  - Rationale to keep in the comment: `overlay:false` fixes the cover-up; `setBackgroundColor` matches `--abyss` (`www/css/style.css:13`) and the `<meta name="theme-color" content="#050b0f">` in `www/index.html:6`.
  - Guard requirements: `try/catch` plus `window.Capacitor` / `Plugins` / `StatusBar` presence checks, so it no-ops in Chrome and on older native builds.
  - ponytail: skipping `SB.setStyle({ style: SB.Style.Dark })` — YAGNI, `setBackgroundColor` alone kills the white flash. Add it if the icons ever turn unreadable on a light system theme.
  - Accept: `www/js/app.js` still loads via `<script defer>` (no `type="module"`), file stays an IIFE, no import statement anywhere in `www/js/`.
  - Verify: `Select-String -Path www\js\app.js -Pattern "import " -Quiet` returns False; browser console has no errors on load in Chrome.

- [x] Add `env(safe-area-inset-top)` fallback padding to `#topbar` in `www/css/style.css`
  - File: `www/css/style.css`, `#topbar` rule (lines 44-48).
  - Old line 46 (exact):
    `  padding: 10px 0 4px; position: sticky; top: 0; z-index: 20; background: var(--abyss);`
  - New line 46 (exact):
    `  padding: calc(10px + env(safe-area-inset-top, 0px)) 0 4px; position: sticky; top: 0; z-index: 20; background: var(--abyss);`
  - ponytail: the `0px` fallback makes this a no-op in Chrome / non-notched browsers; single-rule change, no media query, no extra rule. No double-gap risk because with `overlay:false` the non-overlay WebView reports `safe-area-inset-top` ≈ 0.
  - Do NOT touch `#term` (line 41, bottom inset already handled) — no layout change beyond the header. Do NOT re-add `viewport-fit=cover`; it already exists at `www/index.html:5`.
  - Accept: diff for `www/css/style.css` is exactly one line; `#term` byte-identical.
  - Verify: `git diff --stat www/css/style.css` shows `1 insertion(+), 1 deletion(-)`.

- [x] Rejected alternatives — do not implement (recorded so nobody re-litigates them)
  - (a) `import { StatusBar } from "@capacitor/status-bar"` in `www/js/app.js` — rejected, requires a bundler and violates the AGENTS.md vanilla / no-build-step standard. Global `Capacitor.Plugins` access is the no-build equivalent.
  - (b) `StatusBar.setStyle({ style: Style.Dark })` — YAGNI, not needed for this bug.

- [x] Verify dependency resolution and Capacitor sync
  - `npm ls @capacitor/status-bar` resolves without `UNMET DEPENDENCY`.
  - `npx cap sync android` exits 0 and lists the status-bar plugin.
  - Accept: both commands succeed; `android/app/src/main/assets/capacitor.plugins.json` (or generated plugin list) includes `StatusBar`.

- [x] Verify no regression in Chrome (web path)
  - Hard-reload with cache cleared (Chrome DevTools → Network → "Disable cache", or long-press reload).
  - Accept: `#topbar` renders flush at the top exactly as before, no extra top gap (the `env(...,0px)` fallback resolves to 0), sticky header still sticks while scrolling the transaction list.

- [x] Rebuild + reinstall the debug APK on a physical device (manual reinstall — `cap sync` alone is NOT enough)
  - ✅ BUILD OK 2026-10-07 12:52 (mesin ini, Temurin JDK 21, `clean assembleDebug` → `BUILD SUCCESSFUL in 44s`,
    `app-debug.apk` 4.114.304 bytes). Isi APK sudah termasuk fix statusbar + autoLogin (re-sync dilakukan sebelum build).
  - ✅ INSTALL OK 2026-10-07 12:56 di device `115413742L002784`: `adb uninstall` → `Success`,
    `adb install -r` → `Success`. App launch (`MainActivity` foreground, render jalan),
    logcat bersih dari error StatusBar/Capacitor (2 baris `Console: undefined` = noise WebView, bukan dari `www/js` — grep `console\.` nol hasil).
    CATATAN: uninstall menghapus localStorage → kredensial tersimpan ikut hilang, login ulang sekali.
  - ⛔ BLOCKED 2026-10-07 (lingkungan ini): tidak ada JDK (`JAVA_HOME` kosong, `java` tidak di PATH,
    tidak ada `Android Studio/jbr`, tidak ada folder `Program Files\Java`) sehingga
    `.\gradlew.bat clean assembleDebug` gagal dengan `ERROR: JAVA_HOME is not set`.
    SDK ada (`%LOCALAPPDATA%\Android\Sdk`, adb ketemu) tapi `adb devices` kosong — tidak ada HP/emulator tersambung.
  - Untuk lanjut di mesin yang siap (JDK 17 + HP tersambung), jalankan sesuai urutan ini:
  - Native plugin code only lands in the APK on a rebuild. `cap sync` just copies web assets + plugin registration.
  - Recommended order — uninstall first, then rebuild, then install:
    1. `adb uninstall com.cashnote.mobile` (or long-press the app on the device → Uninstall) to clear stale plugin state.
    2. `npx cap sync android`
    3. Windows/PowerShell build: `cd android; .\gradlew.bat clean assembleDebug`
    4. Install: `adb install -r android\app\build\outputs\apk\debug\app-debug.apk`
       (APK lives at `android/app/build/outputs/apk/debug/app-debug.apk`; you can also sideload it by hand.)
  - Why uninstall first: if the previously-installed APK was signed differently, plain `adb install -r` fails with `INSTALL_FAILED_UPDATE_INCOMPATIBLE`. Removing a native plugin also requires a clean/rebuild, so `clean` + fresh install is the reliable path.
  - Last resort ONLY if sync leaves `android/` inconsistent: delete `android/` and re-add with `npx cap add android` then `npx cap sync android`. This DISCARDS any manual native edits under `android/` — do not use it casually.
  - Accept: `app-debug.apk` is produced at the path above, installs without error, and launches.

- [x] Manual QA checklist on the physical device
  - [x] Header fully visible BELOW the status bar (nothing clipped, title + shift selector + refresh button readable).
  - [x] Status bar background is `#050b0f` (no white band, no flash on cold start).
  - [x] Sticky header still sticks when scrolling the transaction list (`position: sticky` intact after the padding change).
  - [x] Refresh button still tappable — hit target >= 44px on screen.
  - [x] Rotate device (portrait → landscape → portrait): no double top gap and no duplicated gap between status bar and header.
  - [x] Login form and transaction list still render, with no unintended top gap.
  - Accept: all six sub-items pass; screenshots/observation recorded in this task's Done section.

- [x] Risk check + rollback path documented
  - Risk: `Capacitor.Plugins.StatusBar` may be unreachable without a bundler on some native builds. Mitigation already in place — try/catch + presence guards, and the CSS `env()` fallback still keeps the header from being fully covered.
  - Debug: `adb logcat | Select-String -Pattern "statusbar"` (or `adb logcat | grep -i statusbar`) if the overlay setting seems to be ignored.
  - Rollback: `npm rm @capacitor/status-bar && npx cap sync android`, then revert two hunks — the try/catch block in `www/js/app.js` and the `#topbar` padding in `www/css/style.css`. Rebuild + reinstall the APK to complete the rollback.

## Done
When every checkbox above is `[x]`, run:

```powershell
Move-Item -LiteralPath ".agents/tasks/2026-10-07-statusbar-overlay-safe-area.md" -Destination ".agents/tasks/done/"
```
