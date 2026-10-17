# Live Edit Hilang — Guard Render dan Isi Manual HILANG
> Source: Bug poll 2 detik drain() -> renderList() rebuild innerHTML menghancurkan form edit di live.js.
> Source: Fitur baris HILANG (gap no_urut) diisi nominal manual, manual menang atas data PC telat dan ikut total/struk.
> Source: Non-tujuan: hapus isian manual, kirim balik ke PC/GAS, dialog konflik.
## Tasks
- [ ] Amankan form edit dari rebuild poll drain() hingga draft/keyboard utuh selama editing terbuka
  - [ ] Lewati rebuild renderList di drain() saat editingTid/editingFill terbuka dan panggil renderTotals saja di www/js/live.js, diterima bila save/cancel yang sudah kosongkan editingTid tetap render normal, verifikasi dengan `node --check www/js/live.js`
  - [ ] Uji manual Chrome serve www/ dobel-tap tx ketik tunggu 6 detik/3 poll di www/js/live.js, diterima bila keyboard+ketikan utuh simpan muncul tag EDIT dan reload persisten, verifikasi dengan `node --check www/js/live.js`
- [ ] Aktifkan isi manual HILANG hingga nominal manual menang atas data PC telat dan ikut banner/struk
  - [ ] Tambahkan bucket cn_live_fill getFills dan upsertFill kunci hari|no_urut normalisasi parseInt di www/js/store.js, diterima bila upsertTx lewati baris PC terisi tapi last_seen tetap maju, verifikasi dengan `node --check www/js/store.js`
  - [ ] Render gap terisi sebagai tx manual plus tombol [isi] form T/NT validasi cleanNum dan totals ikut fills via editingKey di www/js/live.js, diterima bila baris manual tag MANUAL+EDIT dobel-tap buka form dan guard tahap 1 berlaku, verifikasi dengan `node --check www/js/live.js`
  - [ ] Jumlahkan fills di refreshSys dengan logika Tunai/Nontunai/Split yang sama di www/js/print.js, diterima bila banner+struk bertambah sesuai fills, verifikasi dengan `node --check www/js/print.js`
  - [ ] Verifikasi akhir isi HILANG reload banner+struk manual menang dan edit ulang bisa di www/js/live.js www/js/store.js www/js/print.js, diterima bila data asli telat tetap manual tanpa hapus/kirim-balik/konflik, verifikasi dengan `node --check www/js/live.js; if ($?) { node --check www/js/store.js }; if ($?) { node --check www/js/print.js }`
## Done
When every checkbox is `[x]`, run:
`Move-Item -LiteralPath ".agents/tasks/2026-10-16-live-edit-hilang.md" -Destination ".agents/tasks/done/"`
