/* Daftar komputer: nama + base URL (http://IP:8765). Status koneksi hanya di MEMORI —
   tak pernah ditulis ke storage, jadi tak ada badge basi setelah app ditutup.
   Menggantikan config.js (cn_lan_base): app tak lagi menyimpan satu base global. */
var Comps = (function () {
  "use strict";
  var KEY = "cn_comps";
  var OLD_KEY = "cn_lan_base"; // sisa config.js v1 — di-seed sekali jadi entry "PC 1"
  var DEFAULT_PORT = "8765";
  var CHECK_MS = 2500; // cek list harus terasa instan; aksi tetap 8000 (lan.js)
  var state = {}; // id -> {state:"ok"|"lama"|"putus", version}

  // ponytail: satu normalizer — terima "IP", "http://IP", "http://IP:8765", buang "/" akhir.
  function normBase(v) {
    var s = String(v || "").trim().replace(/\/+$/, "");
    if (!s) return "";
    if (!/^https?:\/\//i.test(s)) s = "http://" + s;
    var m = s.match(/^(https?:\/\/)([^/?#]+)(.*)$/i);
    if (!m) return "";
    var host = m[2].toLowerCase();
    if (host.indexOf(":") < 0) host += ":" + DEFAULT_PORT;
    return m[1].toLowerCase() + host + m[3];
  }

  function normName(v) {
    return String(v || "").trim().replace(/\s+/g, " ");
  }

  function load() {
    try {
      var a = JSON.parse(localStorage.getItem(KEY));
      return Array.isArray(a) ? a : [];
    } catch (e) {
      return [];
    }
  }
  function save(a) {
    try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {}
  }
  function newId() { return "c_" + Date.now() + "_" + Math.floor(Math.random() * 1000000); }

  // seed sekali dari base_url lama, lalu key lama dibuang (tak ada flag: key hilang = selesai).
  function migrate() {
    var a = load();
    var old = "";
    try { old = String(localStorage.getItem(OLD_KEY) || "").trim(); } catch (e) {}
    if (old) {
      try { localStorage.removeItem(OLD_KEY); } catch (e) {}
      var b = normBase(old);
      if (b && !findByBase(a, b)) a.push({ id: newId(), name: "PC 1", base: b, last_used: 0 });
    }
    if (a.length) save(a);
    return a;
  }

  function findByBase(a, base) {
    for (var i = 0; i < a.length; i++) if (a[i].base === base) return a[i];
    return null;
  }

  function list() { return load(); }
  function get(id) {
    var a = load();
    for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i];
    return null;
  }
  function byName(id) {
    var c = get(id);
    return (c && c.name) || "pc";
  }

  // {ok:false,error} | {ok:true,comp} — validasi di satu tempat (dipakai form tambah & ubah).
  function upsert(id, name, base) {
    var n = normName(name), b = normBase(base);
    if (!n) return { ok: false, error: "isi nama computer" };
    if (!b) return { ok: false, error: "isi alamat: http://IP:8765" };
    var a = load(), dupe = findByBase(a, b);
    if (dupe && dupe.id !== id) return { ok: false, error: "alamat itu sudah dipakai " + dupe.name };
    if (id) {
      for (var i = 0; i < a.length; i++) {
        if (a[i].id !== id) continue;
        a[i].name = n; a[i].base = b;
        save(a);
        return { ok: true, comp: a[i] };
      }
      return { ok: false, error: "computer tak ada" };
    }
    var c = { id: newId(), name: n, base: b, last_used: 0 };
    a.push(c);
    save(a);
    return { ok: true, comp: c };
  }

  function remove(id) {
    var a = load();
    for (var i = 0; i < a.length; i++) {
      if (a[i].id !== id) continue;
      a.splice(i, 1);
      save(a);
      delete state[id];
      return true;
    }
    return false;
  }

  // penanda "PC terakhir dipakai": print picker & target sesi.
  function touch(id) {
    var a = load();
    for (var i = 0; i < a.length; i++) {
      if (a[i].id !== id) continue;
      a[i].last_used = Date.now();
      save(a);
      return;
    }
  }
  function lastUsed() {
    var a = load(), best = null;
    for (var i = 0; i < a.length; i++) {
      if (!a[i].last_used) continue;
      if (!best || a[i].last_used > best.last_used) best = a[i];
    }
    return best;
  }

  function st(id) { return state[id] || { state: "?", version: "" }; }
  function setSt(id, s, version) { state[id] = { state: s, version: version || "" }; }

  // satu PC: /api/status (v1.6+) → ok; gagal "versi lama" → /api/health → lama; selain itu putus.
  async function checkOne(c, ms) {
    var t = toIntMs(ms) || CHECK_MS;
    var r = await Lan.statusGet(c.base, t);
    if (r.ok) { setSt(c.id, "ok", r.data && r.data.version); return; }
    if (r.error === "PC versi lama, update dulu") {
      var h = await Lan.health(c.base, t);
      setSt(c.id, h.ok ? "lama" : "putus", "");
      return;
    }
    setSt(c.id, "putus", "");
  }
  function toIntMs(ms) {
    var n = parseInt(ms, 10);
    return isNaN(n) || n <= 0 ? 0 : n;
  }

  // semua PC dicek PARALEL: 1 PC mati tak menambah waktu tunggu PC lain.
  async function checkAll(ms) {
    var a = list();
    await Promise.all(a.map(function (c) { return checkOne(c, ms); }));
    return a;
  }

  // untuk picker [buka] & print: cek SEKARANG lalu ambil yang tersambung saja.
  async function online(ms) {
    await checkAll(ms);
    var a = list(), out = [];
    for (var i = 0; i < a.length; i++) if (st(a[i].id).state !== "putus") out.push(a[i]);
    return out;
  }

  migrate(); // jalan sekali saat script dimuat (sebelum DOMContentLoaded → sebelum Live.resume)

  return {
    list: list, get: get, byName: byName, add: function (n, b) { return upsert(null, n, b); },
    update: upsert, remove: remove, touch: touch, lastUsed: lastUsed,
    checkAll: checkAll, online: online, state: st,
    normBase: normBase, migrate: migrate,
  };
})();