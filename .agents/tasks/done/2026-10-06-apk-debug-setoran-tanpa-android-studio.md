# APK debug Setoran-only tanpa Android Studio (JDK + SDK cmdline-tools)

> Source: Setoran sudah jalan sebagai web murni di `www/` (localStorage + `fetch` GAS https, tanpa plugin native) tapi belum bisa di-build. Plan: wrap `www/` dengan Capacitor 7 dan build `assembleDebug` lewat Gradle CLI — GUI Android Studio di-skip, cukup JDK 21 + Android SDK command-line tools + ADB.
> Keputusan: `appId com.cashnote.mobile`, `appName cnmobile`, `seed_laku.js` DIPERTAHANKAN (GAS hanya return 5 hari terakhir, seed = histori periode 28–27), install via ADB USB debugging.

## Tasks

- [x] Install JDK 21 dan set `JAVA_HOME` ( Capacitor 7 butuh JDK 21, bukan 17)
  - DONE 2026-10-06: winget MSI macet (msiexec session-0 tak bisa di-kill) → pakai ZIP portable `OpenJDK21U-jdk_x64_windows_hotspot_21.0.12.1_1.zip` di `%LOCALAPPDATA%\Java\jdk-21.0.12.1+1`; `JAVA_HOME` user-env + `%JAVA_HOME%\bin` PATH sudah diset; `java -version` = 21.0.12.1. Terminal baru otomatis dapat env ini.
  - details: `winget install --id EclipseAdoptium.Temurin.21.JDK -e`. Lalu set user env `JAVA_HOME` = path `...\Microsoft\jdk-21.*` (cek via `Get-ChildItem 'C:\Program Files\Eclipse Adoptium'`), tambah `%JAVA_HOME%\bin` + `%JAVA_HOME%\bin` PATH. Tutup-buka terminal setelah set env.
  - related files: (env Windows saja, tidak ada file repo)
  - verification: `java -version` → `openjdk version "21...`; `echo $env:JAVA_HOME` tidak kosong. Kalau `java` masih tidakKetemu: PATH belum ter-refresh, buka terminal baru.
  - Fallback: kalau install JDK 21 gagal (keblokir policy), turunkan Capacitor ke `^6.0.0` (Cap 6 = JDK 17) — JANGAN patch `capacitor.build.gradle` manual, file itu di-overwrite tiap `cap sync`.

- [x] Pasang Android SDK command-line tools (tanpa Android Studio)
  - DONE 2026-10-06: `commandlinetools-win-13114758_latest.zip` → `%LOCALAPPDATA%\Android\Sdk\cmdline-tools\latest`; `ANDROID_HOME`+`ANDROID_SDK_ROOT` user-env + PATH; `sdkmanager --version` = 19.0.
  - details: unduh `commandlinetools-win-*_latest.zip` dari halaman resmi command-line tools, extract ke `%LOCALAPPDATA%\Android\Sdk\cmdline-tools\latest` (WAJIB nama folder `latest`, isi zip langsung di dalamnya, bukan nested `cmdline-tools`). Set user env `ANDROID_HOME` dan `ANDROID_SDK_ROOT` = `%LOCALAPPDATA%\Android\Sdk`, tambah PATH: `%ANDROID_HOME%\platform-tools` dan `%ANDROID_HOME%\cmdline-tools\latest\bin`.
  - related files: (env Windows + `%LOCALAPPDATA%\Android\Sdk` di luar repo)
  - verification: `Test-Path "$env:ANDROID_HOME\cmdline-tools\latest\bin\sdkmanager.bat"` = True; `sdkmanager --version` keluar nomor (tidak "command not found").
  - Catatan: butuh ~2–3 GB unduhan + ruang disk. Butuh restart terminal agar env baru terbaca.

- [x] Terima lisensi SDK + pasang paket yang dipakai Capacitor 7
  - DONE 2026-10-06: licenses accepted; terpasang `build-tools;35.0.0`, `platform-tools 37.0.1` (`adb version` OK), `platforms;android-35`.
  - details: `sdkmanager --licenses` (jawab `y` semua), lalu `sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"`. Cap 7 memakai `compileSdk`/`targetSdk` 35, `minSdk` 23.
  - related files: (Android SDK di luar repo)
  - verification: `sdkmanager --list_installed` memuat `platform-tools`, `platforms;android-35`, `build-tools;35.0.0`; `adb version` keluar.
  - Kalau build nanti complains `Failed to find target with hash string 'android-35'`, Meaning paket belum terpasang — ulangi `sdkmanager "platforms;android-35"`.

- [x] Buat `package.json` minimal (3 dependensi Capacitor, tanpa plugin)
  - DONE 2026-10-06: Cap `7.6.9` seragam (`core/cli/android`); `typescript` sempat dipasang lalu dilepas lagi (tak terpakai, lihat task config).
  - details: `private: true`, tanpa `scripts` build web (web-nya plain `www/`, no bundler). `devDependencies`: `@capacitor/cli@^7`, `@capacitor/core@^7`, `@capacitor/android@^7` — semua major sama. TIDAK pasang `@capacitor-community/sqlite` (Setoran pakai `localStorage`, bukan SQLite) sampai Live/LAN masuk scope.
  - related files: `package.json` (baru)
  - verification: `npm ls @capacitor/core @capacitor/cli @capacitor/android` → semua `^7.x` tanpa `UNMET DEPENDENCY`; `npm pkg get devDependencies`.

- [x] Buat `capacitor.config.ts` (appId/appName/webDir)
  - DONE 2026-10-06: jadi `capacitor.config.js` (CommonJS), bukan `.ts` — CLI 7.6.9 TS-loader rusak di Node 24 (`reading 'CommonJS'`). Isi sama: `com.cashnote.mobile` / `cnmobile` / `www`, tanpa cleartext.
  - details: `import type { CapacitorConfig } from '@capacitor/cli';` lalu `const config: CapacitorConfig = { appId: "com.cashnote.mobile", appName: "cnmobile", webDir: "www" }; export default config;`. JANGAN set `server.cleartext` (GAS sudah https, tidak perlu cleartext traffic). Tidak ada `plugins` section.
  - related files: `capacitor.config.ts` (baru)
  - verification: `npx cap config` atau `npx cap doctor` membaca `webDir: www` dan `appId com.cashnote.mobile` tanpa error parse TS.

- [x] `npm install` lalu `npx cap add android`
  - DONE 2026-10-06: `[success] android platform added!`; `android/app/src/main/assets/public/index.html` + `android/variables.gradle` ada.
  - details: `npm install`, lalu `npx cap add android`. Perintah ini menyalin `www/` ke `android/app/src/main/assets/public/` dan membuat project Gradle.
  - related files: `package-lock.json`, `node_modules/` (di-ignore), `android/` (baru, dicommit)
  - verification: `Test-Path "android\app\src\main\assets\public\index.html"` = True; `Test-Path "android\variables.gradle"` = True.
  - Kalau `cap add` gagal soal Java/JDK, ulangi setelah task 1 benar-benar hijau (`npx cap add android` butuh JDK).

- [x] `npx cap sync android` dan pastikan asset ikut
  - DONE 2026-10-06: `Sync finished`; `www`=9 file, `assets/public`=11 file — selisih hanya `cordova.js`+`cordova_plugins.js` (shim bawaan Capacitor). Tak ada file `www/` yang hilang.
  - details: `npx cap sync android`. Output harus menyalin `www/` (index.html, css/, fonts/, js/) ke `android/app/src/main/assets/public/`. Jalankan ulang setiap kali isi `www/` berubah.
  - related files: `android/app/src/main/assets/public/` (generated, ikut commit)
  - verification: bandingkan jumlah file — `(Get-ChildItem www -Recurse -File).Count` == `(Get-ChildItem android\app\src\main\assets\public -Recurse -File).Count`; `npx cap sync android` exited 0 tanpa error plugin.

- [x] Build APK debug via Gradle CLI
  - DONE 2026-10-06: `BUILD SUCCESSFUL in 5m 47s` (85 tasks); `android/app/build/outputs/apk/debug/app-debug.apk` 4 MB. Build dijalankan background via `build.log` karena unduhan Gradle pertama melebihi timeout tool. `git status` tetap bersih dari `android/app/build/`.
  - details: dari folder `android/`: `.\gradlew.bat assembleDebug`. Butuh network sekali untuk unduh Gradle distribution + dependensi.butuh `JAVA_HOME` hidup.
  - related files: `android/app/build/outputs/apk/debug/app-debug.apk` (output, TIDAK dicommit — sudah ada di `.gitignore` `android/app/build/`)
  - verification: `Test-Path "android\app\build\outputs\apk\debug\app-debug.apk"` = True; `BUILD SUCCESSFUL` di log; `git status --short` tidak memuat `android/app/build/`.
  - Kalau `SDK location not found`: set `ANDROID_HOME` atau buat `android/local.properties` berisi `sdk.dir=<path SDK>` (file ini jangan dicommit — masukkan ke `.gitignore` bila belum ada).

- [x] Pasang APK ke HP via ADB (USB debugging)
  - DONE 2026-10-06 (manual user): `adb devices` → `115413742L002784 device`; `adb install` → `Success`; `pm list` → `package:com.cashnote.mobile`; monkey launch OK; app jalan. (Noise `SecurityException user 999` diabaikan — dual-profile.)
- [x] Verifikasi alur Setoran di HP (fungsi, bukan build)
  - DONE 2026-10-06: user konfirmasi semua 6 langkah lolos di device.
  - details: HP: Settings → About phone → tap 7x Build number → Settings → Developer options → USB debugging ON; colok USB, pilih mode "File transfer", accept prompt "Allow USB debugging" di layar HP. Di PC: `adb devices` (status harus `device`, bukan `unauthorized`/`offline`), lalu `adb install -r android\app\build\outputs\apk\debug\app-debug.apk`.
  - related files: (tidak ada file repo; `android/local.properties` sudah dipakai)
  - verification: `adb shell pm list packages | Select-String com.cashnote.mobile` → `package:com.cashnote.mobile`; launcher HP memunculkan app `cnmobile`.
  - Kalau `unauthorized`: cabot-colok ulang + accept dialog di HP. Kalau install ditolak "INSTALL_FAILED_UPDATE_INCOMPATIBLE", uninstall lama dulu: `adb uninstall com.cashnote.mobile`.

- [ ] Verifikasi alur Setoran di HP (fungsi, bukan build)
  - details: cek 6 hal di device, satu per satu: (1) app buka ke view `[setoran]`, form login tampil; (2) login GAS benar → daftar transaksi + ringkasan `tx/kurang/lebih` tampil, label periode `YYYY-MM` benar (periode 28–27); (3) `[masuk]` dengan password salah → pesan error, tidak crash; (4) tombol `↻` → status jadi `[OK <jam>]`; (5) airplane mode → daftar tetap tampil dari cache + banner offline dengan `[coba lagi]`, lalu `[coba lagi]` mengembalikan `[OK]`; (6) tutup lalu buka ulang app → data cache + histori seed masih ada (tidak hilang saat restart).
  - related files: `www/index.html`, `www/js/setoran.js`, `www/js/conflict.js`, `www/js/seed_laku.js`
  - verification: 6 langkah lolos manual di device; `adb logcat -d | Select-String "Capacitor/Console"` tidak menunjukkan error fatal.
  - Debug cepat tanpa build ulang: `adb shell input text`/DevTools remote tidak diperlukan — cukup `npx cap sync android` + build ulang bila ada ubahan `www/`.

- [x] Tandai seed_laku.js sebagai aset produksi, bukan utang
  - DONE 2026-10-06: header `www/js/seed_laku.js` ditulis ulang (aset produksi + alasan GAS 5 hari); task lama `2026-10-05` tidak memuat instruksi hapus seed → tak diubah.
  - details: keputusan user kali ini membatalkan utang "hapus sebelum M4/APK" di `www/js/seed_laku.js` dan di `.agents/tasks/2026-10-05-setoran-mirror-kasir-tab.md`. Update komentar header `seed_laku.js` (sekarang menyatakan "utang: hapus sebelum M4/APK") menjadi alasannya dipertahankan: GAS hanya return 5 hari, seed menyimpan histori periode 28–27. Ubah juga baris "Accepted debt" di task lama agar tidak menyuruh hapus seed.
  - related files: `www/js/seed_laku.js`, `.agents/tasks/2026-10-05-setoran-mirror-kasir-tab.md`
  - verification: `Select-String -Path www\js\seed_laku.js -Pattern "hapus sebelum"` tidak ada hasil; Select-String task lama likewise.

- [x] Commit scaffolding (`package.json`, config, `android/`)
  - DONE 2026-10-06: `c750a73 feat: capacitor wrapper + APK debug setoran-only (tanpa android studio)` — 65 file (`package.json`, `package-lock.json`, `capacitor.config.js`, `www/`, `android/`). `android/app/build/` + `.gradle/` tidak ikut (ignored, verified). `AGENTS.md`/`docs/PRD.md` (edit user) + `.agents/` sengaja tidak di-stage.
  - details: stage `package.json`, `package-lock.json`, `capacitor.config.ts`, `android/` (kecuali folder build), `www/` bila berubah. JANGAKAN stage `node_modules/`, `android/app/build/`, `android/.gradle/`, `android/local.properties`, `android/app/src/main/assets/public/` kalau deemed generated — tapi PRD §3 bilang `android/` dicommit, jadi asset hasil `cap sync` ikut ya (bezanya cuma file sumber).
  - related files: `.gitignore`, `docs/PRD.md` §3
  - verification: `git status --short` bersih setelah commit; `git ls-files android | Select-String "build/"` kosong (tidak ada path build yang ter-track).
  - Pesan commit mengikuti gaya repo (`git log --oneline -10`).

## Non-tujuan (jangan dikerjakan di task ini)
- `www/js/lan.js`, `www/js/sync.js`, `www/js/live.js` — view Live & Print tetap stub "segera (M2)".
- `@capacitor-community/sqlite` + skema `store.js` — Setoran cukup `localStorage`.
- Pairing/QR, `GET /api/outbox`, `POST /api/print` — butuh `../CNdesktop` LAN.
- `manifest.webmanifest`, `sw.js`, `www/icons/` — tidak perlu untuk APK native (PWA fallback).
- Release build, signing keystore, Play Store, versioning/`buildNumber` pertama.
- Ikon launcher custom — default Capacitor dulu, ganti setelah app terbukti dipakai.

## Done
When every checkbox is `[x]`, run:
`Move-Item -LiteralPath ".agents/tasks/2026-10-06-apk-debug-setoran-tanpa-android-studio.md" -Destination ".agents/tasks/done/"`
