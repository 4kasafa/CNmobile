/* Cek logika murni multi-PC. Tanpa framework: `npm test`.
   Modul www/js dimuat lewat vm.runInThisContext (IIFE-nya jadi global) + localStorage tiruan. */
var fs = require("fs"), path = require("path"), vm = require("vm"), assert = require("assert");

var JS = path.join(__dirname, "..", "www", "js");
var mem = {};
global.localStorage = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
  setItem: function (k, v) { mem[k] = String(v); },
  removeItem: function (k) { delete mem[k]; },
};
function loadJs(f) { vm.runInThisContext(fs.readFileSync(path.join(JS, f), "utf8"), { filename: f }); }

var TESTS = [];
function t(name, fn) { TESTS.push({ name: name, fn: fn }); }
function tx(o) { // baris tx PC
  return {
    server_id: o.id, no_transaksi: o.no || "T" + o.id, no_urut: o.n == null ? "" : String(o.n),
    total: o.total == null ? 1000 : o.total, tunai: o.total == null ? 1000 : o.total, nontunai: 0,
    bank: "", kategori: "Tunai", created_at: o.at || "2026-10-17 10:00:00",
  };
}

/* ---------- Comps: normalisasi URL + CRUD ---------- */
loadJs("comps.js");
loadJs("store.js");
loadJs("txmerge.js");

t("normBase: port default 8765 + buang slash akhir", function () {
  assert.strictEqual(Comps.normBase("192.168.1.5"), "http://192.168.1.5:8765");
  assert.strictEqual(Comps.normBase("http://192.168.1.5"), "http://192.168.1.5:8765");
  assert.strictEqual(Comps.normBase("http://192.168.1.5:8765/"), "http://192.168.1.5:8765");
  assert.strictEqual(Comps.normBase(" HTTP://192.168.1.5:9000/ "), "http://192.168.1.5:9000");
  assert.strictEqual(Comps.normBase(""), "");
});

t("Comps: tolak nama/base kosong + base duplikat", function () {
  var a = Comps.add("Kasir 1", "192.168.1.5");
  assert.strictEqual(a.ok, true);
  assert.strictEqual(Comps.add("", "192.168.1.6").ok, false);
  assert.strictEqual(Comps.add("Kosong", "").ok, false);
  assert.strictEqual(Comps.add("Kembar", "http://192.168.1.5:8765").ok, false);
  assert.strictEqual(Comps.add("Harus", "192.168.1.6").ok, true);
  assert.strictEqual(Comps.list().length, 2);
  // ubah base jadi milik sendiri boleh, milik orang lain ditolak
  assert.strictEqual(Comps.update(a.comp.id, "Kasir 1", "192.168.1.5").ok, true);
  assert.strictEqual(Comps.update(a.comp.id, "Kasir 1", "192.168.1.6").ok, false);
});

t("Comps: migrate seed dari cn_lan_base sekali", function () {
  mem["cn_lan_base"] = "http://192.168.1.77:8765";
  Comps.migrate();
  var a = Comps.list(), found = null;
  for (var i = 0; i < a.length; i++) if (a[i].base === "http://192.168.1.77:8765") found = a[i];
  assert.ok(found, "entry PC 1 harus ada");
  assert.strictEqual(found.name, "PC 1");
  assert.strictEqual(mem["cn_lan_base"], undefined, "key lama harus dibuang");
});

/* ---------- Store: multi-PC ---------- */
var C1 = { id: "c1", name: "PC A", base: "http://192.168.1.5:8765" };
var C2 = { id: "c2", name: "PC B", base: "http://192.168.1.6:8765" };

t("Store: createSession multi-PC + addPc tolak kembar", async function () {
  var s = await Store.createSession([C1, C2]);
  assert.strictEqual(s.pcs.length, 2);
  assert.strictEqual(s.pcs[0].last_seen, 0);
  assert.ok(await Store.addPc(s.id, { id: "c3", name: "PC C", base: "http://192.168.1.7:8765" }));
  assert.strictEqual((await Store.getSession(s.id)).pcs.length, 3);
  assert.strictEqual(await Store.addPc(s.id, C1), null, "comp_id kembar ditolak");
});

t("Store: server_id sama antar PC tak bentrok (tid namespaced)", async function () {
  var s = await Store.createSession([C1, C2]);
  await Store.upsertTx(s.id, "c1", [tx({ id: 5, n: 5, at: "2026-10-17 10:05:00" })]);
  await Store.upsertTx(s.id, "c2", [tx({ id: 5, n: 5, at: "2026-10-17 10:04:00" })]);
  var rows = await Store.listTx(s.id);
  assert.strictEqual(rows.length, 2);
  assert.deepStrictEqual(rows.map(function (r) { return r.tid; }), ["c1:5", "c2:5"]);
  assert.strictEqual(rows[0].pc_name, "PC A");
  assert.strictEqual(rows[1].pc_name, "PC B");
});

t("Store: since + complete independen per PC", async function () {
  var s = await Store.createSession([C1, C2]);
  await Store.upsertTx(s.id, "c1", [tx({ id: 9, n: 9 })]);
  await Store.upsertTx(s.id, "c2", [tx({ id: 3, n: 3 })]);
  assert.strictEqual(await Store.getLastSeen(s.id, "c1"), 9);
  assert.strictEqual(await Store.getLastSeen(s.id, "c2"), 3);
  await Store.patchPc(s.id, "c2", { complete: 0, alive: 0 });
  var g = await Store.getSession(s.id);
  assert.strictEqual(g.pcs[0].complete, 1, "PC A tak boleh ikut complete=0");
  assert.strictEqual(g.pcs[1].complete, 0);
  assert.strictEqual(g.complete, 0, "sesi jadi belum lengkap");
  await Store.patchPc(s.id, "c2", { complete: 1, alive: 1 });
  assert.strictEqual((await Store.getSession(s.id)).complete, 1, "sembuh lagi bila drain ok");
});

t("Store: patchTx hanya baris tid itu", async function () {
  var s = await Store.createSession([C1, C2]);
  await Store.upsertTx(s.id, "c1", [tx({ id: 1, n: 1, total: 5000 })]);
  await Store.upsertTx(s.id, "c2", [tx({ id: 1, n: 1, total: 7000 })]);
  await Store.patchTx(s.id, "c1:1", 111, 0);
  var rows = await Store.listTx(s.id);
  assert.strictEqual(rows.length, 2);
  for (var i = 0; i < rows.length; i++) if (rows[i].tid === "c1:1") assert.strictEqual(rows[i].tunai, 111);
  for (var j = 0; j < rows.length; j++) if (rows[j].tid === "c2:1") assert.strictEqual(rows[j].tunai, 7000);
});

t("Store: isian manual ter-namespacing per PC", async function () {
  var s = await Store.createSession([C1, C2]);
  await Store.upsertFill(s.id, "c1", "2026-10-17", 2, 3000, 0);
  var f = await Store.getFills(s.id);
  assert.strictEqual(Object.keys(f).length, 1);
  assert.strictEqual(f["c1|2026-10-17|2"].pc_name, "PC A");
  assert.strictEqual(f["c1|2026-10-17|2"].total, 3000);
});

t("Store: migrasi sesi v1 base_url -> pcs[@legacy]", async function () {
  mem["cn_live_sessions"] = JSON.stringify([
    { id: "s_old", base_url: "http://192.168.1.9:8765", status: "open", started_at: "x", complete: 1, last_seen: 42, count: 0 },
  ]);
  mem["cn_live_tx"] = JSON.stringify({ s_old: [tx({ id: 42, n: 42 })] });
  var s = await Store.getSession("s_old");
  assert.strictEqual(s.base_url, undefined);
  assert.strictEqual(s.pcs.length, 1);
  assert.strictEqual(s.pcs[0].comp_id, "@legacy");
  assert.strictEqual(s.pcs[0].last_seen, 42);
  var rows = await Store.listTx("s_old");
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].tid, "@legacy:42");
  delete mem["cn_live_sessions"]; delete mem["cn_live_tx"];
});

t("Store: deleteSession membuang semua bucket PC", async function () {
  var s = await Store.createSession([C1, C2]);
  await Store.upsertTx(s.id, "c1", [tx({ id: 1, n: 1 })]);
  await Store.upsertTx(s.id, "c2", [tx({ id: 2, n: 2 })]);
  await Store.closeSession(s.id, true);
  assert.strictEqual(await Store.deleteSession(s.id), true);
  assert.strictEqual((await Store.listTx(s.id)).length, 0);
});

/* ---------- TxMerge: rantai HILANG per PC ---------- */
t("TxMerge: gap no_urut tersisip HILANG, tiap lompatan satu", function () {
  var rows = [
    tx({ id: 3, n: 3, at: "2026-10-17 10:03:00" }),
    tx({ id: 1, n: 1, at: "2026-10-17 10:01:00" }),
    tx({ id: 5, n: 5, at: "2026-10-17 10:05:00" }),
  ].map(function (r) { r.pc_id = "c1"; r.pc_name = "PC A"; r.tid = "c1:" + r.server_id; return r; });
  var items = TxMerge.buildItems(rows, {});
  // rantai 1 -> 3 -> 5: dua lompatan (no 2 dan no 4), masing-masing satu baris HILANG
  assert.deepStrictEqual(items.map(function (it) { return it.t === "hilang" ? "H" + it.n : "T" + it.r.no_urut; }),
    ["T5", "H4", "T3", "H2", "T1"]);
  for (var i = 0; i < items.length; i++) {
    assert.strictEqual(items[i].pc_id, "c1", "setiap item membawa pc_id");
    assert.strictEqual(items[i].pc_name, "PC A", "setiap item membawa nama PC");
  }
  assert.strictEqual(items[3].hkey, "c1|2026-10-17|2", "kunci isian ikut pc_id");
});

t("TxMerge: rantai HILANG tiap PC terpisah", function () {
  var rows = [
    tx({ id: 1, n: 1, at: "2026-10-17 10:01:00" }),
    tx({ id: 3, n: 3, at: "2026-10-17 10:03:00" }),
    tx({ id: 4, n: 2, at: "2026-10-17 10:02:00" }),
    tx({ id: 5, n: 5, at: "2026-10-17 10:05:00" }),
  ];
  var tagged = rows.map(function (r) {
    r.pc_id = (r.server_id <= 3) ? "c1" : "c2"; r.pc_name = "PC " + r.pc_id.toUpperCase(); r.tid = r.pc_id + ":" + r.server_id; return r;
  });
  var items = TxMerge.buildItems(tagged, {});
  // c1: 1 -> 3 (gap no 2). c2: 2 -> 5 (gap no 3,4). Tak saling menyisip.
  assert.strictEqual(items.length, 7, "5 tx + 1 gap c1 + 2 gap c2");
  var hilang = items.filter(function (it) { return it.t === "hilang"; });
  // gap c2 dipicu tx 10:05 (paling baru) -> tampil paling atas; dalam 1 PC no besar dulu
  assert.deepStrictEqual(hilang.map(function (it) { return it.hkey; }),
    ["c2|2026-10-17|4", "c2|2026-10-17|3", "c1|2026-10-17|2"]);
});

t("TxMerge: urutan gabung created_at DESC, HILANG di bawah tx pemicunya", function () {
  var rows = [
    tx({ id: 1, n: 1, at: "2026-10-17 10:01:00" }),
    tx({ id: 3, n: 3, at: "2026-10-17 10:05:00" }), // c1: 1 -> 3, memicu H2
    tx({ id: 4, n: 1, at: "2026-10-17 10:02:00" }),
    tx({ id: 5, n: 2, at: "2026-10-17 10:03:00" }), // c2: 1 -> 2, tanpa gap
  ];
  var tagged = rows.map(function (r, i) {
    r.pc_id = i < 2 ? "c1" : "c2"; r.pc_name = r.pc_id.toUpperCase(); r.tid = r.pc_id + ":" + r.server_id; return r;
  });
  var items = TxMerge.buildItems(tagged, {});
  assert.deepStrictEqual(items.map(function (it) { return it.t === "hilang" ? "H" + it.n : it.pc_name + "/" + it.r.no_urut; }),
    ["C1/3", "H2", "C2/2", "C2/1", "C1/1"]);
  assert.strictEqual(items[1].sortKey, items[0].sortKey, "HILANG ikut sortKey tx pemicunya");
  assert.ok(items[0].sortKey > items[2].sortKey, "urut benar-benar created_at DESC lintas PC");
});

t("TxMerge: isian manual menutupi gap, jadi baris MANUAL bukan HILANG", function () {
  var a = tx({ id: 1, n: 1, at: "2026-10-17 10:01:00" }); a.pc_id = "c1"; a.pc_name = "PC A";
  var c = tx({ id: 3, n: 3, at: "2026-10-17 10:03:00" }); c.pc_id = "c1"; c.pc_name = "PC A";
  var fills = { "c1|2026-10-17|2": { day: "2026-10-17", n: 2, tunai: 2000, nontunai: 0, total: 2000, kategori: "Tunai" } };
  var items = TxMerge.buildItems([a, c], fills);
  assert.strictEqual(items.filter(function (it) { return it.t === "hilang"; }).length, 0);
  var m = items.filter(function (it) { return it.fill; })[0];
  assert.ok(m, "baris isian harus muncul");
  assert.strictEqual(m.r.tid, "fill:c1|2026-10-17|2");
  assert.strictEqual(m.r.manual, 1);
});

t("TxMerge: ganti hari & no_urut duplikat tak merusak rantai", function () {
  var r = [
    tx({ id: 1, n: 1, at: "2026-10-16 09:00:00" }),
    tx({ id: 2, n: 2, at: "2026-10-16 09:01:00" }),
    tx({ id: 3, n: 1, at: "2026-10-17 09:00:00" }),
  ];
  r.forEach(function (x) { x.pc_id = "c1"; x.pc_name = "PC A"; x.tid = "c1:" + x.server_id; });
  var items = TxMerge.buildItems(r, {});
  assert.strictEqual(items.filter(function (it) { return it.t === "hilang"; }).length, 0, "reset per hari: tak ada gap");
  assert.strictEqual(items[0].r.created_at, "2026-10-17 09:00:00", "terbaru di atas");
});

t("Store: cap 500 per PC (bukan per sesi)", async function () {
  var s = await Store.createSession([C1, C2]);
  var many = [];
  for (var i = 1; i <= 520; i++) many.push(tx({ id: i, n: i, at: "2026-10-17 10:00:00" }));
  await Store.upsertTx(s.id, "c1", many);
  await Store.upsertTx(s.id, "c2", [tx({ id: 1, n: 1 })]);
  assert.strictEqual((await Store.listTx(s.id)).length, Store.CAP_PER_PC + 1);
  var c1rows = (await Store.listTx(s.id)).filter(function (r) { return r.pc_id === "c1"; });
  assert.strictEqual(c1rows.length, Store.CAP_PER_PC);
  assert.strictEqual(Math.min.apply(null, c1rows.map(function (r) { return r.server_id; })), 21, "potong yang tertua");
});

(async function main() {
  var pass = 0, fail = 0;
  for (var i = 0; i < TESTS.length; i++) {
    try {
      await TESTS[i].fn();
      pass++;
      console.log("  ok  " + TESTS[i].name);
    } catch (e) {
      fail++;
      console.log("FAIL  " + TESTS[i].name + "\n      " + (e && e.message));
    }
  }
  console.log("\n" + pass + " ok, " + fail + " gagal");
  process.exit(fail ? 1 : 0);
})();