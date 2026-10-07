/* ASET PRODUKSI (bukan fixture dev — utang "hapus sebelum M4/APK" dibatalkan
 * 2026-10-06 atas permintaan user). GAS hanya return 5 hari terakhir, seed ini
 * menyimpan histori periode 28-27. Salinan read-only dari
 * ../cash_note/data/laku_2026-10_oleg.json `.data` — hanya field yang dirender/
 * di-merge (tanggal,shift,cabang,kasir,totalKomputer,uangFisik,jumlahSelisih,
 * statusSelisih). Merge via Conflict.mergeGasData: tambah bila key belum ada. */
var SEED_LAKU = [
  { tanggal: "02 Oktober 2026", shift: "Pagi", cabang: "SUMBER REJO", kasir: "AbdusSalam", totalKomputer: 5083600, uangFisik: 5083600, statusSelisih: "PAS", jumlahSelisih: 0 },
  { tanggal: "01 Oktober 2026", shift: "Pagi", cabang: "SUMBER REJO", kasir: "AbdusSalam", totalKomputer: 5734600, uangFisik: 5734600, statusSelisih: "PAS", jumlahSelisih: 0 },
  { tanggal: "30 September 2026", shift: "Pagi", cabang: "SUMBER REJO", kasir: "AbdusSalam", totalKomputer: 4275600, uangFisik: 4275600, statusSelisih: "PAS", jumlahSelisih: 0 },
  { tanggal: "29 September 2026", shift: "Pagi", cabang: "SUMBER REJO", kasir: "AbdusSalam", totalKomputer: 3708600, uangFisik: 3708600, statusSelisih: "PAS", jumlahSelisih: 0 },
  { tanggal: "28 September 2026", shift: "Pagi", cabang: "SUMBER REJO", kasir: "AbdusSalam", totalKomputer: 3407400, uangFisik: 3407400, statusSelisih: "PAS", jumlahSelisih: 0 },
  { tanggal: "03 Oktober 2026", shift: "Pagi", cabang: "SUMBER REJO", kasir: "AbdusSalam", totalKomputer: 3920400, uangFisik: 3970400, statusSelisih: "LEBIH", jumlahSelisih: 50000 },
  { tanggal: "05 Oktober 2026", shift: "Pagi", cabang: "SUMBER REJO", kasir: "AbdusSalam", totalKomputer: 3614500, uangFisik: 3614500, statusSelisih: "PAS", jumlahSelisih: 0 },
  { tanggal: "04 Oktober 2026", shift: "Malam", cabang: "SUMBER REJO", kasir: "AbdusSalam", totalKomputer: 8383500, uangFisik: 8383500, statusSelisih: "PAS", jumlahSelisih: 0 }
];
