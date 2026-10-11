/* LAN base_url: ketik manual http://IP:8765. Tanpa auth (CNdesktop PRD §6). */
var LanConfig = (function () {
  "use strict";
  var KEY = "cn_lan_base";
  function norm(v) {
    v = String(v || "").trim().replace(/\/+$/, "");
    return v;
  }
  function get() {
    try { return norm(localStorage.getItem(KEY)); } catch (e) { return ""; }
  }
  function set(v) {
    v = norm(v);
    try { localStorage.setItem(KEY, v); } catch (e) {}
    return v;
  }
  function clear() { try { localStorage.removeItem(KEY); } catch (e) {} }
  return { get: get, set: set, clear: clear };
})();
