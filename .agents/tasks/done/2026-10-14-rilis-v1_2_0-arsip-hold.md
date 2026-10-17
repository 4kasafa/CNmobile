# Rilis v1.2.0 Arsip Hold
> Source: Baseline v1.1.0 (a4a1220) + working tree arsip akumulasi cn_setoran_archive, merge tanpa purge, hold-to-reveal 900ms.
> Plan 6 phase: fetch-verifikasi, M4 checklist, bump 7->8/1.1.0->1.2.0, build APK, commit 11 path + release, verifikasi akhir.
## Tasks
- [ ] Fetch tags dan verifikasi working tree siap rilis v1.2.0 tanpa error sintaks
  - [ ] Jalankan git fetch tags hingga tag remote sinkron di repo `D:\Desktop\projects\CNmobile` dengan acceptance `git tag --list` memuat baseline, verifikasi dengan `git fetch --tags; git tag --list | Select-Object -Last 10`
  - [ ] Cek sintaks 7 file JS hingga lolos tanpa error di path `www/js/setoran.js`, `www/js/conflict.js`, `www/js/print.js`, `www/js/live.js`, `www/js/store.js`, `www/js/gas.js`, `www/js/app.js` dengan acceptance nol error, verifikasi dengan `foreach ($f in Get-ChildItem www/js/*.js) { node --check $f.FullName }`
  - [ ] Verifikasi ID HTML dan hapus seed_laku hingga `val-arsip`/`btn-pass-peek`/`btn-login-close` ada dan nol referensi di path `www/index.html` dengan acceptance 3 ID ditemukan + 0 hit seed_laku, verifikasi dengan `Select-String -Pattern "val-arsip|btn-pass-peek|btn-login-close" www/index.html; Select-String -Pattern "seed_laku" www/`
- [ ] Tambah M4 singkat di checklist hingga migrasi arsip dan hold teruji manual
  - [ ] Tambahkan seksi M4 arsip-hold hingga memuat migrasi arsip, tx vs arsip, hold-to-reveal di path `docs/TEST-CHECKLIST.md` dengan acceptance seksi M4 ada dan README tidak diubah, verifikasi dengan `Select-String -Pattern "^## M4" docs/TEST-CHECKLIST.md; git status --short README.md`
  - [ ] Verifikasi isi M4 hingga 3 frasa kunci terbaca di path `docs/TEST-CHECKLIST.md` dengan acceptance frasa migrasi/tx-vs-arsip/hold-to-reveal ada, verifikasi dengan `Select-String -Pattern "migrasi arsip|tx vs arsip|hold-to-reveal" docs/TEST-CHECKLIST.md`
- [ ] Bump versi Android hingga code 8 dan name 1.2.0 siap build
  - [ ] Ubah versionCode 7 ke 8 hingga rilis terbedakan di path `android/app/build.gradle` dengan acceptance grep tampil 8, verifikasi dengan `Select-String -Pattern "versionCode 8" android/app/build.gradle`
  - [ ] Ubah versionName 1.1.0 ke 1.2.0 hingga label rilis benar di path `android/app/build.gradle` dengan acceptance grep tampil 1.2.0, verifikasi dengan `Select-String -Pattern 'versionName "1.2.0"' android/app/build.gradle`
- [ ] Build APK debug hingga file keluar dan tanda tangan kunci benar
  - [ ] Sinkronkan web ke native hingga aset terbaru di path `www/` ke `android/app/src/main/assets/public` dengan acceptance sync sukses tanpa error, verifikasi dengan `npx cap sync android`
  - [ ] Bangun APK debug hingga file keluar di path `android/app/build/outputs/apk/debug/app-debug.apk` dengan acceptance 0 error, verifikasi dengan `.\gradlew.bat assembleDebug` dengan workdir `android/`
  - [ ] Verifikasi ukuran dan tanda tangan hingga kunci d21bdf cocok di path `android/app/build/outputs/apk/debug/app-debug.apk` dengan acceptance ukuran tampil + signer d21bdf, verifikasi dengan `Get-Item android/app/build/outputs/apk/debug/app-debug.apk | Select-Object Length; apksigner verify --print-certs android/app/build/outputs/apk/debug/app-debug.apk`
- [ ] Commit 11 path dan rilis GitHub v1.2.0 hingga APK terunduh
  - [ ] Buat commit 11 path eksplisit tanpa .agents hingga hanya file disengaja di path `www/js/setoran.js`, `www/js/conflict.js`, `www/js/print.js`, `www/js/live.js`, `www/index.html`, `www/css/style.css`, `www/js/seed_laku.js`, `docs/TEST-CHECKLIST.md`, `android/app/build.gradle` plus sisa dari status dengan acceptance `.agents/` tidak ikut + README bersih, verifikasi dengan `git status --short; git show --stat HEAD`
  - [ ] Push commit dan tag v1.2.0 hingga remote sinkron di repo `D:\Desktop\projects\CNmobile` dengan acceptance tag tampil di ls-remote, verifikasi dengan `git push origin main v1.2.0; git ls-remote --tags origin | Select-String "v1.2.0"`
  - [ ] Buat GitHub release v1.2.0 berisi APK hingga notes arsip permanen di path `android/app/build/outputs/apk/debug/app-debug.apk` dengan acceptance notes memuat arsip permanen + jangan uninstall + satu WiFi, verifikasi dengan `gh release create v1.2.0 android/app/build/outputs/apk/debug/app-debug.apk --title "v1.2.0 (arsip-hold)" --notes "Arsip permanen per email. Jangan uninstall (arsip lokal hilang). Satu WiFi dengan PC."`
- [ ] Verifikasi akhir rilis hingga release tampil dan tree bersih
  - [ ] Lihat release v1.2.0 hingga aset APK tampil di repo `D:\Desktop\projects\CNmobile` dengan acceptance asset app-debug.apk ada, verifikasi dengan `gh release view v1.2.0`
  - [ ] Cek status akhir hingga hanya sisa disengaja di repo `D:\Desktop\projects\CNmobile` dengan acceptance tidak ada modified tak terduga selain `.agents/`, verifikasi dengan `git status --short; git log --oneline -3`
## Done
When every checkbox is `[x]`, run:
`Move-Item -LiteralPath ".agents/tasks/2026-10-14-rilis-v1_2_0-arsip-hold.md" -Destination ".agents/tasks/done/"`
