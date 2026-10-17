# BgSync Notif Dinamik Bersuara Sekali
> Source: Notifikasi BgSync saat ini silent (LOW, channel live_sync) dan statis di Capacitor 7 targetSdk 35 paket com.cashnote.mobile. Rencana pindah ke channel baru live_sync_v2 DEFAULT berbunyi sekali plus update teks totals dinamis dari live.js lalu rilis v1.5.1/code 17.
## Tasks
- [x] Update BgSyncService ke channel v2 bersuara sekali dengan update dinamis
  - [x] Buat channel live_sync_v2 IMPORTANCE_DEFAULT yang diterima berbunyi sekali saat pertama tampil di android/app/src/main/java/com/cashnote/mobile/BgSyncService.java dengan verifikasi `Select-String -LiteralPath "android/app/src/main/java/com/cashnote/mobile/BgSyncService.java" -Pattern "live_sync_v2"`
  - [x] Hapus channel lama live_sync dan aktifkan setOnlyAlertOnce true yang diterima update tidak bunyi ulang di android/app/src/main/java/com/cashnote/mobile/BgSyncService.java dengan verifikasi `Select-String -LiteralPath "android/app/src/main/java/com/cashnote/mobile/BgSyncService.java" -Pattern "deleteNotificationChannel|setOnlyAlertOnce\(true\)"`
  - [x] Tambah method update(String text) yang rebuild NOTIF_ID sama yang diterima teks notif berubah tanpa alert ulang di android/app/src/main/java/com/cashnote/mobile/BgSyncService.java dengan verifikasi `Select-String -LiteralPath "android/app/src/main/java/com/cashnote/mobile/BgSyncService.java" -Pattern "void update"`
- [x] Expose update notifikasi via plugin BgSync
  - [x] Tambah @PluginMethod update yang forward text ke service dan no-op aman saat service mati yang diterima JS bisa panggil tanpa crash di android/app/src/main/java/com/cashnote/mobile/BgSyncPlugin.java dengan verifikasi `Select-String -LiteralPath "android/app/src/main/java/com/cashnote/mobile/BgSyncPlugin.java" -Pattern "update"`
- [x] Kirim teks totals dinamis throttled dari live.js
  - [x] Panggil BgSync.update dengan teks dinamis N tx totals terakhir jam status yang diterima notif tampilkan totals terbaru reuse rupiah di www/js/live.js dengan verifikasi `node --check www/js/live.js`
  - [x] Throttle update hanya saat teks berubah dengan guard try/catch dan cek S.bg yang diterima polling tidak rusak dan failures silent di www/js/live.js dengan verifikasi `Select-String -LiteralPath "www/js/live.js" -Pattern "BgSync.update|lastSent"`
- [x] Bump versi rebuild sync dan rilis v1.5.1
  - [x] Bump package.json ke 1.5.1 yang diterima version tampil 1.5.1 di package.json dengan verifikasi `Select-String -LiteralPath "package.json" -Pattern '"version": "1.5.1"'`
  - [x] Bump android/app/build.gradle ke code 17 name 1.5.1 yang diterima versionCode versionName sinkron di android/app/build.gradle dengan verifikasi `Select-String -LiteralPath "android/app/build.gradle" -Pattern "versionCode 17"`
  - [x] Jalankan cap sync dan rebuild assembleDebug yang diterima APK debug terbentuk di android/app/build/outputs/apk/debug/app-debug.apk dengan verifikasi `npx cap sync android; ./gradlew -p android assembleDebug; Test-Path -LiteralPath "android/app/build/outputs/apk/debug/app-debug.apk"`
  - [x] Verifikasi merged manifest masih dataSync yang diterima service retained di android/app/build/intermediates/merged_manifest/debug/AndroidManifest.xml dengan verifikasi `Select-String -Path "android/app/build/intermediates/merged_manifest/debug/AndroidManifest.xml" -Pattern "dataSync"`
  - [x] Commit push dan buat rilis v1.5.1 dengan APK yang diterima gh release berisi APK debug di v1.5.1 dengan verifikasi `gh release view v1.5.1 --json tagName,assets` (+ rilis https://github.com/4kasafa/CNmobile/releases/tag/v1.5.1)
- [ ] Verifikasi manual perilaku notifikasi di device
  - [ ] Uji bg:on berbunyi sekali dan notif muncul yang diterima suara sekali teks awal tampil di device fisik terkait android/app/src/main/java/com/cashnote/mobile/BgSyncService.java dengan verifikasi `adb shell dumpsys notification | Select-String "live_sync_v2"`
  - [ ] Uji minimize update tanpa bunyi ulang dan tutup hapus notif yang diterima teks update saat tx baru dan hilang saat tutup terkait www/js/live.js dengan verifikasi `adb shell dumpsys notification | Select-String "live_sync_v2"`
## Done
When every checkbox is `[x]`, run:
`Move-Item -LiteralPath ".agents/tasks/2026-10-16-bgsync-notif-dinamik.md" -Destination ".agents/tasks/done/"`
