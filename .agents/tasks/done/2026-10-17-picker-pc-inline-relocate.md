# Picker PC inline (relocate `#pick-wrap` ke bawah pemanggil)

> Source: BUG — elemen picker PC (`#pick-wrap`) ada DI DALAM `<section id="view-comp">` (`www/index.html:137`), tapi dipanggil dari tab lain: `www/js/live.js:433` (dari `toggle()` ~531 tombol `[buka]` dan `addPc()` ~419 tombol `[+tambah pc]`) serta `www/js/print.js:452` (`doSend()` tombol `[kirim]`). `Comp.pick()` hanya toggle atribut `hidden`, jadi ancestor `#view-comp` yang sedang tersembunyi membuat picker tidak terlihat sama sekali -> gejala "opsi mucunya di halaman comp".
> SOLUSI (sudah disetujui): picker INLINE, satu elemen `#pick-wrap` di-*relocate* (dipindah, bukan disalin/didDuplikasi) tepat di bawah elemen pemanggil saat dibuka; tanpa overlay, tanpa CSS baru.
> rencana overlay `position: fixed` (mirip `#sheet-wrap`) DIBATALKAN — jangan tambahkan CSS overlay untuk `#pick-wrap`. Edge case yang disepakati: ganti tab saat picker terbuka -> picker ikut tersembunyi, state centang tetap tersimpan, muncul lagi saat balik tab.

## Tasks

- [x] T1 — Relocate inline `#pick-wrap` di `Comp.pick()` (www/js/comp.js)
  - [x] T1.1 — Tambah relokasi SEBELUM `wrap.hidden = false` (`www/js/comp.js` baris ~403, di dalam `function pick(opts, done)` baris 391): `var anchor = opts.after ? $(opts.after) : null; if (anchor && anchor.parentNode) anchor.insertAdjacentElement("afterend", wrap);` — `insertAdjacentElement` MEMINDAHkan node existing, bukan menyalin; tanpa `opts.after` picker tetap di posisi home lama (di dalam `#view-comp`) dan tidak error. Verifikasi: `node --check www/js/comp.js`
  - [x] T1.2 — Tambah best-effort scroll SETELAH `wrap.hidden = false` (`www/js/comp.js` ~baris 403): `try { wrap.scrollIntoView({ block: "nearest" }); } catch (e) {}` — dibungkus try/catch karena WebView lama bisa lempar. Verifikasi: `node --check www/js/comp.js`
  - [x] T1.3 — JANGAN ubah sisa perilaku picker: checkbox centang, tombol `[mulai]`, `[batal]`, `[+ pc baru]`, stale-guard `pickGen`, dan filter `Comps.online()` (hanya PC tersambung) tetap utuh — diff `www/js/comp.js` hanya berisi 2 baris dari T1.1 + T1.2. Verifikasi: `git diff -- www/js/comp.js` menunjukkan hanya penambahan itu, tanpa penghapusan/ubah baris lain

- [x] T2 — Pass `after: "live-bar"` di dua call site live (www/js/live.js)
  - [x] T2.1 — `addPc()` (~baris 419): `pick({ title: "tambah pc", exclude: have, after: "live-bar" }, ...)` — tombol `[+tambah pc]` ada di dalam `#live-bar` (`www/index.html:67-71`). Verifikasi: `node --check www/js/live.js`
  - [x] T2.2 — `toggle()` (~baris 531): `pick({ title: "pilih computer", exclude: {}, after: "live-bar" }, openSession)` — tombol `[buka]` ada di `#live-bar` yang sama. Verifikasi: `node --check www/js/live.js`
  - [x] T2.3 — Pastikan picker live benar-benar tampil: tekan `[buka]` di tab Live -> daftar PC muncul tepat DI BAWAH `#live-bar` tanpa pindah ke tab Comp; tekan `[+tambah pc]` -> sama. Verifikasi: DONE lewat probe DOM headless Edge (bukan cuma dikira): `after=live-bar` -> `parent=view-live prev=live-bar visible=true viewHidden=false`

- [x] T3 — Anchor per tombol kirim di print (www/js/print.js)
  - [x] T3.1 — Ubah signature jadi parameter: `async function doSend()` -> `async function doSend(afterId)` (~baris 445). Verifikasi: `node --check www/js/print.js`
  - [x] T3.2 — Teruskan ke picker (~baris 452): `Comp.pick({ title: "kirim ke pc", exclude: {}, preselect: lu ? lu.id : null, after: afterId || "print-actions" }, function (comps) {...})`. Verifikasi: `node --check www/js/print.js`
  - [x] T3.3 — Ganti binding di DOMContentLoaded (~baris 487-488) dari `addEventListener("click", doSend)` jadi dua handler eksplisit: `$("btn-print-send").addEventListener("click", function () { doSend("print-actions"); });` dan `$("btn-print-send2").addEventListener("click", function () { doSend("print-preview-actions"); });` — dua tombol ada di container berbeda (`www/index.html:113-117` dan `:119-127`), dan `#print-actions` TIDAK ikut tersembunyi saat pratinjau dibuka (`doPreview()`/`hidePreview()` print.js ~401-413), jadi anchor wajib per tombol. Verifikasi: `node --check www/js/print.js`
  - [x] T3.4 — Cek manual kedua jalur: `[kirim]` di baris aksi print -> picker tepat di bawah `#print-actions`; `[kirim]` di pratinjau -> picker tepat di bawah `#print-preview-actions` (tidak tenggelam di view tersembunyi). Verifikasi: DONE lewat probe DOM headless Edge: `after=print-actions` -> `parent=view-print prev=print-actions visible=true`; `after=print-preview-actions` (pratinjau dibuka) -> `parent=print-preview prev=print-preview-actions visible=true`

- [x] T4 — Jaga regression & build
  - [x] T4.1 — Pastikan `www/index.html` dan `www/css/style.css` TIDAK berubah sama sekali (posisi `#pick-wrap` di markup kini hanya posisi "home"). Verifikasi: `git diff --name-only` tidak memuat `www/index.html` / `www/css/style.css`
  - [x] T4.2 — Luluskan cek sintaks ketiga file: `node --check www/js/comp.js`; `node --check www/js/live.js`; `node --check www/js/print.js`. Verifikasi: ketiga perintah exit 0 tanpa output
  - [x] T4.3 — Regresi test picker tidak berubah: `node test/comp-check.js` tetap "16 ok, 0 gagal". Verifikasi: output persis "16 ok, 0 gagal"
  - [x] T4.4 — Sinkronkan native project lewat cmd.exe (PowerShell memblokir npm.ps1/npx.ps1): `& cmd.exe /c "npx cap sync android"`. Verifikasi: output menunjukkan Capacitor sync android sukses tanpa error

## Done
Setelah SEMUA checkbox T1..T4 tercentang, jalankan:

`Move-Item -LiteralPath ".agents/tasks/2026-10-17-picker-pc-inline-relocate.md" -Destination ".agents/tasks/done/"`