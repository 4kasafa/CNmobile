/* LAN ke CNdesktop: GET health/transactions + POST print/wipe/watcher. Tanpa auth, tanpa simpan PIN. */
var Lan = (function () {
  "use strict";
  var TIMEOUT_MS = 8000;
  function toInt(v) { var n = parseInt(v, 10); return isNaN(n) ? 0 : n; }
  function base(b) { return String(b || "").trim().replace(/\/+$/, ""); }

  // ponytail: satu mapper error — 400 passthrough error PC, sisanya pesan tetap
  function mapErr(status, bodyErr, isTimeout) {
    if (isTimeout) return "PC tak terjangkau, satu WiFi?";
    if (status === 400) return String(bodyErr || "permintaan ditolak PC");
    if (status === 403) return "PIN salah";
    if (status === 409) return "PC sibuk, coba lagi";
    if (status === 429) return "terkunci 5 menit";
    return String(bodyErr || ("PC menolak (HTTP " + status + ")"));
  }

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

  // POST JSON generik: timeout 8s, parse body.error PC bila !ok, bedakan timeout vs HTTP.
  async function postJson(baseUrl, path, obj) {
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS);
    try {
      var res = await fetch(base(baseUrl) + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(obj || {}),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        var body = null;
        try { body = await res.json(); } catch (e2) {}
        return { ok: false, error: mapErr(res.status, body && body.error, false), status: res.status };
      }
      return { ok: true, data: await res.json(), status: res.status };
    } catch (e) {
      if (e && e.name === "AbortError") return { ok: false, error: mapErr(0, null, true), status: 0 };
      return { ok: false, error: String((e && e.message) || e), status: 0 };
    } finally {
      clearTimeout(t);
    }
  }

  // POST /api/print ke CNdesktop: 200 {ok,printer,total} | 400/500 {error}. Kontrak milik PC, HP hanya teruskan.
  async function print(baseUrl, payload) {
    var r = await postJson(baseUrl, "/api/print", payload);
    if (!r.ok) return { ok: false, error: r.error };
    return { ok: true, data: r.data };
  }

  // Remote wipe + watcher (milik PC): PIN hanya argumen, tak disimpan.
  async function wipe(baseUrl, pin, confirm) {
    return postJson(baseUrl, "/api/wipe", { pin: pin, confirm: confirm });
  }

  async function watcherGet(baseUrl) {
    var r = await get(base(baseUrl) + "/api/watcher");
    if (!r.ok) return { ok: false, error: r.error === "timeout" ? mapErr(0, null, true) : r.error };
    return { ok: true, data: r.data };
  }

  async function watcherSet(baseUrl, pin, enabled) {
    return postJson(baseUrl, "/api/watcher", { pin: pin, enabled: enabled });
  }

  return { health: health, fetchTx: fetchTx, print: print, postJson: postJson, wipe: wipe, watcherGet: watcherGet, watcherSet: watcherSet };
})();
