/* Settings: watcher on/off + wipe permanen. PIN per seksi, hanya memori. Lokal HP tak diubah. */
var Settings = (function () {
  "use strict";
  function $(id) { return document.getElementById(id); }

  function base() { try { return LanConfig.get(); } catch (e) { return ""; } }

  function watchMsg(t, cls) {
    var m = $("watch-msg");
    if (!m) return;
    m.textContent = t || "";
    m.className = "msg" + (cls ? " " + cls : "");
  }
  function wipeMsg(t, cls) {
    var m = $("wipe-msg");
    if (!m) return;
    m.textContent = t || "";
    m.className = "msg" + (cls ? " " + cls : " err");
  }
  function paintPc() {
    var el = $("set-pc");
    if (el) el.textContent = base() || "isi dulu di [live]";
  }
  function paintStatus(enabled) {
    var el = $("watch-status");
    if (!el) return;
    el.textContent = enabled === true ? "[nyala]" : enabled === false ? "[mati]" : "[--]";
  }
  function busy(b) {
    ["btn-watch-on", "btn-watch-off", "btn-watch-reload", "btn-wipe"].forEach(function (id) {
      var el = $(id);
      if (el) el.disabled = !!b;
    });
  }
  function clearPin(id) { var el = $(id); if (el) el.value = ""; }

  async function load() {
    paintPc();
    var b = base();
    if (!b) { paintStatus(null); watchMsg("isi pc dulu di [live]", "err"); return; }
    busy(true);
    try {
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
    var on = $("btn-watch-on"), off = $("btn-watch-off"), rel = $("btn-watch-reload"), w = $("btn-wipe");
    if (on) on.addEventListener("click", function () { setWatcher(true); });
    if (off) off.addEventListener("click", function () { setWatcher(false); });
    if (rel) rel.addEventListener("click", function () { load(); });
    if (w) w.addEventListener("click", function () { wipe(); });
    var sel = $("nav-select");
    if (sel) sel.addEventListener("change", function (e) {
      if (e.target.value === "settings") load();
    });
    try {
      if (sel && sel.value === "settings") load(); else paintPc();
    } catch (e) {}
  });

  return { load: load, setWatcher: setWatcher, wipe: wipe };
})();
