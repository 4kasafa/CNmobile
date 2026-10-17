# Live sembuh otomatis + guard no_urut + banner totals + edit nominal

> Source: Perbaikan status [BUKA·kurang] sticky menjadi sembuh otomatis saat drain ok, guard gap nomor POS (no_urut) sebagai baris HILANG merah, banner Live menjadi totals tunai/nontunai/semua, plus edit tunai/nontunai inline via dobel-tap sebagai koreksi lokal yang tak dikirim balik.
> Scope: `www/js/lan.js`, `www/js/store.js`, `www/js/live.js`, `www/index.html`, `www/css/style.css`; verifikasi harness node throwaway + checklist Chrome mock.

## Tasks

- [x] Teruskan no\_urut POS dari API ke HP agar guard gap punya data
  - [x] Tambahkan field no\_urut di normRow sehingga Lan.fetchTx me-return no\_urut string apa adanya di `www/js/lan.js`, terima: tiap row hasil mengandung `no_urut`; verifikasi: `node --check www/js/lan.js`
- [x] Implementasikan sembuh otomatis dan balik-kurang di semua jalur Live
  - [x] Tambahkan fungsi heal tunggal (everBroken=false + patchSession complete=1 + status \[BUKA·ok\]) yang dipakai pollOnce/retryNow/reopen/resume di `www/js/live.js`, terima: drain ok memulihkan status tanpa \[tutup\]; verifikasi: `node --check www/js/live.js`
  - [x] Tandai gagal di batch drain mana pun sebagai putus (everBroken=true + complete=0 + status \[PUTUS\]) di `www/js/live.js`, terima: gagal halaman ke-2 setelah halaman-1 ok membalikkan status ke kurang; verifikasi: harness node skenario putus-tengah-drain ALL\_GREEN
  - [x] Terapkan aturan sembuh pada reopen sesi lama via dobel-tap sehingga sesi historis belum lengkap yang dibuka ulang + drain ok menjadi lengkap di `www/js/live.js`, terima: reopen + drain ok menghapus tag belum lengkap; verifikasi: harness node skenario reopen ALL\_GREEN
- [ ] Tampilkan nomor hilang sebagai baris HILANG merah tanpa error banner
  - [x] Hitung lompatan no\_urut per-hari secara longgar (parseInt, skip ''/non-digit, grup created\_at) di `www/js/live.js`, terima: 001643→001645 terdeteksi 1 nomor hilang dan ''/duplikat/reset harian tidak memicu; verifikasi: harness node skenario gap ALL\_GREEN
  - [x] Sisipkan baris synthetic HILANG sesuai urutan di #live-list yang tidak ikut totals dan mempertahankan status \[BUKA·ok\] + complete=1 di `www/js/live.js`, terima: baris HILANG tampil di posisi urut dan angka banner tak berubah; verifikasi: checklist Chrome mock skenario gap
  - [x] Tambahkan class tag HILANG merah (reuse --coral) untuk baris synthetic di `www/css/style.css`, terima: baris HILANG berwarna merah coral; verifikasi: checklist Chrome mock lihat warna baris HILANG
- [ ] Ubah banner Live menjadi totals permanen dari data lokal
  - [x] Render banner sebagai tunai=sum(tunai) + nontunai=sum(nontunai) + semua=sum(total) tiap renderList/drain dengan split pecah per komponen di `www/js/live.js`, terima: banner selalu angka totals sesi dan HILANG excluded; verifikasi: checklist Chrome mock ubah data lalu cek banner
  - [x] Sesuaikan markup banner menjadi satu baris totals permanen di `www/index.html`, terima: banner tampil satu baris totals tanpa tombol error; verifikasi: buka `www/index.html` via serve dan lihat banner
  - [x] Hapus semua pemakaian banner error sehingga putus hanya tampil via label status \[PUTUS\]/\[BUKA·kurang\] di `www/js/live.js`, terima: tak ada baris error atas/bawah form saat putus; verifikasi: `grep "banner(true" www/js/live.js` nol hasil
- [ ] Aktifkan edit tunai/nontunai inline via dobel-tap sebagai koreksi lokal
  - [x] Tambahkan Store.patchTx yang mengeset tunai/nontunai/total/kategori/edited=1 tanpa mengubah count/last\_seen di `www/js/store.js`, terima: patch satu baris mengoreksi angka + flag edited; verifikasi: `node --check www/js/store.js`
  - [x] Pastikan upsertTx tidak menimpa baris bertanda edited saat drain ulang tiba di `www/js/store.js`, terima: edit bertahan setelah drain ulang baris yang sama; verifikasi: harness node skenario edit-vs-drain ALL\_GREEN
  - [x] Tambahkan data-tid + tag edited + form inline dobel-tap (input tunai/nontunai + \[simpan\]/\[batal\], validasi digit saja, kosong→0, tolak alpha/negatif, total/kategori otomatis) yang me-refresh list + banner di `www/js/live.js`, terima: simpan mengoreksi angka + totals, batal membuang ketikan, single-tap no-op; verifikasi: checklist Chrome mock skenario edit inline
- [x] Verifikasi harness + checklist mock sesuai perilaku baru
  - [x] Jalankan harness node throwaway yang mencakup sembuh-1-fetch, gagal-batch-2, gap no\_urut, reopen lama, dan edit-vs-drain tanpa dobel di `C:\Users\salam\AppData\Local\Temp\opencode\` (throwaway, bukan repo), terima: semua skenario hijau; verifikasi: `node <harness>.js` → ALL\_GREEN
  - [x] Lalui checklist Chrome mock (drain 60 rows 2 halaman, banner totals, baris HILANG, edit inline, reopen) di `docs/TEST-CHECKLIST.md`, terima: semua langkah checklist centang; verifikasi: buka `www/index.html` via serve dan jalankan tiap langkah
- [x] Buat 2 diagram Mermaid yang komprehensif dari hasil task ini.
  - [x]  Diagram A (Flowchart / State Machine):
  
       - Format: `flowchart TD` dengan subgraph terstruktur (Inisialisasi/Boot, Siklus Utama/State Machine, dan Distribusi Data).
  
    - Tampilkan seluruh transisi status, percabangan logika (kondisi sukses/gagal/timeout), dan mekanisme fallback/error handling.
  
    - Gunakan pewarnaan (styling) pada node status penting.
  - [x] Diagram B (Sequence Diagram Interaksi Komponen):
  
       - Format: `sequenceDiagram` dengan `autonumber`.
  
    - Pisahkan setiap aktor, service, background worker, database, dan client/konsumen data.
  
    - Gambarkan alur end-to-end: dari trigger awal user/event eksternal, pemrosesan internal, penyimpanan data, hingga data dikonsumsi client/output.

## Done

When every checkbox is `[x]`, run:
`Move-Item -LiteralPath ".agents/tasks/2026-10-12-live-heal-nourut-totals-edit.md" -Destination ".agents/tasks/done/"`