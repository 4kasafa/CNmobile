# Fix Scroll Regression Overflow CSS-only
> Source: Regresi hardening mengunci scroll total via overflow di html/body sehingga viewport tidak scroll di HP maupun Chrome.
> Plan CSS-only tanpa ubah native: bersihkan overflow root html/body, jaga inner scroll + MainActivity.java, verifikasi sync dan build debug.
## Tasks
- [ ] Pulihkan scroll viewport dengan bersihkan overflow root hingga viewport yang scroll tanpa bar
  - [ ] Hapus overflow-x:hidden dari rule html hingga tidak ada overflow apapun tersisa di rule html di www/css/style.css:28, sisakan scrollbar-width:none, -ms-overflow-style:none, overscroll-behavior:none, ::-webkit-scrollbar | file: www/css/style.css:28 | verify: Select-String -Path "www/css/style.css" -Pattern "overflow" -Context 2,2
  - [ ] Hapus overflow-y:auto dan overflow-x:clip dari rule body hingga tidak ada overflow apapun tersisa di rule body di www/css/style.css:37, sisakan overscroll-behavior:none agar body visible dan viewport yang scroll | file: www/css/style.css:37 | verify: Select-String -Path "www/css/style.css" -Pattern "^html|^body|overflow" -Context 2,2
- [ ] Pertahankan guardrail inner scroll dan native glow HP tanpa perubahan hingga tidak ada diff di luar rule html/body
  - [ ] Biarkan aturan inner #log-pre/#receipt-pre tetap ber-overflow terbatas hingga tinggi terbatas dan overflow di sana tetap ada di www/css/style.css | file: www/css/style.css (#log-pre, #receipt-pre) | verify: Select-String -Path "www/css/style.css" -Pattern "#log-pre|#receipt-pre" -Context 3
  - [ ] Jangan sentuh MainActivity.java hingga fix glow HP tetap utuh tanpa diff native | file: android/app/src/main/java/**/MainActivity.java | verify: git diff --exit-code -- android/
- [ ] Verifikasi bersih dan build APK debug hingga scroll jalan lagi di Chrome dan HP tanpa bar dan mentok keras
  - [ ] Jalankan Select-String overflow hingga rule html/body bersih tanpa kata overflow di www/css/style.css:28 dan :37 | file: www/css/style.css:28, www/css/style.css:37 | verify: Select-String -Path "www/css/style.css" -Pattern "overflow"
  - [ ] Jalankan cap sync dan gradlew assembleDebug hingga build sukses dan assets sync mengandung CSS baru di android/app/src/main/assets/public/css/style.css | file: www/css/style.css, android/app/src/main/assets/public/css/style.css | verify: npx cap sync android; if ($?) { .\android\gradlew.bat assembleDebug }; if ($?) { Select-String -Path "android/app/src/main/assets/public/css/style.css" -Pattern "overflow" }
  - [ ] Uji manual Chrome dan HP hingga scroll vertikal jalan lagi tanpa scrollbar terlihat dan mentok keras atas-bawah | file: www/css/style.css, android/app/src/main/assets/public/css/style.css | verify: buka Chrome DevTools tes scroll halaman Live dan Setoran lalu tes APK debug di HP
## Done
When every checkbox is `[x]`, run:
`Move-Item -LiteralPath ".agents/tasks/2026-10-16-fix-scroll-regression-overflow-css-only.md" -Destination ".agents/tasks/done/"`
