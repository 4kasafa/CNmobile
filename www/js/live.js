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

  // item urut ASC: tx asli diseling baris HILANG untuk no_urut lompat.
  // Per-hari (reset POS tak memicu), duplikat/'' dilewati tanpa gap.
  function buildItems(rows) {
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
        for (var m = prevN + 1; m < n; m++) out.push({ t: "hilang", day: d, n: m, w: w });
      }
      prevDay = d; prevN = n;
      out.push({ t: "tx", r: r });
    }
    return out;
  }

  var S = { sessionId: null, base: "", seq: 0, timer: null, polling: false, everBroken: false, known: {}, flickT: null };
  var lastTap = { id: "", t: 0 }; // dobel-tap manual: dblclick bawaan tak andal di touchscreen HP
  var lastTxTap = { tid: "", t: 0 }; // dobel-tap baris tx (namespace terpisah dari riwayat)
  var editingTid = null; // tid yang form koreksinya terbuka; satu form saja
  var pendingDelete = null; // sid yang tombolnya [yakin?]; tap/render lain me-reset

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
    $("live-banner-text").textContent = "└─ tx: " + rows.length + " · tunai: " + rupiah(t) + " · nontunai: " + rupiah(nt) + " · semua: " + rupiah(all);
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
    var items = buildItems(rows).reverse(); // terbaru di atas; HILANG sisip sesuai urutan
    $("live-list").innerHTML = items.map(function (it, i) {
      if (it.t === "hilang") return '<div class="tx st-kurang">' +
        '<div class="tx-top"><span class="idx">~</span><span>HILANG no ' + esc(padU(it.n, it.w)) + '</span>' +
        '<span class="tag hilang">HILANG</span></div>' +
        '<div class="tx-bot"><span class="dim">' + esc(it.day) + ' · tak ada di PC</span></div></div>';
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
      var cp = s.complete ? "" : ' <span class="tag kurang">belum lengkap</span>';
      var cur = s.id === S.sessionId ? ' <span class="tag lebih">aktif</span>' : "";
      var del = s.status === "open" ? "" : (String(pendingDelete) === String(s.id)
        ? ' <button type="button" data-del="yakin">[yakin?]</button>'
        : ' <button type="button" data-del="hapus">[hapus]</button>');
      return '<div class="tx" data-sid="' + esc(s.id) + '"><div class="tx-mid"><span>' + esc(st) + " " + esc(s.id) + "</span>" +
        "<span class=\"dim\">" + esc(s.started_at || "") + " · " + esc(String(s.count || 0)) + " tx</span></div>" +
        "<div class=\"tx-bot\"><span class=\"dim\">" + esc(s.base_url || "") + "</span><span>" + cp + cur + del + "</span></div></div>";
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
    await renderList();
    await renderHistory();
  }

  function stopTimer() {
    if (S.timer) { clearInterval(S.timer); S.timer = null; }
    S.polling = false;
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
    pendingDelete = null;
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
    pendingDelete = null;
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

  // dobel-tap baris tx sesi open = buka/tutup form koreksi lokal. Tap tunggal: no-op.
  function onListClick(e) {
    if (!S.sessionId) return;
    if (e.target && e.target.closest && (e.target.closest("button") || e.target.closest("input"))) return;
    var el = e.target && e.target.closest ? e.target.closest("[data-tid]") : null;
    if (!el) return;
    var tid = el.getAttribute("data-tid");
    if (!tid) return;
    var now = Date.now();
    if (lastTxTap.tid === tid && now - lastTxTap.t < 350) {
      lastTxTap.tid = "";
      editingTid = (String(editingTid) === String(tid)) ? null : tid;
      renderAll();
    } else {
      lastTxTap.tid = tid; lastTxTap.t = now;
    }
  }

  async function onListAction(e) {
    var t = e.target && e.target.closest ? e.target.closest("[data-act]") : null;
    if (!t || !S.sessionId) return;
    var box = t.closest("[data-tid]");
    var tid = box && box.getAttribute("data-tid");
    if (t.getAttribute("data-act") === "cancel" || !tid) { editingTid = null; await renderAll(); return; }
    var iT = box.querySelector('[data-ed="tunai"]'), iN = box.querySelector('[data-ed="nontunai"]');
    var ct = cleanNum(iT && iT.value), cn = cleanNum(iN && iN.value);
    if (ct === null || cn === null) return; // negatif: tolak, form tetap buka
    var ok = await Store.patchTx(S.sessionId, tid, ct, cn);
    if (!ok) return;
    editingTid = null;
    await renderAll(); // list + totals banner ikut via renderList
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
    pendingDelete = null;
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
    } else {
      await renderAll();
      status("[--]", "");
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    if ($("in-lan") && !S.base) { try { $("in-lan").value = LanConfig.get(); S.base = LanConfig.get(); } catch (e) {} }
    if ($("btn-live-toggle")) $("btn-live-toggle").addEventListener("click", toggle);
    if ($("btn-live-retry")) $("btn-live-retry").addEventListener("click", retryNow);
    if ($("live-history")) $("live-history").addEventListener("click", onHistoryClick);
    if ($("live-list")) { $("live-list").addEventListener("click", onListClick); $("live-list").addEventListener("click", onListAction); }
    if ($("in-lan")) $("in-lan").addEventListener("change", function (e) { S.base = LanConfig.set(e.target.value); });
    resume();
  });

  return { open: openSession, close: closeCurrent, toggle: toggle, retry: retryNow, _state: S };
})();
