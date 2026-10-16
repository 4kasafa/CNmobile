/* Settings: watcher on/off + wipe permanen. PIN per seksi, hanya memori. Lokal HP tak diubah. */
var Settings = (function () {
  "use strict";
  function $(id) { return document.getElementById(id); }

  function base() { try { return LanConfig.get(); } catch (e) { return ""; } }

  function setMsg(t, cls) {
    var m = $("set-msg");
    if (!m) return;
    m.textContent = t || "";
    m.className = "msg" + (cls ? " " + cls : "");
  }
  function watchMsg(t, cls) { setMsg(t, cls); }
  function wipeMsg(t, cls) { setMsg(t, cls === undefined ? "err" : cls); }
  function logMsg(t, cls) { setMsg(t, cls); }
  function paintPc() {
    var el = $("set-status-info");
    if (el) el.textContent = "└─ pc: " + (base() || "isi dulu di [live]");
  }
  function paintBadge(txt, cls) {
    var el = $("set-status-badge");
    if (!el) return;
    el.textContent = txt;
    el.className = cls || "dim";
  }
  function paintStatus(enabled) {
    var el = $("watch-status");
    if (!el) return;
    el.textContent = enabled === true ? "[nyala]" : enabled === false ? "[mati]" : "[--]";
  }
  function busy(b) {
    ["btn-watch-on", "btn-watch-off", "btn-watch-reload", "btn-wipe", "btn-log-load"].forEach(function (id) {
      var el = $(id);
      if (el) el.disabled = !!b;
    });
  }
  function clearPin(id) { var el = $(id); if (el) el.value = ""; }

  async function checkPc(b) {
    try {
      var s = await Lan.statusGet(b);
      if (s.ok) { paintBadge("[OK]", "ok"); return; }
      if (s.error === "PC versi lama, update dulu") {
        var h = await Lan.health(b);
        paintBadge(h.ok ? "[OK·lama]" : "[PUTUS]", h.ok ? "ok" : "bad");
      } else {
        paintBadge("[PUTUS]", "bad");
      }
    } catch (e) {
      paintBadge("[PUTUS]", "bad");
    }
  }

  async function load() {
    paintPc();
    var b = base();
    if (!b) { paintStatus(null); paintBadge("[--]", "dim"); watchMsg("isi pc dulu di [live]", "err"); return; }
    busy(true);
    try {
      checkPc(b); // tanpa await: badge nyusul, watcher tak nunggu
      var r = await Lan.watcherGet(b);
      if (r.ok) { paintStatus(!!(r.data && r.data.enabled)); watchMsg("", ""); }
      else { paintStatus(null); watchMsg(r.error, "err"); }
    } finally {
      busy(false);
    }
  }

  async function setWatcher(enabled) {
    paintPc();
    var b = base();
    if (!b) { watchMsg("isi pc dulu di [live]", "err"); return; }
    var pin = String(($("set-watch-pin") || {}).value || "");
    if (!pin) { watchMsg("isi pin watcher dulu", "err"); return; }
    busy(true);
    try {
      var r = await Lan.watcherSet(b, pin, !!enabled);
      if (r.ok) {
        paintStatus(!!(r.data && r.data.enabled));
        watchMsg("watcher " + ((r.data && r.data.enabled) ? "nyala" : "mati"), "ok");
        clearPin("set-watch-pin");
      } else {
        watchMsg(r.error, "err");
        if (r.status === 403 || r.status === 429) clearPin("set-watch-pin");
      }
    } finally {
      busy(false);
    }
  }

  // ponytail: tombol selalu aktif, validasi HAPUS di server (400 passthrough)
  async function wipe() {
    paintPc();
    var b = base();
    if (!b) { wipeMsg("isi pc dulu di [live]", "err"); return; }
    var pin = String(($("set-wipe-pin") || {}).value || "");
    var confirm = String(($("set-wipe-confirm") || {}).value || "");
    busy(true);
    try {
      var r = await Lan.wipe(b, pin, confirm);
      if (r.ok) {
        var n = r.data && r.data.deleted;
        wipeMsg("dihapus " + (n == null ? "?" : n), "ok");
        clearPin("set-wipe-pin");
        var c = $("set-wipe-confirm");
        if (c) c.value = "";
      } else {
        wipeMsg(r.error, "err");
        if (r.status === 400) {
          var cf = $("set-wipe-confirm");
          if (cf) { cf.focus(); try { cf.select(); } catch (e2) {} }
        } else if (r.status === 403 || r.status === 429) {
          clearPin("set-wipe-pin");
        }
        // 409/timeout: biarkan PIN agar tekan ulang manual
      }
    } finally {
      busy(false);
    }
  }

  async function loadLog() {
    paintPc();
    var b = base();
    if (!b) { logMsg("isi pc dulu di [live]", "err"); return; }
    var pin = String(($("set-log-pin") || {}).value || "");
    if (!pin) { logMsg("isi pin log dulu", "err"); return; }
    busy(true);
    try {
      var r = await Lan.logGet(b, pin, 200);
      if (r.ok) {
        var lines = r.data && r.data.lines;
        var pre = $("log-pre");
        if (pre) pre.textContent = Array.isArray(lines) && lines.length ? lines.join("\n") : "(kosong)";
        logMsg("", "");
      } else {
        logMsg(r.error, "err");
        if (r.status === 403 || r.status === 429) clearPin("set-log-pin");
      }
    } finally {
      busy(false);
    }
  }

  function peek(btnId, inputId) {
    var btn = $(btnId), inp = $(inputId);
    if (!btn || !inp) return;
    btn.addEventListener("click", function () {
      inp.type = inp.type === "password" ? "text" : "password";
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    peek("btn-watch-peek", "set-watch-pin");
    peek("btn-wipe-peek", "set-wipe-pin");
    peek("btn-log-peek", "set-log-pin");
    var on = $("btn-watch-on"), off = $("btn-watch-off"), rel = $("btn-watch-reload"), w = $("btn-wipe");
    if (on) on.addEventListener("click", function () { setWatcher(true); });
    if (off) off.addEventListener("click", function () { setWatcher(false); });
    if (rel) rel.addEventListener("click", function () { load(); });
    if (w) w.addEventListener("click", function () { wipe(); });
    var lg = $("btn-log-load");
    if (lg) lg.addEventListener("click", function () { loadLog(); });
    var st = $("set-status");
    if (st) {
      st.addEventListener("dblclick", function (e) {
        if (e.target && e.target.closest && e.target.closest("button")) return;
        st.classList.toggle("collapsed");
      });
      // ponytail: fallback HP (dblclick tak andal) — ketuk badge ikut lipat
      st.addEventListener("click", function (e) {
        var t = e.target;
        if (t && (t.id === "set-status-badge" || (t.closest && t.closest("#set-status-badge")))) st.classList.toggle("collapsed");
      });
    }
    var sel = $("nav-select");
    if (sel) sel.addEventListener("change", function (e) {
      if (e.target.value === "settings") load();
    });
    try {
      if (sel && sel.value === "settings") load(); else paintPc();
    } catch (e) {}
  });

  return { load: load, setWatcher: setWatcher, wipe: wipe, loadLog: loadLog };
})();
