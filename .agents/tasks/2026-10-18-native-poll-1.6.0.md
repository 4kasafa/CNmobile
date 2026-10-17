# Native Poll 1.6.0 — polling native untuk notifikasi Live

> Source: Plan terverifikasi. Polling WebView beku di background, jadi satu penulis notifikasi dipindah ke native: native poll selalu jalan (fg & bg) via `ScheduledExecutorService` 2 detik per PC, sementara JS hanya mengirim state absolut lewat `BP.start({state})` (last-writer-wins, tanpa dobel-hitung). Delta dari poll native ditambahkan di atas state absolut JS; `pushBg`/`lastSent` dan `BgSyncPlugin.update()` dihapus. Rilis 1.6.0/code 20.

## Tasks

- [ ] Jadikan `BgSyncService` pemilik notifikasi + poll native sendiri
  - [ ] Tambah field `ScheduledExecutorService exec` dan SharedPreferences dengan key `"state"` (JSON utuh dari JS) di `android/app/src/main/java/com/cashnote/mobile/BgSyncService.java` — verify `Select-String -Path "android\app\src\main\java\com\cashnote\mobile\BgSyncService.java" -Pattern "ScheduledExecutorService|\"state\""`
  - [ ] Ubah `onStartCommand` agar membaca `intent.getStringExtra("state")` lalu memanggil `applyState()`, dan menghapus jalur extra `"text"` lama; saat `intent == null` (restart `START_STICKY`) reload state dari prefs lalu lanjut poll tanpa crash — verify `Select-String -Path "android\app\src\main\java\com\cashnote\mobile\BgSyncService.java" -Pattern "getStringExtra|applyState|START_STICKY"` dan `Select-String -Path "android\app\src\main\java\com\cashnote\mobile\BgSyncService.java" -Pattern "getStringExtra\(\"text\""` tidak match
  - [ ] Implementasikan `applyState(String json)` dengan `synchronized(this)`: parse `{pcs:[{comp_id,base,since,alive}],count,total,lastTotal,lastTime}`, simpan ke prefs, lalu panggil update notif — verify `Select-String -Path "android\app\src\main\java\com\cashnote\mobile\BgSyncService.java" -Pattern "applyState|synchronized"`
  - [ ] Implementasikan `tick()` dengan `synchronized(this)`: per PC HttpURLConnection `GET {base}/api/transactions?since={since}&limit=50`, connect+read timeout 3000ms, terima array response langsung ATAU `{rows:[...]}` (cermin `lan.js:58`) — verify `Select-String -Path "android\app\src\main\java\com\cashnote\mobile\BgSyncService.java" -Pattern "api/transactions|setConnectTimeout|setReadTimeout|rows"`
  - [ ] Di `tick()`, ambil field `id`, `total`, `created_at` per baris; `since = max(id)`, `alive = gagal ? 0 : 1`, akumulasi `count`/`total`/`last`, simpan prefs, update notif — verify `Select-String -Path "android\app\src\main\java\com\cashnote\mobile\BgSyncService.java" -Pattern "created_at|alive|since"`
  - [ ] Buat `exec` hanya bila belum ada (idempoten, aman saat `BP.start` dipanggil ulang tiap reseed) dan jadwalkan `tick()` via `scheduleWithFixedDelay` 2 detik — verify `Select-String -Path "android\app\src\main\java\com\cashnote\mobile\BgSyncService.java" -Pattern "scheduleWithFixedDelay|exec == null"`
  - [ ] Pertahankan format notif `37 tx · Rp 5.250.000 · terakhir Rp 50.000 10:31 · [ok]` dengan helper `rp(long)` (titik ribuan, cermin `live.js:16-18`); `[ok]` bila semua PC alive, `[PUTUS]` bila ada gagal; `lastTime` sudah "HH:MM" dari JS jadi tak perlu parse tanggal — verify `Select-String -Path "android\app\src\main\java\com\cashnote\mobile\BgSyncService.java" -Pattern "rp\(|PUTUS|tx ·"`
  - [ ] Di `onDestroy`, panggil `exec.shutdownNow()` dan pertahankan cleanup wake/wifi lock yang sudah ada; JANGAN hapus prefs agar restart `START_STICKY` aman — verify `Select-String -Path "android\app\src\main\java\com\cashnote\mobile\BgSyncService.java" -Pattern "shutdownNow"` dan build sukses di task Verifikasi

- [ ] Ubah `BgSyncPlugin` jadi hanya meneruskan state absolut
  - [ ] Teruskan `call.getString("state")` sebagai extra ke intent service di `start(call)` pada `android/app/src/main/java/com/cashnote/mobile/BgSyncPlugin.java`, jalur permission tetap tidak berubah dan extra ikut pada cabang `notifCb` — verify `Select-String -Path "android\app\src\main\java\com\cashnote\mobile\BgSyncPlugin.java" -Pattern "getString\(\"state\"\)|putExtra|notifCb"`
  - [ ] Hapus method `update()` dari `android/app/src/main/java/com/cashnote/mobile/BgSyncPlugin.java` sehingga tak ada lagi remote entry point pembaruan notif dari JS — verify `Select-String -Path "android\app\src\main\java\com\cashnote\mobile\BgSyncPlugin.java" -Pattern "void update|@PluginMethod"` hanya menyisakan `start`

- [ ] Ganti `pushBg` dengan `pushState` di `www/js/live.js`
  - [ ] Ubah `renderTotals` (± baris 52-69) di `www/js/live.js` agar menghitung `count`/`total`/`lastTotal`/`lastTime` lalu memanggil `pushState(st)` menggantikan `pushBg(...)` — verify `Select-String -Path "www\js\live.js" -Pattern "pushState"` dan `node --check www/js/live.js`
  - [ ] Implementasikan `pushState(st)` di `www/js/live.js` dengan payload `{pcs: S.pcs.map(p => ({comp_id, base, since: sInt(p.last_seen)})), count, total, lastTotal, lastTime}` dan throttle kirim hanya bila JSON berubah (pola `lastSent` lama) lalu `BP.start({state})`; bila gagal, reset throttle agar retry — verify `Select-String -Path "www\js\live.js" -Pattern "comp_id|last_seen|BP\.start"` dan `node --check www/js/live.js`
  - [ ] Ubah `setBg(true)` (± baris 218) di `www/js/live.js` menjadi `await BP.start({state: <payload>})` agar state terkirim sejak awal, bukan nunggu render berikutnya — verify `Select-String -Path "www\js\live.js" -Pattern "setBg"` menunjukkan `BP.start({state`
  - [ ] Hapus `pushBg` (± baris 71-78) dan `lastSent` (± baris 24) beserta sisa referensinya dari `www/js/live.js`, termasuk panggilan `BgSync.update()` saat bg ON — verify `Select-String -Path "www\js\live.js" -Pattern "pushBg|lastSent|BgSync\.update"` tidak match, `node --check www/js/live.js` exit 0

- [ ] Bersihkan workaround anti-freeze WebView di `MainActivity.java` (rekomendasi: ikut)
  - [ ] Hapus `dispatchWindowVisibilityChanged` `postDelayed` di `onStop` dan `setRendererPriorityPolicy` dari `android/app/src/main/java/com/cashnote/mobile/MainActivity.java`; WebView boleh diam saat background karena polling pindah ke native — verify `Select-String -Path "android\app\src\main\java\com\cashnote\mobile\MainActivity.java" -Pattern "dispatchWindowVisibilityChanged|setRendererPriorityPolicy"` tidak match, `registerPlugin`/`onStart` tetap ada

- [ ] Bump versi ke 1.6.0 / code 20
  - [ ] Verifikasi nilai lama dulu (`versionName "1.5.3"`, `versionCode 19`, `package.json` 1.5.3) lalu ubah `android/app/build.gradle` ke `versionName "1.6.0"` dan `versionCode 20` — verify `Select-String -Path "android\app\build.gradle" -Pattern 'versionName "1\.6\.0"|versionCode 20'`
  - [ ] Ubah `"version"` di `package.json` menjadi `1.6.0` — verify `Select-String -Path "package.json" -Pattern '"version": "1\.6\.0"'`

- [ ] Verifikasi build, manifest, dan file lain yang harus tetap utuh
  - [ ] Jalankan `node --check www/js/live.js` dan pastikan exit 0 — verify `node --check www/js/live.js`
  - [ ] Jalankan `npx.cmd cap sync android` dari root repo dan pastikan `www` tersinkron tanpa langkah gagal — verify `Select-String -Path "android\app\src\main\assets\public\js\live.js" -Pattern "pushState"`
  - [ ] Jalankan `.\android\gradlew.bat -p android assembleDebug` dan pastikan `BUILD SUCCESSFUL` — verify `Get-Item android\app\build\outputs\apk\debug\app-debug.apk`
  - [ ] Cek merged manifest tetap `dataSync` tanpa permission baru (khususnya tak ada `RECORD_AUDIO`) — verify `Select-String -Path "android\app\build\intermediates\merged_manifest\debug\processDebugMainManifest\AndroidManifest.xml" -Pattern "dataSync|RECORD_AUDIO"` (fallback: `Get-ChildItem "android\app\build" -Recurse -Filter AndroidManifest.xml | Select-String -Pattern "dataSync|RECORD_AUDIO"`)
  - [ ] Pastikan `store.js`, `lan.js`, `index.html`, dan `AndroidManifest.xml` tidak berubah oleh steps di atas — verify `git status --short` hanya memuat BgSyncService.java, BgSyncPlugin.java, MainActivity.java, www/js/live.js, android/app/build.gradle, package.json, dan file task ini

- [ ] Commit, push, dan rilis v1.6.0
  - [ ] Commit hanya file yang direncanakan (BgSyncService.java, BgSyncPlugin.java, MainActivity.java, www/js/live.js, android/app/build.gradle, package.json, file task ini) dengan pesan Bahasa Indonesia gaya repo, awali `feat/` atau `fix/` dan sebut rilis APK debug — verify `git log --oneline -1` dan `git status -sb`
  - [ ] Push ke branch remote yang dilacak — verify `git status -sb` menunjukkan branch ter-ahead 0 dan bersih
  - [ ] Buat rilis `gh release create v1.6.0` dengan `android\app\build\outputs\apk\debug\app-debug.apk` sebagai asset — verify `gh release view v1.6.0 --json assets` mencantumkan `app-debug.apk` (+ https://github.com/4kasafa/CNmobile/releases/tag/v1.6.0)

- [ ] Uji manual di HP (pending — dijalankan user, jangan tandai selesai tanpa hasil nyata)
  - [ ] Pasang app-debug 1.6.0 di HP, buka sesi Live dengan `[bg:on]`, minimalkan 5 menit, buka lagi, dan pastikan angka notif bertambah walaupun WebView tidak di foreground — verify `gh release view v1.6.0 --json tagName` + hasil pembacaan notif dicatat di file task ini
  - [ ] Catat hasil: jumlah tick native (angka `tx` bertambah?), apakah `[ok]`/`[PUTUS]` sesuai kondisi PC, dan apakah event foreground (`BP.start` dari JS) masih menulis state dengan benar tanpa dobel-hitung — verify catatan observasi tertulis di file task ini

## Done
When every checkbox is `[x]`, run:
`Move-Item -LiteralPath ".agents/tasks/2026-10-18-native-poll-1.6.0.md" -Destination ".agents/tasks/done/"`