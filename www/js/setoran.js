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

  var LS_CRED = "cn_cred", LS_CACHE = "cn_setoran_cache";
  var state = {
    token: null, email: "", password: "", cashier: "",
    cache: [], lastSync: null, lastError: null, syncing: false, syncSeq: 0, conflictKey: null,
    showLogin: false, // form terbuka manual walau sudah login (ganti akun)
  };

  function loadJSON(k) { try { var v = JSON.parse(localStorage.getItem(k)); return v && typeof v === "object" ? v : null; } catch (e) { return null; } }
  function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  // kasir_tab.py:292-316 load cache + purge luar periode
  function loadCache() {
    state.cache = []; state.lastSync = null;
    var c = loadJSON(LS_CACHE);
    var cur = Conflict.currentPeriode();
    if (c && c.email === state.email && Array.isArray(c.data) && c.periode === cur) {
      state.cache = c.data.filter(function (it) {
        var p = Conflict.periodeOf(it && it.tanggal);
        return p === null || p === cur;
      });
      state.lastSync = c.last_sync || null;
      state.cashier = c.cashier || state.cashier;
    }
    // ponytail: periode berganti -> cache basi, mulai segar (purge implisit).
    // seed dev sekali: tambah yang belum ada by txKey, langsung simpan biar offline tetap ada.
    if (typeof SEED_LAKU !== "undefined" && SEED_LAKU && SEED_LAKU.length && state.email) {
      try { Conflict.mergeGasData(state.cache, SEED_LAKU); } catch (e) {}
      try { saveCache(); } catch (e2) {}
    }
  }
  function saveCache() {
    saveJSON(LS_CACHE, { email: state.email, cashier: state.cashier, periode: Conflict.currentPeriode(), last_sync: state.lastSync, data: state.cache });
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

  // kasir_tab.py:336-351 ringkasan dari data tampil
  function renderSummary() {
    var kurang = 0, lebih = 0;
    state.cache.forEach(function (it) {
      var s = Conflict.toInt((it || {}).jumlahSelisih);
      if (s < 0) kurang += Math.abs(s);
      else if (s > 0) lebih += s;
    });
    $("periode-label").textContent = Conflict.currentPeriode();
    $("val-tx").textContent = String(state.cache.length);
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
  function renderList() {
    var box = $("tx-list");
    if (!state.cache.length) {
      box.innerHTML = '<div class="box"><span class="dim">└─ tidak ada transaksi periode ini.</span></div>';
      return;
    }
    var ordered = state.cache.slice().sort(function (a, b) {
      var da = Conflict.parseDate(a && a.tanggal), db = Conflict.parseDate(b && b.tanggal);
      return (db ? db.getTime() : -1) - (da ? da.getTime() : -1);
    });
    box.innerHTML = ordered.map(function (it, i) {
      var st = statusOf(it);
      var key = Conflict.txKey(it);
      var conf = it._conflict
        ? ' <span class="tag conf">beda</span> <button type="button" class="diff" data-key="' + esc(key) + '">Lihat beda</button>'
        : "";
      return '<div class="tx st-' + st.toLowerCase() + '">' +
        '<div class="tx-top"><span class="idx">#' + (i + 1) + '</span><span>' + esc(it.tanggal || "--") + '</span>' +
        '<span class="tag">' + esc(String(it.shift || "--").toUpperCase()) + '</span>' +
        '<span class="dim">' + esc(it.cabang || "--") + '</span></div>' +
        '<div class="tx-mid"><span class="dim">kasir: ' + esc(it.kasir || "--") + '</span>' +
        '<span>K: ' + esc(rupiah(it.totalKomputer)) + ' F: ' + esc(rupiah(it.uangFisik)) + '</span></div>' +
        '<div class="tx-bot"><span><span class="tag ' + st.toLowerCase() + '">' + st + '</span>' + conf + '</span>' +
        '<span>Selisih: ' + esc(rupiah(it.jumlahSelisih)) + '</span></div></div>';
    }).join("");
    box.querySelectorAll("button.diff").forEach(function (b) {
      b.addEventListener("click", function () { showSheet(b.getAttribute("data-key")); });
    });
  }

  function renderAll() {
    renderSummary();
    renderList();
    refreshStatus();
    var logged = !!state.token;
    // cache tampil instan walau belum login (mode cache); login menimpa dengan data segar
    var showData = logged || state.cache.length > 0;
    $("banner").hidden = !showData;
    $("summary").hidden = !showData;
    // form hanya terbuka saat belum login; setelah login melipat jadi baris sesi
    $("login-section").hidden = logged && !state.showLogin;
    $("session-line").hidden = !logged || state.showLogin;
    if (logged) {
      $("kasir-info").textContent = state.cashier + " <" + state.email + ">";
      $("session-info").textContent = "└─ login sebagai " + state.email;
    } else if (state.cache.length) {
      $("kasir-info").textContent = state.email + " (cache, belum login)";
    }
  }

  function openLogin(focus) {
    state.showLogin = true;
    $("login-section").hidden = false;
    $("session-line").hidden = true;
    if (focus !== false) $("in-email").focus();
  }

  function doLogout() {
    // token hanya di memori: keluar = buang dari memori (PRD §8)
    state.token = null;
    state.password = "";
    state.showLogin = false;
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
    Conflict.mergeGasData(state.cache, res.data);
    state.lastSync = nowStamp();
    if (res.user) {
      state.cashier = typeof res.user === "object" ? (res.user.name || state.cashier) : String(res.user);
    }
    saveCache();
    renderAll();
  }

  async function doLogin() {
    var email = $("in-email").value.trim();
    var pass = $("in-pass").value;
    var remember = $("chk-remember").checked;
    var msg = $("login-msg");
    if (!email || !pass) { msg.textContent = "└─ isi email + pass dulu."; msg.className = "msg err"; return; }
    msg.textContent = "└─ menghubungi GAS...";
    msg.className = "msg";
    var res = await Gas.login(email, pass);
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
    var cred = loadJSON(LS_CRED);
    if (cred) {
      if (cred.email) $("in-email").value = cred.email;
      if (cred.password) $("in-pass").value = cred.password;
    }
    $("btn-login").addEventListener("click", doLogin);
    $("btn-logout").addEventListener("click", doLogout);
    $("btn-show-login").addEventListener("click", function () { openLogin(); });
    $("btn-refresh").addEventListener("click", triggerFetch);
    $("btn-retry").addEventListener("click", triggerFetch);
    $("btn-use-lokal").addEventListener("click", function () { resolveSheet(false); });
    $("btn-use-gas").addEventListener("click", function () { resolveSheet(true); });
    $("btn-sheet-close").addEventListener("click", hideSheet);
    $("sheet-wrap").addEventListener("click", function (e) { if (e.target === $("sheet-wrap")) hideSheet(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("sheet-wrap").hidden) hideSheet(); });
    $("in-pass").addEventListener("keydown", function (e) { if (e.key === "Enter") doLogin(); });
    // ponytail: tanpa interval (hemat kuota GAS); sync saat buka + kembali ke app + online
    document.addEventListener("visibilitychange", function () { if (!document.hidden) bootSync(); });
    window.addEventListener("online", bootSync);
    if (cred && cred.email && cred.password) {
      // render cache lokal dulu (instan, tanpa network), login jalan di background
      state.email = cred.email;
      state.password = cred.password;
      loadCache();
      renderAll();
      doLogin(); // auto-login: kredensial tersimpan
    }
  });
})();
