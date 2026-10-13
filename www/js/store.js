/* Store Live sesi manual. M1: localStorage. M4: ganti isi fungsi ini dengan
   @capacitor-community/sqlite bila isNative — nama fungsi + bentuk return TETAP. */
var Store = (function () {
  "use strict";
  var K_SESS = "cn_live_sessions", K_TX = "cn_live_tx";
  function load(k, fb) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? fb : v; } catch (e) { return fb; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function nowIso() { return new Date().toISOString(); }
  function toInt(v) { var n = parseInt(v, 10); return isNaN(n) ? 0 : n; }

  async function init() { return true; }

  async function createSession(baseUrl) {
    var sessions = load(K_SESS, []);
    var s = {
      id: "s_" + Date.now() + "_" + Math.floor(Math.random() * 1000000), // suffix acak: cegah tabrakan same-ms
      base_url: String(baseUrl || ""),
      started_at: nowIso(),
      closed_at: null,
      status: "open",
      complete: 1, // 0 = pernah putus mid-drain/poll -> "belum lengkap"
      last_seen: 0,
      count: 0,
    };
    sessions.unshift(s);
    save(K_SESS, sessions.slice(0, 50)); // ponytail: 50 sesi cukup, IndexedDB bila butuh ribuan
    return s;
  }

  async function getSession(id) {
    var sessions = load(K_SESS, []);
    for (var i = 0; i < sessions.length; i++) if (sessions[i].id === id) return sessions[i];
    return null;
  }

  async function listSessions(limit) {
    return load(K_SESS, []).slice(0, limit || 20);
  }

  // patch: {status, complete, closed_at, last_seen, count}
  async function patchSession(id, patch) {
    var sessions = load(K_SESS, []);
    for (var i = 0; i < sessions.length; i++) {
      if (sessions[i].id !== id) continue;
      for (var k in patch) sessions[i][k] = patch[k];
      save(K_SESS, sessions);
      return sessions[i];
    }
    return null;
  }

  async function closeSession(id, complete) {
    return patchSession(id, { status: "closed", closed_at: nowIso(), complete: complete ? 1 : 0 });
  }

  // hapus sesi closed + bucket tx-nya. Tolak open (lindungi sesi aktif). Tanpa undo.
  async function deleteSession(id) {
    var sessions = load(K_SESS, []);
    var at = -1;
    for (var i = 0; i < sessions.length; i++) {
      if (sessions[i].id === id) { at = i; break; }
    }
    if (at < 0 || sessions[at].status === "open") return false;
    sessions.splice(at, 1);
    save(K_SESS, sessions);
    var all = load(K_TX, {});
    if (all[id]) { delete all[id]; save(K_TX, all); }
    return true;
  }

  async function getLastSeen(id) {
    var s = await getSession(id);
    return s ? toInt(s.last_seen) : 0;
  }

  async function setLastSeen(id, lastSeen) {
    return patchSession(id, { last_seen: toInt(lastSeen) });
  }

  // rows: [{server_id,no_transaksi,...}] -> {added, lastSeen, ids}
  async function upsertTx(sessionId, rows) {
    var all = load(K_TX, {});
    var cur = all[sessionId] || [];
    var seenId = {}, seenNo = {};
    var i, r;
    for (i = 0; i < cur.length; i++) {
      r = cur[i] || {};
      seenId[r.server_id] = true;
      if (r.no_transaksi) seenNo[r.no_transaksi] = true;
    }
    var added = 0, maxId = 0, ids = [];
    for (i = 0; i < cur.length; i++) { maxId = Math.max(maxId, toInt(cur[i].server_id)); }
    for (i = 0; i < (rows || []).length; i++) {
      r = rows[i] || {};
      var sid = toInt(r.server_id);
      if (sid > maxId) maxId = sid;
      if (seenId[sid]) continue; // sudah ada (termasuk edited): drain tak menimpa koreksi lokal
      if (r.no_transaksi && seenNo[r.no_transaksi]) continue;
      seenId[sid] = true;
      if (r.no_transaksi) seenNo[r.no_transaksi] = true;
      cur.push(r);
      added++;
      ids.push(sid);
    }
    // urut id ASC ala API; cap 500/sesi (ponytail: sesi kasir wajar <500)
    cur.sort(function (a, b) { return toInt(a.server_id) - toInt(b.server_id); });
    if (cur.length > 500) cur = cur.slice(cur.length - 500);
    all[sessionId] = cur;
    save(K_TX, all);
    await patchSession(sessionId, { last_seen: maxId > 0 ? maxId : await getLastSeen(sessionId), count: cur.length });
    return { added: added, lastSeen: maxId, ids: ids };
  }

  // koreksi lokal: set tunai/nontunai (+total/kategori otomatis), flag edited=1.
  // count/last_seen tak berubah; tak dikirim balik ke PC. Tanpa undo.
  async function patchTx(sessionId, serverId, tunai, nontunai) {
    var all = load(K_TX, {});
    var cur = all[sessionId] || [];
    var t = toInt(tunai), nt = toInt(nontunai);
    if (t < 0 || nt < 0) return null;
    for (var i = 0; i < cur.length; i++) {
      if (toInt(cur[i].server_id) !== toInt(serverId)) continue;
      cur[i].tunai = t;
      cur[i].nontunai = nt;
      cur[i].total = t + nt;
      cur[i].kategori = (t > 0 && nt > 0) ? "Split" : (t > 0 ? "Tunai" : (nt > 0 ? "Nontunai" : (cur[i].kategori || "")));
      cur[i].edited = 1;
      save(K_TX, all);
      return cur[i];
    }
    return null;
  }

  async function listTx(sessionId) {
    var all = load(K_TX, {});
    var cur = all[sessionId] || [];
    return cur.slice().sort(function (a, b) { return toInt(b.server_id) - toInt(a.server_id); }); // terbaru di atas
  }

  return {
    init: init, createSession: createSession, getSession: getSession,
    listSessions: listSessions, patchSession: patchSession, closeSession: closeSession,
    getLastSeen: getLastSeen, setLastSeen: setLastSeen,
    upsertTx: upsertTx, listTx: listTx, patchTx: patchTx, deleteSession: deleteSession,
  };
})();
