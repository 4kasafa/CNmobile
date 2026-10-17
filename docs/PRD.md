# PRD — Mobile (repo BARU, mis. `CNmobile`, Capacitor)

> Repo `cash_note` TIDAK diubah. Repo ini: web app (vanilla JS) + Capacitor wrapper → APK.
> Bicara ke 2 backend: (1) connector PC via WiFi-LAN, (2) GAS langsung untuk setoran.

## 0. Konteks & referensi (baca dulu)

Dua rujukan wajib:
1. `cash_note` = app kasir desktop existing (Python + customtkinter, Windows-only):
   baca POS Ketoko via UIA, simpan JSON `data/`, backend GAS. Lokasi:
   `D:\Desktop\projects\cash_note` (`../cash_note`). DIKUNCI — copy logika saja.
2. `CNdesktop` = connector PC (`D:\Desktop\projects\CNdesktop`, `../CNdesktop`):
   buffer sementara + HTTP LAN. Kontrak endpoint HANYA dari `../CNdesktop/docs/PRD.md` §5
   — mobile dilarang mendefinisikan endpoint sendiri.
Posisi repo ini: PEMILIK DATA UTAMA (SQLite di HP). Desktop hanya perantara sesi aktif.

## 1. Latar & tujuan

Kasir pantau dari HP: lihat transaksi live yang dibaca connector PC, kirim perintah print struk ke PC, dan cek hasil setoran dari GAS — tanpa duduk di depan PC.

Non-tujuan: tidak input/edit transaksi, tidak print langsung dari HP (Bluetooth), tidak offline-edit + sync konflik.

## 2. Keputusan kunci (locked)

- 2 layar saja: **Live** + **Setoran** (+ tombol Print di Live).
- **Daftar computer** (tab `[comp]`, menggantikan `[settings]`, vv1.6.0+): tiap PC = `nama` +
  `base URL` (`http://IP:8765`) di `localStorage cn_comps`; badge `[ok]/[OK·lama]/[putus]` dari
  `GET /api/status` (fallback `GET /api/health` untuk PC <1.6.0), dicek saat tab dibuka + tombol `[cek]`.
  Gestur: tap tunggal no-op · dobel-tap → halaman **control** (status + watcher + wipe + log) ·
  tahan 900ms → `[ubah]`/`[hapus]`→`[yakin?]`. **Wipe diblokir di HP** bila PC ikut sesi aktif.
- Sesi Live: **1 sesi, N PC**. `[buka]` → picker berisi **hanya PC tersambung** (`Comps.online()`
  = cek ulang lalu filter), centang beberapa, `[mulai]`. Baris picker menampilkan tombol tambah
  PC baru. `[+tambah pc]` menyisip PC ke sesi yang sedang jalan (PC yang sudah ikut sesi tak muncul).
- Multi-PC: `server_id` bisa bentrok antar PC → identitas baris `tid = "<comp_id>:<server_id>"`,
  bucket tx `"<sessionId>|<comp_id>"`, `since` + `complete` **independen per PC** (satu PC putus
  tak menjatuhkan PC lain; yang nyala lagi otomatis tertangkap), `no_urut`/baris HILANG dihitung
  **per PC** lalu digabung `created_at` DESC (`js/txmerge.js`, fungsi murni + `npm test`).
  Baris tx dapat tag nama PC; banner totals tetap satu baris gabungan. Riwayat sesi menampilkan
  nama PC, bukan URL. PIN tetap hanya di memori per aksi (tak pernah disimpan).
- Print struk: **pilih PC tiap kirim** (picker PC tersambung, PC terakhir dipakai tercentang).
  Tidak ada asumsi "PC printer" — printer bisa ada di PC mana pun dalam daftar.
- Data live: polling `GET /api/outbox?since_id=` tiap 2 detik (cukup untuk 1 HP; tanpa WebSocket).
- Setoran: fetch GAS **langsung dari HP** (kontrak sama dengan `gas_service.py` repo lama).
- Pairing: scan QR dari tray PC → simpan `{base_url, token}` di `localStorage`.
- Vanilla JS tanpa framework (kecil, 1 dev, tanpa build step untuk web-nya).
- HP = database utama (SQLite via `@capacitor-community/sqlite`); desktop = buffer,
  dihapus setelah ACK. Tanpa ACK = data tetap di desktop, HP tandai sesi "belum lengkap".
- Sinkronisasi: pull (`since_id`) → upsert by `uuid` → ack. Ack = "sudah terima".
- HP boleh koreksi nominal/kategori offline (kolom `edited`); koreksi tidak dikirim balik.
- Cache setoran GAS di HP + merge + konflik (port dialog desktop) — fetch terakhir menang
  hanya bila tidak konflik.
- Backup/export HP: BELUM (risiko diterima, catat sebagai utang).

## 3. Struktur file repo baru

```
CNmobile/
  README.md                    # dev (npm), pairing ke PC, build APK, troubleshooting
  package.json                 # @capacitor/core, @capacitor/cli, @capacitor/android,
                                 #   @capacitor-community/sqlite (+ input QR manual fallback)
  capacitor.config.ts          # appId mis. com.toko.cashnote, webDir: www
  www/                         # web app murni (bisa dibuka di Chrome dulu sebelum wrap)
    index.html                 # shell + 2 tab (Live, Setoran) + dialog pairing + tombol print
    manifest.webmanifest       # nama, ikon, display standalone (untuk mode PWA fallback)
    sw.js                      # minimal (cache shell) — relevan untuk mode browser, diabaikan di native
    css/style.css              # mobile-first, 1 kolom, sentuh ≥44px
    js/store.js                # lapisan storage: sesi multi-PC (pcs[]) + tx per PC + isian manual
                                #   (kunci "<sessionId>|<comp_id>", tid "<comp_id>:<server_id>")
    js/txmerge.js              # fungsi murni: rantai no_urut (baris HILANG) per PC -> gabung DESC
    js/sync.js                 # pull since_id → upsert by uuid → ack; watermark last_server_id di meta
    js/conflict.js             # merge setoran GAS vs cache (port _tx_key/_is_conflict/periode) + bottom-sheet
    js/comps.js                # daftar computer (nama+base URL) + status koneksi runtime + migrasi key lama
    js/lan.js                  # GET health/transactions/totals, POST print (header X-Token)
    js/gas.js                  # PORT dari gas_service.py: call_api/login/get_dashboard_data via fetch
                                #   + hitung total_kurang/total_lebih (gas_service.py:76-94)
                                #   + filter periode 28–27 & merge by (tanggal,shift,cabang) (kasir_tab.py:267-278,446-458)
    js/live.js                 # polling since per PC, render list + tag PC + totals, tombol print per struk/periode
    js/comp.js                 # tab [comp]: daftar + badge + picker PC + halaman control (watcher/wipe/log)
    js/setoran.js              # login (email/pass, deviceId:"CNmobile"), render dashboard 5 hari
    js/app.js                  # glue tab + pairing flow
    icons/                     # icon-192/512 + maskable
  test/comp-check.js          # assert-based check logika multi-PC (npm test, tanpa framework)
  android/                     # hasil `npx cap add android` (dicommit, kecuali build/ via gitignore bawaan)
  docs/TEST-CHECKLIST.md       # uji manual: pairing, live <3s, print, GAS, ganti WiFi/IP
```

## 4. Layar & perilaku

1. **Pairing (sekali):** tombol Pair → input/scan QR (`http://IP:8765#token=...`) → `GET /health` cek → simpan. Gagal → pesan "satu WiFi dengan PC?".
2. **Live:** list transaksi terbaru (nominal Rp, jam, label), totals (kurang/lebih), auto-refresh 2 dtk + pull indikator. Tombol **Print** per item / print rekap → `POST /api/print` → toast `job_id` + status.
3. **Setoran:** form email+password (disimpan hanya token di memori, bukan password) → `checkLogin` → `getDashboardData` → list 5 hari + total kurang/lebih. Tombol refresh.
4. **Offline LAN:** bila PC tak terjangkau → banner "PC offline", tombol retry; data GAS tetap bisa dibuka (internet ada).
5. **Koreksi (offline bisa):** edit nominal/kategori di item Live → tandai `edited=1`
   + `edited_ts`; tidak dikirim ke mana pun (HP otoritatif). Struk print pakai data terkoreksi.
6. **Konflik setoran:** tiap fetch GAS vs cache → merge (`_tx_key`, `_is_conflict`,
   periode 28–27, port `kasir_tab.py`) → bila beda → bottom-sheet "Pakai Lokal / Pakai GAS"
   (port `show_conflict_dialog`, tapi non-blokir). Tanpa konflik → fetch terakhir menang.
7. **Matriks offline:** LAN mati → Live freeze + banner "PC offline, sesi belum lengkap",
   koreksi tetap bisa; internet mati → Setoran baca cache + banner; keduanya mati → semua
   baca lokal + banner ganda. Tombol retry tiap banner.

## 5. Inventaris rujukan (copy dari `cash_note`, bukan import)

| # | Sumber (terverifikasi) | Dipakai di |
|---|---|---|
| 1 | `gas_service.py` full: `call_api` (POST `{action,args}`, header `text/plain`), `login` (token dari `redirectUrl`, fallback `token_<ms>`), `get_dashboard_data` (`[token, cashier_name]`, 5 hari), rumus kurang/lebih; `constants.py:25` (URL) | `js/gas.js` via `fetch` (`deviceId:"CNmobile"`) |
| 2 | `tabs/kasir_tab.py:15` (`format_rupiah`), `:221` (parse tanggal), `:267-282` (periode 28–27), `:336-351` (ringkasan kurang/lebih), `:446-484` (merge + `_conflict`), `:423-444` (`_tx_key`, `_is_conflict`, `_to_int`) | `js/setoran.js` + `js/conflict.js` |
| 3 | `tabs/kasir_tab.py:644-725` (field item: `tanggal,shift,cabang,kasir,totalKomputer,uangFisik,jumlahSelisih,statusSelisih`) | shape render list Setoran |
| 4 | `tabs/kasir_tab.py:498-544` (sync background + stale-guard) | pola `async fetch` + abaikan respons basi (tanpa `threading`/`after`) |
| 5 | `tabs/kasir_tab.py:765-814` (`show_conflict_dialog` + `resolve`) | bottom-sheet konflik (non-blokir) |
| 6 | Kontrak LAN: `../CNdesktop/docs/PRD.md` §5 | `js/lan.js` + `js/sync.js` (jangan definisikan ulang) |

## 6. Acceptance

- [ ] Dibuka di Chrome HP (WiFi sama): pairing QR → Live update <3 dtk.
- [ ] Tombol print → struk fisik keluar di PC + status `done`.
- [ ] Tab Setoran: login + data tampil dari storag(db) dan update data terbaru.
- [ ] APK debug (`npx cap sync android` + build) terinstall & ketiga alur di atas jalan di device.
- [ ] PC mati → banner offline jelas, tidak crash.
- [ ] Matikan WiFi PC: banner "sesi belum lengkap" + koreksi tetap bisa + data tidak hilang (restart app).
- [ ] Koreksi item → print → struk pakai angka koreksi.
- [ ] Uji konflik: ubah cache lalu fetch GAS beda → bottom-sheet muncul, kedua pilihan benar.
- [ ] Pull → ack: `outbox_depth` di PC berkurang; uuid ganda tidak dobel di HP.

## 7. Milestone

M1 web murni di Chrome (pairing manual + live mock) → M2 sambung LAN asli + print → M3 GAS setoran → M4 `cap add android` + APK debug → uji di toko.

## 8. Yang eksplisit TIDAK dirujuk dari `cash_note`

- Widget customtkinter + pola `threading`/`after` (`tabs/kasir_tab.py:353-372,526`) — diganti `async fetch`.
- `users.json` (password kasir) — HP tidak simpan password, hanya token di memori.
