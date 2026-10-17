# Print Terminal Revamp — Denom Two-Line + Meta Collapse
> Source: Approved 3-part revision of CNmobile [print] view: denom rows become two-line terminal blocks, meta form mirrors Setoran login-collapse with shift select + prefill from latest cache entry, then verify. Out of scope: pulling K/F/selisih into receipt, new files, new color/font/gradient tokens.

## Tasks

- [x] Phase 1a — HTML: restructure meta into collapsed line + form
  - details: In `www/index.html` (~lines 81-92) replace 3 loose `.field` divs with: `#print-meta-line[hidden]` one-liner `└─ kasir · cabang · shift [ubah]` (reuse `#session-line` pattern) + `#print-meta-form` wrapping the 3 fields + row with `[tutup]` (`#btn-print-meta-close`) + `[ambil setoran]` (`#btn-print-meta-pull`). Keep input ids `in-kasir`/`in-cabang`/`in-shift` unchanged.
  - files: `www/index.html`
  - done: `#print-meta-line`, `#print-meta-form`, `#btn-print-meta-close`, `#btn-print-meta-pull` exist; old ids still present; no other markup touched.
  - verify: `python -c "from html.parser import HTMLParser; p=HTMLParser(); p.feed(open('www/index.html',encoding='utf-8').read()); print('parse ok')"`
- [x] Phase 1b — HTML: shift text input → select Pagi/Malam
  - details: Replace `<input id=in-shift>` with `<select id=in-shift><option value="">--</option><option>Pagi</option><option>Malam</option></select>` (display text PAGI/MALAM via CSS uppercase if needed). Keep `id=in-shift` so `print.js` `.value` API (`generateReceipt`/`doSave`/validation) unchanged.
  - files: `www/index.html`
  - done: `in-shift` is a `<select>` with empty + Pagi + Malam options; kasir/cabang stay text inputs.
  - verify: `python -c "import re; h=open('www/index.html',encoding='utf-8').read(); assert re.search(r'<select[^>]*id=\"in-shift\"',h) and 'Pagi' in h and 'Malam' in h; print('shift select ok')"`
- [x] Phase 2a — CSS: denom two-line block + top line
  - details: In `www/css/style.css`: change `.denom` from flex row to `display:block` (stacked), add `.denom-top` rule (~10 lines total) for line1 `┌──(100.000)-[Rp subtotal]` reusing `.pu`/`.pp` colors. Keep left status rail + `.hit` sonar highlight when qty>0. No new color/font/gradient tokens.
  - files: `www/css/style.css`
  - done: `.denom` is block, `.denom-top` styled, `.hit` rule still highlights qty>0 rows, no new `--*` tokens / no `linear-gradient`.
  - verify: `python -c "import re; c=open('www/css/style.css',encoding='utf-8').read(); assert '.denom-top' in c; assert re.search(r'\.denom\s*\{[^}]*display\s*:\s*block',c); print('denom css ok')"`
- [x] Phase 2b — CSS: meta one-liner + shift select joins nav rule
  - details: Style `#print-meta-line` by reusing/extending existing `#session-line` styling (same one-line + `[ubah]` look). Join `#in-shift` into the existing `#nav-select` CSS rule so shift dropdown looks identical to navbar dropdown (no duplicate rule body).
  - files: `www/css/style.css`
  - done: `#print-meta-line` visible as one line when unhidden; `#in-shift` shares `#nav-select` declaration (same selector list or identical props).
  - verify: `python -c "c=open('www/css/style.css',encoding='utf-8').read(); assert '#print-meta-line' in c and '#in-shift' in c; print('meta css ok')"`
- [x] Phase 3 — JS: renderDenoms two-line markup + paint into top line
  - details: In `www/js/print.js` `renderDenoms()` emit per-denom block: line1 `<div class=denom-top>┌──(label)-[subtotal span#sub-<denom>]</div>` + line2 `└─ lbr [qty input#q-<denom>]`; `paintSubtotals()` writes `rupiah()` into top-line span and toggles `.hit` on `.denom[data-denom]`. Keep element ids `q-<denom>`/`sub-<denom>` so existing selectors/input listeners survive.
  - files: `www/js/print.js`
  - done: denom rows render two lines with `┌──`/`└─` glyphs; typing qty updates top-line subtotal + `.hit`; totals unchanged.
  - verify: `node --check www/js/print.js`
- [x] Phase 4a — JS: prefill meta from latest Setoran cache entry (empty-only)
  - details: In `www/js/print.js` replace kasir-only `cn_setoran_cache.cashier` prefill with: read `localStorage cn_setoran_cache.data` array, sort desc via global `Conflict.parseDate(tanggal)` (same ordering as `www/js/setoran.js` `renderList`), take first entry → kasir/cabang/shift (normalize shift `/malam/i→Malam`, `/pagi/i→Pagi`, else keep). Auto-prefill fills EMPTY fields only (never clobber user edits on tab switch).
  - files: `www/js/print.js` (mirror `www/js/setoran.js:136-177` ordering logic, read-only ref)
  - done: With cache present + empty meta fields, kasir/cabang/shift auto-filled from newest entry; with user-edited non-empty fields, switching tabs does not overwrite.
  - verify: `node --check www/js/print.js`
- [x] Phase 4b — JS: [ambil setoran] + collapse toggle + fold persist (+meta fields persist on `input`, bukan cuma `change`, agar pindah tab tanpa blur tak hilangkan ketikan)
- [x] Follow-up (2026-10-10): toggle `#btn-expense` DIHAPUS; expense lipat ala meta — ringkas `└─ Rp X · note [ubah]/[+]`, buka form, tutup via `[batal]` (buang ketikan) / `[simpan]` / `[hapus]`. Fungsional 11/11 PASS.
- [x] Follow-up 2 (2026-10-10): `#expense-line` + `#expense-info` DIHAPUS; ringkas dilebur ke header `└─ pengeluaran · Rp X · note [+]/[ubah]` (satu baris, tanpa elemen ekstra). Fungsional 11/11 PASS.
- [x] Follow-up 3 (2026-10-10): fitur RIWAYAT print DICABUT seutuhnya — `[simpan]` + `doSave` + `renderHistory` + `#print-history` + CSS-nya + `Store.saveCalc/listCalc` + helper `esc` (print.js). Riwayat sesi di Live tak tersentuh. `node --check` OK, no-sisa-ref.
  - details: Wire `[ambil setoran]` (`#btn-print-meta-pull`) to force-overwrite all three fields from latest cache entry; `[ubah]` opens form, `[tutup]` (`#btn-print-meta-close`) blocked with msg when any of kasir/cabang/shift empty; auto-collapse to `#print-meta-line` when all three filled else form stays open + `print-msg` `login Setoran dulu`. Persist fold flag in `cn_print_meta.fold` (extend existing `saveMeta`/`loadMeta`, same pattern as `cn_session_collapsed`); reload restores values + fold.
  - files: `www/js/print.js`, `www/index.html` (ids from Phase 1)
  - done: collapse/expand works, incomplete `[tutup]` blocked, fold + values survive reload, `select.value` path keeps `generateReceipt`/`doSave`/validation unchanged.
  - verify: `node --check www/js/print.js`
- [x] Phase 5a — Verify automated: syntax + markup + receipt width math
  - evidence (2026-10-10): `node --check` print/store/lan OK; HTML ids + shift select + CSS denom/meta rules OK; fungsional node+stubDOM 10/10 (prefill entri terbaru by Conflict.parseDate, shift Malam/Pagi normalize, auto-collapse + teks `└─ kasir · cabang · SHIFT`, fill-empty-only, fold persist, tanpa cache → form open + hint); http://localhost:8124/ 200 semua aset.
  - details: Run static checks only, no edits: `node --check` on `print.js`, HTML parse of `index.html`, CSS grep for `.denom-top`/`#print-meta-line`/`#in-shift`, receipt width assertion (all `generateReceipt(32/48)` lines ≤32/≤48 cols incl. margin).
  - files: none (check `www/index.html`, `www/css/style.css`, `www/js/print.js`)
  - done: All static checks green.
  - verify: `node --check www/js/print.js && python -c "from html.parser import HTMLParser; p=HTMLParser(); p.feed(open('www/index.html',encoding='utf-8').read()); print('html ok')"`
- [ ] Phase 5b — Verify manual Chrome: denom/meta/shift/persist/receipt
  - details: Serve `python -m http.server 8000` in repo root, open Chrome `http://localhost:8000/www/`: (1) denom shows two-line blocks + `.hit` on qty>0; (2) with `cn_setoran_cache` present meta collapses to `└─ kasir · cabang · shift [ubah]`; (3) shift dropdown Pagi/Malam works; (4) `[ambil setoran]` overwrites all three; (5) `[tutup]` blocked when incomplete; (6) reload persists values+fold; (7) receipt preview wraps ≤32 cols @58 / ≤48 cols @80.
  - files: none (manual against `www/index.html` + `www/js/print.js` + `www/css/style.css`)
  - done: All 7 manual steps pass; any failure filed as new bug, not scope-creeped here.
  - verify: `python -m http.server 8000` then Chrome `http://localhost:8000/www/` (manual checklist above)

## Done
When every checkbox is `[x]`, run:
`Move-Item -LiteralPath ".agents/tasks/2026-10-10-print-terminal-revamp.md" -Destination ".agents/tasks/done/"`
