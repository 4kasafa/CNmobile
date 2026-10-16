/* Live sesi manual: buka -> kuras buffer (loop since/limit=50) -> poll 2 dtk.
   Putus = sesi tetap buka + status [PUTUS]/[BUKA·kurang] (tanpa banner error); drain ok = heal.
   Banner = totals permanen. Stale-guard via seq. */
var Live = (function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function rupiah(v) {
    var n = parseInt(v, 10);
    if (isNaN(n)) return "Rp 0";
    var f = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return n < 0 ? "Rp -" + f : "Rp " + f;
  }
  function sInt(v) { var n = parseInt(v, 10); return isNaN(n) ? 0 : n; }
  // no_urut longgar: digit >0 saja; ''/non-digit -> 0 (diabaikan guard).
  function numUrut(r) { var n = parseInt(String((r && r.no_urut) || ""), 10); return (isNaN(n) || n <= 0) ? 0 : n; }
  function dayOf(r) { return String((r && r.created_at) || "").slice(0, 10) || "??"; }
  function padU(n, w) { var s = String(n); while (s.length < w) s = "0" + s; return s; }

  // baris sintetis dari isian manual (tanpa server_id asli; identitas = fill "hari|n").
  function fillRow(f) {
    return {
      server_id: 0, no_transaksi: "", no_urut: String(f.n),
      total: f.total, tunai: f.tunai, nontunai: f.nontunai, bank: "",
      kategori: f.kategori, created_at: f.day, day: f.day, n: f.n, edited: 1, manual: 1,
    };
  }

  // item urut ASC: tx asli diseling baris HILANG untuk no_urut lompat.
  // Per-hari (reset POS tak memicu), duplikat/'' dilewati tanpa gap.
  // Gap yang sudah diisi manual (fills hari|no_urut) tampil sebagai tx MANUAL.
  function buildItems(rows, fills) {
    fills = fills || {};
    var asc = rows.slice().sort(function (a, b) { return sInt(a.server_id) - sInt(b.server_id); });
    var out = [], seen = {}, prevDay = null, prevN = 0, dayW = {};
    for (var i = 0; i < asc.length; i++) {
      var r = asc[i], d = dayOf(r), n = numUrut(r);
      if (!n) { out.push({ t: "tx", r: r }); prevDay = null; prevN = 0; continue; }
      var dw = String((r && r.no_urut) || "").replace(/[^0-9]/g, "").length; // lebar digit asli hari itu
      dayW[d] = Math.max(dayW[d] || 0, dw);
      var key = d + "|" + n;
      if (seen[key]) { out.push({ t: "tx", r: r }); continue; } // duplikat: tampil, tak dipakai rantai gap
      seen[key] = true;
      if (d === prevDay && n > prevN + 1) {
        var w = Math.max(dayW[d] || 0, String(prevN).length, String(n).length, 4);
        for (var m = prevN + 1; m < n; m++) {
          var fk = d + "|" + m;
          if (fills[fk]) out.push({ t: "tx", r: fillRow(fills[fk]), fill: fk, w: w });
          else out.push({ t: "hilang", day: d, n: m, w: w });
        }
      }
      prevDay = d; prevN = n;
      out.push({ t: "tx", r: r });
    }
    return out;
  }

  var S = { sessionId: null, base: "", seq: 0, timer: null, polling: false, everBroken: false, known: {}, flickT: null, bg: false };
  var lastTap = { id: "", t: 0 }; // dobel-tap manual: dblclick bawaan tak andal di touchscreen HP
  var lastTxTap = { tid: "", t: 0 }; // dobel-tap baris tx (namespace terpisah dari riwayat)
  var editingTid = null; // tid yang form koreksinya terbuka; satu form saja
  var editingFill = null; // kunci "hari|no_urut" HILANG yang form isiannya terbuka (tahap 2)
  var pendingDelete = null; // sid yang tombolnya [yakin?]; tap/render lain me-reset
  var revealedSid = null; // sid yang secret-nya (belum lengkap+[hapus]) diungkap via hold
  var holdT = null, holdSid = null, holdX = 0, holdY = 0; // timer hold 900ms

  function status(txt, cls) {
    var el = $("live-status");
    if (!el) return;
    el.textContent = txt;
    el.className = cls || "";
  }
  // banner = totals permanen sesi (tunai/nontunai/semua dari Store, split pecah per komponen).
  // Error hanya via label status ([PUTUS]/[BUKA·kurang]); HILANG excluded (tanpa nominal).
  async function renderTotals(rows) {
    var b = $("live-banner");
    if (!b) return;
    if (!S.sessionId) { b.hidden = true; return; }
    rows = rows || await Store.listTx(S.sessionId);
    var t = 0, nt = 0, all = 0;
    for (var i = 0; i < rows.length; i++) { t += sInt(rows[i].tunai); nt += sInt(rows[i].nontunai); all += sInt(rows[i].total); }
    var fills = await Store.getFills(S.sessionId), nf = 0; // isian manual ikut totals/banner
    for (var k in fills) {
      if (!fills.hasOwnProperty(k)) continue;
      nf++; t += sInt(fills[k].tunai); nt += sInt(fills[k].nontunai); all += sInt(fills[k].total);
    }
    $("live-banner-text").textContent = "└─ tx: " + (rows.length + nf) + " · tunai: " + rupiah(t) + " · nontunai: " + rupiah(nt) + " · semua: " + rupiah(all);
    b.hidden = false;
  }

  // sembuh tunggal: drain ok (cukup 1 fetchTx ok) -> everBroken=false + complete=1 + [BUKA·ok].
  // Dipakai poll/retry/reopen/open; gagal di batch mana pun tetap kurang via drain().
  async function heal() {
    S.everBroken = false;
    if (S.sessionId) await Store.patchSession(S.sessionId, { complete: 1 });
    status("[BUKA·ok]", "ok");
  }

  // freshIds: server_id baru dari drain -> class tx-new (flicker 5x/1dtk, lepas via timeout).
  // Tanpa argumen = render diam (sinkron S.known, tanpa flicker): dipakai open/reopen/edit.
  async function renderList(freshIds) {
    await renderTotals();
    if (!S.sessionId) { $("live-list").innerHTML = '<p class="dim">└─ belum ada sesi. isi IP PC lalu [buka].</p>'; return; }
    var rows = await Store.listTx(S.sessionId);
    if (!rows.length) { $("live-list").innerHTML = '<p class="dim">└─ sesi ini belum ada transaksi.</p>'; await renderTotals(rows); return; }
    var fresh = {};
    if (Array.isArray(freshIds)) for (var f = 0; f < freshIds.length; f++) fresh[String(freshIds[f])] = true;
    var items = buildItems(rows, await Store.getFills(S.sessionId)).reverse(); // terbaru di atas; HILANG sisip sesuai urutan
    $("live-list").innerHTML = items.map(function (it, i) {
      if (it.t === "hilang") {
        var hk = it.day + "|" + it.n;
        var hbody = String(editingFill) === hk
          ? '<div class="tx-bot"><span class="dim">T:</span><input data-ed="tunai" type="text" inputmode="numeric" pattern="[0-9]*" value="">' +
            '<span class="dim">NT:</span><input data-ed="nontunai" type="text" inputmode="numeric" pattern="[0-9]*" value="">' +
            '<span class="cmds"><button type="button" data-act="save">[simpan]</button> <button type="button" data-act="cancel">[batal]</button></span></div>'
          : '<div class="tx-bot"><span class="dim">' + esc(it.day) + ' · tak ada di PC</span>' +
            '<span class="cmds"><button type="button" data-isi="' + esc(hk) + '">[isi]</button></span></div>';
        return '<div class="tx st-kurang" data-hkey="' + esc(hk) + '">' +
          '<div class="tx-top"><span class="idx">~</span><span>HILANG no ' + esc(padU(it.n, it.w)) + '</span>' +
          '<span class="tag hilang">HILANG</span></div>' + hbody + '</div>';
      }
      if (it.fill) {
        var fr = it.r;
        var fkk = String(fr.kategori || "").toLowerCase();
        var fcls = fkk === "tunai" ? "lebih" : (fkk === "nontunai" ? "pas" : (fkk === "split" ? "kurang" : "pas"));
        var fform = String(editingFill) === String(it.fill)
          ? '<div class="tx-bot"><span class="dim">T:</span><input data-ed="tunai" type="text" inputmode="numeric" pattern="[0-9]*" value="' + esc(fr.tunai) + '">' +
            '<span class="dim">NT:</span><input data-ed="nontunai" type="text" inputmode="numeric" pattern="[0-9]*" value="' + esc(fr.nontunai) + '">' +
            '<span class="cmds"><button type="button" data-act="save">[simpan]</button> <button type="button" data-act="cancel">[batal]</button></span></div>'
          : "";
        return '<div class="tx st-' + fcls + '" data-fill="' + esc(it.fill) + '">' +
          '<div class="tx-top"><span class="idx">#' + (i + 1) + '</span><span>MANUAL no ' + esc(padU(fr.n, it.w || 4)) + '</span>' +
          '<span class="tag kurang">MANUAL</span> <span class="tag conf">EDIT</span></div>' +
          '<div class="tx-mid"><span>' + esc(rupiah(fr.total)) + '</span>' +
          '<span class="dim">T: ' + esc(rupiah(fr.tunai)) + ' NT: ' + esc(rupiah(fr.nontunai)) + '</span></div>' +
          '<div class="tx-bot"><span class="dim">' + esc(fr.day || "") + ' · isian HP</span></div>' + fform + '</div>';
      }
      var r = it.r;
      var k = String(r.kategori || "").toLowerCase();
      var cls = k === "tunai" ? "lebih" : (k === "nontunai" ? "pas" : (k === "split" ? "kurang" : "pas"));
      var ed = r.edited ? ' <span class="tag conf">EDIT</span>' : "";
      var form = String(r.server_id) === String(editingTid)
        ? '<div class="tx-bot"><span class="dim">T:</span><input data-ed="tunai" type="text" inputmode="numeric" pattern="[0-9]*" value="' + esc(r.tunai) + '">' +
          '<span class="dim">NT:</span><input data-ed="nontunai" type="text" inputmode="numeric" pattern="[0-9]*" value="' + esc(r.nontunai) + '">' +
          '<span class="cmds"><button type="button" data-act="save">[simpan]</button> <button type="button" data-act="cancel">[batal]</button></span></div>'
        : "";
      return '<div class="tx st-' + cls + (fresh[String(r.server_id)] ? " tx-new" : "") + '" data-tid="' + esc(r.server_id) + '">' +
        '<div class="tx-top"><span class="idx">#' + (i + 1) + '</span><span>' + esc(r.no_transaksi || ("id-" + r.server_id)) + '</span>' +
        '<span class="tag ' + cls + '">' + esc(String(r.kategori || "--").toUpperCase()) + '</span>' + ed + '</div>' +
        '<div class="tx-mid"><span>' + esc(rupiah(r.total)) + '</span>' +
        '<span class="dim">T: ' + esc(rupiah(r.tunai)) + ' NT: ' + esc(rupiah(r.nontunai)) + (r.bank ? " " + esc(r.bank) : "") + '</span></div>' +
        '<div class="tx-bot"><span class="dim">' + esc(r.created_at || "") + '</span></div>' + form + '</div>';
    }).join("");
    for (var u = 0; u < rows.length; u++) S.known[String(rows[u].server_id)] = true;
    if (S.flickT) { clearTimeout(S.flickT); S.flickT = null; }
    if (Object.keys(fresh).length) {
      S.flickT = setTimeout(function () {
        S.flickT = null;
        var box = $("live-list");
        if (!box) return;
        var els = box.querySelectorAll(".tx-new");
        for (var q = 0; q < els.length; q++) els[q].classList.remove("tx-new");
      }, 1000);
    }
    await renderTotals(rows);
  }

  async function renderHistory() {
    var box = $("live-history");
    if (!box) return;
    if (S.sessionId) { box.hidden = true; box.innerHTML = ""; return; } // sesi dibuka -> riwayat hidden total
    box.hidden = false;
    var ss = await Store.listSessions(10);
    if (!ss.length) { box.innerHTML = '<p class="dim">└─ riwayat: kosong.</p>'; return; }
    box.innerHTML = "<p class=\"cmdline\">└─ riwayat sesi</p>" + ss.map(function (s) {
      var st = s.status === "open" ? "[buka]" : "[tutup]";
      var shown = String(revealedSid) === String(s.id);
      var cp = (!s.complete && shown) ? ' <span class="tag kurang">belum lengkap</span>' : "";
      var cur = s.id === S.sessionId ? ' <span class="tag lebih">aktif</span>' : "";
      var del = (s.status === "open" || !shown) ? "" : (String(pendingDelete) === String(s.id)
        ? ' <button type="button" data-del="yakin">[yakin?]</button>'
        : ' <button type="button" data-del="hapus">[hapus]</button>');
      return '<div class="tx" data-sid="' + esc(s.id) + '"><div class="tx-mid"><span>' + esc(st) + " " + esc(s.id) + "</span>" +
        "<span class=\"dim\">" + esc(s.started_at || "") + " · " + esc(String(s.count || 0)) + " tx</span></div>" +
        "<div class=\"tx-bot\"><span class=\"dim\">" + esc(s.base_url || "") + "</span><span class=\"hist-secret\">" + cp + cur + del + "</span></div></div>";
    }).join("");
  }

  async function renderBar() {
    var open = !!S.sessionId && await Store.getSession(S.sessionId).then(function (s) { return s && s.status === "open"; });
    $("btn-live-toggle").textContent = open ? "[tutup]" : "[buka]";
    var inp = $("in-lan");
    if (inp && document.activeElement !== inp) inp.value = S.base;
  }

  async function renderAll() {
    await renderBar();
    renderBg();
    await renderList();
    await renderHistory();
  }

  function stopTimer() {
    if (S.timer) { clearInterval(S.timer); S.timer = null; }
    S.polling = false;
  }

  // ponytail: akses plugin lewat global Capacitor.Plugins — tanpa bundler di repo ini.
  function bgPlugin() {
    try { return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.BackgroundMode; } catch (e) { return null; }
  }
  function renderBg() {
    var b = $("btn-bg");
    if (b) b.textContent = S.bg ? "[bg:on]" : "[bg:off]";
  }
  // bg ON = foreground service + notifikasi permanen agar polling jalan saat minimize/layar mati.
  // Guard: hanya saat sesi open. Gagal/ditolak = status sebaris, tetap mode lama, tanpa crash.
  async function setBg(on) {
    var BM = bgPlugin();
    if (on) {
      var sess = S.sessionId ? await Store.getSession(S.sessionId) : null;
      if (!sess || sess.status !== "open") { status("[buka sesi dulu]", "bad"); return; }
      if (!BM) { status("[bg tak tersedia]", "bad"); return; }
      try {
        var np = await BM.checkNotificationsPermission();
        if (np && np.notifications !== "granted") np = await BM.requestNotificationsPermission();
        if (np && np.notifications !== "granted") { status("[notif ditolak]", "bad"); return; }
        try {
          var bo = await BM.checkBatteryOptimizations();
          if (bo && bo.enabled) await BM.requestDisableBatteryOptimizations();
        } catch (e2) {}
        await BM.enable({ title: "CNmobile", text: "Live sync jalan", channelName: "live_sync", channelDescription: "Sinkron Live kasir", silent: false, hidden: false, resume: true, disableWebViewOptimization: true });
        S.bg = true;
        try { localStorage.setItem("cn_bg", "1"); } catch (e3) {}
      } catch (e4) { S.bg = false; status("[bg gagal]", "bad"); }
    } else {
      if (BM) { try { await BM.disable(); } catch (e5) {} }
      S.bg = false;
      try { localStorage.setItem("cn_bg", "0"); } catch (e6) {}
    }
    renderBg();
  }

  // kuras buffer: loop since=last_seen limit=50 sampai <limit. false bila putus.
  // silent=true (kuras awal open/reopen): render diam tanpa flicker. poll/retry: flicker.
  async function drain(my, silent) {
    var since = await Store.getLastSeen(S.sessionId);
    var freshIds = [];
    for (;;) {
      if (my !== S.seq) return true; // basi: sesi baru diambil alih
      var r = await Lan.fetchTx(S.base, since, 50);
      if (!r.ok) {
        S.everBroken = true;
        await Store.patchSession(S.sessionId, { complete: 0 });
        status("[PUTUS]", "bad");
        await renderHistory();
        return false;
      }
      if (r.rows.length) {
        var up = await Store.upsertTx(S.sessionId, r.rows);
        if (up && up.ids) for (var k = 0; k < up.ids.length; k++) if (!S.known[String(up.ids[k])]) freshIds.push(up.ids[k]);
      }
      if (r.rows.length < 50) { since = await Store.getLastSeen(S.sessionId); break; }
      since = await Store.getLastSeen(S.sessionId);
    }
    if (my !== S.seq) return true;
    // ponytail: form edit/isi terbuka -> totals saja, jangan rebuild list (bunuh keyboard+draft)
    if (editingTid != null || editingFill != null) { await renderTotals(); return true; }
    await renderList(silent ? [] : freshIds);
    return true;
  }

  async function pollOnce(my) {
    if (my !== S.seq || S.polling) return;
    S.polling = true;
    try {
      var ok = await drain(my);
      if (ok && my === S.seq) {
        await heal();
        await renderHistory();
      }
    } finally {
      if (my === S.seq) S.polling = false;
    }
  }

  async function openSession() {
    pendingDelete = null; revealedSid = null; clearHold(); editingTid = null; editingFill = null;
    var base = LanConfig.set($("in-lan").value);
    if (!base) { status("[isi IP dulu]", "bad"); $("in-lan").focus(); return; }
    S.base = base;
    status("[cek...]", "");
    var h = await Lan.health(base);
    var my = ++S.seq;
    stopTimer();
    S.everBroken = !h.ok; // buka walau health gagal (keputusan user: tetap buka + retry)
    var s = await Store.createSession(base);
    if (!S.everBroken) { /* complete default 1 */ }
    else await Store.patchSession(s.id, { complete: 0 });
    S.sessionId = s.id;
    S.known = {}; // sesi baru: bucket Store kosong, known di-sync ulang via kuras diam
    if (!h.ok) {
      status("[PUTUS]", "bad");
    } else {
      status("[BUKA·kuras...]", "");
    }
    await renderAll();
    var ok = await drain(my, true); // kuras awal: diam, tanpa flicker
    if (my !== S.seq) return;
    S.timer = setInterval(function () { pollOnce(my); }, 2000);
    if (ok) await heal();
    else {
      var sess = await Store.getSession(S.sessionId);
      status(sess && sess.complete ? "[BUKA·ok]" : "[BUKA·kurang]", sess && sess.complete ? "ok" : "");
    }
    await renderAll();
  }

  async function closeCurrent() {
    var my = ++S.seq;
    stopTimer();
    if (S.bg) await setBg(false); // tutup sesi = service mati + notifikasi hilang
    pendingDelete = null; revealedSid = null; clearHold(); editingTid = null; editingFill = null;
    if (S.sessionId) {
      await Store.closeSession(S.sessionId, !S.everBroken);
      S.sessionId = null;
    }
    S.everBroken = false;
    status("[--]", "");
    if (my !== S.seq) return;
    await renderAll();
  }

  // guard angka ala print.js: strip non-digit, kosong->0; "-" ditolak (null).
  function cleanNum(v) {
    var s = String(v == null ? "" : v);
    if (/-/.test(s)) return null;
    var d = s.replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, "");
    return d === "" ? 0 : parseInt(d, 10);
  }

  // dobel-tap baris tx/manual sesi open = buka/tutup form koreksi lokal. Tap tunggal: no-op.
  function onListClick(e) {
    if (!S.sessionId) return;
    if (e.target && e.target.closest && (e.target.closest("button") || e.target.closest("input"))) return;
    var el = e.target && e.target.closest ? (e.target.closest("[data-tid]") || e.target.closest("[data-fill]")) : null;
    if (!el) return;
    var key = el.getAttribute("data-tid") || el.getAttribute("data-fill");
    if (!key) return;
    var isFill = !!el.getAttribute("data-fill");
    var now = Date.now();
    if (lastTxTap.tid === key && now - lastTxTap.t < 350) {
      lastTxTap.tid = "";
      if (isFill) { editingFill = (String(editingFill) === key) ? null : key; editingTid = null; }
      else { editingTid = (String(editingTid) === String(key)) ? null : key; editingFill = null; }
      renderAll();
    } else {
      lastTxTap.tid = key; lastTxTap.t = now;
    }
  }

  // tap [isi] pada baris HILANG = buka form isian + fokus input pertama.
  async function onListIsi(e) {
    var b = e.target && e.target.closest ? e.target.closest("[data-isi]") : null;
    if (!b || !S.sessionId) return;
    editingFill = b.getAttribute("data-isi");
    editingTid = null;
    await renderAll();
    try {
      var inp = document.querySelector('[data-hkey="' + editingFill + '"] [data-ed="tunai"]');
      if (inp) inp.focus();
    } catch (e2) {}
  }

  async function onListAction(e) {
    var t = e.target && e.target.closest ? e.target.closest("[data-act]") : null;
    if (!t || !S.sessionId) return;
    var box = t.closest("[data-tid]") || t.closest("[data-fill]") || t.closest("[data-hkey]");
    if (!box) { editingTid = null; editingFill = null; await renderAll(); return; }
    if (t.getAttribute("data-act") === "cancel") { editingTid = null; editingFill = null; await renderAll(); return; }
    var iT = box.querySelector('[data-ed="tunai"]'), iN = box.querySelector('[data-ed="nontunai"]');
    var ct = cleanNum(iT && iT.value), cn = cleanNum(iN && iN.value);
    if (ct === null || cn === null) return; // negatif: tolak, form tetap buka
    var fkey = box.getAttribute("data-fill") || box.getAttribute("data-hkey");
    if (fkey) { // isian manual HILANG: kunci "hari|n"
      var parts = String(fkey).split("|"), fn = parseInt(parts.pop(), 10), fday = parts.join("|");
      var f = await Store.upsertFill(S.sessionId, fday, fn, ct, cn);
      if (!f) return;
      editingFill = null; editingTid = null;
      await renderAll(); // list + totals banner ikut via renderList
      return;
    }
    var tid = box.getAttribute("data-tid");
    if (!tid) { editingTid = null; editingFill = null; await renderAll(); return; }
    var ok = await Store.patchTx(S.sessionId, tid, ct, cn);
    if (!ok) return;
    editingTid = null;
    await renderAll(); // list + totals banner ikut via renderList
  }

  // hold-to-reveal: tahan ~900ms pada item riwayat = ungkap secret (belum lengkap+[hapus]).
  // Dobel-tap tetap buka sesi; hold dibatalkan bila jari geser >10px (scroll) atau lepas cepat.
  function clearHold() {
    if (holdT) { clearTimeout(holdT); holdT = null; }
    holdSid = null;
    var box = $("live-history");
    if (!box) return;
    var els = box.querySelectorAll(".holding");
    for (var i = 0; i < els.length; i++) els[i].classList.remove("holding");
  }
  function revealHold() {
    if (!holdSid) return;
    revealedSid = holdSid; pendingDelete = null; lastTap.id = "";
    holdSid = null; holdT = null;
    try { if (navigator.vibrate) navigator.vibrate(15); } catch (e) {}
    renderAll();
  }
  function onHistoryHoldStart(e) {
    if (e.button != null && e.button !== 0) return; // klik kanan bukan hold
    if (!e.target || !e.target.closest) return;
    if (e.target.closest("[data-del]")) return; // tombol hapus tak perlu hold ulang
    var el = e.target.closest("[data-sid]");
    if (!el) return;
    var id = el.getAttribute("data-sid");
    if (!id || String(revealedSid) === String(id)) return; // sudah terungkap: tak perlu timer
    clearHold();
    holdSid = id;
    var p = (e.touches && e.touches[0]) || e;
    holdX = p.clientX || 0; holdY = p.clientY || 0;
    el.classList.add("holding");
    holdT = setTimeout(revealHold, 900);
  }
  function onHistoryHoldMove(e) {
    if (!holdT) return;
    var p = (e.touches && e.touches[0]) || e;
    var x = p.clientX || 0, y = p.clientY || 0;
    if (Math.abs(x - holdX) > 10 || Math.abs(y - holdY) > 10) clearHold();
  }

  // dobel-tap item riwayat closed = lanjutkan sesi itu. Tap tunggal: no-op.
  // Klik tombol [hapus]/[yakin?] dikecualikan dari tracker dobel-tap; tap lain me-reset pending.
  function onHistoryClick(e) {
    if (!e.target || !e.target.closest) return;
    var el = e.target.closest("[data-sid]");
    if (!el) return;
    var id = el.getAttribute("data-sid");
    if (!id) return;
    if (e.target.closest("[data-del]")) {
      lastTap.id = "";
      if (String(pendingDelete) === String(id)) {
        pendingDelete = null;
        Store.deleteSession(id).then(function () { renderAll(); });
      } else {
        pendingDelete = id;
        renderAll(); // [hapus] -> [yakin?]
      }
      return;
    }
    if (id === S.sessionId) { lastTap.id = ""; return; } // aktif: no-op
    if (revealedSid && String(revealedSid) !== String(id)) { revealedSid = null; pendingDelete = null; lastTap.id = ""; renderAll(); return; } // tap lain: sembunyikan secret
    if (pendingDelete) { pendingDelete = null; renderAll(); return; } // tap lain: batalkan [yakin?]
    var now = Date.now();
    if (lastTap.id === id && now - lastTap.t < 350) {
      lastTap.id = "";
      reopenSession(id);
    } else {
      lastTap.id = id; lastTap.t = now;
    }
  }

  async function reopenSession(id) {
    var s = await Store.getSession(id);
    if (!s || s.status === "open") return;
    stopTimer();
    pendingDelete = null; revealedSid = null; clearHold(); editingTid = null; editingFill = null;
    if (S.sessionId && S.sessionId !== id) await closeCurrent(); // sesi lain ditutup dulu
    var my = ++S.seq; // seq segar pasca-tutup (closeCurrent memajukan seq)
    await Store.patchSession(id, { status: "open", closed_at: null });
    S.sessionId = id;
    S.base = LanConfig.set(s.base_url || S.base);
    S.everBroken = !s.complete;
    status("[BUKA·kuras...]", "");
    await renderAll();
    var ok = await drain(my, true); // lanjutkan sesi: diam, tanpa flicker massal
    if (my !== S.seq) return;
    S.timer = setInterval(function () { pollOnce(my); }, 2000);
    if (ok) await heal(); // sesi lama ikut sembuh bila drain ok
    else {
      var sess = await Store.getSession(S.sessionId);
      status(sess && sess.complete ? "[BUKA·ok]" : "[BUKA·kurang]", sess && sess.complete ? "ok" : "");
    }
    await renderAll();
  }

  async function toggle() {
    var s = S.sessionId ? await Store.getSession(S.sessionId) : null;
    if (s && s.status === "open") await closeCurrent();
    else await openSession();
  }

  async function retryNow() {
    if (!S.sessionId) return;
    var my = S.seq; // retry dalam sesi yang sama, tanpa reset seq
    status("[coba...]", "");
    var ok = await drain(my);
    if (ok && my === S.seq) await heal();
    await renderAll();
  }

  // resume sesi open terakhir saat pindah tab / reload (tanpa auto-drain: tunggu [coba lagi]/poll)
  async function resume() {
    await Store.init();
    var ss = await Store.listSessions(10);
    var open = null;
    for (var i = 0; i < ss.length; i++) if (ss[i].status === "open") { open = ss[i]; break; }
    S.base = LanConfig.get();
    if (open) {
      S.sessionId = open.id;
      S.base = open.base_url || S.base;
      S.everBroken = !open.complete;
      var my = ++S.seq;
      stopTimer();
      status(S.everBroken ? "[BUKA·kurang]" : "[BUKA]", S.everBroken ? "" : "ok");
      await renderAll();
      S.timer = setInterval(function () { pollOnce(my); }, 2000);
      var wantBg = false;
      try { wantBg = localStorage.getItem("cn_bg") === "1"; } catch (e) {}
      if (wantBg) await setBg(true); // reload/minimize-balik: nyalakan lagi bila sebelumnya ON
    } else {
      await renderAll();
      status("[--]", "");
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    if ($("in-lan") && !S.base) { try { $("in-lan").value = LanConfig.get(); S.base = LanConfig.get(); } catch (e) {} }
    if ($("btn-live-toggle")) $("btn-live-toggle").addEventListener("click", toggle);
    if ($("btn-bg")) { $("btn-bg").addEventListener("click", function () { setBg(!S.bg); }); renderBg(); }
    if ($("btn-live-retry")) $("btn-live-retry").addEventListener("click", retryNow);
    if ($("live-history")) { $("live-history").addEventListener("click", onHistoryClick); $("live-history").addEventListener("pointerdown", onHistoryHoldStart); $("live-history").addEventListener("pointerup", clearHold); $("live-history").addEventListener("pointercancel", clearHold); $("live-history").addEventListener("pointerleave", clearHold); $("live-history").addEventListener("pointermove", onHistoryHoldMove); $("live-history").addEventListener("contextmenu", function (e) { if (holdT) e.preventDefault(); }); }
    if ($("live-list")) { $("live-list").addEventListener("click", onListClick); $("live-list").addEventListener("click", onListAction); $("live-list").addEventListener("click", onListIsi); }
    if ($("in-lan")) $("in-lan").addEventListener("change", function (e) { S.base = LanConfig.set(e.target.value); });
    resume();
  });

  return { open: openSession, close: closeCurrent, toggle: toggle, retry: retryNow, _state: S };
})();
