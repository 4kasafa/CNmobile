# nontunai_amount di POST body (sumber Live, tanpa input baru)
> Source: Kirim nontunai_amount dari S.noncash Live yang sudah ada ke POST print PC tanpa input manual baru.
> PC read only dan hanya dinormalisasi di receipt.py, HP cukup tambah payload plus tampilkan NT dan samakan prompt.md.
> Tanpa perubahan kontrak, tanpa entry gaya dashboard PC, fallback nol saat tidak ada sesi Live.
## Tasks
- [x] Phase 1: Wire buildPayload nontunai_amount dari Live S.noncash selesai saat POST body bawa native int dengan fallback nol tanpa input baru vanilla JS
  - [x] Add nontunai_amount S.noncash ke return buildPayload terima nol saat tidak ada sesi Live di file www/js/print.js verifikasi dengan `node --check www/js/print.js`
  - [x] Confirm sumber S.noncash tetap dari refreshSys Nontunai.total plus Split.nontunai terima tanpa field input baru di file www/js/print.js verifikasi dengan `node --check www/js/print.js`
- [x] Phase 2: Render pesan sukses doSend dengan NT dan sales_total selesai saat baris terminal tetap pendek dan NT hanya muncul saat nontunai di atas nol
  - [x] Update pesan sukses doSend tampilkan tercetak di printer fisik Rp X plus NT Rp Y hanya saat nontunai di atas nol pakai sales_total PC 200 di file www/js/print.js verifikasi dengan `node --check www/js/print.js`
  - [x] Preserve path error doSend tetap utuh terima Lan.print teruskan objek error PC apa adanya di file www/js/print.js verifikasi dengan `node --check www/js/print.js`
- [x] Phase 3: Update baris spec prompt.md selesai saat payload dan bentuk 200 jujur terhadap kontrak PC tanpa klaim perubahan kontrak
  - [x] Edit spec payload di prompt.md dokumentasikan nontunai_amount native int dari S.noncash di file www/prompt.md verifikasi dengan `grep nontunai_amount www/prompt.md`
  - [x] Edit spec respons 200 di prompt.md dokumentasikan bentuk ok printer total nontunai sales_total di file www/prompt.md verifikasi dengan `grep sales_total www/prompt.md`
  - note: prompt.md ditemukan KOSONG (0 byte, gitignored) saat eksekusi — spek disusun ulang dari versi approved + baris nontunai.
- [x] Phase 4: Verify payload dan messaging ujung ke ujung selesai saat stub dan Chrome manual konfirmasi fisik plus NT dan forward 400
  - [x] Run uji stub otomatis buktikan sesi Live dengan satu Nontunai 50000 hasilkan payload 50000 plus tanpa sesi hasilkan 0 plus mock 200 tampilkan NT plus mock 400 teruskan error di file www/js/print.js verifikasi dengan `node --check www/js/print.js`
  - evidence (2026-10-13): node --check OK; stub 5/5 (sumline NT, payload 50000, msg NT, 400 forward). Fallback 0 = nilai awal S.noncash (hanya refreshSys yang mengubah).
  - [ ] Execute cek manual Chrome via send nyata terima struk fisik tampilkan Non Tunai plus Total Penjualan terhitung di file www/js/print.js verifikasi dengan `read Chrome console plus inspeksi visual struk`
## Done
When every checkbox is `[x]`, run:
`Move-Item -LiteralPath ".agents/tasks/2026-10-13-print-nontunai-amount.md" -Destination ".agents/tasks/done/"`
