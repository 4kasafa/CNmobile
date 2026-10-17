/* Glue nav: dropdown baris-2 -> 4 view, ingat pilihan. Tanpa framework. */
(function () {
  "use strict";
  var KEY = "cn_view";
  var VIEWS = ["setoran", "live", "print", "comp"];
  function $(id) { return document.getElementById(id); }
  function show(v) {
    VIEWS.forEach(function (k) {
      var el = $("view-" + k);
      if (el) el.hidden = (k !== v);
    });
    var pp = $("pp-path");
    if (pp) pp.textContent = "-[" + v + "]";
    var sel = $("nav-select");
    if (sel && sel.value !== v) sel.value = v;
  }
  document.addEventListener("DOMContentLoaded", function () {
    // ponytail: akses plugin lewat global Capacitor.Plugins — tanpa bundler di repo ini.
    // ESM `import { StatusBar } from '@capacitor/status-bar'` ditolak: butuh build step.
    try {
      var SB = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.StatusBar;
      if (SB) {
        // overlay:false -> WebView mulai DI BAWAH status bar, jadi header sticky tidak ketutup
        SB.setOverlaysWebView({ overlay: false });
        SB.setBackgroundColor({ color: "#000000" }); // sama dengan --abyss, hindari flash putih
      }
    } catch (e3) {}
    var v = "setoran";
    try { v = localStorage.getItem(KEY) || "setoran"; } catch (e) {}
    if (VIEWS.indexOf(v) < 0) v = "setoran";
    show(v);
    $("nav-select").addEventListener("change", function (e) {
      show(e.target.value);
      try { localStorage.setItem(KEY, e.target.value); } catch (e2) {}
    });
    // tab yang dipulihkan harus memicu listener tab (mis. Comp.load() saat kembali ke [comp])
    try { $("nav-select").dispatchEvent(new Event("change")); } catch (e4) {}
  });
})();
