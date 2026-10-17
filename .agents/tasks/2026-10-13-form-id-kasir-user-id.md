# Form ID Kasir untuk data user_id
> Source: Tambah field required ID Kasir di #print-meta-form untuk mengisi user_id payload struk.
> Setoran cache tanpa id jadi tanpa prefill, manual persist di cn_print_meta; fold 4-segmen dan validasi blokir preview/send saat kosong.
## Tasks
- [x] Phase 1: Tambahkan field ID Kasir di HTML hingga parse lolos tanpa CSS baru
  - [x] Sisipkan div.field ID Kasir setelah kasir sebelum cabang dengan acceptance input#in-kasir-id placeholder cth: K01 muncul di #print-meta-form file paths: www/index.html verification command: python -c "html.parser parse www/index.html cek id in-kasir-id"
  - [x] Pertahankan reuse CSS .field tanpa aturan baru dengan acceptance tidak ada tag style/class baru untuk ID Kasir file paths: www/index.html verification command: python -c "parse www/index.html pastikan nol blok style baru"
- [x] Phase 2: Perluas persist-complete-fold print.js hingga reload dan fold 4-segmen benar
  - [x] Perluas saveMeta/loadMeta/bootMeta untuk persist-restore in-kasir-id dengan acceptance reload mempertahankan ID Kasir seperti meta lain file paths: www/js/print.js verification command: node --check www/js/print.js
  - [x] Perluas metaComplete dengan syarat ID tidak kosong dengan acceptance tutup plus auto-collapse butuh 4 field terisi file paths: www/js/print.js verification command: node --check www/js/print.js
  - [x] Perluas renderMeta fold line dengan ID dengan acceptance fold tampil kasir · cabang · SHIFT · K01 plus ubah saat ID ada file paths: www/js/print.js verification command: node --check www/js/print.js
- [x] Phase 3: Tambahkan receipt-payload-validasi print.js hingga User ID terkirim dan kosong diblokir
  - [x] Tambahkan baris User ID kvLine setelah Kasir di generateReceipt dengan acceptance preview struk memuat User ID dan wrap 32/48 aman mirror receipt.py:121 file paths: www/js/print.js verification command: node --check www/js/print.js
  - [x] Petakan user_id dari input di buildPayload dengan acceptance string tertrim dikirim kosong jadi strip plus komentar default-"-" dihapus file paths: www/js/print.js verification command: node --check www/js/print.js
  - [x] Tambahkan validasi ID kosong di doPreview/doSend dengan acceptance tampil isi id kasir dulu plus focus ke in-kasir-id dan zero fetch file paths: www/js/print.js verification command: node --check www/js/print.js
- [ ] Phase 4: Verifikasi otomatis dan manual hingga struk fisik tampil User ID
  - [x] Jalankan uji stub fungsional dengan acceptance ID kosong blokir preview/send zero fetch plus focus ID terisi jadi payload user_id fold tampil ID reload persist preview ada User ID file paths: www/js/print.js verification command: node --check www/js/print.js && node stub-test-print-meta.js
  - evidence (2026-10-13): node --check OK; stub 10 valid + 7/7 (blokir msg+focus+hidden, nol fetch, user_id payload, preview User ID+K01, persist, fold 4-segmen + reload). 2 gagal awal terbukti artefak harness (flag hidden HTML + fold state), terkonfirmasi via uji ulang.
  - [ ] Lakukan checklist Chrome manual dengan acceptance isi 4 field tekan tutup jadi fold 4-segmen kirim lalu struk fisik tampil User ID file paths: www/index.html, www/js/print.js verification command: manual Chrome buka www/index.html cek fold lalu kirim dan lihat struk fisik
## Done
When every checkbox is `[x]`, run:
`Move-Item -LiteralPath ".agents/tasks/2026-10-13-form-id-kasir-user-id.md" -Destination ".agents/tasks/done/"`
