# Setoran tx-new Blink Sync
> Source: Port pola blink Live (renderList(freshIds) + class tx-new + timeout 1000ms + S.known, CSS .tx-new di style.css) ke www/js/setoran.js agar refresh tanpa perubahan diam dan hanya baris baru/berubah yang blink. Jalur sukses syncGas pakai diff signature per key dan render berani-blink, tanpa menyentuh conflict.js.
## Tasks
- [ ] Tambah blink state di setoran.js agar renderList punya known-set dan timer handle
  - [ ] Tambah properti known:{} pada objek state di www/js/setoran.js sehingga state.known terdefinisi sebagai objek kosong saat boot, verifikasi dengan `node --check www/js/setoran.js`
  - [ ] Tambah properti flickT:null pada objek state di www/js/setoran.js sehingga state.flickT terdefinisi null untuk clearTimeout/setTimeout 1000ms, verifikasi dengan `node --check www/js/setoran.js`
- [ ] Ubah renderList menjadi blink-aware agar tanpa argumen diam dan dengan freshKeys hanya baris cocok yang blink
  - [ ] Ubah signature menjadi renderList(freshKeys) di www/js/setoran.js sehingga baris yang key-nya ada di freshKeys dapat class tambahan " tx-new" dan tanpa argumen nol blink, verifikasi dengan `node --check www/js/setoran.js`
  - [ ] Sinkronkan state.known dari seluruh cache dan kelola timer di www/js/setoran.js sehingga clearTimeout(state.flickT) + setTimeout 1000ms melepas .tx-new di #tx-list, verifikasi dengan `node --check www/js/setoran.js`
  - [ ] Pertahankan semua jalur existing tanpa argumen di www/js/setoran.js sehingga renderAll, login, boot, dan resolve tetap render diam tanpa blink, verifikasi dengan `Select-String -Pattern "renderList\(" -Path www/js/setoran.js`
- [ ] Terapkan diff signature di jalur sukses syncGas agar hanya baris baru atau berubah yang blink
  - [ ] Buat snapshot signature per key sebelum merge di www/js/setoran.js sehingga tiap key memetakan JSON dari [toInt(totalKomputer), toInt(uangFisik), toInt(jumlahSelisih), !!_conflict], verifikasi dengan `node --check www/js/setoran.js`
  - [ ] Panggil Conflict.mergeGasData lalu hitung diff di www/js/setoran.js sehingga fresh = key baru ATAU signature berubah dan conflict.js tidak disentuh, verifikasi dengan `node --check www/js/setoran.js`
  - [ ] Ganti renderAll() dengan render berani-blink hanya di jalur sukses di www/js/setoran.js sehingga memanggil renderSummary() + renderList(fresh) + refreshStatus() + visibility logic, verifikasi dengan `node --check www/js/setoran.js`
- [ ] Verifikasi statis dan manual agar tidak ada pemanggil rusak dan perilaku blink tepat
  - [ ] Jalankan cek sintaks dan audit pemanggil di www/js/setoran.js sehingga node --check lolos dan tidak ada pemanggil renderList lain yang rusak, verifikasi dengan `node --check www/js/setoran.js`
  - [ ] Uji manual empat kondisi di Chrome memakai www/js/setoran.js + www/css/style.css sehingga refresh tanpa perubahan = nol blink, baris baru = blink, update angka/flag beda = blink, load awal/login/boot/resolve = diam, verifikasi dengan `node --check www/js/setoran.js`
## Done
When every checkbox is `[x]`, run:
`Move-Item -LiteralPath ".agents/tasks/2026-10-14-setoran-tx-new-blink.md" -Destination ".agents/tasks/done/"`
