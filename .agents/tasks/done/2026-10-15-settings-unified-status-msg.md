# Settings Unified Status + Message
> Source: Unify view-settings into single #set-status line + single #set-msg box, no 3 msg duplicates.
> Retarget settings.js + badge [OK]/[PUTUS] + fold toggle; vanilla JS, PIN memory only, reuse mapErr, keep min-height.
## Tasks
- [x] Unify view-settings header into single status + message with no duplicate PC line or 3 msg boxes
  - [x] Add div#set-status (span#set-status-info '└─ pc: --' + span#set-status-badge '[--]') after -[ip] header plus single div#set-msg.msg accepted when header shows session-line-like row without ┌── in www/index.html, verify with `Select-String -Pattern "set-status|set-msg" www/index.html`
  - [x] Delete #watch-msg, #wipe-msg, #log-msg and merge set-pc text into status-info accepted when no duplicates remain and min-height stays to prevent jump in www/index.html, verify with `Select-String -Pattern "watch-msg|wipe-msg|log-msg" www/index.html`
- [x] Retarget settings logic to unified msg plus badge plus fold with PIN memory only and reuse mapErr
  - [x] Retarget watchMsg/wipeMsg/logMsg to #set-msg keeping color logic accepted when all three overwrite same box reusing mapErr in www/js/settings.js, verify with `node --check www/js/settings.js`
  - [x] Add Lan.statusGet check with health fallback for old PC in load() accepted when badge paints [OK]/[PUTUS] in www/js/settings.js, verify with `node --check www/js/settings.js`
  - [x] Add dblclick toggle collapsed on #set-status mirroring session-line accepted when fold works and PIN stays in memory only in www/js/settings.js, verify with `node --check www/js/settings.js`
- [x] Style unified status reusing session-line pattern with no layout jump
  - [x] Add 1-2 rules for #set-status reusing #session-line pattern plus .collapsed accepted when visual matches session-line and min-height stays in www/css/style.css, verify with `Select-String -Pattern "set-status" www/css/style.css`
- [x] Verify unified status and message with no regressions
  - [x] Run static check passing on settings JS accepted when no syntax errors in www/js/settings.js, verify with `node --check www/js/settings.js`
  - [x] Smoke badge plus overwrite msg plus fold toggle accepted when [OK]/[PUTUS] shows, last msg wins, dblclick collapses in www/index.html and www/js/settings.js, verify with manual Chrome smoke on view-settings
## Done
When every checkbox is `[x]`, run:
`Move-Item -LiteralPath ".agents/tasks/2026-10-15-settings-unified-status-msg.md" -Destination ".agents/tasks/done/"`
