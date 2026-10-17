# Hapus Total Arsip-Doctor Pasca-Pemulihan v1.2.3(11)
> Source: Baseline v1.2.2 (commit aeaef9e) data sudah pulih + backup JSON aman di luar HP; doctor hanya diagnostik dihapus total termasuk export/impor.
> Hardening diam dipertahankan (email lowercase, removeItem-setelah-sukses, normalisasi case); tanpa CSS doctor baru, reuse class yang ada.
## Tasks
- [ ] 1. Hapus section doctor di HTML hingga nol-sisa markup doctor
  - [ ] Hapus section#doctor 6 baris (doctor-line, btn-doctor-adopsi, btn-arch-export, btn-arch-import, file-arch-import, doctor-msg) di `www/index.html` hingga 0 hit tanpa sentuh hardening/CSS lain, verifikasi dengan `Select-String -Pattern "doctor|btn-doctor-adopsi|btn-arch-export|btn-arch-import|file-arch-import|doctor-msg" -Path www/index.html` harus $null
- [ ] 2. Hapus logika doctor di setoran.js hingga nol-sisa fungsi dan listener
  - [ ] Hapus 5 fungsi listBuckets/renderDoctor/adoptAll/exportArchive/importArchiveFile di `www/js/setoran.js` hingga definisi hilang dan hardening (lowercase email, removeItem-setelah-sukses, normalisasi case) utuh, verifikasi dengan `Select-String -Pattern "function listBuckets|function renderDoctor|function adoptAll|function exportArchive|function importArchiveFile" -Path www/js/setoran.js` harus $null
  - [ ] Hapus 1 panggilan renderDoctor() di renderAll() di `www/js/setoran.js` hingga renderAll jalan tanpa referensi doctor, verifikasi dengan `Select-String -Pattern "renderDoctor\(\)" -Path www/js/setoran.js` harus $null dan `node --check www/js/setoran.js` exit 0
  - [ ] Hapus 3 blok listener adopsi/export/import plus file-input di `www/js/setoran.js` hingga tidak ada getElementById/addEventListener sisa, verifikasi dengan `Select-String -Pattern "btn-doctor-adopsi|btn-arch-export|btn-arch-import|file-arch-import" -Path www/js/setoran.js` harus $null
- [ ] 3. Verifikasi nol-sisa doctor di seluruh www hingga siap rilis
  - [ ] Jalankan grep gabungan di `www/` hingga 0 hit doctor/adopsi/arch-export/arch-import/file-arch-import/listBuckets/renderDoctor/exportArchive/importArchive, verifikasi dengan `Select-String -Pattern "doctor|adopsi|arch-export|arch-import|file-arch-import|listBuckets|renderDoctor|exportArchive|importArchive" -Path www/* -Recurse` harus $null
  - [ ] Jalankan cek sintaks `www/js/setoran.js` hingga exit 0 dan diff hanya 2 file HTML+JS, verifikasi dengan `node --check www/js/setoran.js` bersih dan `git diff --stat -- www/index.html www/js/setoran.js` tampil 2 file
- [ ] 4. Bump versi dan bangun APK debug v1.2.3(11) hingga terverifikasi kunci
  - [ ] Bump versionCode 10->11 dan versionName 1.2.2->1.2.3 di `android/app/build.gradle` hingga cocok, verifikasi dengan `Select-String -Pattern 'versionCode 11|versionName "1.2.3"' -Path android/app/build.gradle` ada hit
  - [ ] Jalankan sinkron dan rakit APK debug dari `android/app/build.gradle` hingga APK terbit di `android/app/build/outputs/apk/debug/app-debug.apk`, verifikasi dengan `npx cap sync android` lalu `.\android\gradlew.bat assembleDebug` exit 0 dan `Test-Path android/app/build/outputs/apk/debug/app-debug.apk` True
  - [ ] Verifikasi tanda tangan APK di `android/app/build/outputs/apk/debug/app-debug.apk` hingga SHA-256 cocok d21bdf8be493bee460b3255a34299e9addd98670565cbac5948264195bdeffa1, verifikasi dengan `apksigner verify --print-certs android/app/build/outputs/apk/debug/app-debug.apk | Select-String d21bdf8be493bee460b3255a34299e9addd98670565cbac5948264195bdeffa1` ada hit
- [ ] 5. Komit dan rilis v1.2.3 hingga remote dan release bersih
  - [ ] Buat komit 3 file `www/index.html` + `www/js/setoran.js` + `android/app/build.gradle` pesan refactor hapus arsip-doctor lalu push origin main, verifikasi dengan `git status --short` bersih dan `git log --oneline -1` tampil pesan dan `git status -sb` ahead 0
  - [ ] Buat GitHub release v1.2.3 dengan APK `android/app/build/outputs/apk/debug/app-debug.apk` dan notes bersih-bersih UI arsip+hardening tetap, verifikasi dengan `gh release create v1.2.3 android/app/build/outputs/apk/debug/app-debug.apk --title v1.2.3 --notes "bersih-bersih UI arsip, hardening tetap"` exit 0
  - [ ] Verifikasi rilis v1.2.3 hingga tag+aset tampil dan kerja bersih, verifikasi dengan `gh release view v1.2.3 --json tagName,assets,body` tampil dan `git status --short` kosong
## Done
When every checkbox is `[x]`, run:
`Move-Item -LiteralPath ".agents/tasks/2026-10-15-hapus-arsip-doctor.md" -Destination ".agents/tasks/done/"`
