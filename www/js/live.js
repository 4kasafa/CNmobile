/* Live sesi manual: buka -> kuras buffer (loop since/limit=50) -> poll 2 dtk.
   Putus = sesi tetap buka + banner "belum lengkap" + retry. Stale-guard via seq. */
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

  var S = { sessionId: null, base: "", seq: 0, timer: null, polling: false, everBroken: false };
  var lastTap = { id: "", t: 0 }; // dobel-tap manual: dblclick bawaan tak andal di touchscreen HP

  function status(txt, cls) {
    var el = $("live-status");
    if (!el) return;
    el.textContent = txt;
    el.className = cls || "";
  }
  function banner(show, txt) {
    var b = $("live-banner");
    if (!b) return;
    b.hidden = !show;
    if (txt) $("live-banner-text").textContent = txt;
  }

  async function renderList() {
    if (!S.sessionId) { $("live-list").innerHTML = '<p class="dim">└─ belum ada sesi. isi IP PC lalu [buka].</p>'; return; }
    var rows = await Store.listTx(S.sessionId);
    if (!rows.length) { $("live-list").innerHTML = '<p class="dim">└─ sesi ini belum ada transaksi.</p>'; return; }
    $("live-list").innerHTML = rows.map(function (r, i) {
      var k = String(r.kategori || "").toLowerCase();
      var cls = k === "tunai" ? "lebih" : (k === "nontunai" ? "pas" : (k === "split" ? "kurang" : "pas"));
      return '<div class="tx st-' + cls + '">' +
        '<div class="tx-top"><span class="idx">#' + (i + 1) + '</span><span>' + esc(r.no_transaksi || ("id-" + r.server_id)) + '</span>' +
        '<span class="tag ' + cls + '">' + esc(String(r.kategori || "--").toUpperCase()) + '</span></div>' +
        '<div class="tx-mid"><span>' + esc(rupiah(r.total)) + '</span>' +
        '<span class="dim">T: ' + esc(rupiah(r.tunai)) + ' NT: ' + esc(rupiah(r.nontunai)) + (r.bank ? " " + esc(r.bank) : "") + '</span></div>' +
        '<div class="tx-bot"><span class="dim">' + esc(r.created_at || "") + '</span></div></div>';
    }).join("");
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
      var hint = s.status === "open" ? "" : ' <span class="dim">dobel-tap: buka lagi</span>';
      return '<div class="tx" data-sid="' + esc(s.id) + '"><div class="tx-mid"><span>' + esc(st) + " " + esc(s.id) + "</span>" +
        "<span class=\"dim\">" + esc(s.started_at || "") + " · " + esc(String(s.count || 0)) + " tx</span></div>" +
        "<div class=\"tx-bot\"><span class=\"dim\">" + esc(s.base_url || "") + "</span><span>" + cp + cur + hint + "</span></div></div>";
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
  async function drain(my) {
    var since = await Store.getLastSeen(S.sessionId);
    for (;;) {
      if (my !== S.seq) return true; // basi: sesi baru diambil alih
      var r = await Lan.fetchTx(S.base, since, 50);
      if (!r.ok) {
        S.everBroken = true;
        await Store.patchSession(S.sessionId, { complete: 0 });
        status("[PUTUS]", "bad");
        banner(true, "└─ belum lengkap: " + r.error + " (data tetap di PC)");
        await renderHistory();
        return false;
      }
      if (r.rows.length) await Store.upsertTx(S.sessionId, r.rows);
      if (r.rows.length < 50) { since = await Store.getLastSeen(S.sessionId); break; }
      since = await Store.getLastSeen(S.sessionId);
    }
    await renderList();
    return true;
  }

  async function pollOnce(my) {
    if (my !== S.seq || S.polling) return;
    S.polling = true;
    try {
      var ok = await drain(my);
      if (ok && my === S.seq) {
        status(S.everBroken ? "[BUKA·kurang]" : "[BUKA·ok]", S.everBroken ? "" : "ok");
        if (S.everBroken) banner(true, "└─ sesi belum lengkap (pernah putus), data baru tetap masuk");
        else banner(false);
        await renderHistory();
      }
    } finally {
      if (my === S.seq) S.polling = false;
    }
  }

  async function openSession() {
    var base = LanConfig.set($("in-lan").value);
    if (!base) { status("[isi IP dulu]", "bad"); $("in-lan").focus(); return; }
    S.base = base;
    status("[cek...]", "");
    banner(false);
    var h = await Lan.health(base);
    var my = ++S.seq;
    stopTimer();
    S.everBroken = !h.ok; // buka walau health gagal (keputusan user: tetap buka + retry)
    var s = await Store.createSession(base);
    if (!S.everBroken) { /* complete default 1 */ }
    else await Store.patchSession(s.id, { complete: 0 });
    S.sessionId = s.id;
    if (!h.ok) {
      status("[PUTUS]", "bad");
      banner(true, "└─ belum lengkap: PC tak terjangkau (" + h.error + "). sesi tetap buka, [coba lagi]");
    } else {
      status("[BUKA·kuras...]", "");
    }
    await renderAll();
    await drain(my);
    if (my !== S.seq) return;
    S.timer = setInterval(function () { pollOnce(my); }, 2000);
    var sess = await Store.getSession(S.sessionId);
    status(sess && sess.complete ? "[BUKA·ok]" : "[BUKA·kurang]", sess && sess.complete ? "ok" : "");
    await renderAll();
  }

  async function closeCurrent() {
    var my = ++S.seq;
    stopTimer();
    banner(false);
    if (S.sessionId) {
      await Store.closeSession(S.sessionId, !S.everBroken);
      S.sessionId = null;
    }
    S.everBroken = false;
    status("[--]", "");
    if (my !== S.seq) return;
    await renderAll();
  }

  // dobel-tap item riwayat closed = lanjutkan sesi itu. Tap tunggal: no-op.
  function onHistoryClick(e) {
    var el = e.target && e.target.closest ? e.target.closest("[data-sid]") : null;
    if (!el) return;
    var id = el.getAttribute("data-sid");
    if (!id || id === S.sessionId) { lastTap.id = ""; return; } // aktif: no-op
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
    var my = ++S.seq;
    stopTimer();
    if (S.sessionId && S.sessionId !== id) await closeCurrent(); // sesi lain ditutup dulu
    await Store.patchSession(id, { status: "open", closed_at: null });
    S.sessionId = id;
    S.base = LanConfig.set(s.base_url || S.base);
    S.everBroken = !s.complete;
    status("[BUKA·kuras...]", "");
    banner(S.everBroken, S.everBroken ? "└─ sesi belum lengkap (pernah putus), data baru tetap masuk" : "");
    await renderAll();
    await drain(my); // lanjut dari last_seen sesi itu, idempoten via upsertTx
    if (my !== S.seq) return;
    S.timer = setInterval(function () { pollOnce(my); }, 2000);
    var sess = await Store.getSession(S.sessionId);
    status(sess && sess.complete ? "[BUKA·ok]" : "[BUKA·kurang]", sess && sess.complete ? "ok" : "");
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
    if (ok && my === S.seq) {
      status(S.everBroken ? "[BUKA·kurang]" : "[BUKA·ok]", S.everBroken ? "" : "ok");
      // everBroken tetap true sampai tutup: riwayat jujur "belum lengkap"
      banner(S.everBroken, S.everBroken ? "└─ sesi belum lengkap (pernah putus), data baru tetap masuk" : "");
    }
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
      banner(S.everBroken, S.everBroken ? "└─ sesi belum lengkap (pernah putus)" : "");
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
    if ($("in-lan")) $("in-lan").addEventListener("change", function (e) { S.base = LanConfig.set(e.target.value); });
    resume();
  });

  return { open: openSession, close: closeCurrent, toggle: toggle, retry: retryNow, _state: S };
})();
