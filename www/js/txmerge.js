/* Baris transaksi gabungan multi-PC. Rantai no_urut (baris HILANG) dihitung PER PC
   supaya lompatan nomor PC-A tak menyisip baris di dalam daftar PC-B, lalu semua item
   digabung dan diurut created_at DESC (terbaru di atas).
   Fungsi murni (tanpa DOM/storage) -> bisa diuji langsung di Node. */
var TxMerge = (function () {
  "use strict";
  function sInt(v) { var n = parseInt(v, 10); return isNaN(n) ? 0 : n; }
  // no_urut longgar: digit >0 saja; ''/non-digit -> 0 (diabaikan rantai gap)
  function numUrut(r) { var n = parseInt(String((r && r.no_urut) || ""), 10); return (isNaN(n) || n <= 0) ? 0 : n; }
  function dayOf(r) { return String((r && r.created_at) || "").slice(0, 10) || "??"; }
  function padU(n, w) { var s = String(n); while (s.length < w) s = "0" + s; return s; }
  function fkey(pcId, day, n) { return pcId + "|" + day + "|" + n; }

  // baris sintetis dari isian manual (tanpa server_id asli; identitas = fill key)
  function fillRow(f, pcId, pcName) {
    return {
      tid: "fill:" + fkey(pcId, f.day, f.n), pc_id: pcId, pc_name: pcName,
      server_id: 0, no_transaksi: "", no_urut: String(f.n),
      total: f.total, tunai: f.tunai, nontunai: f.nontunai, bank: "",
      kategori: f.kategori, created_at: String(f.day || ""), day: f.day, n: f.n,
      edited: 1, manual: 1,
    };
  }

  // satu PC: susun rantai no_urut ASC. Setiap item bawa sortKey (ts tx yang memunculkan
  // gap) + seq (no_urut) supaya baris HILANG duduk tepat DI BAWAH tx penggantinya.
  function chain(rows, fills, pcId, pcName) {
    var asc = rows.slice().sort(function (a, b) { return sInt(a.server_id) - sInt(b.server_id); });
    var out = [], seen = {}, prevDay = null, prevN = 0, dayW = {};
    function tx(r, sortKey, seq) { return { t: "tx", r: r, pc_id: pcId, pc_name: pcName, sortKey: sortKey, seq: seq }; }
    for (var i = 0; i < asc.length; i++) {
      var r = asc[i], d = dayOf(r), n = numUrut(r);
      var ts = String((r && r.created_at) || "");
      if (!n) { out.push(tx(r, ts || d, 0)); prevDay = null; prevN = 0; continue; }
      var dw = String((r && r.no_urut) || "").replace(/[^0-9]/g, "").length; // lebar digit asli hari itu
      dayW[d] = Math.max(dayW[d] || 0, dw);
      if (seen[d + "|" + n]) { out.push(tx(r, ts || d, n)); continue; } // duplikat: tak dipakai rantai
      seen[d + "|" + n] = true;
      if (d === prevDay && n > prevN + 1) {
        var w = Math.max(dayW[d] || 0, String(prevN).length, String(n).length, 4);
        for (var m = prevN + 1; m < n; m++) {
          var fk = fkey(pcId, d, m);
          if (fills[fk]) out.push({ t: "tx", r: fillRow(fills[fk], pcId, pcName), fill: fk, w: w, pc_id: pcId, pc_name: pcName, sortKey: ts || d, seq: m });
          else out.push({ t: "hilang", day: d, n: m, w: w, hkey: fk, pc_id: pcId, pc_name: pcName, sortKey: ts || d, seq: m });
        }
      }
      prevDay = d; prevN = n;
      out.push(tx(r, ts || d, n));
    }
    return out;
  }

  // rows: hasil Store.listTx (sudah bertag tid/pc_id/pc_name, urut created_at DESC)
  // fills: Store.getFills (kunci "<comp_id>|<hari>|<no_urut>") -> item urut DESC, siap render
  function buildItems(rows, fills) {
    fills = fills || {};
    rows = rows || [];
    var groups = {}, names = {}, order = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i] || {};
      var c = String(r.pc_id || "");
      if (!groups[c]) { groups[c] = []; order.push(c); names[c] = r.pc_name || c; }
      groups[c].push(r);
    }
    var all = [];
    for (var k = 0; k < order.length; k++) {
      var items = chain(groups[order[k]], fills, order[k], names[order[k]]);
      for (var j = 0; j < items.length; j++) all.push(items[j]);
    }
    all.sort(function (a, b) {
      var c = String(b.sortKey || "").localeCompare(String(a.sortKey || ""));
      if (c !== 0) return c;
      return sInt(b.seq) - sInt(a.seq);
    });
    return all;
  }

  return { buildItems: buildItems, fillRow: fillRow, numUrut: numUrut, dayOf: dayOf, padU: padU, fkey: fkey };
})();