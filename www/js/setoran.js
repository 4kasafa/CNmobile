/* Glue Setoran: login -> cache -> render -> sinkron GAS. Mirror tabs/kasir_tab.py. */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  // kasir_tab.py:15-22 format_rupiah
  function rupiah(val) {
    var n = parseInt(val, 10);
    if (isNaN(n)) return "Rp 0";
    var neg = n < 0;
    var f = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return neg ? "Rp -" + f : "Rp " + f;
  }
  function nowStamp() {
    var d = new Date(), p = function (n) { return String(n).padStart(2, "0"); };
    return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear() + " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
  }

  var LS_CRED = "cn_cred", LS_ARCH = "cn_setoran_archive", LS_FOLD = "cn_session_collapsed";
  // ponytail: hanya dibaca migrasi sekali-jalan, lalu dihapus (jangan tulis ke sini lagi)
  var LS_V1 = "cn_setoran_cache", LS_V2 = "cn_setoran_cache_v2";
  var state = {
    token: null, email: "", password: "", cashier: "",
    cache: [], lastSync: null, lastError: null, syncing: false, syncSeq: 0, conflictKey: null,
    collapsed: true, // gabung session-line + banner jadi 1 baris
    showLogin: false, // form terbuka manual walau sudah login (ganti akun)
    autoLogin: false, // kredensial tersimpan: lipat form ala login selama login background
    known: {}, // txKey yang sudah tampil; diff blink ala live.js
    flickT: null, // timeout pelepas .tx-new
  };

  function loadJSON(k) { try { var v = JSON.parse(localStorage.getItem(k)); return v && typeof v === "object" ? v : null; } catch (e) { return null; } }
  function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  // arsip akumulasi per email: {email: {cashier, last_sync, data: [...]}} — tanpa purge periode.
  function loadArch() { var a = loadJSON(LS_ARCH); return a && typeof a === "object" && !Array.isArray(a) ? a : {}; }
  function saveArch(a) { saveJSON(LS_ARCH, a || {}); }
  function bucketEmail(a, email) {
    var b = a[email];
    if (!b || typeof b !== "object" || Array.isArray(b)) { b = { cashier: "", last_sync: "", data: [] }; a[email] = b; }
    if (!Array.isArray(b.data)) b.data = [];
    return b;
  }

  // kasir_tab.py:292-316 load cache — versi arsip: seluruh bucket dimuat, tampil difilter viewRows().
  function loadCache() {
    state.cache = []; state.lastSync = null;
    if (!state.email) return;
    var a = loadArch();
    var b = bucketEmail(a, state.email);
    // adopsi bucket penampung kasir yang cocok (hasil migrasi slot tercampur)
    if (state.cashier) {
      var hk = "kasir:" + String(state.cashier).trim().toLowerCase();
      var hold = a[hk];
      if (hold && typeof hold === "object" && Array.isArray(hold.data) && hold.data.length) {
        Conflict.mergeGasData(b.data, hold.data);
        if (hold.last_sync && !b.last_sync) b.last_sync = hold.last_sync;
        if (!b.cashier && hold.cashier) b.cashier = hold.cashier;
        delete a[hk];
        saveArch(a);
      }
    }
    state.cache = b.data;
    state.lastSync = b.last_sync || null;
    state.cashier = b.cashier || state.cashier;
    // ponytail: periode berganti tidak membuang apa pun; tampil difilter viewRows().
  }
  function saveCache() {
    if (!state.email) return;
    var a = loadArch();
    a[state.email] = { cashier: state.cashier, last_sync: state.lastSync, data: state.cache };
    saveArch(a);
  }

  // migrasi sekali-jalan v1/v2 -> arsip; pisah by kasir bila slot tercampur; baru hapus key lama.
  function migrateArchive() {
    var a = loadArch(), touched = false;
    // normalisasi key email campuran-case -> lowercase (gabung dedup)
    Object.keys(a).forEach(function (k) {
      if (k.indexOf("@") < 0) return;
      var low = k.toLowerCase();
      if (low === k) return;
      var src = a[k], dst = bucketEmail(a, low);
      var have0 = {};
      dst.data.forEach(function (r) { have0[Conflict.txKey(r)] = 1; });
      (src && Array.isArray(src.data) ? src.data : []).forEach(function (r) {
        var t = Conflict.txKey(r);
        if (!have0[t]) { dst.data.push(r); have0[t] = 1; }
      });
      if (src && src.last_sync && !dst.last_sync) dst.last_sync = src.last_sync;
      if (src && src.cashier && !dst.cashier) dst.cashier = src.cashier;
      delete a[k];
      touched = true;
    });
    [LS_V1, LS_V2].forEach(function (k) {
      var c = loadJSON(k);
      // ponytail: gagal validasi -> key lama dibiarkan, jangan hapus sebelum sukses
      if (!c || typeof c !== "object" || !Array.isArray(c.data) || !c.data.length) return;
      var email = String(c.email || "").trim().toLowerCase(), cashier = c.cashier || "";
      var own = [], holds = {};
      c.data.forEach(function (r) {
        var rk = String((r && r.kasir) || "").trim().toLowerCase();
        if (email && cashier && rk && rk !== String(cashier).trim().toLowerCase()) {
          (holds[rk] = holds[rk] || []).push(r);
        } else if (email) {
          own.push(r);
        } else if (rk) {
          (holds[rk] = holds[rk] || []).push(r);
        }
      });
      if (email && own.length) {
        var b = bucketEmail(a, email);
        var have = {};
        b.data.forEach(function (r) { have[Conflict.txKey(r)] = 1; });
        own.forEach(function (r) {
          var t = Conflict.txKey(r);
          if (!have[t]) { b.data.push(r); have[t] = 1; }
        });
        if (c.last_sync && !b.last_sync) b.last_sync = c.last_sync;
        if (!b.cashier && cashier) b.cashier = cashier;
      }
      for (var hk in holds) {
        var key = "kasir:" + hk;
        var hb = a[key];
        if (!hb || typeof hb !== "object") { hb = { cashier: (holds[hk][0] || {}).kasir || "", last_sync: "", data: [] }; a[key] = hb; }
        if (!Array.isArray(hb.data)) hb.data = [];
        var hh = {};
        hb.data.forEach(function (r) { hh[Conflict.txKey(r)] = 1; });
        holds[hk].forEach(function (r) {
          var t = Conflict.txKey(r);
          if (!hh[t]) { hb.data.push(r); hh[t] = 1; }
        });
        if (c.last_sync && !hb.last_sync) hb.last_sync = c.last_sync;
      }
      touched = true;
      try { localStorage.removeItem(k); } catch (e) {} // hapus SETELAH migrasi per-key sukses
    });
    if (touched) saveArch(a);
  }

  // arsip-doctor: diagnosis bucket yatim + adopsi ke akun aktif (dedup by Conflict.txKey)
  function listBuckets() {
    var a = loadArch(), out = [];
    Object.keys(a).forEach(function (k) {
      var b = a[k];
      out.push({ key: k, n: b && Array.isArray(b.data) ? b.data.length : 0 });
    });
    out.sort(function (x, y) { return x.key < y.key ? -1 : 1; });
    return out;
  }
  function renderDoctor() {
    var line = $("doctor-line"), btn = $("btn-doctor-adopsi");
    if (!line) return;
    var buckets = listBuckets();
    if (!buckets.length) { line.textContent = "kosong"; if (btn) btn.hidden = true; return; }
    var active = state.email || "";
    var act = buckets.filter(function (b) { return b.key === active; })[0];
    var orphans = buckets.filter(function (b) { return b.key !== active && b.n > 0; });
    line.textContent = "bucket:" + buckets.length + " aktif:" + (active || "-") +
      "(" + (act ? act.n : 0) + ") yatim:" + (orphans.length ? orphans.map(function (b) { return b.key + "(" + b.n + ")"; }).join(" ") : "-");
    if (btn) btn.hidden = !(state.email && orphans.length);
  }
  function adoptAll() {
    var msg = $("doctor-msg");
    if (!state.email) { if (msg) msg.textContent = "└─ login dulu sebelum adopsi."; return 0; }
    var a = loadArch(), b = bucketEmail(a, state.email), n = 0;
    Object.keys(a).forEach(function (k) {
      if (k === state.email) return;
      var ob = a[k];
      if (!ob || !Array.isArray(ob.data) || !ob.data.length) { delete a[k]; return; }
      var before = b.data.length;
      Conflict.mergeGasData(b.data, ob.data);
      n += b.data.length - before;
      if (ob.last_sync && !b.last_sync) b.last_sync = ob.last_sync;
      delete a[k];
    });
    saveArch(a);
    loadCache();
    renderAll();
    if (msg) msg.textContent = "└─ adopsi ok: +" + n + " baris.";
    return n;
  }
  function exportArchive() {
    try {
      var blob = new Blob([JSON.stringify(loadArch())], { type: "application/json" });
      var u = URL.createObjectURL(blob), link = document.createElement("a");
      var d = new Date(), p = function (x) { return String(x).padStart(2, "0"); };
      link.href = u;
      link.download = "arsip-setoran-" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + ".json";
      document.body.appendChild(link);
      link.click();
      setTimeout(function () { URL.revokeObjectURL(u); link.remove(); }, 500);
    } catch (e) {}
  }
  function importArchiveFile(f) {
    var msg = $("doctor-msg");
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var o = JSON.parse(rd.result);
        if (!o || typeof o !== "object" || Array.isArray(o)) throw 0;
        var a = loadArch(), n = 0;
        Object.keys(o).forEach(function (k) {
          var src = o[k];
          if (!src || !Array.isArray(src.data) || !src.data.length) return;
          var key = k.indexOf("@") >= 0 ? k.toLowerCase() : k;
          var dst = bucketEmail(a, key);
          var before = dst.data.length;
          Conflict.mergeGasData(dst.data, src.data);
          n += dst.data.length - before;
          if (src.last_sync && !dst.last_sync) dst.last_sync = src.last_sync;
          if (src.cashier && !dst.cashier) dst.cashier = src.cashier;
        });
        saveArch(a);
        loadCache();
        renderAll();
        if (msg) msg.textContent = "└─ impor ok: +" + n + " baris.";
      } catch (e) { if (msg) msg.textContent = "└─ file arsip tidak valid."; }
    };
    rd.readAsText(f);
  }

  // kasir_tab.py:377-417 label status
  function setStatus(mode, text) {
    var el = $("sync-status");
    el.className = mode === "ok" ? "ok" : (mode === "bad" ? "bad" : "");
    el.textContent = text;
  }
  function refreshStatus() {
    if (state.syncing) { setStatus("", "[SYNC]"); return; }
    var n = Conflict.countConflicts(state.cache);
    if (n) { setStatus("", "[CONF " + n + "]"); return; }
    if (state.lastError) { setStatus("bad", "[ERR]"); return; }
    if (state.lastSync) { setStatus("ok", "[OK " + state.lastSync + "]"); return; }
    setStatus("", state.token ? "[LOGIN]" : "[--]");
  }

  // arsip akumulasi: tampil + ringkas hanya periode berjalan; total arsip di val-arsip.
  function viewRows() {
    var cur = Conflict.currentPeriode();
    return state.cache.filter(function (it) {
      var p = Conflict.periodeOf(it && it.tanggal);
      return p === null || p === cur;
    });
  }

  // kasir_tab.py:336-351 ringkasan dari data tampil
  function renderSummary() {
    var kurang = 0, lebih = 0;
    var rows = viewRows();
    rows.forEach(function (it) {
      var s = Conflict.toInt((it || {}).jumlahSelisih);
      if (s < 0) kurang += Math.abs(s);
      else if (s > 0) lebih += s;
    });
    $("periode-label").textContent = Conflict.currentPeriode();
    $("val-tx").textContent = String(rows.length);
    $("val-arsip").textContent = String(state.cache.length);
    $("val-kurang").textContent = rupiah(kurang);
    $("val-lebih").textContent = rupiah(lebih);
  }

  function statusOf(it) {
    var st = String(it.statusSelisih || "").toUpperCase();
    var s = Conflict.toInt(it.jumlahSelisih);
    if (st === "KURANG" || s < 0) return "KURANG";
    if (st === "LEBIH" || s > 0) return "LEBIH";
    return "PAS";
  }

  // kasir_tab.py:644-763 daftar, terbaru di atas (:656-661)
  // freshKeys: txKey baru/berubah dari syncGas -> class tx-new (blink 5x/1dtk, lepas via timeout).
  // Tanpa argumen = render diam (sinkron state.known, tanpa blink): login/boot/resolve.
  function renderList(freshKeys) {
    var box = $("tx-list");
    var rows = viewRows();
    if (!rows.length) {
      box.innerHTML = '<div class="box"><span class="dim">└─ tidak ada transaksi periode ini.</span></div>';
      return;
    }
    var fresh = {};
    if (Array.isArray(freshKeys)) for (var f = 0; f < freshKeys.length; f++) fresh[freshKeys[f]] = true;
    var ordered = rows.slice().sort(function (a, b) {
      var da = Conflict.parseDate(a && a.tanggal), db = Conflict.parseDate(b && b.tanggal);
      return (db ? db.getTime() : -1) - (da ? da.getTime() : -1);
    });
    box.innerHTML = ordered.map(function (it, i) {
      var st = statusOf(it);
      var key = Conflict.txKey(it);
      var conf = it._conflict
        ? ' <span class="tag conf">beda</span> <button type="button" class="diff" data-key="' + esc(key) + '">Lihat beda</button>'
        : "";
      return '<div class="tx st-' + st.toLowerCase() + (fresh[key] ? " tx-new" : "") + '">' +
        '<div class="tx-top"><span class="idx">#' + (i + 1) + '</span><span>' + esc(it.tanggal || "--") + '</span>' +
        '<span class="tag">' + esc(String(it.shift || "--").toUpperCase()) + '</span>' +
        '<span class="dim">' + esc(it.cabang || "--") + '</span></div>' +
        '<div class="tx-mid"><span class="dim">kasir: ' + esc(it.kasir || "--") + '</span>' +
        '<span>K: ' + esc(rupiah(it.totalKomputer)) + ' F: ' + esc(rupiah(it.uangFisik)) + '</span></div>' +
        '<div class="tx-bot"><span><span class="tag ' + st.toLowerCase() + '">' + st + '</span>' + conf + '</span>' +
        '<span>Selisih: ' + esc(rupiah(it.jumlahSelisih)) + '</span></div></div>';
    }).join("");
    for (var u = 0; u < state.cache.length; u++) state.known[Conflict.txKey(state.cache[u])] = true;
    if (state.flickT) { clearTimeout(state.flickT); state.flickT = null; }
    if (Object.keys(fresh).length) {
      state.flickT = setTimeout(function () {
        state.flickT = null;
        var bx = $("tx-list");
        if (!bx) return;
        var els = bx.querySelectorAll(".tx-new");
        for (var q = 0; q < els.length; q++) els[q].classList.remove("tx-new");
      }, 1000);
    }
    box.querySelectorAll("button.diff").forEach(function (b) {
      b.addEventListener("click", function () { showSheet(b.getAttribute("data-key")); });
    });
  }

  // gabung 1 baris: pindah node #sync-status ke session-line (collapse)
  // atau kembalikan ke banner (expand). Tanpa id ganda.
  function placeStatus(fold) {
    var line = $("session-line"), banner = $("banner"), st = $("sync-status");
    if (!line || !banner || !st) return;
    if (fold) line.appendChild(st);
    else banner.appendChild(st);
    line.classList.toggle("collapsed", !!fold);
  }
  function setCollapsed(fold) {
    state.collapsed = !!fold;
    try { localStorage.setItem(LS_FOLD, state.collapsed ? "1" : "0"); } catch (e) {}
    placeStatus(state.collapsed);
  }
  function toggleFold() { setCollapsed(!state.collapsed); renderAll(); }

  function renderAll(freshKeys) {
    renderSummary();
    renderList(freshKeys);
    refreshStatus();
    renderDoctor();
    var logged = !!state.token;
    // cache tampil instan walau belum login (mode cache); login menimpa dengan data segar
    var showData = logged || state.cache.length > 0;
    var lineVisible = (logged || state.autoLogin) && !state.showLogin;
    // ponytail: collapse = 1 baris (login-info + sync), banner + tombol disembunyikan.
    // baris tak tampil (logout/ganti-akun) -> status tetap di banner.
    placeStatus(lineVisible && state.collapsed);
    $("banner").hidden = !showData || (lineVisible && state.collapsed);
    $("summary").hidden = !showData;
    // form hanya terbuka saat belum login; selama auto-login tampil ala sudah login
    $("login-section").hidden = (logged || state.autoLogin) && !state.showLogin;
    $("session-line").hidden = !(logged || state.autoLogin) || state.showLogin;
    // [tutup] hanya ada saat form dibuka manual (ganti akun); saat logout form tak bisa ditutup
    $("btn-login-close").hidden = !(logged || state.autoLogin);
    if (logged) {
      $("kasir-info").textContent = state.cashier + " <" + state.email + ">";
      $("session-info").textContent = "└─ login sebagai " + state.email;
    } else if (state.autoLogin) {
      $("session-info").textContent = "└─ menghubungi GAS...";
    } else if (state.cache.length) {
      $("kasir-info").textContent = state.email + " (cache, belum login)";
    }
  }

  function openLogin(focus) {
    state.showLogin = true;
    // ganti akun manual membatalkan auto-login kredensial lama yang sedang terbang
    state.syncSeq++;
    state.autoLogin = false;
    $("login-section").hidden = false;
    $("session-line").hidden = true;
    $("btn-login-close").hidden = false;
    if (focus !== false) $("in-email").focus();
  }

  // batal ganti-akun: lipat form kembali jadi satu baris sesi
  function closeLogin() {
    state.showLogin = false;
    renderAll();
  }

  function doLogout() {
    // token hanya di memori: keluar = buang dari memori (PRD §8)
    state.token = null;
    state.password = "";
    state.showLogin = false;
    state.autoLogin = false;
    state.syncing = false;
    state.syncSeq++; // batalkan sync berjalan via stale-guard
    state.lastError = null;
    // ponytail: cache memori ikut dibuang agar tak bocor ke sesi berikutnya
    state.cache = [];
    state.lastSync = null;
    hideOffline();
    renderAll();
    openLogin();
  }

  function showOffline(msg) {
    $("offline-text").textContent = msg;
    $("offline-banner").hidden = false;
  }
  function hideOffline() { $("offline-banner").hidden = true; }

  // kasir_tab.py:765-787 dialog konflik (non-blokir bottom-sheet)
  function fmt3(o) {
    o = o || {};
    return "K: " + rupiah(o.totalKomputer) + " | F: " + rupiah(o.uangFisik) + " | S: " + rupiah(o.jumlahSelisih);
  }
  function showSheet(key) {
    var it = null;
    for (var i = 0; i < state.cache.length; i++) {
      if (Conflict.txKey(state.cache[i]) === key) { it = state.cache[i]; break; }
    }
    if (!it || !it._conflict) return;
    state.conflictKey = key;
    $("sheet-title").textContent = "KONFLIK: " + (it.tanggal || "--") + " / " + (it.shift || "--") + " / " + (it.cabang || "--");
    $("sheet-lokal").textContent = fmt3(it._conflict.lokal);
    $("sheet-gas").textContent = fmt3(it._conflict.gas);
    $("sheet-wrap").hidden = false;
  }
  function hideSheet() { $("sheet-wrap").hidden = true; state.conflictKey = null; }

  // kasir_tab.py:789-804 resolve + simpan + render ulang
  function resolveSheet(useGas) {
    if (!state.conflictKey) return;
    Conflict.resolve(state.cache, state.conflictKey, useGas);
    saveCache();
    hideSheet();
    renderAll();
  }

  // kasir_tab.py:498-549 sinkron background + stale-guard, tanpa threading
  // alur: tombol disable "Sinkron..." -> fetch -> render ulang (kasir_tab.py:514-532)
  function setRefreshing(busy) {
    var b = $("btn-refresh");
    if (b) { b.disabled = busy; b.textContent = busy ? "⋯" : "↻"; }
  }
  async function syncGas() {
    if (!state.token || state.syncing) return;
    state.syncing = true;
    state.lastError = null;
    var seq = ++state.syncSeq;
    setRefreshing(true);
    refreshStatus();
    var res = await Gas.fetchKasirSummary(state.email, state.password, state.cashier);
    state.syncing = false;
    setRefreshing(false);
    if (seq !== state.syncSeq) return; // respons basi: login/sync baru sudah jalan
    if (!res || !res.success) {
      var msg = (res && res.message) || "Tidak ada respon";
      state.lastError = msg;
      if (!state.cache.length) {
        $("tx-list").innerHTML = '<div class="box"><span class="err">└─ gagal: ' + esc(msg) + ' — cek koneksi lalu Muat ulang.</span></div>';
      } else {
        showOffline("gagal sinkron: " + msg);
      }
      renderAll();
      return;
    }
    hideOffline();
    // diff blink: signature per key sebelum merge; fresh = key baru ATAU nilai/flag beda berubah.
    var before = {};
    state.cache.forEach(function (it) {
      before[Conflict.txKey(it)] = JSON.stringify([Conflict.toInt(it.totalKomputer), Conflict.toInt(it.uangFisik), Conflict.toInt(it.jumlahSelisih), !!it._conflict]);
    });
    Conflict.mergeGasData(state.cache, res.data);
    var fresh = [];
    state.cache.forEach(function (it) {
      var k = Conflict.txKey(it);
      var sig = JSON.stringify([Conflict.toInt(it.totalKomputer), Conflict.toInt(it.uangFisik), Conflict.toInt(it.jumlahSelisih), !!it._conflict]);
      if (!Object.prototype.hasOwnProperty.call(before, k) || before[k] !== sig) fresh.push(k);
    });
    state.lastSync = nowStamp();
    if (res.user) {
      state.cashier = typeof res.user === "object" ? (res.user.name || state.cashier) : String(res.user);
    }
    saveCache();
    renderAll(fresh);
  }

  async function doLogin() {
    var email = $("in-email").value.trim().toLowerCase();
    var pass = $("in-pass").value;
    var remember = $("chk-remember").checked;
    var msg = $("login-msg");
    if (!email || !pass) { msg.textContent = "└─ isi email + pass dulu."; msg.className = "msg err"; return; }
    msg.textContent = "└─ menghubungi GAS...";
    msg.className = "msg";
    var my = state.syncSeq; // batal bila logout/ganti-akun terjadi selama await
    var res = await Gas.login(email, pass);
    if (my !== state.syncSeq) return; // basi: jangan timpa sesi baru
    state.autoLogin = false;
    if (!res || !res.success) {
      msg.textContent = "└─ gagal: " + ((res && res.message) || "tanpa respon");
      msg.className = "msg err";
      openLogin(false); // auto-login gagal (mis. password berubah): buka form
      return;
    }
    // ponytail: kredensial di localStorage hanya bila dicentang (utang PRD §8, sadar)
    if (remember) saveJSON(LS_CRED, { email: email, password: pass });
    else { try { localStorage.removeItem(LS_CRED); } catch (e) {} }
    state.token = res.token;
    state.email = email;
    state.password = pass;
    state.cashier = (res.user && res.user.name) || email.split("@")[0];
    hideOffline();
    msg.textContent = "└─ login ok.";
    msg.className = "msg ok";
    // kasir_tab.py:353-372 render cache dulu, lalu sinkron
    state.showLogin = false; // sukses: lipat form jadi satu baris sesi
    loadCache();
    renderAll();
    syncGas();
  }

  function triggerFetch() {
    if (!state.token) {
      var m = $("login-msg");
      m.textContent = "└─ login dulu.";
      m.className = "msg err";
      openLogin();
      return;
    }
    loadCache();
    renderAll();
    syncGas();
  }

  // kasir_tab.py:353-372 render cache dulu, lalu sinkron background
  function bootSync() {
    if (!state.token || state.syncing) return;
    loadCache();
    renderAll();
    syncGas();
  }

  document.addEventListener("DOMContentLoaded", function () {
    try { state.collapsed = localStorage.getItem(LS_FOLD) !== "0"; } catch (e) {}
    migrateArchive(); // sekali-jalan: pindah v1/v2 -> arsip, baru hapus key lama
    var line = $("session-line");
    if (line) {
      line.title = "dobel-ketuk: buka/tutup";
      line.addEventListener("dblclick", function (e) {
        if (e.target && e.target.closest && e.target.closest("button")) return;
        toggleFold();
      });
      // ponytail: fallback HP (dblclick tak andal) — ketuk status ikut toggle
      line.addEventListener("click", function (e) {
        var t = e.target;
        if (t && (t.id === "sync-status" || (t.closest && t.closest("#sync-status")))) toggleFold();
      });
    }
    var cred = loadJSON(LS_CRED);
    if (cred) {
      if (cred.email) $("in-email").value = cred.email;
      if (cred.password) $("in-pass").value = cred.password;
    }
    $("btn-login").addEventListener("click", doLogin);
    $("btn-login-close").addEventListener("click", closeLogin);
    var pk = $("btn-pass-peek"), pi = $("in-pass"); // ala settings.js peek()
    if (pk && pi) pk.addEventListener("click", function () {
      pi.type = pi.type === "password" ? "text" : "password";
    });
    $("btn-logout").addEventListener("click", doLogout);
    $("btn-show-login").addEventListener("click", function () { openLogin(); });
    $("btn-refresh").addEventListener("click", triggerFetch);
    $("btn-retry").addEventListener("click", triggerFetch);
    $("btn-use-lokal").addEventListener("click", function () { resolveSheet(false); });
    $("btn-use-gas").addEventListener("click", function () { resolveSheet(true); });
    var ba = $("btn-doctor-adopsi");
    if (ba) ba.addEventListener("click", adoptAll);
    var be = $("btn-arch-export");
    if (be) be.addEventListener("click", exportArchive);
    var bi = $("btn-arch-import"), fi = $("file-arch-import");
    if (bi && fi) {
      bi.addEventListener("click", function () { fi.click(); });
      fi.addEventListener("change", function () {
        if (fi.files && fi.files[0]) importArchiveFile(fi.files[0]);
        fi.value = "";
      });
    }
    $("btn-sheet-close").addEventListener("click", hideSheet);
    $("sheet-wrap").addEventListener("click", function (e) { if (e.target === $("sheet-wrap")) hideSheet(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("sheet-wrap").hidden) hideSheet(); });
    $("in-pass").addEventListener("keydown", function (e) { if (e.key === "Enter") doLogin(); });
    // ponytail: tanpa interval (hemat kuota GAS); sync saat buka + kembali ke app + online
    document.addEventListener("visibilitychange", function () { if (!document.hidden) bootSync(); });
    window.addEventListener("online", bootSync);
    if (cred && cred.email && cred.password) {
      // render ala login dulu (form lipat), login jalan di background
      state.autoLogin = true;
      state.email = String(cred.email).trim().toLowerCase();
      state.password = cred.password;
      loadCache();
      renderAll();
      doLogin(); // auto-login: kredensial tersimpan
    }
  });
})();
