# Settings Wipe Watcher
> Source: Tambah klien LAN generik postJson plus wipe/watcher dengan map error seragam dan view Settings minimal vanilla JS. Tanpa scaffolding baru, validasi server-side, lokal HP utuh, docs uji dan verifikasi node plus smoke Chrome.
## Tasks
- [x] Perluas klien LAN untuk wipe dan watcher hingga map error seragam tampil apa adanya
  - [x] Tambah fungsi postJson generik terima baseUrl path obj kembalikan {ok,data|error,status} dengan timeout 8s dan parse body.error PC di `www/js/lan.js` terima bila timeout dibedakan dari HTTP lolos bila `node --check www/js/lan.js` bersih
  - [x] Tambah fungsi wipe watcherGet watcherSet plus satu mapper error 400 passthrough 403 PIN salah 409 sibuk 429 terkunci 5 menit dan export baru di `www/js/lan.js` terima bila signature sesuai plan lolos bila `node --check www/js/lan.js` bersih
- [x] Tambah markup view Settings dan routing tampil hingga guard default aman
  - [x] Tambah option settings di nav select plus section view-settings berisi info PC readonly blok watcher status plus tombol plus PIN plus intip plus msg dan blok wipe PIN plus intip plus input HAPUS plus tombol plus msg plus hint plus script settings.js di `www/index.html` terima bila semua ID ada lolos bila `node --check www/js/settings.js` bersih dan tanpa 404 di console
  - [x] Daftarkan settings ke daftar show plus guard default di `www/js/app.js` terima bila navigasi settings tampil tanpa JS error lolos bila `node --check www/js/app.js` bersih
- [x] Implementasikan logika settings.js vanilla tanpa polling hingga data lokal HP utuh
  - [x] Implement auto load watcherGet saat view dibuka plus refresh manual tanpa polling dan disable saat fetch di `www/js/settings.js` terima bila status tampil tanpa polling lolos bila `node --check www/js/settings.js` bersih
  - [x] Implement watcherSet validasi PIN kosong inline plus clear PIN setelah sukses atau 403 atau 429 dan wipe passthrough tombol selalu aktif 400 tampilkan error PC plus sorot HAPUS tanpa clear PIN plus intip per seksi di `www/js/settings.js` terima bila perilaku PIN sesuai plan lolos bila `node --check www/js/settings.js` bersih
- [x] Lengkapi style danger dan checklist uji hingga baris settings terisi
  - [x] Tambah satu class btn-danger minimal reuse msg err di `www/css/style.css` terima bila tombol hapus tampil beda tanpa style baru lain lolos bila `Select-String -Path www/css/style.css -Pattern btn-danger`
  - [x] Tambah baris uji settings status on off 200 403 wipe 400 403 200 429 setelah 5x salah 409 saat sibuk di `docs/TEST-CHECKLIST.md` terima bila semua kasus tercatat lolos bila `Select-String -Path docs/TEST-CHECKLIST.md -Pattern settings`
- [x] Verifikasi akhir node dan smoke browser hingga Lan health watcher wipe OK
  - [x] Jalankan node check untuk file baru dan ubahan di `www/js/lan.js` dan `www/js/settings.js` dan `www/js/app.js` terima bila semua bersih lolos bila `node --check www/js/lan.js` dan `node --check www/js/settings.js` dan `node --check www/js/app.js`
  - [x] Jalankan serve www smoke di Chrome via console panggil Lan.health watcherGet watcherSet wipe di `www/index.html` terima bila tanpa error console lolos bila `npx http-server www/ -p 8080` lalu uji console Chrome
## Done
When every checkbox is `[x]`, run:
`Move-Item -LiteralPath ".agents/tasks/2026-10-13-settings-wipe-watcher.md" -Destination ".agents/tasks/done/"`
