# TEST-CHECKLIST — Live sesi manual (M1)

Kontrak LAN: `../CNdesktop/docs/PRD.md` §6 — `GET /api/health`, `GET /api/transactions?since&limit=50`, tanpa auth.

## M1 (Chrome desktop, tanpa PC asli)

1. [ ] Buka `www/index.html` via serve (`npx serve www` / Live Server) → tab dropdown `[live]` → tampil bar `└─ pc` + `[buka]`.
2. [ ] Mock: devtools Console → `Lan.fetchTx = async () => ({ok:true, rows:[{server_id:1,no_transaksi:"NO-1",total:50000,tunai:50000,nontunai:0,bank:"",kategori:"Tunai",created_at:"2026-10-10 10:00:00"}]})` → isi pc `http://127.0.0.1:8765` → `[buka]` → list tampil 1 tx <3 dtk.
3. [ ] Drain loop: mock 60 rows `since=0` → buka → cek `await Store.listTx(Live._state.sessionId)` = 60 (2 halaman × 50).
4. [ ] Dedup: panggil `Live.retry()` → jumlah tetap 60, tidak dobel (by `server_id` + `no_transaksi`).
5. [ ] Putus: `Lan.fetchTx = async () => ({ok:false, error:"boom", rows:[]})` → `[coba lagi]` → banner `└─ belum lengkap` muncul + sesi tetap `[BUKA·kurang]` + riwayat tag `belum lengkap`.
6. [ ] Tutup: `[tutup]` → riwayat tampil sesi `[tutup]` + `belum lengkap` bila pernah putus.
7. [ ] Reload halaman → riwayat sesi tetap ada (localStorage `cn_live_sessions` / `cn_live_tx`).

## M2 (dengan PC + CNdesktop asli, WiFi sama)

1. [ ] Isi `http://<IP-PC>:8765` → `[buka]` → `GET /api/health` ok → drain tampil transaksi kasir nyata.
2. [ ] Buat transaksi baru di Ketoko → ≤4 dtk muncul di HP (poll 2 dtk + drain).
3. [ ] Matikan CNdesktop → banner `belum lengkap` + `[coba lagi]`; hidupkan lagi → retry mengisi yang kurang, tanpa dobel (`since` = `last_seen`).
4. [ ] Ganti WiFi / IP berubah → ganti isi pc → `[buka]` sesi baru, sesi lama tetap di riwayat.

## M3 (settings: watcher + wipe, dengan PC + CNdesktop asli, WiFi sama)

1. [ ] Dropdown `[settings]` → `└─ pc` tampil dari `[live]`; kosong → "isi dulu di [live]".
2. [ ] Buka settings → `watcherGet` auto-load → status `[nyala]`/`[mati]`; `[muat ulang]` refresh.
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
