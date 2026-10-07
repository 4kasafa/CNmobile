/* Glue nav: dropdown baris-2 -> 3 view, ingat pilihan. Tanpa framework. */
(function () {
  "use strict";
  var KEY = "cn_view";
  function $(id) { return document.getElementById(id); }
  function show(v) {
    ["setoran", "live", "print"].forEach(function (k) {
      var el = $("view-" + k);
      if (el) el.hidden = (k !== v);
    });
    var pp = $("pp-path");
    if (pp) pp.textContent = "-[" + v + "]";
    var sel = $("nav-select");
    if (sel && sel.value !== v) sel.value = v;
  }
  document.addEventListener("DOMContentLoaded", function () {
    var v = "setoran";
    try { v = localStorage.getItem(KEY) || "setoran"; } catch (e) {}
    if (["setoran", "live", "print"].indexOf(v) < 0) v = "setoran";
    show(v);
    $("nav-select").addEventListener("change", function (e) {
      show(e.target.value);
      try { localStorage.setItem(KEY, e.target.value); } catch (e2) {}
    });
  });
})();
