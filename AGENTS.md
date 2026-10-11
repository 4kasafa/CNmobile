# CNmobile

HP kasir: vanilla JS + Capacitor → APK. 2 layar: Live (via LAN ke connector) + Setoran (langsung ke GAS). Bukan input/edit transaksi, bukan print dari HP.

Scaffold belum ada (`www/`, `package.json`, `android/` belum dibuat) — bangun per `docs/PRD.md` §3 saat mulai.

- Sumber kebenaran: baca `docs/PRD.md` dulu. Sibling `../cash_note` dan `../CNdesktop` READ-ONLY, jangan edit.
- Kontrak LAN otoritatif hanya `../CNdesktop/docs/PRD.md` §5 — jangan definisikan endpoint sendiri. Ringkasnya (`X-Token`, port 8765): `GET /api/health`, `GET /api/outbox?since_id=N`, `POST /api/ack {last_id}`, `GET /api/totals`, `POST /api/print`, `GET /api/print/:id`, `POST /api/pair`.
- Sinkronisasi: pull `since_id` → upsert by `uuid` → ack. `since_id` (rowid) bukan identitas; ack menghapus baris di desktop. Tanpa ACK data tetap di desktop, HP tandai sesi "belum lengkap".
- Data: HP pemilik utama (SQLite via `@capacitor-community/sqlite`); desktop hanya buffer. Koreksi lokal (`edited`) tidak dikirim balik. Dev web dulu di Chrome via `js/store.js` fallback (sql.js+IndexedDB) sebelum `npx cap add/sync android`.
- GAS (port dari `../cash_note`, jangan import): `POST {action,args}` header `text/plain`; login `deviceId:"CNmobile"`, token dari `redirectUrl` fallback `token_<ms>`; filter periode 28–27 + merge by (tanggal,shift,cabang) dari `tabs/kasir_tab.py`. Token di memori saja, jangan simpan password.
- Standar: vanilla JS tanpa framework/build step (`npm`/Capacitor hanya untuk wrap APK). Pola async `fetch` + stale-guard; tanpa `threading`/`after`, tanpa widget customtkinter.
