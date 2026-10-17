# Rilis CNmobile v1.3.0 — Isian Manual HILANG + Log Viewer + Badge Status
> Source: Plan rilis v1.3.0 dari baseline v1.2.3 (commit f70b0d7, versionCode 11) untuk merakit working tree yang sudah ada.
> Working tree mencakup isian MANUAL via Store/fillRow, log viewer PC via Lan/settings, badge set-status, fix glow MainActivity, dan rapihan CSS print/settings.
> Target akhir APK debug v1.3.0(12) + gh release v1.3.0 dengan verifikasi penuh sebelum push.
## Tasks
- [ ] Phase 1 Betulkan bug editing state agar ganti sesi selalu reset, diterima bila tidak ada path ganti sesi tanpa reset
  - [ ] Tambahkan reset editingTid=null + editingFill=null di openSession di www/js/live.js, diterima bila kedua reset ada di fungsi openSession, verifikasi dengan `node --check www/js/live.js`
  - [ ] Tambahkan reset editingTid=null + editingFill=null di closeCurrent di www/js/live.js, diterima bila kedua reset ada di fungsi closeCurrent, verifikasi dengan `Select-String -Path www/js/live.js -Pattern "editingTid=null"`
  - [ ] Tambahkan reset editingTid=null + editingFill=null di reopenSession di www/js/live.js, diterima bila kedua reset ada di fungsi reopenSession, verifikasi dengan `Select-String -Path www/js/live.js -Pattern "editingFill=null"`
  - [ ] Verifikasi tidak ada path ganti sesi tanpa reset di www/js/live.js, diterima bila grep menemukan reset di ketiga fungsi openSession closeCurrent reopenSession, verifikasi dengan `Select-String -Path www/js/live.js -Pattern "editingTid=null.*editingFill=null|editingFill=null.*editingTid=null"`
- [ ] Phase 2 Tambahkan seksi M5 di checklist uji, diterima bila seksi ## M5 ada dan mencakup 3 skenario
  - [ ] Tulis skenario isian HILANG jadi MANUAL + totals/banner/struk ikut di docs/TEST-CHECKLIST.md, diterima bila ## M5 memuat langkah isian MANUAL dan totals/struk, verifikasi dengan `Select-String -Path docs/TEST-CHECKLIST.md -Pattern "^## M5"`
  - [ ] Tulis skenario log viewer PIN salah vs benar di docs/TEST-CHECKLIST.md, diterima bila ## M5 memuat langkah PIN salah ditolak dan PIN benar tampil log, verifikasi dengan `Select-String -Path docs/TEST-CHECKLIST.md -Pattern "M5"`
  - [ ] Tulis skenario badge OK/PUTUS di docs/TEST-CHECKLIST.md, diterima bila ## M5 memuat langkah badge set-status OK dan PUTUS, verifikasi dengan `Get-Content docs/TEST-CHECKLIST.md | Select-String "M5|badge|set-status"`
- [ ] Phase 3 Verifikasi konsistensi JS dan ID HTML/JS, diterima bila node --check lolos dan ID baru ada serta ID lama nol hit
  - [ ] Jalankan node --check untuk semua file di www/js/*.js, diterima bila semua file lolos tanpa SyntaxError, verifikasi dengan `node --check www/js/live.js; node --check www/js/print.js; node --check www/js/settings.js`
  - [ ] Verifikasi ID baru ada di www/index.html dan www/js/live.js, diterima bila set-status set-status-info set-status-badge set-msg set-log-pin btn-log-peek btn-log-load log-pre btn-wipe data-isi data-fill data-hkey masing-masing ada hit, verifikasi dengan `Select-String -Path www/index.html,www/js/live.js -Pattern "set-status|log-pre|data-fill"`
  - [ ] Verifikasi ID lama nol hit di www/index.html dan www/js/*.js, diterima bila set-pc watch-msg wipe-msg set-actions masing-masing nol hit, verifikasi dengan `Select-String -Path www/index.html,www/js/*.js -Pattern "set-pc|watch-msg|wipe-msg|set-actions"`
- [ ] Phase 4 Naikkan versi dan rakit APK debug, diterima bila APK terbuat dari versionCode 12 versionName 1.3.0 dan lolos verifikasi kunci
  - [ ] Naikkan versionCode 11 ke 12 dan versionName 1.2.3 ke 1.3.0 di android/app/build.gradle, diterima bila kedua nilai baru tertulis di file, verifikasi dengan `Select-String -Path android/app/build.gradle -Pattern "versionCode 12|versionName .1.3.0"`
  - [ ] Jalankan sync dan rakit APK debug dari android/app/build.gradle, diterima bila APK debug terbuat tanpa error gradle, verifikasi dengan `npx cap sync android; .\android\gradlew.bat assembleDebug`
  - [ ] Verifikasi ukuran dan tanda tangan APK di android/app/build/outputs/apk/debug/*.apk, diterima bila ukuran tampil dan apksigner cocok kunci d21bdf8be493bee460b3255a34299e9addd98670565cbac5948264195bdeffa1, verifikasi dengan `Get-Item android/app/build/outputs/apk/debug/*.apk; apksigner verify --print-certs android/app/build/outputs/apk/debug/app-debug.apk`
- [ ] Phase 5 Publikasikan rilis v1.3.0 ke origin dan GitHub, diterima bila commit-push-release terverifikasi dan working tree bersih
  - [ ] Commit semua path berubah tanpa .agents dengan pesan rilis di repo D:/Desktop/projects/CNmobile, diterima bila git log teratas memuat pesan feat isian manual HILANG + log viewer + badge status rilis APK debug v1.3.0(12), verifikasi dengan `git status --short; git log --oneline -3`
  - [ ] Dorong commit ke origin main di repo D:/Desktop/projects/CNmobile, diterima bila origin/main sejajar dengan HEAD lokal, verifikasi dengan `git push origin main; git status -sb`
  - [ ] Buat GitHub release v1.3.0 beserta APK dan notes di repo D:/Desktop/projects/CNmobile, diterima bila release v1.3.0 ada dengan APK terunggah notes fitur dan update di atas versi lama serta unduhan penuh, verifikasi dengan `gh release view v1.3.0 --json tagName,assets`
  - [ ] Verifikasi akhir release dan kebersihan tree di repo D:/Desktop/projects/CNmobile, diterima bila gh release view v1.3.0 sukses dan git status bersih, verifikasi dengan `gh release view v1.3.0; git status --short`
- [ ] Keputusan Pertahankan kode mati yang disengaja, diterima bila tidak ada penghapusan atau refactor di luar plan
  - [ ] Biarkan portSet/pinSet/shutdown apa adanya di www/js/lan.js, diterima bila ketiga simbol tetap ada tanpa dihapus atau dipanggil baru, verifikasi dengan `Select-String -Path www/js/lan.js -Pattern "portSet|pinSet|shutdown"`
  - [ ] Biarkan activity_main.xml mati apa adanya dengan fix glow/scrollbar tetap di android/app/src/main/java/.../MainActivity.java, diterima bila layout tidak diubah dan MainActivity tetap memuat fix glow/scrollbar, verifikasi dengan `git diff --stat android/app/src/main/res/layout/activity_main.xml; Select-String -Path android/app/src/main/java -Pattern "glow|scrollbar|overScroll"`
## Done
When every checkbox is `[x]`, run:
`Move-Item -LiteralPath ".agents/tasks/2026-10-16-rilis-v1_3_0-fill-log.md" -Destination ".agents/tasks/done/"`
