# Fix Scrollbar Stretch WebView v1.2.3
> Source: Fix v1.2.1 (style.css + activity_main.xml) tidak ngefek di HP karena MainActivity hanya extends BridgeActivity tanpa inflate XML. Plan disetujui: fix native via getBridge().getWebView() + CSS hardening fallback + build dan verifikasi HP.
## Tasks
- [ ] Perbaiki overscroll native di MainActivity via getBridge().getWebView() dengan acceptance ketiga panggilan hadir dan build sukses
  - [ ] Tambahkan import android.view.View ke MainActivity.java dengan acceptance baris import hadir di file android/app/src/main/java/com/cashnote/mobile/MainActivity.java dengan verifikasi `Select-String -Pattern "import android.view.View" -LiteralPath "android/app/src/main/java/com/cashnote/mobile/MainActivity.java"`
  - [ ] Override onStart dengan setOverScrollMode OVER_SCROLL_NEVER + setVerticalScrollBarEnabled(false) + setHorizontalScrollBarEnabled(false) di file android/app/src/main/java/com/cashnote/mobile/MainActivity.java dengan acceptance ketiga panggilan hadir via verifikasi `Select-String -Pattern "setOverScrollMode|setVerticalScrollBarEnabled|setHorizontalScrollBarEnabled" -LiteralPath "android/app/src/main/java/com/cashnote/mobile/MainActivity.java"`
- [ ] Harden CSS fallback scrollbar di www/css/style.css dengan acceptance tidak ada overflow:hidden di body dan scroll tetap jalan
  - [ ] Tambahkan fallback html overflow-x:hidden untuk overflow-x:clip di file www/css/style.css dengan acceptance rule html hadir dan body tanpa overflow:hidden via verifikasi `Select-String -Pattern "overflow-x" -LiteralPath "www/css/style.css"`
  - [ ] Sembunyikan scrollbar #log-pre via scrollbar-width:none + ::-webkit-scrollbar display:none dengan overflow-y:auto tetap di file www/css/style.css dengan acceptance scroll internal jalan dan bar tersembunyi via verifikasi `Select-String -Pattern "#log-pre|scrollbar-width|::-webkit-scrollbar" -LiteralPath "www/css/style.css"`
- [ ] Build dan verifikasi layar utama mentok keras tanpa stretch dengan acceptance tanpa glow/bar kanan dan scroll tetap jalan
  - [ ] Jalankan cap sync lalu build debug APK dari file android/app/src/main/java/com/cashnote/mobile/MainActivity.java dan www/css/style.css dengan acceptance APK debug terbuat via verifikasi `npx cap sync android; if ($?) { Set-Location android; if ($?) { ./gradlew assembleDebug } }`
  - [ ] Verifikasi manual di HP v1.2.3 layar utama mentok berhenti keras tanpa stretch/glow/bar kanan dan scroll tetap jalan terkait file android/app/src/main/java/com/cashnote/mobile/MainActivity.java dan www/css/style.css dengan acceptance checklist HP lolos via verifikasi `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`
  - [ ] Verifikasi Chrome desktop tidak regresi untuk file www/css/style.css dengan acceptance scroll dan layout sama seperti sebelum fix via verifikasi `npx serve www`
## Done
When every checkbox is `[x]`, run:
`Move-Item -LiteralPath ".agents/tasks/2026-10-15-fix-scrollbar-stretch-webview.md" -Destination ".agents/tasks/done/"`
