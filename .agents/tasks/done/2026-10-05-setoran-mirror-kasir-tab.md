# Setoran: mirror Tab Kasir, terminal-like UI (web murni, iterasi 1)
> Source: Mulai dari fitur cek setoran dulu, mirror `tabs/kasir_tab.py` desktop (periode 28–27, bukan dashboard 5 hari mentah). UI terminal-like hacker theme tanpa glow, 5 file di `www/`, cache localStorage, konflik ikut iterasi 1, login ingat email+password.

## Tasks
- [x] Scaffold `www/index.html` shell terminal-like
  - details: header bar (judul + tombol refresh), banner kasir (info + status label), 3 box ringkasan (TX periode berjalan / KURANG / LEBIH), container list transaksi, container bottom-sheet konflik, banner offline + tombol retry. Tab bar: Setoran aktif, Live nonaktif (stub).
  - related files: `www/index.html`
  - verification: buka file langsung di Chrome (`File > Open`), struktur tampil tanpa JS error di console.
- [x] Buat `www/css/style.css` tema terminal
  - details: token `--bg:#0b0d0b, --panel:#101310, --line:#2a312a, --fg:#c9d1c9, --dim:#7d8a7d, --grn:#4ade80, --amb:#eab308, --red:#f87171, --gry:#9ca3af`; full monospace stack; mobile-first 1 kolom; area sentuh >=44px. LARANGAN: tanpa `box-shadow` glow, tanpa gradient, tanpa animasi blink/scanline; status selalu tag teks (`[OK]`/`[SYNC]`/`[CONF n]`/`[ERR]`), tanpa emoji sebagai satu-satunya penanda.
  - related files: `www/css/style.css`
  - verification: `Select-String -Pattern "box-shadow|linear-gradient|radial-gradient|blink|scanline" www/css/style.css` kosong + kontras terbaca di Chrome mobile emulation.
- [x] Buat `www/js/gas.js` port `cash_note/gas_service.py`
  - details: `callApi` (POST `{action,args}`, header `text/plain`, URL dari `constants.py:25` `GAS_URL_KASIR`); `login` (checkLogin + `deviceId:"CNmobile"`, token dari `redirectUrl` fallback `token_<ms>` per `:35-62`); `getDashboardData` (`[token, cashier_name]` + `total_kurang`/`total_lebih` per `:64-95`).
  - related files: `www/js/gas.js`, ref READ-ONLY `D:\Desktop\projects\cash_note\gas_service.py`, `D:\Desktop\projects\cash_note\constants.py:25`
  - verification: login asli via console DevTools mengembalikan token + data (`await login(email,pw)` lalu `await getDashboardData(token,nama)` sukses).
- [x] Buat `www/js/conflict.js` port `tabs/kasir_tab.py`
  - details: `_parseDate` (`:221-264`), `_periodeOf` 28–27 (`:267-278`, tgl>=28 masuk bulan berikut), `_txKey`/`_isConflict`/`_toInt` (`:419-444`, key=tanggal+shift+cabang), `mergeGasData` (skip luar periode, tandai `_conflict`, return `n_new`/`n_conflict` per `:446-484`), `resolve(useGas)` (Pakai Lokal buang flag / Pakai GAS ganti item per `:789-804`).
  - related files: `www/js/conflict.js`, ref READ-ONLY `D:\Desktop\projects\cash_note\tabs\kasir_tab.py`
  - verification: unit check manual di console — tgl 27 vs 28 beda bulan periode; key sama angka beda → konflik `true`; `resolve` kedua arah benar.
- [x] Buat `www/js/setoran.js` glue+render mirror kasir_tab
  - details: state token di memori; localStorage `cn_cred` `{email,password}` + checkbox ingat + `cn_setoran_cache` `{data,last_sync}`; purge luar periode saat load (port `:292-316`); render cache dulu lalu sinkron background + stale-guard async tanpa threading (port `:353-372`,`:498-549`); render banner info kasir + status label `[OK jam]`/`[SYNC]`/`[CONF n]` (port `:377-417`); 3 ringkasan + label periode `YYYY-MM` (port `:336-351` + `format_rupiah :15-22`); list kartu baris-log terbaru di atas `#no tanggal [SHIFT] cabang | kasir | K: Rp F: Rp | [STATUS] Rp` + tombol `[DIFF]` bila konflik (port `:644-763`); bottom-sheet non-blokir LOKAL vs GAS + `[PAKAI LOKAL]`/`[PAKAI GAS]` (port `:765-814`); internet mati → cache + banner `[RETRY]` (PRD §4.7).
  - related files: `www/js/setoran.js`, `www/index.html`, `www/js/gas.js`, `www/js/conflict.js`
  - verification: tiap perilaku dicoba di Chrome — login benar tampil list, login salah tampil error; refresh update `last_sync`; airplane mode baca cache + banner retry; konflik kedua pilihan (lokal/gas) benar.
- [x] Uji akhir HP Chrome (iterasi selesai)
  - details: alur penuh — login → list periode berjalan tampil → refresh → offline banner → konflik bottom-sheet → purge periode (item tgl 27 hilang saat periode berganti).
  - related files: `www/index.html`, `www/js/setoran.js`, `docs/PRD.md`
  - verification: semua langkah lolos manual di Chrome; semua checkbox di atas `[x]` = iterasi selesai.

## Non-tujuan (jangan dikerjakan)
- `www/js/lan.js`, `www/js/sync.js`, `www/js/live.js`, `www/js/store.js`/SQLite (`@capacitor-community/sqlite`)
- pairing/QR, print (`POST /api/print`), `capacitor.config.ts`, `android/`
- `manifest.json` / service worker / icons
- `docs/TEST-CHECKLIST.md`
- dropdown multi-kasir (satu kasir per HP)
- efek CRT/typing, light mode
- Accepted debt: password disimpan di localStorage (`cn_cred`) atas permintaan user — sadar melanggar PRD §8; upgrade path = kembali ke token-di-memori saja.

## Done
When every checkbox is `[x]`, run:
`Move-Item -LiteralPath ".agents/tasks/2026-10-05-setoran-mirror-kasir-tab.md" -Destination ".agents/tasks/done/"`
