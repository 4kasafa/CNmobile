# Background Sync Live via Foreground Service

> Source: Opsi A disetujui — foreground service agar polling Live 2 detik tetap jalan saat minimize/layar mati.
> Plugin `@anuradev/capacitor-background-mode@^7.2.1` (cocok Capacitor 7, targetSdk 35). Tanpa service native baru; `lan.js`/`store.js` tidak disentuh.

## Tasks

- [x] Instal plugin background-mode Cap 7 dan pastikan service-nya valid untuk targetSdk 35
  - [x] Instal paket `@anuradev/capacitor-background-mode@^7.2.1` via npm — terima bila `package.json` memuat entri tersebut — file: `package.json` — verifikasi: `npm ls @anuradev/capacitor-background-mode`
  - [x] Sinkronkan plugin ke proyek Android via cap sync — terima bila plugin terdaftar di settings Gradle — file: `android/capacitor.settings.gradle` — verifikasi: `Select-String -Path "android/capacitor.settings.gradle" -Pattern "background-mode"`
  - [x] Periksa tipe foreground service bawaan plugin — terima bila nilai `foregroundServiceType` diketahui (catat untuk Task 2 bila hilang/tak cocok) — file: `node_modules/@anuradev/capacitor-background-mode/android/src/main/AndroidManifest.xml` — verifikasi: `Get-Content "node_modules/@anuradev/capacitor-background-mode/android/src/main/AndroidManifest.xml"`
- [x] Deklarasikan izin dan foreground service di manifest app
  - [x] Andalkan uses-permission bawaan plugin — `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_SPECIAL_USE`, `POST_NOTIFICATIONS`, `WAKE_LOCK`, `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` sudah di manifest plugin, merge otomatis, tanpa duplikasi di manifest app — file: `node_modules/@anuradev/capacitor-background-mode/android/src/main/AndroidManifest.xml` — verifikasi: `Select-String` pada manifest plugin menemukan semua izin (terbukti di output Get-Content Task 1)
  - [x] Override entri service TIDAK PERLU — plugin sudah deklarasi `foregroundServiceType="specialUse|microphone"` + `PROPERTY_SPECIAL_USE_FGS_SUBTYPE`, valid untuk targetSdk 35 (APK sideload, bukan Play Store) — file: `node_modules/@anuradev/capacitor-background-mode/android/src/main/AndroidManifest.xml` — verifikasi: output Get-Content Task 1
- [x] Tambahkan tombol toggle background di layar Live
  - [x] Sisipkan `button#btn-bg` berlabel `[bg:off]` di live-bar sebelah tombol `[buka]` — terima bila tombol tampil di layar Live dan default OFF — file: `www/index.html` — verifikasi: `Select-String -Path "www/index.html" -Pattern 'id="btn-bg"'`
- [x] Implementasikan enable/disable background mode dan izin runtime di live.js
  - [x] Implementasikan ON/OFF via `window.Capacitor.Plugins.BackgroundMode` (pola global ala StatusBar di `app.js:17`) dengan guard hanya saat sesi open dan auto-`disable()` di `closeCurrent()` — terima bila ON memunculkan notifikasi permanen dan OFF/`[tutup]` menghilangkannya — file: `www/js/live.js` — verifikasi: `Select-String -Path "www/js/live.js" -Pattern "BackgroundMode"`
  - [x] Simpan pilihan toggle di `localStorage cn_bg` dan aktifkan ulang di `resume()` bila tersimpan ON + sesi open — terima bila reload app mengembalikan status toggle — file: `www/js/live.js` — verifikasi: `Select-String -Path "www/js/live.js" -Pattern "cn_bg"`
  - [x] Minta izin notifikasi runtime sebelum enable dengan fallback toast tanpa crash bila ditolak — terima bila user yang menolak tetap memakai mode lama — file: `www/js/live.js` — verifikasi: `Select-String -Path "www/js/live.js" -Pattern "requestNotificationsPermission"`
  - [x] Lolos cek sintaks tanpa build step — terima bila tidak ada error sintaks — file: `www/js/live.js` — verifikasi: `node --check www/js/live.js`
- [ ] Uji background sync di HP toko hingga lolos semua skenario
  - [x] Build dan pasang APK debug — terima bila APK terpasang dan pairing + Live jalan seperti biasa — file: `android/app/build/outputs/apk/debug/app-debug.apk` — verifikasi: `Test-Path "android/app/build/outputs/apk/debug/app-debug.apk"` (+ rilis https://github.com/4kasafa/CNmobile/releases/tag/v1.4.0)
  - [ ] Uji minimize 5 menit dengan `[bg:on]` — terima bila notifikasi permanen tampil dan tx bertambah tanpa duplikat — file: — verifikasi: `adb shell dumpsys notification | Select-String "CNmobile"`
  - [ ] Uji layar mati 10 menit dan Doze paksa — terima bila status kembali `[BUKA·ok]` bukan `[PUTUS]` — file: — verifikasi: `adb shell dumpsys deviceidle force-idle`
  - [ ] Uji tutup sesi dan tolak izin — terima bila notifikasi hilang setelah `[tutup]` dan tolak izin tidak crash — file: — verifikasi: `adb shell dumpsys notification | Select-String "CNmobile"`

## Done

When every checkbox is `[x]`, run:
`Move-Item -LiteralPath ".agents/tasks/2026-10-16-background-sync-foreground-service.md" -Destination ".agents/tasks/done/"`
