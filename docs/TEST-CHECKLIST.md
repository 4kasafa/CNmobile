# TEST-CHECKLIST — Live sesi manual (M1)

Kontrak LAN: `../CNdesktop/docs/PRD.md` §6 — `GET /api/health`, `GET /api/transactions?since&limit=50`, tanpa auth.

## M1 (Chrome desktop, tanpa PC asli)

1. [ ] Buka `www/index.html` via serve (`npx serve www` / Live Server) → tab dropdown `[live]` → tampil bar `└─ pc --` + `[buka]`.
2. [ ] Mock: devtools Console → `Lan.fetchTx = async () => ({ok:true, rows:[{server_id:1,no_transaksi:"NO-1",no_urut:"1",total:50000,tunai:50000,nontunai:0,bank:"",kategori:"Tunai",created_at:"2026-10-10 10:00:00"}]})` → tab `[comp]` `[+ tambah]` nama `mock` + `127.0.0.1:8765` → `[live]` `[buka]` → picker centang `mock` → `[mulai]` → list tampil 1 tx <3 dtk.
3. [ ] Drain loop: mock 60 rows `since=0` → buka → cek `await Store.listTx(Live._state.sessionId)` = 60 (2 halaman × 50).
4. [ ] Dedup: panggil `Live.retry()` → jumlah tetap 60, tidak dobel (by `server_id` + `no_transaksi`).
5. [ ] Putus: `Lan.fetchTx = async () => ({ok:false, error:"boom", rows:[]})` → tunggu poll 2 dtk → status `[BUKA·kurang]` + riwayat tag `belum lengkap` (setelah `[tutup]`).
6. [ ] Tutup: `[tutup]` → riwayat tampil sesi `[tutup]` + `belum lengkap` bila pernah putus.
7. [ ] Reload halaman → riwayat sesi tetap ada (localStorage `cn_live_sessions` / `cn_live_tx`).

## M2 (dengan PC + CNdesktop asli, WiFi sama)

1. [ ] Tab `[comp]` `[+ tambah]` nama + `http://<IP-PC>:8765` → `[live]` `[buka]` → centang PC itu → `[mulai]` → drain tampil transaksi kasir nyata.
2. [ ] Buat transaksi baru di Ketoko → ≤4 dtk muncul di HP (poll 2 dtk + drain).
3. [ ] Matikan CNdesktop → `[BUKA·kurang]`; hidupkan lagi → catch-up ≤4 dtk tanpa dobel (`since` per PC).
4. [ ] Ganti WiFi / IP berubah → tambah PC baru di `[comp]` (atau `[ubah]` yang lama) → `[buka]` sesi baru, sesi lama tetap di riwayat.

## M3 (control per-PC: watcher + wipe, dengan PC + CNdesktop asli, WiFi sama)

1. [ ] Tab `[comp]` dobel-tap baris PC → panel `kontrol: <nama>` berisi versi + ip:port; badge `[ok]`/`[OK·lama]`/`[PUTUS]`.
2. [ ] Buka panel → watcherGet auto-load → status `[nyala]`/`[mati]`; `[muat ulang]` refresh.
3. [ ] Watcher off→on→off (PIN benar) → 200 + status ikut; PIN salah → "PIN salah".
4. [ ] Wipe confirm salah → 400 tampilkan error PC + fokus ke field HAPUS (PIN tetap); PIN salah → "PIN salah".
5. [ ] Wipe benar (`HAPUS` kapital) → 200 `dihapus N`; data lokal HP tetap utuh.
6. [ ] 5x PIN salah beruntun (watcher/wipe) → 429 "terkunci 5 menit"; PIN benar me-reset.
7. [ ] Saat print/watcher-tulis aktif → wipe/watcher-set 409 "PC sibuk, coba lagi" (tekan ulang manual).

## M4 (arsip setoran + hold riwayat, Chrome + HP)

1. [ ] Login setoran (akun lama, cache v1 ada) → migrasi sekali-jalan: `cn_setoran_archive` terisi, key lama hilang, data tidak dobel.
2. [ ] Ringkasan tampil `tx` = periode berjalan vs `arsip` = total; sync baru → baris baru blink 5x.
3. [ ] Riwayat live: `belum lengkap`+`[hapus]` tersembunyi → tahan 900ms muncul; tap item lain sembunyi lagi.
4. [ ] Password `[lihat]` + `[tutup]` batal ganti-akun; print prefill kasir/cabang/shift dari arsip periode berjalan.

## M5 (isian manual + log PC, dengan CNdesktop asli)

1. [ ] Baris `HILANG no N` → `[isi]` → simpan T/NT → jadi `MANUAL`, totals banner + struk print ikut; data PC telat untuk no itu diabaikan.
2. [ ] Form `[isi]`/edit terbuka → ganti sesi → form tertutup, list sesi baru drain normal (tidak macet totals-saja).
3. [ ] Tab `[comp]` dobel-tap PC → panel `kontrol:` → `[logs]`: PIN salah → "PIN salah"; PIN benar → `[muat]` tampil 200 baris.

## M6 (comp: daftar computer + sesi multi-PC)

Loka: tab `[comp]` (gantikan `[settings]`). Mock lewat devtools Console untuk M6.1–M6.3.

1. [ ] Migrasi: HP lama punya `cn_lan_base` → buka app → tab `[comp]` tampil satu baris `PC 1` + base URL lamanya, key `cn_lan_base` hilang (`localStorage.getItem("cn_lan_base") === null`).
2. [ ] `[+ tambah]` → isi nama + `192.168.1.5` (tanpa port) → tersimpan `http://192.168.1.5:8765`; tambah lagi nama berbeda + alamat sama → pesan "alamat itu sudah dipakai".
3. [ ] Badge: matikan CNdesktop → `[cek]` → baris PC itu `[PUTUS]`; hidupkan → `[cek]` → `[ok]`. PC versi lama (<1.6.0) tampil `[OK·lama]`, bukan `[PUTUS]`.
4. [ ] Gestur: tap tunggal tidak mengubah apa pun; tahan 900ms baris → muncul `[ubah]` + `[hapus]`; geser jari >10px saat tahan → batal (tak muncul).
5. [ ] `[hapus]` → `[yakin?]` → baris hilang + badge ikut hilang dari daftar. PC yang ikut sesi aktif ditolak hapus ("dipakai sesi aktif").
6. [ ] `[ubah]` → ganti nama/base → tersimpan; alamat milik PC lain ditolak (form tetap buka + pesan).
7. [ ] Dobel-tap baris → panel `kontrol: <nama>` dengan versi/ip:port dari `/api/status`; `[kembali]` kembali ke daftar.
8. [ ] Picker saat [buka]: `Lan.statusGet` di-mock jadi gagal untuk 1 dari 2 PC → picker hanya menampilkan PC tersambung, `[mulai]` nonaktif sebelum ada centang; 0 PC tersambung → "tak ada PC tersambung" + `[+ pc baru]`.
9. [ ] Sesi 2 PC: centang keduanya → `[mulai]` → bar Live `PC A + PC B`; tiap baris tx dapat tag nama PC; banner totals 1 baris gabungan dengan prefix `2 pc ·`.
10. [ ] Tx dengan `server_id` sama di dua PC (mis. 5) → keduanya tampil, tag PC berbeda; dobel-tap baris PC-A → koreksi hanya mengubah baris itu.
11. [ ] PC satu mati saat sesi jalan → status `[BUKA·kurang]`, baris tag PC lain tetap bertambah; hidupkan lagi → ≤4 dtk `[BUKA·ok]` + catch-up tanpa dobel (since per PC).
12. [ ] `[+tambah pc]` di Live → picker Hide PC yang sudah ikut sesi → pilih PC ketiga → tx-nya langsung masuk tanpa `[tutup]`.
13. [ ] Sesi ditutup → riwayat tampil nama PC (maks 2 + `(+n)`), bukan URL; dobel-tap riwayat → lanjutkan sesi dengan semua PC-nya.
14. [ ] Wipe: panel control PC yang ikut sesi aktif → tombol `[hapus]` (wipe) disabled + alasan tampil; setelah `[tutup]` → aktif lagi (PIN + ketik `HAPUS` → 200 `dihapus N`).
15. [ ] Print: `[kirim]` → picker PC tersambung dengan PC terakhir dipakai tercentang; ganti centang → struk keluar di printer PC yang dipilih; tutup picker → tak ada struk tercetak.
