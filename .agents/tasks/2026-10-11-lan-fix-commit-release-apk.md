# LAN Fix → Commit → Release APK (Failed to fetch http://192.168.1.8:8765)
> Source: Tes Chrome HP ke /api/health ok:true membuktikan network/firewall/IP sehat; gagal hanya fetch dari APK. Plan: prompt CORS untuk CNdesktop, 1 baris cleartext di mobile + build, lalu commit + GitHub Release APK debug untuk download dari HP.
## Tasks
- [x] Tulis ulang CNdesktop/.agents/prompt.md dengan prompt CORS (hapus isi lama)
  - File: `D:\Desktop\projects\CNdesktop\.agents\prompt.md` (diganti penuh, backup tidak perlu karena isi lama sudah usang)
  - Isi baru memuat: gejala + vonis (tanpa header CORS/OPTIONS), kontrak tetap (0.0.0.0:8765, §6 tanpa auth, tanpa dep baru), 5 permintaan (header _send, do_OPTIONS 204, assert test, curl verify, restart)
  - Verifikasi: `Read` file → judul `# FIX: APK Failed to fetch` + frasa `Access-Control-Allow-Origin` ada
- [ ] Jalankan prompt di sesi CNdesktop dan dapatkan konfirmasi restart
  - Dikerjakan di repo CNdesktop (bukan repo ini, yang di sini READ-ONLY terhadap sibling)
  - Verifikasi: `curl -i -H "Origin: capacitor://localhost" http://127.0.0.1:8765/api/health` balas header `Access-Control-Allow-Origin: *`
  - Verifikasi: `pytest` di CNdesktop hijau (termasuk assert CORS + OPTIONS 204 baru)
- [ ] Konfirmasi GATE: CNdesktop sudah restart dengan CORS sebelum lanjut
  - Kriteria gate: agen/user CNdesktop jawab "restart, header CORS ada"
  - Tanpa gate ini Fase B/C dilarang lanjut (APK baru pun tetap Failed to fetch)
- [x] Tambah usesCleartextTraffic di AndroidManifest.xml
  - File: `android/app/src/main/AndroidManifest.xml`, tambah `android:usesCleartextTraffic="true"` di tag `<application>`
  - Verifikasi: `grep usesCleartextTraffic android/app/src/main/AndroidManifest.xml` tampil 1 baris
- [x] Sinkron web ke native via cap sync
  - Perintah: `npx cap sync android` dari root repo
  - Verifikasi: output sync sukses tanpa error, `android/app/src/main/assets/public` (atau `res`) ter-update tanggalnya
- [ ] Verifikasi M2 lawan PC asli: [buka] drain transaksi nyata
  - APK terinstall di HP, WiFi sama, isi `http://192.168.1.8:8765` → `[buka]`
  - Kriteria: status `[BUKA·ok]`, transaksi kasir nyata tampil ≤4 dtk (poll 2 dtk + drain)
- [ ] Verifikasi M2: putus + retry tanpa dobel
  - Matikan CNdesktop → kriteria: `[PUTUS]` + banner `belum lengkap` + sesi tetap buka
  - Hidupkan lagi → `[coba lagi]` → kriteria: data kurang masuk, jumlah tidak dobel (`since` = `last_seen`)
- [x] Bump versionCode 1→2 di build.gradle
  - File: `android/app/build.gradle` baris `versionCode 1` → `versionCode 2` (`versionName` tetap `1.0`)
  - Verifikasi: `grep versionCode android/app/build.gradle` tampil `versionCode 2`
- [x] Review dan stage file kerja yang kotor
  - Perintah: `git status --short` lalu `git diff --stat` untuk review 12 entri kotor saat ini
  - Stage hanya file kerja (termasuk untracked `www/js/*.js`, `docs/TEST-CHECKLIST.md` bila diputuskan perlu); draft `.agents/` tidak ikut commit
  - Verifikasi: `git status --short` hanya tampil file yang disengaja
- [x] Buat commit rilis
  - Pesan: `fix: lan cleartext + rilis APK debug v1.0(2)`
  - Verifikasi: `git log --oneline -3` tampil commit baru di paling atas, `git show --stat HEAD` hanya file disengaja
- [x] Build APK debug dan pastikan file keluar
  - Perintah: `.\gradlew.bat assembleDebug` dengan workdir `android/`
  - Verifikasi: `Test-Path android/app/build/outputs/apk/debug/app-debug.apk` = True (abaikan warning, 0 error)
- [x] Push commit + tag v1.0.1 ke origin
  - Perintah: `git tag v1.0.1` lalu `git push origin main v1.0.1` (nama branch menyesuaikan hasil `git branch --show-current`)
  - Verifikasi: `git ls-remote --tags origin` memuat `v1.0.1`
- [x] Buat GitHub Release berisi APK dan ambil URL download
  - Perintah: `gh release create v1.0.1 android/app/build/outputs/apk/debug/app-debug.apk --title "v1.0.1 (LAN fix)" --notes "Satu WiFi dengan PC. Perlu CNdesktop sudah restart (CORS). Aktifkan install aplikasi tak dikenal."`
  - Verifikasi: `gh release view v1.0.1` tampil asset `app-debug.apk`
  - Kriteria selesai: URL release terkirim ke user untuk download dari HP
## Done
When every checkbox is `[x]`, run:
`Move-Item -LiteralPath ".agents/tasks/2026-10-11-lan-fix-commit-release-apk.md" -Destination ".agents/tasks/done/"`
