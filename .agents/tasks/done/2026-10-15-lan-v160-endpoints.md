# LAN v1.60 Endpoints lan.js
> Source: Tambah 5 helper LAN v1.60 di www/js/lan.js saja (vanilla JS, reuse postJson + mapErr).
> Aturan: tanpa simpan PIN, error mapping sama, timeout 8s via postJson.
## Tasks
- [x] Implement 5 helper LAN v1.60 di www/js/lan.js, acceptance semua ter-export dan lolos node --check
  - [x] Implement statusGet(baseUrl) GET /api/status di www/js/lan.js, acceptance missing version throw "PC versi lama, update dulu", verification `node --check www/js/lan.js`
  - [x] Implement logGet(baseUrl,pin,tail) GET /api/log di www/js/lan.js, acceptance default tail 200 clamp 1-1000 PIN tak disimpan, verification `node --check www/js/lan.js`
  - [x] Implement portSet/pinSet/shutdown POST via postJson di www/js/lan.js, acceptance 8s timeout + mapErr 400/403/409/429, verification `node --check www/js/lan.js`
  - [x] Export 5 fungsi di return {...} di www/js/lan.js, acceptance statusGet/logGet/portSet/pinSet/shutdown callable, verification `node --check www/js/lan.js`
  - [x] Verify syntax + smoke Chrome console untuk www/js/lan.js, acceptance node clean dan GET smoke OK tanpa shutdown produksi, verification `node --check www/js/lan.js`
## Done
When every checkbox is `[x]`, run:
`Move-Item -LiteralPath ".agents/tasks/2026-10-15-lan-v160-endpoints.md" -Destination ".agents/tasks/done/"`
