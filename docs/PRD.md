# PRD — Mobile (repo BARU, mis. `CNmobile`, Capacitor)

> Repo `cash_note` TIDAK diubah. Repo ini: web app (vanilla JS) + Capacitor wrapper → APK.
> Bicara ke 2 backend: (1) connector PC via WiFi-LAN, (2) GAS langsung untuk setoran.

## 1. Latar & tujuan

Kasir pantau dari HP: lihat transaksi live yang dibaca connector PC, kirim perintah print struk ke PC, dan cek hasil setoran dari GAS — tanpa duduk di depan PC.

Non-tujuan: tidak input/edit transaksi, tidak print langsung dari HP (Bluetooth), tidak offline-edit + sync konflik.

## 2. Keputusan kunci (locked)

- 2 layar saja: **Live** + **Setoran** (+ tombol Print di Live).
- Data live: polling `GET /api/transactions?since_id=` tiap 2 detik (cukup untuk 1 HP; tanpa WebSocket).
- Setoran: fetch GAS **langsung dari HP** (kontrak sama dengan `gas_service.py` repo lama).
- Pairing: scan QR dari tray PC → simpan `{base_url, token}` di `localStorage`.
- Vanilla JS tanpa framework (kecil, 1 dev, tanpa build step untuk web-nya).

## 3. Struktur file repo baru

```
CNmobile/
  README.md                    # dev (npm), pairing ke PC, build APK, troubleshooting
  package.json                 # @capacitor/core, @capacitor/cli, @capacitor/android (+ qrcode reader? pakai input manual fallback)
  capacitor.config.ts          # appId mis. com.toko.cashnote, webDir: www
  www/                         # web app murni (bisa dibuka di Chrome dulu sebelum wrap)
    index.html                 # shell + 2 tab (Live, Setoran) + dialog pairing + tombol print
    manifest.webmanifest       # nama, ikon, display standalone (untuk mode PWA fallback)
    sw.js                      # minimal (cache shell) — relevan untuk mode browser, diabaikan di native
    css/style.css              # mobile-first, 1 kolom, sentuh ≥44px
    js/config.js               # simpan/baca {base_url, token} localStorage
    js/lan.js                  # GET health/transactions/totals, POST print (header X-Token)
    js/gas.js                  # PORT dari gas_service.py: call_api/login/get_dashboard_data via fetch
                               #   + hitung total_kurang/total_lebih (gas_service.py:76-94)
                               #   + filter periode 28–27 & merge by (tanggal,shift,cabang) (kasir_tab.py:267-278,446-458)
    js/live.js                 # polling since_id, render list + totals, tombol print per struk/periode
    js/setoran.js              # login (email/pass, deviceId:"CashNoteMobile"), render dashboard 5 hari
    js/app.js                  # glue tab + pairing flow
    icons/                     # icon-192/512 + maskable
  android/                     # hasil `npx cap add android` (dicommit, kecuali build/ via gitignore bawaan)
  docs/TEST-CHECKLIST.md       # uji manual: pairing, live <3s, print, GAS, ganti WiFi/IP
```

## 4. Layar & perilaku

1. **Pairing (sekali):** tombol Pair → input/scan QR (`http://IP:8765#token=...`) → `GET /health` cek → simpan. Gagal → pesan "satu WiFi dengan PC?".
2. **Live:** list transaksi terbaru (nominal Rp, jam, label), totals (kurang/lebih), auto-refresh 2 dtk + pull indikator. Tombol **Print** per item / print rekap → `POST /api/print` → toast `job_id` + status.
3. **Setoran:** form email+password (disimpan hanya token di memori, bukan password) → `checkLogin` → `getDashboardData` → list 5 hari + total kurang/lebih. Tombol refresh.
4. **Offline LAN:** bila PC tak terjangkau → banner "PC offline", tombol retry; data GAS tetap bisa dibuka (internet ada).

## 5. Kontrak yang dipakai ulang (copy dari repo lama, bukan import)

- LAN: lihat `../CNdesktop/docs/PRD.md` §5 (`/health`, `/transactions?since_id`, `/totals`, `POST /print`, header `X-Token`).
- GAS: `POST GAS_URL_KASIR` body `{action, args}` header `Content-Type: text/plain`:
  - `checkLogin [{email, password, deviceId:"CashNoteMobile"}]` → token dari `redirectUrl` (fallback `token_<ms>`).
  - `getDashboardData [token, cashier_name]` → `{data[], totalTransaksi}`; item `{tanggal,shift,cabang,kasir,totalKomputer,uangFisik,jumlahSelisih,statusSelisih}` (`tabs/kasir_tab.py:678-725`).

## 6. Acceptance

- [ ] Dibuka di Chrome HP (WiFi sama): pairing QR → Live update <3 dtk.
- [ ] Tombol print → struk fisik keluar di PC + status `done`.
- [ ] Tab Setoran: login + data 5 hari tampil tanpa lewat PC.
- [ ] APK debug (`npx cap sync android` + build) terinstall & ketiga alur di atas jalan di device.
- [ ] PC mati → banner offline jelas, tidak crash.

## 7. Milestone

M1 web murni di Chrome (pairing manual + live mock) → M2 sambung LAN asli + print → M3 GAS setoran → M4 `cap add android` + APK debug → uji di toko.
