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
