# Live sesi manual LAN (M1 web murni)
> Source: Halaman Live buka sesi manual dulu lalu kuras buffer PC via GET /api/health + GET /api/transactions?since&limit=50 (tanpa auth). Putus = tetap buka + retry + banner "belum lengkap" + riwayat sesi. Vanilla JS, pola async fetch + stale-guard, 1 API js/store.js (M1 localStorage, M4 sqlite native bila isNative).
## Tasks
- [x] T1 config.js: get/set base_url localStorage
  - details: `www/js/config.js`, global `LanConfig`, key `cn_lan_base`, normalisasi trailing `/`, API: `get() / set(v) / clear()`
  - verify: buka Chrome devtools `localStorage.getItem("cn_lan_base")` tersimpan
- [x] T2 store.js skema + API sama M1/M4
  - details: `www/js/store.js`, global `Store` async, keys `cn_live_sessions / cn_live_tx / cn_live_meta`; sessions(id,base_url,started_at,closed_at,status,complete,last_seen,count); tx dedup by `(sessionId,server_id)` + `no_transaksi` unik per sesi; API: `init/createSession/closeSession/getSession/listSessions/upsertTx/listTx/getLastSeen/setLastSeen`
  - verify: `await Store.createSession("http://1.1.1.1:8765")` lalu `listSessions()` muncul di devtools
- [x] T3 lan.js health + transactions tanpa auth
  - details: `www/js/lan.js`, global `Lan`, `health(base)` → `GET /api/health` timeout 8s return `{ok}`, `fetchTx(base,since,limit=50)` → `GET /api/transactions?since=&limit=` return array ternormalisasi `{server_id,no_transaksi,total,tunai,nontunai,bank,kategori,created_at}`
  - verify: `await Lan.health("http://PC:8765")` → `{ok:true}` saat PC hidup; gagal → `{ok:false,error}`
- [x] T4 live.js state machine buka/kuras/poll/tutup/retry
  - details: `www/js/live.js`, global `Live`; `openSession()` = health-check lalu `Store.createSession` lalu `drainBuffer()` loop `since=last_seen,limit=50` sampai `<limit`; polling 2 dtk + stale-guard `seq`; putus → tetap buka + `complete=0` + banner; `closeSession()` tandai closed + `complete` sesuai pernah-putus; `retryNow()` = drain sekali
  - verify: klik [buka] dengan mock `since=0` data masuk list; matikan server → banner "belum lengkap" + sesi tetap buka
- [x] T5 index.html view-live: session-bar + banner + list + riwayat
  - details: `www/index.html:62-65` ganti placeholder → `#live-bar` (input `#in-lan` + `#btn-live-toggle` + `#live-status`), `#live-banner` (hidden + `#btn-live-retry`), `#live-list`, `#live-history`; tambah `<script>` config/store/lan/live sebelum app.js (urutan: gas,conflict,seed,setoran,config,store,lan,live,app)
  - verify: `grep "live-bar" www/index.html` ketemu; buka Chrome tab [live] tampil bar
- [x] T6 css minimal reuse tema terminal
  - details: `www/css/style.css` tambah `#live-bar,#live-banner,#live-list,#live-history` reuse `.tx/.tag/.msg/.cmdline`, tanpa kartu/pill/gradien, sentuh ≥44px
  - verify: tidak ada `border-radius/card/box-shadow` baru; `grep "live-bar" www/css/style.css`
- [x] T7 TEST-CHECKLIST + uji manual M1
  - details: `docs/TEST-CHECKLIST.md` (baru) isi: pairing base_url manual, buka sesi <3 dtk, drain loop ≥50 rows, putus → banner + retry, tutup → riwayat, reload → data tidak hilang
  - verify: `Test-Path docs/TEST-CHECKLIST.md` True; jalankan tiap baris di Chrome desktop + devtools offline
## Done
When every checkbox is `[x]`, run:
`Move-Item -LiteralPath ".agents/tasks/2026-10-10-live-sesi-manual-lan.md" -Destination ".agents/tasks/done/"`

