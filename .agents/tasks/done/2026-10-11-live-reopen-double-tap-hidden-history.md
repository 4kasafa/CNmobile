# Live: dobel-tap buka kembali sesi + riwayat hidden saat sesi dibuka
> Source: Halaman Live sembunyikan riwayat sesi total saat sesi aktif; dobel-tap item riwayat closed melanjutkan sesi itu via patchSession status open + drain dari last_seen. Semua di www/js/live.js tanpa API Store baru.
## Tasks
- [x] Sembunyikan #live-history saat sesi terbuka dan tampilkan lagi setelah tutup
  - [x] Terapkan hide/show di renderHistory dan renderAll di www/js/live.js dengan acceptance #live-history hidden saat S.sessionId set dan visible lagi setelah closeCurrent atau no session, verifikasi harness node 18/18 ALL_GREEN
- [x] Tandai item riwayat closed dengan hint dobel-tap dan buat item open non-tappable
  - [x] Tambahkan label hint dobel-tap buka lagi pada item closed di www/js/live.js fungsi renderHistory dengan acceptance item closed tampilkan hint kecil dan item open/active no-op saat di-tap, verifikasi harness (hint ada, tap aktif no-op)
- [x] Deteksi dobel-tap via delegated click listener 350ms pada #live-history
  - [x] Pasang single delegated click listener di #live-history di www/js/live.js dengan acceptance tap kedua pada session id sama dalam 350ms memicu reopen dan single tap no-op tanpa dblclick, verifikasi harness (single no-op, double reopen)
- [x] Implementasikan reopenSession(id) lanjutkan sesi closed dari last_seen
  - [x] Panggil closeCurrent lalu Store.patchSession dan drain di www/js/live.js fungsi reopenSession dengan acceptance tutup sesi lain dulu, patch status open closed_at null, restore S.base ke input plus LanConfig, everBroken dari !complete, bump S.seq stopTimer status [BUKA·kuras...] renderAll drain(my) dari last_seen idempotent via upsertTx restart poll 2s dan PUTUS saat PC unreachable, verifikasi harness (pindah A→B, base pulih, retry tanpa dobel)
- [x] Verifikasi M1 end-to-end dengan Lan.fetchTx mocked tanpa duplikat
  - [x] Jalankan skenario mock via harness node (C:\Users\salam\AppData\Local\Temp\opencode\live-test.js, throwaway) dengan acceptance open sembunyikan history close tampilkan lagi, dobel-tap closed buka dengan data dan status open, single tap no-op, dobel-tap saat sesi lain open tutup yang lama, retry setelah reopen tanpa duplikat — hasil ALL_GREEN 18/18
## Done
When every checkbox is `[x]`, run:
`Move-Item -LiteralPath ".agents/tasks/2026-10-11-live-reopen-double-tap-hidden-history.md" -Destination ".agents/tasks/done/"`
