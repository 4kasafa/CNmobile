/* Port logika merge/konflik tabs/kasir_tab.py — global `Conflict`, murni tanpa DOM. */
var Conflict = (function () {
  "use strict";

  // kasir_tab.py:205-218 tabel bulan ID/EN
  var BULAN = {
    januari: 1, jan: 1, january: 1, februari: 2, feb: 2, february: 2, peb: 2,
    maret: 3, mar: 3, march: 3, april: 4, apr: 4, mei: 5, may: 5,
    juni: 6, jun: 6, june: 6, juli: 7, jul: 7, july: 7,
    agustus: 8, agu: 8, agst: 8, ags: 8, aug: 8, august: 8,
    september: 9, sep: 9, sept: 9, oktober: 10, okt: 10, oct: 10, october: 10,
    november: 11, nov: 11, desember: 12, des: 12, dec: 12, december: 12,
  };

  // kasir_tab.py:221-264 _parse_date -> Date lokal tengah malam / null
  function parseDate(tgl) {
    if (tgl == null) return null;
    if (tgl instanceof Date) return isNaN(tgl) ? null : new Date(tgl.getFullYear(), tgl.getMonth(), tgl.getDate());
    var s = String(tgl).trim();
    if (!s) return null;
    var m = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
    if (m) { var d0 = new Date(+m[1], +m[2] - 1, +m[3]); return isNaN(d0) ? null : d0; }
    m = /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/.exec(s);
    if (m) {
      var y = +m[3]; if (y < 100) y += 2000;
      var d1 = new Date(y, +m[2] - 1, +m[1]);
      return isNaN(d1) ? null : d1;
    }
    m = /(\d{1,2})\s+([a-z]+)\s+(\d{2,4})/.exec(s.toLowerCase());
    if (m && BULAN[m[2]]) {
      var y2 = +m[3]; if (y2 < 100) y2 += 2000;
      var d2 = new Date(y2, BULAN[m[2]] - 1, +m[1]);
      return isNaN(d2) ? null : d2;
    }
    return null;
  }

  // kasir_tab.py:267-278 periode 28-27 -> "YYYY-MM" / null bila gagal parse
  function periodeOf(tgl) {
    var d = parseDate(tgl);
    if (!d) return null;
    var y = d.getFullYear(), mo = d.getMonth() + 1;
    if (d.getDate() >= 28) { mo += 1; if (mo > 12) { mo = 1; y += 1; } }
    return y + "-" + String(mo).padStart(2, "0");
  }

  function currentPeriode() {
    return periodeOf(new Date());
  }

  // kasir_tab.py:419-444
  function norm(v) { return String(v == null ? "" : v).trim().toLowerCase(); }
  function txKey(item) {
    item = item || {};
    return norm(item.tanggal) + "|" + norm(item.shift) + "|" + norm(item.cabang);
  }
  function toInt(v) {
    if (typeof v === "number") return isFinite(v) ? Math.trunc(v) : 0;
    var s = String(v == null ? "" : v).trim();
    var neg = s.charAt(0) === "-";
    var digits = s.replace(/[^0-9]/g, "");
    if (!digits) return 0;
    var n = parseInt(digits, 10);
    return neg ? -n : n;
  }
  function isConflict(a, b) {
    a = a || {}; b = b || {};
    return ["totalKomputer", "uangFisik", "jumlahSelisih"].some(function (k) {
      return toInt(a[k]) !== toInt(b[k]);
    });
  }
  function stripConflict(g) {
    var c = {}, k;
    for (k in g) if (k !== "_conflict") c[k] = g[k];
    return c;
  }

  // kasir_tab.py:446-484 merge incremental; mutasi `cache` in-place, return {n_new, n_conflict}
  function mergeGasData(cache, gasData) {
    var cur = currentPeriode();
    for (var i = cache.length - 1; i >= 0; i--) {
      var p0 = periodeOf(cache[i] && cache[i].tanggal);
      if (p0 !== null && p0 !== cur) cache.splice(i, 1);
    }
    var idx = {};
    cache.forEach(function (it, j) { idx[txKey(it)] = j; });
    var nNew = 0;
    (gasData || []).forEach(function (g) {
      if (!g || typeof g !== "object") return;
      var p = periodeOf(g.tanggal);
      if (p !== null && p !== cur) return;
      var key = txKey(g);
      if (!(key in idx)) {
        cache.push(stripConflict(g));
        idx[key] = cache.length - 1;
        nNew++;
      } else {
        var curIt = cache[idx[key]];
        if (isConflict(curIt, g)) {
          var prevGas = (curIt._conflict || {}).gas_item;
          var seen = curIt._dismissed_gas;
          if (seen && !isConflict(seen, g)) {
            // ponytail: user sudah pilih lokal untuk versi GAS ini — diam sampai GAS berubah
          } else if (prevGas == null || isConflict(prevGas, g)) {
            curIt._conflict = {
              lokal: { totalKomputer: curIt.totalKomputer || 0, uangFisik: curIt.uangFisik || 0, jumlahSelisih: curIt.jumlahSelisih || 0 },
              gas: { totalKomputer: g.totalKomputer || 0, uangFisik: g.uangFisik || 0, jumlahSelisih: g.jumlahSelisih || 0 },
              gas_item: stripConflict(g),
            };
            delete curIt._dismissed_gas;
          }
        } else if (curIt._dismissed_gas) {
          delete curIt._dismissed_gas;
        }
      }
    });
    return { n_new: nNew, n_conflict: countConflicts(cache) };
  }

  function countConflicts(cache) {
    return cache.filter(function (it) { return it && it._conflict; }).length;
  }

  // kasir_tab.py:789-804 resolve; return item hasil / null bila key tak ketemu
  function resolve(cache, key, useGas) {
    for (var i = 0; i < cache.length; i++) {
      if (txKey(cache[i]) === key) {
        if (useGas) {
          var gi = ((cache[i]._conflict || {}).gas_item) || {};
          cache[i] = stripConflict(gi);
        } else {
          // ponytail: ingat versi GAS yang ditolak; flag lagi hanya bila GAS berubah
          var seenGas = ((cache[i]._conflict || {}).gas_item) || null;
          delete cache[i]._conflict;
          if (seenGas) cache[i]._dismissed_gas = stripConflict(seenGas);
        }
        return cache[i];
      }
    }
    return null;
  }

  return {
    parseDate: parseDate, periodeOf: periodeOf, currentPeriode: currentPeriode,
    txKey: txKey, toInt: toInt, isConflict: isConflict,
    mergeGasData: mergeGasData, countConflicts: countConflicts, resolve: resolve,
  };
})();
