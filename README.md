# CNmobile — kasir pantau dari HP

Vanilla JS + Capacitor → APK. 2 layar utama: **Live** (via LAN ke connector PC) + **Setoran** (langsung ke GAS). Bukan input/edit transaksi, bukan print dari HP.

## Dev di Chrome (web murni, tanpa build)

```powershell
npx serve www   # atau: python -m http.server --directory www 8000
```

Buka `http://localhost:8000`. Storage web pakai `js/store.js` fallback (sql.js+IndexedDB); di APK pakai SQLite native. API sama.

## Pairing ke PC (satu WiFi)

1. Layar `[live]` → isi `pc` dengan `http://IP-PC:8765` (contoh `http://192.168.1.5:8765`).
2. `[buka]` → sesi mulai, drain buffer lalu polling 2 detik.
3. Kontrak LAN otoritatif: `../CNdesktop/docs/PRD.md` §5. HP tidak mendefinisikan endpoint sendiri.

## Layar

- **[live]** — list transaksi + totals (tx/tunai/nontunai/semua). Dobel-tap baris = koreksi lokal (`edited`, tidak dikirim balik). PC mati = banner + retry; data tetap lokal.
- **[print]** — denominasi fisik + `kasir + id kasir + cabang + shift` wajib → preview struk → `[kirim]` POST ke PC (`user_id` + `nontunai_amount` dari sesi Live).
- **[settings]** — `watcher` on/off + `wipe` permanen (`HAPUS` kapital). PIN hanya di memori panggilan, tidak disimpan. PIN default `363636` (ganti via dashboard PC).
- **[setoran]** — login GAS (`deviceId:"CNmobile"`, token di memori saja) → dashboard 5 hari.

## Build APK debug

```powershell
npx cap sync android
cd android; ./gradlew assembleDebug
```

APK: `android/app/build/outputs/apk/debug/app-debug.apk`. Install di HP: aktifkan "install aplikasi tak dikenal".

## Troubleshooting

| Gejala | Arti |
|---|---|
| `PC tak terjangkau, satu WiFi?` | timeout 8 dtk: cek IP PC + WiFi sama |
| `PIN salah` | 403: cek PIN watcher/wipe |
| `PC sibuk, coba lagi` | 409: print/watcher-tulis aktif, tekan ulang manual |
| `terkunci 5 menit` | 429: 5x PIN salah beruntun, tunggu |
| blank mixed-content | `android.allowMixedContent: true` wajib di root `capacitor.config.js` (bukan `server.*`) |

Uji manual: `docs/TEST-CHECKLIST.md`. Detail alur live: `docs/live-flow.md`.
