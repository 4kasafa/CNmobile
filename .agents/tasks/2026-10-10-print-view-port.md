# Print View Port — calculate_tab.py → CNmobile [print]
> Source: Port `cash_note/tabs/calculate_tab.py` (11 denom + expense + 58/80 receipt preview + local history) into `www/index.html` `#view-print`. CNdesktop PRD §6 has no `POST /api/print`, so send stays disabled stub (M2); only preview + local save work.
## Tasks
- [x] Phase 1: HTML expand `#view-print` placeholder into meta + denom + totals + actions + preview
  - details: in `www/index.html` replace `#view-print` placeholder with: meta inputs (kasir readonly from Setoran session, cabang/shift inputs), expense `[cmd]` line, `#denom-list` container, `#print-sumline` totals, actions `[simpan] [preview] [kirim:off] [bersih]`, preview block (`<pre id="receipt-pre">` + 58/80 toggle + `#print-msg` + `[kembali]`). No new views/routes.
  - files: `www/index.html`
  - done: `#view-print` contains all ids above, no placeholder text remains.
  - verify: `python -m http.server 8000 --directory www` then open `http://localhost:8000/` in Chrome → tab `[print]` shows meta/denom/totals/actions/preview skeleton.
- [x] Phase 2: CSS denom rows + receipt-pre reuse terminal tokens
  - details: in `www/css/style.css` style denom rows + `pre#receipt-pre` (white paper exception allowed) using existing `.tx/.tag/.cmdline/.msg/[cmd]`, abyss/sonar/coral/mint, JetBrains Mono 10px. No cards/gradients/new fonts.
  - files: `www/css/style.css`
  - done: denom rows visually match `.tx` list; `pre` wraps at 32/48 chars without page scroll-break.
  - verify: same Chrome session → resize to 360px width, rows + pre stay terminal-styled, no gradient/card artifacts.
- [x] Phase 3: `js/print.js` core — state + renderDenoms + qty guard + totals vs Live session
  - details: create `www/js/print.js` with 11-denom state (`cash_portion`/`noncash_portion` mirror), `renderDenoms()`, numeric-only qty guard (empty→0, reject alpha/negatif), `subtotal`/`grand_total` math, `diff = fisik − Total Sistem` where Total Sistem = active Live session `Store.listTx()` sum; diff color coral (kurang) / mint (lebih). Wire `<script src="js/print.js">` in `index.html`.
  - files: `www/js/print.js`, `www/index.html` (one script tag)
  - done: typing qty updates subtotal/grand/diff live; non-numeric input rejected; no-session shows `Total Sistem: —` + diff `—`.
  - verify: open Chrome console → set qty 100k×2, 50k×1 → subtotal shows 250.000; type `ab` → stays 0; `Store.listTx` empty → diff `—`.
- [x] Phase 4: expense INLINE di `#print-expense` (deviasi sadar: `#sheet-wrap` dipakai Setoran konflik — reuse tabrakan handler `resolveSheet`; inline tanpa modal baru, kriteria verify tetap lolos)
  - details: in `www/js/print.js` reuse existing `#sheet-wrap` bottom-sheet (no new modal): fields nominal + keterangan, `[simpan] [hapus] [batal]`. Expense subtracts from fisik (`fisik + nontunai − expense`), shown on sumline.
  - files: `www/js/print.js` (+ existing `#sheet-wrap` in `www/index.html`, no new container)
  - done: save/clear/cancel all close sheet and update totals; empty nominal = 0.
  - verify: Chrome → `[expense]` → input 10.000 → sumline fisik berkurang 10.000; `[hapus]` → kembali; `[batal]` → nilai tetap.
- [x] Phase 5: receipt builder port + preview toggle 58/80 + validation
  - details: in `www/js/print.js` port `format_key_value_line/format_amount_line/add_receipt_margin/generate_receipt_text` as plain-text functions, widths 32 (58mm) / 48 (80mm), screen 30/40; preview toggle re-renders `pre`; `[kembali]` hides preview. Validation blocks preview: kasir kosong OR grand_total==0 → `#print-msg` error. Persist kasir/cabang/shift to `localStorage cn_print_meta` (kasir prefilled from Setoran session, skip USERS_FILE; skip arabic ESC/POS image B64 — text line only).
  - files: `www/js/print.js`
  - done: preview text matches calculate_tab line layout at both widths; kasir empty or total 0 → blocked with msg; meta survives reload.
  - verify: Chrome → kasir kosong → `[preview]` → msg error, no pre; isi kasir + qty → toggle 58/80 → pre line length ≤32 / ≤48; reload → cabang/shift tetap.
- [x] Phase 6: `Store.saveCalc/listCalc` local history cap 50 + save action
  - details: in `www/js/store.js` add `saveCalc(entry)/listCalc()` over `localStorage cn_calc_history` (unshift, slice 50). In `www/js/print.js` `[simpan]` writes `{ts, kasir, cabang, shift, grand, diff, expense}` + `#print-msg` confirm. No GAS/desktop write.
  - files: `www/js/store.js`, `www/js/print.js`
  - done: 51st save drops oldest; reload keeps history; save shows confirm msg.
  - verify: Chrome console → `Store.listCalc().length` grows to ≤50 after looped saves; reload → history intact; `[simpan]` → msg `tersimpan`.
- [x] Phase 7: `Lan.print()` future stub disabled + button wiring
  - details: in `www/js/lan.js` add `print(payload)` stub: `POST /api/print`, 8s timeout, on 404/network → throw `disabled` message (M2 not available). In `www/js/print.js` `[kirim:off]` stays disabled with msg `kirim nonaktif (M2)` — never calls stub on success path.
  - files: `www/js/lan.js`, `www/js/print.js`
  - done: button visibly disabled; stub exists but unreachable; if forced, graceful msg not crash.
  - verify: Chrome → `[kirim]` disabled attr present, click → msg `kirim nonaktif`; console → `await Lan.print({})` → caught 404/disabled msg, no unhandled rejection.
- [ ] Phase 8: verification checklist pass (offline freeze, reload, wrap)
  - details: run full checklist, fix fallout in same files only (no new files): no-session `—`, qty math, diff coral/mint, expense `fisik+nontunai−expense`, validation blocks, 58/80 wrap ≤32/≤48, save history persists, send disabled msg, airplane-mode freeze (no fetch, totals still compute), reload persists qty+meta.
  - files: any of above (no new files)
  - done: all 9 checks green in one session.
   - verify: `python -m http.server 8000 --directory www` + Chrome: 1) fresh profile no-session → `—` 2) qty math 3) diff colors 4) expense math 5) empty-kasir/zero-total blocked 6) toggle widths wrap 7) save→`listCalc`→reload intact 8) kirim msg 9) airplane-mode totals work + reload qty/meta intact. No build step, no `npm`.
   - evidence (otomatis, 2026-10-10): `node --check` print/store/lan OK; helper struk w32 maxlen=32 PASS, w80 maxlen=48 PASS, fisik/jual/diff math PASS; HTML parser no-mismatch; http://localhost:8123/ → 200 + `view-print` + `print.js` 200. Sisa manual: 9 langkah Chrome/LAN di device (buka tab `[print]`, sesi Live asli, airplane-mode).
## Done
When every checkbox is `[x]`, run:
`Move-Item -LiteralPath ".agents/tasks/2026-10-10-print-view-port.md" -Destination ".agents/tasks/done/"`
