# CNmobile

HP kasir (vanilla JS + Capacitor → APK). 2 layar: Live (via LAN ke connector)
+ Setoran (langsung ke GAS). Tidak input/edit transaksi, tidak print dari HP.

- Sumber kebenaran: baca dulu `docs/PRD.md`.
- Kontrak LAN (tanpa ubah): `../CNdesktop/docs/PRD.md` §5
  (`/health`, `/transactions?since_id`, `/totals`, `POST /print`, header `X-Token`).
- Kontrak GAS + rumus + filter periode, copy dari `../cash_note` (READ-ONLY, JANGAN edit):
  - `gas_service.py` → `call_api`/`login`/`get_dashboard_data`, hitung kurang/lebih
  - `tabs/kasir_tab.py` → filter periode 28–27 + merge by (tanggal,shift,cabang)
- Standar: vanilla JS tanpa framework; `npm`/Capacitor hanya saat wrap APK (`npx cap sync`).
