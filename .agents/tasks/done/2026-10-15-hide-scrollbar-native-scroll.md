# Sembunyikan Scrollbar + Rasa Scroll Native
> Source: Plan yang disetujui untuk CNmobile (vanilla JS + Capacitor www/ + android/): sembunyikan scrollbar vertikal tapi tetap bisa scroll di Chrome desktop + HP.
> Scroll mentok tidak stretch/glow agar terasa native bukan webview, dengan jaminan CSS + atribut native WebView.
## Tasks
- [ ] Terapkan CSS sembunyi-scrollbar dan anti-stretch agar scroll tetap jalan tanpa glow di Chrome dan HP
  - [ ] Edit blok html,body di www/css/style.css hingga memenuhi acceptance scrollbar-width:none dan -ms-overflow-style:none dan ::-webkit-scrollbar display:none dan body overflow-y:auto dan overflow-x:clip dan overscroll-behavior:none, file `www/css/style.css`, verifikasi dengan `Select-String -Pattern "scrollbar-width:\s*none" -LiteralPath "www/css/style.css" && Select-String -Pattern "overscroll-behavior:\s*none" -LiteralPath "www/css/style.css"`
  - [ ] Edit blok #receipt-pre di www/css/style.css hingga memenuhi acceptance max-width:100% dan overflow-x:auto dan scrollbar disembunyikan tanpa mematikan scroll horizontal, file `www/css/style.css`, verifikasi dengan `Select-String -Pattern "#receipt-pre" -LiteralPath "www/css/style.css"`
- [ ] Terapkan jaminan native anti-glow di WebView Android agar scroll HP tanpa overscroll visual
  - [ ] Tambahkan atribut android:overScrollMode="never" dan android:scrollbars="none" pada elemen WebView di activity_main.xml hingga memenuhi acceptance kedua atribut hadir di tag WebView yang sama, file `android/app/src/main/res/layout/activity_main.xml`, verifikasi dengan `Select-String -Pattern 'overScrollMode="never"' -LiteralPath "android/app/src/main/res/layout/activity_main.xml" && Select-String -Pattern 'scrollbars="none"' -LiteralPath "android/app/src/main/res/layout/activity_main.xml"`
- [ ] Verifikasi hasil edit agar tidak ada regresi scroll dan refresh manual tetap tersedia
  - [ ] Baca ulang kedua file hasil edit hingga memenuhi acceptance tidak ada overflow:hidden di body yang mematikan scroll dan pull-to-refresh bawaan mati via overscroll-behavior:none plus overScrollMode never, file `www/css/style.css` dan `android/app/src/main/res/layout/activity_main.xml`, verifikasi dengan `Select-String -Pattern "overflow(-y)?:\s*hidden" -LiteralPath "www/css/style.css"`
  - [ ] Pastikan tombol #btn-refresh tetap ada di codebase hingga memenuhi acceptance tombol refresh manual masih bisa diklik walau pull bawaan mati, file `www/index.html` dan `www/js/*.js`, verifikasi dengan `Select-String -Pattern "#btn-refresh|btn-refresh" -Path "www/**/*.*"`
## Done
When every checkbox is `[x]`, run:
`Move-Item -LiteralPath ".agents/tasks/2026-10-15-hide-scrollbar-native-scroll.md" -Destination ".agents/tasks/done/"`
