# hold-to-reveal belum lengkap + [hapus] di riwayat Live (www/js/live.js + www/css/style.css)
> Source: Sembunyikan tag belum lengkap dan tombol hapus di riwayat Live sampai hold 900ms, tap lain sembunyikan lagi.
> Source: Vanilla JS tanpa lib baru di www/js/live.js dan www/css/style.css dengan diff minimal sekitar 20 baris JS tambah 3 baris CSS.
> Source: Konteks locked 900ms bukan 3000ms, gate render plus hold detection plus verifikasi mobile emulation.
## Tasks
- [x] 1 Tambah state hold-to-reveal di modul Live tanpa lib baru
  - [x] Tambah variabel revealedSid null plus holdT null plus holdSid null di dekat pendingDelete diterima bila state awal null dan tanpa import baru di www/js/live.js:47-51 verifikasi dengan `rg "revealedSid|holdT|holdSid" www/js/live.js`
- [x] 2 Gate renderHistory dengan span hist-secret berbasis revealedSid
  - [x] Bungkus elemen cp plus cur plus del dalam span hist-secret diterima bila sesi closed sembunyi awal dan hanya isi muncul saat s id sama dengan revealedSid di www/js/live.js:132-142 verifikasi dengan `rg "hist-secret|revealedSid" www/js/live.js`
  - [x] Atur reset tap sid lain ke revealedSid null plus pendingDelete null plus renderAll diterima bila pindah sesi langsung sembunyi dan sesi open tetap tanpa tombol hapus di www/js/live.js:132-142 verifikasi dengan `rg "pendingDelete=null|renderAll" www/js/live.js`
- [x] 3 Implementasikan hold detection 900ms di live-history dengan stale-guard
  - [x] Daftarkan handler pointerdown pada kontainer live-history diterima bila cari data-sid lalu abaikan data-del dan sesi open lalu set holdSid plus holdT setTimeout 900ms plus class holding di www/js/live.js DOMContentLoaded dan www/index.html:74 verifikasi dengan `rg "pointerdown|holdT=setTimeout|holding" www/js/live.js`
  - [x] Daftarkan handler pointerup plus pointercancel plus pointerleave plus pointermove lebih dari 10px plus contextmenu diterima bila clearTimeout hapus class holding dan contextmenu preventDefault di www/js/live.js DOMContentLoaded verifikasi dengan `rg "pointerup|pointercancel|pointerleave|pointermove|contextmenu" www/js/live.js`
  - [x] Implementasikan fungsi reveal set revealedSid ke holdSid plus reset pendingDelete plus lastTap id plus renderAll plus vibrate diterima bila hold sekitar 1 dtk memunculkan secret dan tap lain menghilangkan di www/js/live.js verifikasi dengan `rg "revealedSid=holdSid|navigator.vibrate" www/js/live.js`
- [x] 4 Tambah CSS hold state 3 baris tanpa file baru
  - [x] Tambah rule touch-action pan-y plus user-select none plus opacity holding diterima bila scroll vertikal tetap jalan teks tidak terseleksi dan feedback holding terlihat di www/css/style.css:136-156 verifikasi dengan `rg "hist-secret|tx.holding|touch-action" www/css/style.css`
- [x] 5 Verifikasi manual mobile emulation dan double-tap tetap jalan
  - [x] Jalankan server lokal dan uji Chrome mobile emulation diterima bila sembunyi awal lalu hold sekitar 1 dtk muncul lalu tap lain hilang lalu double-tap di bawah 350ms tetap buka sesi via www/index.html:74 verifikasi dengan `python3 -m http.server 8000 --directory www`
  - [x] Jalankan pencarian rg revealedSid atau holdT diterima bila tidak ada sisa TODO dan onHistoryClick dua langkah hapus tetap jalan di www/js/live.js:293-319 verifikasi dengan `rg "revealedSid|holdT" www/js/live.js www/css/style.css`
## Done
When every checkbox is `[x]`, run:
`Move-Item -LiteralPath ".agents/tasks/2026-10-14-hold-to-reveal-belum-lengkap-hapus-riwayat-live.md" -Destination ".agents/tasks/done/"`
