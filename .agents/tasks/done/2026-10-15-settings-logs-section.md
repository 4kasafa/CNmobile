# Settings Logs Section
> Source: Add PIN-gated [logs] viewer to settings view (vanilla JS, per-section in-memory PIN).
> Reuses mapErr + Lan.logGet, no polling/auto-load; scrollable pre output with inline error msg.
## Tasks
- [x] Add logs section markup to settings view accepted when header/PIN/pre/msg render below wipe
  - [x] Append logs block inside view-settings below wipe in www/index.html accepted when header ┌──(settings@cn)-[logs] plus set-log-pin plus btn-log-peek plus btn-log-load plus pre#log-pre default 'belum dimuat' plus div#log-msg.msg exist in `www/index.html` verify with `Select-String -Pattern "log-pre" -LiteralPath "www/index.html"`
- [x] Implement per-section PIN logs loading accepted when empty-PIN inline msg, 403/429 clears PIN, join busy disables
  - [x] Add loadLog() in www/js/settings.js accepted when empty PIN shows inline msg plus Lan.logGet(base,pin,200) success joins lines into log-pre plus 403/429 clears PIN plus join uses busy() disable plus reuses mapErr plus PIN in-memory only plus no polling/auto-load in `www/js/settings.js` verify with `node --check www/js/settings.js`
- [x] Style log output and verify end-to-end accepted when internal scroll plus smoke passes
  - [x] Add scroll rule in www/css/style.css accepted when #log-pre has max-height 40vh plus overflow-y auto plus pre-wrap and page unaffected in `www/css/style.css` verify with `Select-String -Pattern "#log-pre" -LiteralPath "www/css/style.css"`
  - [x] Verify logs section in www/index.html, www/js/settings.js, www/css/style.css accepted when wrong PIN shows 'PIN salah' and ok shows scrollable box in `www/index.html, www/js/settings.js, www/css/style.css` verify with `node --check www/js/settings.js`
## Done
When every checkbox is `[x]`, run:
`Move-Item -LiteralPath ".agents/tasks/2026-10-15-settings-logs-section.md" -Destination ".agents/tasks/done/"`
