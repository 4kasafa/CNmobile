# Hapus list sesi per item Live
> Source: Tambah hapus riwayat sesi per item (closed saja, open dikunci) dengan konfirmasi dua tahap [hapus]→[yakin?] yang batal otomatis; bucket tx sesi ikut dihapus agar tak yatim.
> Scope: `www/js/store.js`, `www/js/live.js`; verifikasi manual Chrome saja (tanpa harness).
## Tasks
- [ ] Hapus sesi + bucket tx di store dengan kunci open
  - [x] Tambahkan Store.deleteSession yang menolak status open dan menghapus entry sesi + delete cn_live_tx[id] di `www/js/store.js`, terima: closed terhapus bersih, open ditolak; verifikasi: `node --check www/js/store.js`
- [ ] Tampilkan tombol hapus dua tahap di riwayat Live
  - [x] Render tombol [hapus]/[yakin?] hanya pada item closed dengan variabel pendingDelete di `www/js/live.js`, terima: item open tanpa tombol, tap kedua [yakin?] mengeksekusi; verifikasi: `node --check www/js/live.js`
  - [x] Kecualikan klik tombol hapus dari tracker dobel-tap reopen dan reset pendingDelete saat tap lain/render di `www/js/live.js`, terima: [yakin?] batal saat tap lain, dobel-tap reopen tak bentrok; verifikasi: checklist Chrome manual skenario batal + reopen
- [ ] Verifikasi manual Chrome sesuai perilaku baru
  - [ ] Lalui checklist Chrome (hapus closed + tx ikut hilang, open terkunci, [yakin?] batal saat tap lain, riwayat kosong tampil teks lama) di `docs/TEST-CHECKLIST.md`, terima: semua langkah centang; verifikasi: buka `www/index.html` via serve dan jalankan tiap langkah
## Done
When every checkbox is `[x]`, run:
`Move-Item -LiteralPath ".agents/tasks/2026-10-12-hapus-list-sesi.md" -Destination ".agents/tasks/done/"`
