/* LAN ke CNdesktop PRD §6: GET /api/health + GET /api/transactions?since&limit=. Tanpa auth. */
var Lan = (function () {
  "use strict";
  var TIMEOUT_MS = 8000;
  function toInt(v) { var n = parseInt(v, 10); return isNaN(n) ? 0 : n; }
  function base(b) { return String(b || "").trim().replace(/\/+$/, ""); }

  async function get(url) {
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS);
    try {
      var res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) return { ok: false, error: "HTTP " + res.status };
      return { ok: true, data: await res.json() };
    } catch (e) {
      return { ok: false, error: (e && e.name === "AbortError") ? "timeout" : String((e && e.message) || e) };
    } finally {
      clearTimeout(t);
    }
  }

  async function health(baseUrl) {
    var r = await get(base(baseUrl) + "/api/health");
    if (!r.ok) return { ok: false, error: r.error };
    return { ok: !!(r.data && (r.data.ok === true || r.data.ok === undefined)), raw: r.data };
  }

  function normRow(r) {
    r = r || {};
    return {
      server_id: toInt(r.id),
      no_transaksi: String(r.no_transaksi == null ? "" : r.no_transaksi),
      no_urut: String(r.no_urut == null ? "" : r.no_urut), // ponytail: string apa adanya, guard gap di live.js
      total: toInt(r.total),
      tunai: toInt(r.tunai),
      nontunai: toInt(r.nontunai),
      bank: String(r.bank || ""),
      kategori: String(r.kategori || ""),
      created_at: String(r.created_at || ""),
    };
  }

  async function fetchTx(baseUrl, since, limit) {
    var lim = limit || 50;
    var r = await get(base(baseUrl) + "/api/transactions?since=" + encodeURIComponent(toInt(since)) + "&limit=" + encodeURIComponent(lim));
    if (!r.ok) return { ok: false, error: r.error, rows: [] };
    var arr = Array.isArray(r.data) ? r.data : (r.data && Array.isArray(r.data.rows) ? r.data.rows : []);
    return { ok: true, rows: arr.map(normRow) };
  }

  // POST /api/print ke CNdesktop: 200 {ok,printer,total} | 400/500 {error}. Kontrak milik PC, HP hanya teruskan.
  async function print(baseUrl, payload) {
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS);
    try {
      var res = await fetch(base(baseUrl) + "/api/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload || {}),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        var body = null;
        try { body = await res.json(); } catch (e2) {}
        return { ok: false, error: (body && body.error) || ("PC menolak (HTTP " + res.status + ")") };
      }
      return { ok: true, data: await res.json() };
    } catch (e) {
      return { ok: false, error: (e && e.name === "AbortError") ? "timeout: PC tak terjangkau, satu WiFi?" : String((e && e.message) || e) };
    } finally {
      clearTimeout(t);
    }
  }

  return { health: health, fetchTx: fetchTx, print: print };
})();
