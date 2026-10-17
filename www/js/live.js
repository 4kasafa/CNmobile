/* Live sesi manual multi-PC: [buka] -> picker (hanya PC tersambung, Comp.pick) -> satu
   sesi menarik N PC. Drain/poll PER PC (since + complete sendiri): satu PC putus tak
   menjatuhkan PC lain; yang nyala lagi otomatis tertangkap (drain ok =-resources heal).
   [>+tambah pc] menyisip PC ke sesi yang jalan. Baris tx diberi tag nama PC
   (TxMerge: rantai no_urut per PC lalu gabung created_at DESC). Stale-guard via seq. */
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
  function padU(n, w) { return TxMerge.padU(n, w); }

  var S = { sessionId: null, pcs: [], seq: 0, timer: null, polling: false, everBroken: false, known: {}, flickT: null, bg: false, beats: 0, beatsAtHide: 0, hiddenAt: 0 };
  var lastSent = ""; // throttle pushState: kirim state ke native hanya bila berubah
  var lastTap = { id: "", t: 0 }; // dobel-tap manual: dblclick bawaan tak andal di touchscreen HP
  var lastTxTap = { tid: "", t: 0 }; // dobel-tap baris tx (namespace terpisah dari riwayat)
  var editingTid = null; // tid yang form koreksinya terbuka; satu form saja
  var editingFill = null; // kunci "<comp_id>|<hari>|<no_urut>" HILANG yang form isiannya terbuka
  var pendingDelete = null; // sid yang tombolnya [yakin?]; tap/render lain me-reset
  var revealedSid = null; // sid yang secret-nya (belum lengkap+[hapus]) diungkap via hold
  var holdT = null, holdSid = null, holdX = 0, holdY = 0; // timer hold 900ms

  function status(txt, cls) {
    var el = $("live-status");
    if (!el) return;
    el.textContent = txt;
    el.className = cls || "";
  }
  // [BUKA·ok] semua PC sehat · [BUKA·kurang] sebagian putus · [PUTUS] semua putus
  function paintStatus() {
    if (!S.sessionId) { status("[--]", ""); return; }
    var n = 0, alive = 0;
    for (var i = 0; i < S.pcs.length; i++) { n++; if (S.pcs[i].alive) alive++; }
    if (!n) { status("[--]", ""); return; }
    if (alive === n) status("[BUKA·ok]", "ok");
    else if (alive === 0) status("[PUTUS]", "bad");
    else status("[BUKA·kurang]", "");
  }

  // banner = totals permanen sesi (tunai/nontunai/semua dari Store, split pecah per komponen).
  // Error hanya via label status ([PUTUS]/[BUKA·kurang]); HILANG excluded (tanpa nominal).
  async function renderTotals(rows) {
    var b = $("live-banner");
    if (!b) return;
    if (!S.sessionId) { b.hidden = true; return; }
    rows = rows || await Store.listTx(S.sessionId);
    var t = 0, nt = 0, all = 0, last = null;
    for (var i = 0; i < rows.length; i++) { t += sInt(rows[i].tunai); nt += sInt(rows[i].nontunai); all += sInt(rows[i].total); if (!last || sInt(rows[i].server_id) > sInt(last.server_id)) last = rows[i]; }
    var fills = await Store.getFills(S.sessionId), nf = 0; // isian manual ikut totals/banner
    for (var k in fills) {
      if (!fills.hasOwnProperty(k)) continue;
      nf++; t += sInt(fills[k].tunai); nt += sInt(fills[k].nontunai); all += sInt(fills[k].total);
    }
    $("live-banner-text").textContent = "└─ " + S.pcs.length + " pc · tx: " + (rows.length + nf) + " · tunai: " + rupiah(t) + " · nontunai: " + rupiah(nt) + " · semua: " + rupiah(all);
    b.hidden = false;
    pushState({
      count: rows.length + nf,
      total: all,
      lastTotal: last ? sInt(last.total) : 0,
      lastTime: last ? String(last.created_at || "").slice(11, 16) : "",
    });
  }

  // v1.6.0: native yang menulis notifikasi (polling sendiri, tak bergantung timer WebView).
  // JS kirim state ABSOLUT (total sesi termasuk isian manual) + since tiap PC; native replace
  // lalu menambah delta tick-nya -> last-writer-wins, tak pernah dobel-hitung. Throttle per berubah.
  async function pushState(st) {
    if (!S.bg || !st) return;
    var BP = bgPlugin();
    if (!BP) return;
    var pl = [], i;
    for (i = 0; i < S.pcs.length; i++) pl.push({ comp_id: S.pcs[i].comp_id, base: S.pcs[i].base, since: sInt(S.pcs[i].last_seen), alive: S.pcs[i].alive ? 1 : 0 });
    var payload;
    try { payload = JSON.stringify({ pcs: pl, count: st.count, total: st.total, lastTotal: st.lastTotal, lastTime: st.lastTime }); }
    catch (e) { return; }
    if (payload === lastSent) return;
    lastSent = payload;
    try { await BP.start({ state: payload }); } catch (e2) { lastSent = ""; }
  }

  // freshIds: tid baru dari drain -> class tx-new (flicker 5x/1dtk, lepas via timeout).
  // Tanpa argumen = render diam (sinkron S.known, tanpa flicker): dipakai open/reopen/edit.
  async function renderList(freshIds) {
    await renderTotals();
    if (!S.sessionId) { $("live-list").innerHTML = '<p class="dim">└─ belum ada sesi. [buka] lalu pilih computer.</p>'; return; }
    var rows = await Store.listTx(S.sessionId);
    if (!rows.length) { $("live-list").innerHTML = '<p class="dim">└─ sesi ini belum ada transaksi.</p>'; await renderTotals(rows); return; }
    var fresh = {};
    if (Array.isArray(freshIds)) for (var f = 0; f < freshIds.length; f++) fresh[String(freshIds[f])] = true;
    var items = TxMerge.buildItems(rows, await Store.getFills(S.sessionId)); // sudah urut DESC
    $("live-list").innerHTML = items.map(function (it, i) {
      var pcTag = '<span class="tag pc">' + esc(it.pc_name || "") + "</span>";
      if (it.t === "hilang") {
        var hk = it.hkey;
        var hbody = String(editingFill) === hk
          ? '<div class="tx-bot"><span class="dim">T:</span><input data-ed="tunai" type="text" inputmode="numeric" pattern="[0-9]*" value="">' +
            '<span class="dim">NT:</span><input data-ed="nontunai" type="text" inputmode="numeric" pattern="[0-9]*" value="">' +
            '<span class="cmds"><button type="button" data-act="save">[simpan]</button> <button type="button" data-act="cancel">[batal]</button></span></div>'
          : '<div class="tx-bot"><span class="dim">' + esc(it.day) + " · tak ada di PC</span>" +
            '<span class="cmds"><button type="button" data-isi="' + esc(hk) + '">[isi]</button></span></div>';
        return '<div class="tx st-kurang" data-hkey="' + esc(hk) + '">' +
          '<div class="tx-top"><span class="idx">~</span><span>HILANG no ' + esc(padU(it.n, it.w)) + "</span>" +
          pcTag + ' <span class="tag hilang">HILANG</span></div>' + hbody + "</div>";
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
          '<div class="tx-top"><span class="idx">#' + (i + 1) + '</span><span>MANUAL no ' + esc(padU(fr.n, it.w || 4)) + "</span>" +
          pcTag + ' <span class="tag kurang">MANUAL</span> <span class="tag conf">EDIT</span></div>' +
          '<div class="tx-mid"><span>' + esc(rupiah(fr.total)) + "</span>" +
          '<span class="dim">T: ' + esc(rupiah(fr.tunai)) + " NT: " + esc(rupiah(fr.nontunai)) + "</span></div>" +
          '<div class="tx-bot"><span class="dim">' + esc(fr.day || "") + " · isian HP</span></div>" + fform + "</div>";
      }
      var r = it.r;
      var k = String(r.kategori || "").toLowerCase();
      var cls = k === "tunai" ? "lebih" : (k === "nontunai" ? "pas" : (k === "split" ? "kurang" : "pas"));
      var ed = r.edited ? ' <span class="tag conf">EDIT</span>' : "";
      var form = String(r.tid) === String(editingTid)
        ? '<div class="tx-bot"><span class="dim">T:</span><input data-ed="tunai" type="text" inputmode="numeric" pattern="[0-9]*" value="' + esc(r.tunai) + '">' +
          '<span class="dim">NT:</span><input data-ed="nontunai" type="text" inputmode="numeric" pattern="[0-9]*" value="' + esc(r.nontunai) + '">' +
          '<span class="cmds"><button type="button" data-act="save">[simpan]</button> <button type="button" data-act="cancel">[batal]</button></span></div>'
        : "";
      return '<div class="tx st-' + cls + (fresh[String(r.tid)] ? " tx-new" : "") + '" data-tid="' + esc(r.tid) + '">' +
        '<div class="tx-top"><span class="idx">#' + (i + 1) + '</span><span>' + esc(r.no_transaksi || ("id-" + r.server_id)) + "</span>" +
        pcTag + ' <span class="tag ' + cls + '">' + esc(String(r.kategori || "--").toUpperCase()) + "</span>" + ed + "</div>" +
        '<div class="tx-mid"><span>' + esc(rupiah(r.total)) + "</span>" +
        '<span class="dim">T: ' + esc(rupiah(r.tunai)) + " NT: " + esc(rupiah(r.nontunai)) + (r.bank ? " " + esc(r.bank) : "") + "</span></div>" +
        '<div class="tx-bot"><span class="dim">' + esc(r.created_at || "") + "</span></div>" + form + "</div>";
    }).join("");
    for (var u = 0; u < rows.length; u++) S.known[String(rows[u].tid)] = true;
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

  function pcLabel(pcs) {
    var names = [];
    for (var i = 0; i < (pcs || []).length; i++) names.push(pcs[i].name || pcs[i].comp_id);
    if (!names.length) return "--";
    if (names.length <= 2) return names.join(" + ");
    return names[0] + " + " + names[1] + " (+" + (names.length - 2) + ")";
  }

  async function renderHistory() {
    var box = $("live-history");
    if (!box) return;
    if (S.sessionId) { box.hidden = true; box.innerHTML = ""; return; } // sesi dibuka -> riwayat hidden total
    box.hidden = false;
    var ss = await Store.listSessions(10);
    if (!ss.length) { box.innerHTML = '<p class="dim">└─ riwayat: kosong.</p>'; return; }
    box.innerHTML = '<p class="cmdline">└─ riwayat sesi</p>' + ss.map(function (s) {
      var st = s.status === "open" ? "[buka]" : "[tutup]";
      var shown = String(revealedSid) === String(s.id);
      var cp = (!s.complete && shown) ? ' <span class="tag kurang">belum lengkap</span>' : "";
      var cur = s.id === S.sessionId ? ' <span class="tag lebih">aktif</span>' : "";
      var del = (s.status === "open" || !shown) ? "" : (String(pendingDelete) === String(s.id)
        ? ' <button type="button" data-del="yakin">[yakin?]</button>'
        : ' <button type="button" data-del="hapus">[hapus]</button>');
      return '<div class="tx" data-sid="' + esc(s.id) + '"><div class="tx-mid"><span>' + esc(st) + " " + esc(s.id) + "</span>" +
        '<span class="dim">' + esc(s.started_at || "") + " · " + esc(String(s.count || 0)) + " tx</span></div>" +
        '<div class="tx-bot"><span class="dim">' + esc(pcLabel(s.pcs)) + "</span><span class=\"hist-secret\">" + cp + cur + del + "</span></div></div>";
    }).join("");
  }

  async function renderBar() {
    var open = !!S.sessionId && await Store.getSession(S.sessionId).then(function (s) { return s && s.status === "open"; });
    $("btn-live-toggle").textContent = open ? "[tutup]" : "[buka]";
    var lab = $("live-pcs");
    if (lab) lab.textContent = open ? pcLabel(S.pcs) : "--";
    var add = $("btn-live-add");
    if (add) add.hidden = !open;
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
    try { return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.BgSync; } catch (e) { return null; }
  }
  function renderBg() {
    var b = $("btn-bg");
    if (b) b.textContent = S.bg ? "[bg:on]" : "[bg:off]";
  }
  // bg ON = foreground service + notifikasi permanen agar polling jalan saat minimize/layar mati.
  // Guard: hanya saat sesi open. Gagal/ditolak = status sebaris, tetap mode lama, tanpa crash.
  async function setBg(on) {
    var BP = bgPlugin();
    if (on) {
      if (S.bg) { renderBg(); return; }
      var sess = S.sessionId ? await Store.getSession(S.sessionId) : null;
      if (!sess || sess.status !== "open") { status("[buka sesi dulu]", "bad"); return; }
      if (!BP) { status("[bg tak tersedia]", "bad"); return; }
      try {
        await BP.start(); // prompt izin notif di native bila perlu; tolak "denied-notif" bila ditolak
        try {
          var batt = null;
          try { batt = localStorage.getItem("cn_batt"); } catch (e0) {}
          if (batt !== "1") {
            await BP.openBatterySettings();
            try { localStorage.setItem("cn_batt", "1"); } catch (e1) {}
          }
        } catch (e2) {}
        S.bg = true;
        try { localStorage.setItem("cn_bg", "1"); } catch (e3) {}
        lastSent = ""; await renderTotals(); // kirim state awal ke native (sekalian isi banner)
      } catch (e4) {
        S.bg = false;
        status(String((e4 && e4.message) || e4 || "").indexOf("denied-notif") >= 0 ? "[notif ditolak]" : "[bg gagal]", "bad");
      }
    } else {
      if (BP) { try { await BP.stop(); } catch (e5) {} }
      S.bg = false;
      lastSent = "";
      try { localStorage.setItem("cn_bg", "0"); } catch (e6) {}
    }
    renderBg();
  }

  /* ---------- drain per PC ---------- */

  // kuras buffer 1 PC: loop since=pc.last_seen limit=50 sampai <50. true bila tuntas.
  // gagal -> PC itu alive=0 + complete=0 (PC lain tak tersentuh); drain ok =-resources heal.
  async function drainPc(my, pc, freshIds) {
    var since = sInt(pc.last_seen);
    for (;;) {
      if (my !== S.seq) return true; // basi: sesi baru diambil alih
      var r = await Lan.fetchTx(pc.base, since, 50);
      if (!r.ok) {
        pc.alive = 0; pc.complete = 0;
        if (S.sessionId) await Store.patchPc(S.sessionId, pc.comp_id, { alive: 0, complete: 0 });
        return false;
      }
      if (r.rows.length) {
        var up = await Store.upsertTx(S.sessionId, pc.comp_id, r.rows);
        if (up) {
          pc.last_seen = up.lastSeen;
          if (up.ids) for (var k = 0; k < up.ids.length; k++) if (!S.known[String(up.ids[k])]) freshIds.push(up.ids[k]);
        }
      }
      if (r.rows.length < 50) break;
      since = sInt(pc.last_seen);
    }
    pc.alive = 1; pc.complete = 1;
    if (S.sessionId) await Store.patchPc(S.sessionId, pc.comp_id, { alive: 1, complete: 1, last_seen: sInt(pc.last_seen) });
    return true;
  }

  // semua PC bergantian. allOk = semua tuntas. silent=true (kuras awal): render diam tanpa flicker.
  async function drain(my, silent) {
    var freshIds = [], allOk = true;
    for (var i = 0; i < S.pcs.length; i++) {
      if (my !== S.seq) return true;
      if (!(await drainPc(my, S.pcs[i], freshIds))) allOk = false;
    }
    if (my !== S.seq) return true;
    S.everBroken = !allOk;
    paintStatus();
    if (!allOk) { await renderHistory(); return false; }
    // ponytail: form edit/isi terbuka -> totals saja, jangan rebuild list (bunuh keyboard+draft)
    if (editingTid != null || editingFill != null) { await renderTotals(); return true; }
    await renderList(silent ? [] : freshIds);
    return true;
  }

  async function pollOnce(my) {
    if (my !== S.seq || S.polling) return;
    S.polling = true;
    S.beats++; // diagnostik: tick timer hidup/tidak saat background
    try { await drain(my); } finally { if (my === S.seq) S.polling = false; }
  }

  // comps: [{id,name,base}] dari picker Comp.pick (PC tersindung saja)
  async function openSession(comps) {
    var pick = [];
    for (var i = 0; i < (comps || []).length; i++) if (comps[i] && comps[i].id && comps[i].base) pick.push(comps[i]);
    if (!pick.length) return;
    pendingDelete = null; revealedSid = null; clearHold(); editingTid = null; editingFill = null;
    var my = ++S.seq;
    stopTimer();
    var s = await Store.createSession(pick);
    S.sessionId = s.id;
    S.pcs = s.pcs;
    S.known = {}; // sesi baru: bucket Store kosong, known di-sync ulang via kuras diam
    S.everBroken = false;
    for (var p = 0; p < pick.length; p++) { try { Comps.touch(pick[p].id); } catch (e) {} }
    status("[cek...]", "");
    await renderAll();
    var ok = await drain(my, true); // kuras awal: diam, tanpa flicker
    if (my !== S.seq) return;
    S.timer = setInterval(function () { pollOnce(my); }, 2000);
    paintStatus();
    await renderAll();
  }

  async function closeCurrent() {
    var my = ++S.seq;
    stopTimer();
    if (S.bg) await setBg(false); // tutup sesi = service mati + notifikasi hilang
    pendingDelete = null; revealedSid = null; clearHold(); editingTid = null; editingFill = null;
    if (S.sessionId) {
      var sess = await Store.getSession(S.sessionId);
      await Store.closeSession(S.sessionId, !!(sess && sess.complete));
      S.sessionId = null;
    }
    S.pcs = [];
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
    if (fkey) { // isian manual HILANG: kunci "<comp_id>|<hari>|<n>"
      var parts = String(fkey).split("|"), fn = parseInt(parts.pop(), 10), fday = parts.pop(), fcomp = parts.join("|");
      var f = await Store.upsertFill(S.sessionId, fcomp, fday, fn, ct, cn);
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

  // [+tambah pc]: sisip PC ke sesi yang jalan (since=0 -> langsung di-drain penuh)
  async function addPc() {
    if (!S.sessionId) return;
    var have = {};
    for (var i = 0; i < S.pcs.length; i++) have[S.pcs[i].comp_id] = true;
    pick({ title: "tambah pc", exclude: have }, async function (comps) {
      if (!comps || !comps.length) return;
      var s = await Store.addPc(S.sessionId, comps[0]);
      if (!s) { status("[sudah ada di sesi]", "bad"); return; }
      for (var j = 0; j < comps.length; j++) try { Comps.touch(comps[j].id); } catch (e) {}
      var pcs = await Store.getSession(S.sessionId);
      S.pcs = pcs ? pcs.pcs : S.pcs;
      await renderAll();
      await drain(S.seq, true); // PC baru: kuras diam, tanpa bikin PC lain flicker
      await renderAll();
    });
  }

  // picker PC (Comp.pick): cek ulang -> hanya PC tersambung. Tanpa UI comp = jelas, bukan crash.
  function pick(opts, done) {
    if (typeof Comp === "undefined" || !Comp.pick) { status("[ui computer belum siap]", "bad"); return; }
    Comp.pick(opts, done);
  }

  /* ---------- riwayat sesi ---------- */

  // hold-to-reveal: tahan ~900ms pada item riwayat = ungkink secret (belum lengkap+[hapus]).
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
    S.pcs = s.pcs || [];
    S.known = {};
    status("[BUKA·kuras...]", "");
    await renderAll();
    var ok = await drain(my, true); // lanjutkan sesi: diam, tanpa flicker massal
    if (my !== S.seq) return;
    S.timer = setInterval(function () { pollOnce(my); }, 2000);
    paintStatus(); // tiap PC disembuhkan sendiri bila drain-nya ok
    await renderAll();
  }

  async function toggle() {
    var s = S.sessionId ? await Store.getSession(S.sessionId) : null;
    if (s && s.status === "open") await closeCurrent();
    else pick({ title: "pilih computer", exclude: {} }, openSession);
  }

  async function retryNow() {
    if (!S.sessionId) return;
    var my = S.seq; // retry dalam sesi yang sama, tanpa reset seq
    status("[coba...]", "");
    await drain(my);
    await renderAll();
  }

  // PC ini sedang ikut sesi aktif? (halaman control pakai ini untuk memblokir wipe)
  function isActive(compId) {
    for (var i = 0; i < S.pcs.length; i++) if (S.pcs[i].comp_id === compId) return true;
    return false;
  }

  // resume sesi open terakhir saat pindah tab / reload (tanpa auto-drain: tunggu poll)
  async function resume() {
    await Store.init();
    var ss = await Store.listSessions(10);
    var open = null;
    for (var i = 0; i < ss.length; i++) if (ss[i].status === "open") { open = ss[i]; break; }
    if (open) {
      S.sessionId = open.id;
      S.pcs = open.pcs || [];
      var my = ++S.seq;
      stopTimer();
      S.everBroken = false;
      for (var k = 0; k < S.pcs.length; k++) { S.pcs[k].alive = 0; S.pcs[k].complete = 0; } // belum dicek: tunggu poll pertama
      status("[BUKA·kurang]", "");
      await renderAll();
      S.timer = setInterval(function () { pollOnce(my); }, 2000);
      var wantBg = false;
      try { wantBg = localStorage.getItem("cn_bg") === "1"; } catch (e) {}
      if (wantBg) await setBg(true); // reload/minimize-balik: nyalakan lagi bila sebelumnya ON
    } else {
      S.pcs = [];
      await renderAll();
      status("[--]", "");
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    if ($("btn-live-toggle")) $("btn-live-toggle").addEventListener("click", toggle);
    if ($("btn-live-add")) $("btn-live-add").addEventListener("click", addPc);
    if ($("btn-bg")) { $("btn-bg").addEventListener("click", function () { setBg(!S.bg); }); renderBg(); }
    if ($("btn-live-retry")) $("btn-live-retry").addEventListener("click", retryNow);
    if ($("live-history")) {
      $("live-history").addEventListener("click", onHistoryClick);
      $("live-history").addEventListener("pointerdown", onHistoryHoldStart);
      $("live-history").addEventListener("pointerup", clearHold);
      $("live-history").addEventListener("pointercancel", clearHold);
      $("live-history").addEventListener("pointerleave", clearHold);
      $("live-history").addEventListener("pointermove", onHistoryHoldMove);
      $("live-history").addEventListener("contextmenu", function (e) { if (holdT) e.preventDefault(); });
    }
    if ($("live-list")) {
      $("live-list").addEventListener("click", onListClick);
      $("live-list").addEventListener("click", onListAction);
      $("live-list").addEventListener("click", onListIsi);
    }
    // ponytail: diagnostik throttle (bukan fitur). N besar = timer hidup di background;
    // N~0 tapi detik besar = visibilitychange telat (renderer beku); detik kecil = event tak jalan.
    // Tulis ke #live-beat, BUKAN status() — poll tiap 2 dtk menimpa status.
    function beatMark() { S.beatsAtHide = S.beats; S.hiddenAt = Date.now(); }
    function beatShow() {
      var el = $("live-beat");
      if (!el || !S.sessionId) return;
      var d = S.beats - S.beatsAtHide;
      var secs = S.hiddenAt ? Math.round((Date.now() - S.hiddenAt) / 1000) : 0;
      el.textContent = "[beat +" + d + " · " + secs + "d]";
    }
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) beatMark();
      else beatShow();
    });
    document.addEventListener("freeze", beatMark); // renderer dibekukan: catat titik masuk
    document.addEventListener("resume", beatShow); // renderer hidup lagi: laporkan
    resume();
  });

  return { open: openSession, close: closeCurrent, toggle: toggle, retry: retryNow, addPc: addPc, isActive: isActive, _state: S };
})();