/* Store Live sesi manual (multi-PC). M1: localStorage.
   Sesi memuat banyak PC (pcs[]); tiap PC punya since + complete sendiri, jadi satu PC
   putus tak menjatuhkan PC lain. Bucket tx per PC: "<sessionId>|<comp_id>" sehingga
   server_id antar-PC tak bentrok; tid baris = "<comp_id>:<server_id>". */
var Store = (function () {
  "use strict";
  var K_SESS = "cn_live_sessions", K_TX = "cn_live_tx", K_FILL = "cn_live_fill";
  var CAP_PER_PC = 500; // ponytail: 500 tx per PC cukup untuk 1 shift

  function load(k, fb) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? fb : v; } catch (e) { return fb; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function nowIso() { return new Date().toISOString(); }
  function toInt(v) { var n = parseInt(v, 10); return isNaN(n) ? 0 : n; }

  // identitas baris tx lintas sesi: comp_id menentukan asal PC
  function tid(compId, sid) { return String(compId) + ":" + toInt(sid); }
  function splitTid(t) {
    var s = String(t == null ? "" : t), i = s.lastIndexOf(":");
    return i < 0 ? { comp_id: "", sid: s } : { comp_id: s.slice(0, i), sid: s.slice(i + 1) };
  }
  function bKey(sessionId, compId) { return sessionId + "|" + compId; }
  function fillKey(compId, day, n) { return compId + "|" + day + "|" + n; }
  // kunci isian manual (cermin numUrut/dayOf txmerge.js)
  function dayOf(r) { return String((r && r.created_at) || "").slice(0, 10) || "??"; }
  function numUrut(r) { var n = parseInt(String((r && r.no_urut) || ""), 10); return (isNaN(n) || n <= 0) ? 0 : n; }

  /* ---------- migrasi v1 (satu PC per sesi) -> v2 (pcs[]) ---------- */

  // sesi lama: base_url -> satu pc "@legacy". Sekali jalan, ditulis balik.
  function fixSession(s) {
    if (s.pcs && s.pcs.length) return false;
    var base = String(s.base_url || "");
    s.pcs = base
      ? [{ comp_id: "@legacy", name: base, base: base, last_seen: toInt(s.last_seen), complete: toInt(s.complete) ? 1 : 0, alive: 1 }]
      : [];
    delete s.base_url;
    return true;
  }
  function sessions() {
    var a = load(K_SESS, []), changed = false;
    for (var i = 0; i < a.length; i++) if (fixSession(a[i])) changed = true;
    if (changed) save(K_SESS, a);
    return a;
  }
  function compOf(sessionId) {
    var a = sessions();
    for (var i = 0; i < a.length; i++) if (a[i].id === sessionId && a[i].pcs.length) return a[i].pcs[0].comp_id;
    return "";
  }

  // bucket tx lama "sid" -> "sid|@legacy"; bucket fill lama ikut di-prefix key isiannya.
  function tx() {
    var all = load(K_TX, {}), out = {}, changed = false;
    for (var k in all) {
      if (!all.hasOwnProperty(k)) continue;
      if (k.indexOf("|") >= 0) { out[k] = all[k]; continue; }
      var c = compOf(k);
      if (!c) { out[k] = all[k]; continue; }
      out[k + "|" + c] = all[k];
      changed = true;
    }
    if (changed) save(K_TX, out);
    return out;
  }
  function fills() {
    var all = load(K_FILL, {}), out = {}, changed = false;
    for (var k in all) {
      if (!all.hasOwnProperty(k)) continue;
      if (k.indexOf("|") >= 0) { out[k] = all[k]; continue; }
      var c = compOf(k);
      if (!c) { out[k] = all[k]; continue; }
      var src = all[k] || {}, dst = {};
      for (var f in src) if (src.hasOwnProperty(f)) dst[c + "|" + f] = src[f];
      out[k + "|" + c] = dst;
      changed = true;
    }
    if (changed) save(K_FILL, out);
    return out;
  }

  /* ---------- sesi ---------- */

  async function init() { return true; }

  // comps: [{id,name,base}] -> pcs[]
  async function createSession(comps) {
    var pcs = [];
    var seen = {};
    for (var i = 0; i < (comps || []).length; i++) {
      var c = comps[i];
      if (!c || !c.id || !c.base || seen[c.id]) continue;
      seen[c.id] = true;
      pcs.push({ comp_id: c.id, name: c.name || c.id, base: c.base, last_seen: 0, complete: 1, alive: 1 });
    }
    var a = sessions();
    var s = {
      id: "s_" + Date.now() + "_" + Math.floor(Math.random() * 1000000), // suffix acak: cegah tabrakan same-ms
      pcs: pcs,
      started_at: nowIso(),
      closed_at: null,
      status: "open",
      complete: 1, // 0 = ada PC yang pernah putus mid-drain/poll -> "belum lengkap"
      count: 0,
    };
    a.unshift(s);
    save(K_SESS, a.slice(0, 50)); // ponytail: 50 sesi cukup, IndexedDB bila butuh ribuan
    return s;
  }

  async function getSession(id) {
    var a = sessions();
    for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i];
    return null;
  }

  async function listSessions(limit) { return sessions().slice(0, limit || 20); }

  // patch: {status, closed_at, count, complete}
  async function patchSession(id, patch) {
    var a = sessions(), hit = null;
    for (var i = 0; i < a.length; i++) {
      if (a[i].id !== id) continue;
      for (var k in patch) a[i][k] = patch[k];
      hit = a[i];
      break;
    }
    if (hit) save(K_SESS, a);
    return hit;
  }

  async function closeSession(id, complete) { return patchSession(id, { status: "closed", closed_at: nowIso(), complete: complete ? 1 : 0 }); }

  // [+tambah pc]: sisip PC ke sesi open (since=0 → di-drain penuh). Tolak comp_id kembar.
  async function addPc(sessionId, comp) {
    var a = sessions(), hit = null;
    for (var i = 0; i < a.length; i++) {
      if (a[i].id !== sessionId) continue;
      if (!a[i].pcs) a[i].pcs = [];
      for (var j = 0; j < a[i].pcs.length; j++) if (a[i].pcs[j].comp_id === comp.id) return null;
      a[i].pcs.push({ comp_id: comp.id, name: comp.name || comp.id, base: comp.base, last_seen: 0, complete: 1, alive: 1 });
      hit = a[i];
      break;
    }
    if (hit) save(K_SESS, a);
    return hit;
  }

  // patch per PC (last_seen, complete, alive) + turunkan complete sesi bila ada PC kurang.
  async function patchPc(sessionId, compId, patch) {
    var a = sessions(), hit = null;
    for (var i = 0; i < a.length; i++) {
      if (a[i].id !== sessionId) continue;
      var pcs = a[i].pcs || [];
      for (var j = 0; j < pcs.length; j++) {
        if (pcs[j].comp_id !== compId) continue;
        for (var k in patch) pcs[j][k] = patch[k];
        hit = pcs[j];
        break;
      }
      a[i].pcs = pcs;
      var ok = 1;
      for (var q = 0; q < pcs.length; q++) if (!toInt(pcs[q].complete)) ok = 0;
      a[i].complete = ok;
      break;
    }
    if (hit) save(K_SESS, a);
    return hit;
  }

  // hapus sesi closed + bucket tx/fill-nya (prefix "<id>|"). Tolak open (lindungi sesi aktif).
  async function deleteSession(id) {
    var a = sessions(), at = -1;
    for (var i = 0; i < a.length; i++) if (a[i].id === id) { at = i; break; }
    if (at < 0 || a[at].status === "open") return false;
    a.splice(at, 1);
    save(K_SESS, a);
    var t = tx(), pre = id + "|", changed = false;
    for (var k in t) if (t.hasOwnProperty(k) && k.indexOf(pre) === 0) { delete t[k]; changed = true; }
    if (changed) save(K_TX, t);
    var f = fills(), ch2 = false;
    for (var k2 in f) if (f.hasOwnProperty(k2) && k2.indexOf(pre) === 0) { delete f[k2]; ch2 = true; }
    if (ch2) save(K_FILL, f);
    return true;
  }

  async function getLastSeen(sessionId, compId) {
    var a = sessions();
    for (var i = 0; i < a.length; i++) {
      if (a[i].id !== sessionId) continue;
      var pcs = a[i].pcs || [];
      for (var j = 0; j < pcs.length; j++) if (pcs[j].comp_id === compId) return toInt(pcs[j].last_seen);
      return 0;
    }
    return 0;
  }

  /* ---------- transaksi ---------- */

  // rows: [{server_id,no_transaksi,...}] per PC -> {added, ids:[tid], lastSeen}
  async function upsertTx(sessionId, compId, rows) {
    var all = tx(), key = bKey(sessionId, compId);
    var cur = all[key] || [];
    var fillsHere = fills()[key] || {};
    var seenId = {}, seenNo = {};
    var i, r;
    for (i = 0; i < cur.length; i++) {
      r = cur[i] || {};
      seenId[r.server_id] = true;
      if (r.no_transaksi) seenNo[r.no_transaksi] = true;
    }
    var added = 0, maxId = 0, ids = [];
    for (i = 0; i < cur.length; i++) maxId = Math.max(maxId, toInt(cur[i].server_id));
    for (i = 0; i < (rows || []).length; i++) {
      r = rows[i] || {};
      var sid = toInt(r.server_id);
      if (sid > maxId) maxId = sid;
      if (seenId[sid]) continue; // sudah ada (termasuk edited): drain tak menimpa koreksi lokal
      if (r.no_transaksi && seenNo[r.no_transaksi]) continue;
      if (numUrut(r) && dayOf(r) && fillsHere[fillKey(compId, dayOf(r), numUrut(r))]) continue; // manual menang
      seenId[sid] = true;
      if (r.no_transaksi) seenNo[r.no_transaksi] = true;
      cur.push(r);
      added++;
      ids.push(tid(compId, sid));
    }
    cur.sort(function (a, b) { return toInt(a.server_id) - toInt(b.server_id); }); // urut id ASC ala API
    if (cur.length > CAP_PER_PC) cur = cur.slice(cur.length - CAP_PER_PC);
    all[key] = cur;
    save(K_TX, all);

    var sess = await getSession(sessionId);
    var lastSeen = maxId > 0 ? maxId : await getLastSeen(sessionId, compId);
    if (sess) {
      var count = 0;
      for (var k in all) if (all.hasOwnProperty(k) && k.indexOf(sessionId + "|") === 0) count += (all[k] || []).length;
      await patchSession(sessionId, { count: count });
    }
    await patchPc(sessionId, compId, { last_seen: lastSeen });
    return { added: added, lastSeen: lastSeen, ids: ids };
  }

  // koreksi lokal: set tunai/nontunai (+total/kategori otomatis), flag edited=1.
  // count/last_seen tak berubah; tak dikirim balik ke PC. Tanpa undo.
  async function patchTx(sessionId, t, tunai, nontunai) {
    var parts = splitTid(t);
    var all = tx(), key = bKey(sessionId, parts.comp_id), cur = all[key] || [];
    var tt = toInt(tunai), nt = toInt(nontunai);
    if (tt < 0 || nt < 0) return null;
    for (var i = 0; i < cur.length; i++) {
      if (toInt(cur[i].server_id) !== toInt(parts.sid)) continue;
      cur[i].tunai = tt;
      cur[i].nontunai = nt;
      cur[i].total = tt + nt;
      cur[i].kategori = (tt > 0 && nt > 0) ? "Split" : (tt > 0 ? "Tunai" : (nt > 0 ? "Nontunai" : (cur[i].kategori || "")));
      cur[i].edited = 1;
      all[key] = cur;
      save(K_TX, all);
      return cur[i];
    }
    return null;
  }

  // semua PC digabung: tag tid + nama PC, urut created_at DESC (baru di atas), server_id pengurai.
  async function listTx(sessionId) {
    var sess = await getSession(sessionId);
    var all = tx(), names = {}, out = [];
    var pcs = (sess && sess.pcs) || [];
    for (var i = 0; i < pcs.length; i++) names[pcs[i].comp_id] = pcs[i].name || pcs[i].comp_id;
    var pre = sessionId + "|";
    for (var k in all) {
      if (!all.hasOwnProperty(k) || k.indexOf(pre) !== 0) continue;
      var cid = k.slice(pre.length), arr = all[k] || [];
      for (var j = 0; j < arr.length; j++) {
        var r = arr[j] || {};
        r.tid = tid(cid, r.server_id);
        r.pc_id = cid;
        r.pc_name = names[cid] || cid;
        out.push(r);
      }
    }
    out.sort(function (a, b) {
      var c = String(b.created_at || "").localeCompare(String(a.created_at || ""));
      if (c !== 0) return c;
      return toInt(b.server_id) - toInt(a.server_id);
    });
    return out;
  }

  /* ---------- isian manual (baris HILANG) ---------- */

  // kunci "<comp_id>|<hari>|<no_urut>"; ditulis ulang = edit ulang. Tanpa hapus (YAGNI).
  async function getFills(sessionId) {
    var sess = await getSession(sessionId);
    var all = fills(), out = {};
    var names = {};
    var pcs = (sess && sess.pcs) || [];
    for (var i = 0; i < pcs.length; i++) names[pcs[i].comp_id] = pcs[i].name || pcs[i].comp_id;
    var pre = sessionId + "|";
    for (var k in all) {
      if (!all.hasOwnProperty(k) || k.indexOf(pre) !== 0) continue;
      var cid = k.slice(pre.length), bag = all[k] || {};
      for (var f in bag) {
        if (!bag.hasOwnProperty(f)) continue;
        var v = bag[f] || {};
        v.pc_id = cid;
        v.pc_name = names[cid] || cid;
        v.tid = "fill:" + f;
        out[f] = v;
      }
    }
    return out;
  }

  async function upsertFill(sessionId, compId, day, n, tunai, nontunai) {
    var t = toInt(tunai), nt = toInt(nontunai);
    n = parseInt(n, 10);
    if (!(n > 0) || !day || t < 0 || nt < 0) return null;
    var all = fills(), key = bKey(sessionId, compId);
    var cur = all[key] || {};
    var fk = fillKey(compId, day, n);
    cur[fk] = {
      day: day, n: n, tunai: t, nontunai: nt, total: t + nt,
      kategori: (t > 0 && nt > 0) ? "Split" : (t > 0 ? "Tunai" : (nt > 0 ? "Nontunai" : "")),
      edited: 1, manual: 1, filled_at: nowIso(),
    };
    all[key] = cur;
    save(K_FILL, all);
    return cur[fk];
  }

  return {
    init: init, createSession: createSession, getSession: getSession,
    listSessions: listSessions, patchSession: patchSession, closeSession: closeSession,
    addPc: addPc, patchPc: patchPc,
    getLastSeen: getLastSeen,
    upsertTx: upsertTx, listTx: listTx, patchTx: patchTx, deleteSession: deleteSession,
    getFills: getFills, upsertFill: upsertFill,
    tid: tid, splitTid: splitTid, fillKey: fillKey, CAP_PER_PC: CAP_PER_PC,
  };
})();