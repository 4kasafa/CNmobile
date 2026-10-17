/* Tab [comp] = daftar computer (nama + base URL) dengan badge koneksi, plus halaman
   control per-PC (status + watcher + wipe + log). Menggantikan settings.js.
   Gestur: tap tunggal = no-op · dobel-tap = control · tahan 900ms = [ubah]+[hapus].
   Comp.pick() dipakai bersama: [buka] sesi Live, [+tambah pc], dan kirim print —
   semuanya daftar PC TERSAMBUNG saja (Comps.online() = cek ulang lalu filter). */
var Comp = (function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var adding = false;        // form [+ tambah] terbuka
  var editing = null;        // id PC yang form [ubah] terbuka
  var pendingDel = null;     // id PC yang tombolnya [yakin?]
  var revealed = null;       // id PC yang aksi hold-nya terungkap
  var ctl = null;            // id PC yang halaman control-nya terbuka
  var lastTap = { id: "", t: 0 };
  var holdT = null, holdId = null, holdX = 0, holdY = 0;
  var pickCb = null, pickExclude = {}, pickSel = {}, pickList = [], pickGen = 0;

  function msg(t, cls) {
    var m = $("comp-msg");
    if (!m) return;
    m.textContent = t || "";
    m.className = "msg" + (cls ? " " + cls : "");
  }
  function ctlMsg(t, cls) {
    var m = $("set-msg");
    if (!m) return;
    m.textContent = t || "";
    m.className = "msg" + (cls ? " " + cls : "");
  }
  // btn-wipe TIDAK ikut busy(): pemiliknya guardWipe() (tak boleh aktif saat PC dipakai sesi)
  function busy(b) {
    ["comp-add", "comp-check", "btn-watch-on", "btn-watch-off", "btn-watch-reload", "btn-log-load"].forEach(function (id) {
      var el = $(id);
      if (el) el.disabled = !!b;
    });
  }

  /* ---------- daftar computer ---------- */

  function badge(st) {
    return st.state === "ok" ? "[ok]" : st.state === "lama" ? "[OK·lama]" : st.state === "putus" ? "[PUTUS]" : "[--]";
  }
  function badgeCls(st) {
    return st.state === "ok" ? "ok" : st.state === "lama" ? "ok" : st.state === "putus" ? "bad" : "dim";
  }

  function editForm(c) {
    return '<div class="tx-bot"><label class="dim">nama</label>' +
      '<input id="comp-ed-name" type="text" autocomplete="off" value="' + esc(c.name) + '">' +
      '<label class="dim">alamat</label>' +
      '<input id="comp-ed-base" type="text" inputmode="url" autocomplete="off" value="' + esc(c.base) + '">' +
      '<span class="cmds"><button type="button" data-save="' + esc(c.id) + '">[simpan]</button> ' +
      '<button type="button" data-cancel="1">[batal]</button></span></div>';
  }

  function renderList() {
    var box = $("comp-list");
    if (!box) return;
    var a = Comps.list();
    if (!a.length) {
      box.innerHTML = '<p class="dim">└─ belum ada computer. [+ tambah] dulu.</p>';
      return;
    }
    box.innerHTML = (adding ? addForm() : "") + '<p class="cmdline">└─ daftar computer</p>' + a.map(function (c) {
      var s = Comps.state(c.id);
      var shown = String(revealed) === String(c.id);
      var acts = shown
        ? ' <button type="button" data-edit="' + esc(c.id) + '">[ubah]</button>' +
          (pendingDel === c.id
            ? ' <button type="button" data-del="yakin">[yakin?]</button>'
            : ' <button type="button" data-del="hapus">[hapus]</button>')
        : "";
      var act = (typeof Live !== "undefined" && Live.isActive(c.id)) ? ' <span class="tag lebih">sesi aktif</span>' : "";
      var form = String(editing) === String(c.id) ? editForm(c) : "";
      return '<div class="tx' + (shown ? " revealed" : "") + '" data-cid="' + esc(c.id) + '">' +
        '<div class="tx-mid"><span>' + esc(c.name) + "</span>" +
        '<span class="' + badgeCls(s) + '">' + badge(s) + "</span></div>" +
        '<div class="tx-bot"><span class="dim">' + esc(c.base) + "</span>" + act + acts + "</div>" + form + "</div>";
    }).join("");
  }

  function addForm() {
    return '<div class="tx" data-add="1"><div class="tx-bot"><label class="dim">nama</label>' +
      '<input id="comp-new-name" type="text" autocomplete="off" placeholder="kasir 1">' +
      '<label class="dim">alamat</label>' +
      '<input id="comp-new-base" type="text" inputmode="url" autocomplete="off" placeholder="http://192.168.1.5:8765">' +
      '<span class="cmds"><button type="button" data-save-new="1">[simpan]</button> ' +
      '<button type="button" data-cancel="1">[batal]</button></span></div></div>';
  }

  // tab [comp] dibuka -> cek semua PC paralel, lalu badge terisi
  async function load() {
    if (ctl) { renderCtl(); await ctlLoad(); return; }
    renderList();
    await Comps.checkAll();
    renderList();
  }

  /* ---------- gestur daftar: tap no-op, dobel-tap control, hold aksi ---------- */

  function clearHold() {
    if (holdT) { clearTimeout(holdT); holdT = null; }
    holdId = null;
    var box = $("comp-list");
    if (!box) return;
    var els = box.querySelectorAll(".holding");
    for (var i = 0; i < els.length; i++) els[i].classList.remove("holding");
  }
  function revealHold() {
    if (!holdId) return;
    revealed = holdId; pendingDel = null; lastTap.id = "";
    holdId = null; holdT = null;
    try { if (navigator.vibrate) navigator.vibrate(15); } catch (e) {}
    renderList();
  }
  function onHoldStart(e) {
    if (e.button != null && e.button !== 0) return;
    if (!e.target || !e.target.closest) return;
    if (e.target.closest("button") || e.target.closest("input")) return; // sudah ada aksi dijarik
    var el = e.target.closest("[data-cid]");
    if (!el) return;
    var id = el.getAttribute("data-cid");
    if (!id || String(revealed) === String(id)) return;
    clearHold();
    holdId = id;
    var p = (e.touches && e.touches[0]) || e;
    holdX = p.clientX || 0; holdY = p.clientY || 0;
    el.classList.add("holding");
    holdT = setTimeout(revealHold, 900);
  }
  function onHoldMove(e) {
    if (!holdT) return;
    var p = (e.touches && e.touches[0]) || e;
    var x = p.clientX || 0, y = p.clientY || 0;
    if (Math.abs(x - holdX) > 10 || Math.abs(y - holdY) > 10) clearHold();
  }

  function onListClick(e) {
    var t = e.target;
    if (!t || !t.closest) return;

    var bSaveNew = t.closest("[data-save-new]");
    if (bSaveNew) {
      var nn = $("comp-new-name"), nb = $("comp-new-base");
      var r1 = Comps.add(nn ? nn.value : "", nb ? nb.value : "");
      if (!r1.ok) { msg(r1.error, "err"); return; }
      adding = false;
      msg("ditambah " + r1.comp.name, "ok");
      renderList();
      Comps.checkAll().then(function () { renderList(); });
      return;
    }
    var bSave = t.closest("[data-save]");
    if (bSave) {
      var id = bSave.getAttribute("data-save");
      var en = $("comp-ed-name"), eb = $("comp-ed-base");
      var r2 = Comps.update(id, en ? en.value : "", eb ? eb.value : "");
      if (!r2.ok) { msg(r2.error, "err"); return; } // form tetap buka
      editing = null;
      msg("diperbarui", "ok");
      renderList();
      Comps.checkAll().then(function () { renderList(); });
      return;
    }
    if (t.closest("[data-cancel]")) { adding = false; editing = null; msg(""); renderList(); return; }
    var bEdit = t.closest("[data-edit]");
    if (bEdit) { editing = bEdit.getAttribute("data-edit"); pendingDel = null; renderList(); return; }
    var bDel = t.closest("[data-del]");
    if (bDel) {
      var did = bDel.closest("[data-cid]").getAttribute("data-cid");
      if (String(pendingDel) === String(did)) {
        if (typeof Live !== "undefined" && Live.isActive(did)) {
          msg("pc itu dipakai sesi aktif, tutup sesi dulu", "err");
          return;
        }
        Comps.remove(did);
        revealed = null; pendingDel = null; editing = null;
        msg("dihapus", "ok");
        renderList();
      } else {
        pendingDel = did;
        renderList(); // [hapus] -> [yakin?]
      }
      return;
    }
    // tap pada baris: bukan aksi — hanya reset state baris lain, atau jadi bagian dobel-tap
    var el = t.closest("[data-cid]");
    if (!el) return;
    var id2 = el.getAttribute("data-cid");
    if (revealed && String(revealed) !== String(id2)) {
      revealed = null; pendingDel = null; lastTap.id = "";
      renderList();
      return;
    }
    var now = Date.now();
    if (lastTap.id === id2 && now - lastTap.t < 350) {
      lastTap.id = "";
      openCtl(id2);
    } else {
      lastTap.id = id2; lastTap.t = now; // tap tunggal: no-op
    }
  }

  /* ---------- halaman control ---------- */

  function renderCtl() {
    var c = ctl ? Comps.get(ctl) : null;
    var title = $("ctl-title");
    if (title) title.textContent = "kontrol: " + (c ? c.name : "--") + (c ? " · " + c.base : "");
    var panel = $("ctl-panel"), list = $("comp-list-wrap");
    if (panel) panel.hidden = !ctl;
    if (list) list.hidden = !!ctl;
  }

  function paintBadge(txt, cls) {
    var el = $("set-status-badge");
    if (!el) return;
    el.textContent = txt;
    el.className = cls || "dim";
  }
  function paintWatch(enabled) {
    var el = $("watch-status");
    if (!el) return;
    el.textContent = enabled === true ? "[nyala]" : enabled === false ? "[mati]" : "[--]";
  }
  function clearPin(id) { var el = $(id); if (el) el.value = ""; }

  // wipe = aksi destruktif: PC yang sedang dipakai sesi aktif diblokir di HP (tak sampai ke PC).
  function guardWipe() {
    var act = !!ctl && typeof Live !== "undefined" && Live.isActive(ctl);
    var btn = $("btn-wipe"), why = $("ctl-wipe-why");
    if (btn) btn.disabled = act;
    if (why) why.textContent = act ? "pc dipakai sesi aktif: tutup sesi dulu" : "";
  }

  async function ctlLoad() {
    if (!ctl) return;
    var c = Comps.get(ctl);
    if (!c) { closeCtl(); return; }
    busy(true);
    try {
      var s = await Lan.statusGet(c.base);
      if (!s.ok && s.error === "PC versi lama, update dulu") {
        var h = await Lan.health(c.base);
        $("set-status-info").textContent = h.ok ? "└─ pc versi lama: update dulu" : "└─ pc tak terjangkau";
        paintBadge(h.ok ? "[OK·lama]" : "[PUTUS]", h.ok ? "ok" : "bad");
        paintWatch(null);
        ctlMsg("", "");
        return;
      }
      if (!s.ok) {
        $("set-status-info").textContent = "└─ " + c.base;
        paintBadge("[PUTUS]", "bad");
        paintWatch(null);
        ctlMsg(s.error, "err");
        return;
      }
      var d = s.data || {};
      $("set-status-info").textContent = "└─ v" + (d.version || "?") + " · " + (d.ip || "?") + ":" + (d.port || "?");
      paintBadge("[OK]", "ok");
      ctlInfo(d);
      paintWatch(!!d.watcher_enabled);
      ctlMsg("", "");
    } finally {
      guardWipe();
      busy(false);
    }
  }

  function ctlInfo(d) {
    var el = $("ctl-detail");
    if (!el) return;
    el.textContent = "└─ watcher " + (d.watcher_enabled ? "nyala" : "mati") + (d.watcher_alive ? " (hidup)" : " (tak hidup)") +
      " · ketoko " + (d.ketoko ? "ada" : "tak ada") +
      " · tx hari ini " + (d.count_today == null ? "?" : d.count_today) +
      (d.last_no ? " · " + d.last_no : "") +
      (d.uptime_s != null ? " · up " + Math.round(d.uptime_s) + " dtk" : "") +
      (d.db_busy ? " · db sibuk" : "");
  }

  function openCtl(id) {
    ctl = id;
    clearPin("set-watch-pin"); clearPin("set-wipe-pin"); clearPin("set-log-pin");
    var log = $("log-pre");
    if (log) log.textContent = "belum dimuat";
    renderCtl();
    ctlLoad();
  }
  function closeCtl() {
    ctl = null;
    ctlMsg("", "");
    renderCtl();
    renderList();
  }

  async function setWatcher(enabled) {
    if (!ctl) return;
    var c = Comps.get(ctl);
    if (!c) return;
    var pin = String((($("set-watch-pin") || {}).value) || "");
    if (!pin) { ctlMsg("isi pin watcher dulu", "err"); return; }
    busy(true);
    try {
      var r = await Lan.watcherSet(c.base, pin, !!enabled);
      if (r.ok) {
        paintWatch(!!(r.data && r.data.enabled));
        ctlMsg("watcher " + ((r.data && r.data.enabled) ? "nyala" : "mati"), "ok");
        clearPin("set-watch-pin");
      } else {
        ctlMsg(r.error, "err");
        if (r.status === 403 || r.status === 429) clearPin("set-watch-pin");
      }
    } finally {
      busy(false);
    }
  }

  // tombol selalu aktif, validasi HAPUS di server (400 passthrough)
  async function wipe() {
    if (!ctl) return;
    var c = Comps.get(ctl);
    if (!c) return;
    if (typeof Live !== "undefined" && Live.isActive(ctl)) { ctlMsg("pc dipakai sesi aktif: tutup sesi dulu", "err"); return; }
    var pin = String((($("set-wipe-pin") || {}).value) || "");
    var confirm = String((($("set-wipe-confirm") || {}).value) || "");
    var btn = $("btn-wipe");
    if (btn) btn.disabled = true;
    try {
      var r = await Lan.wipe(c.base, pin, confirm);
      if (r.ok) {
        var n = r.data && r.data.deleted;
        ctlMsg("dihapus " + (n == null ? "?" : n), "ok");
        clearPin("set-wipe-pin");
        var cf = $("set-wipe-confirm");
        if (cf) cf.value = "";
      } else {
        ctlMsg(r.error, "err");
        if (r.status === 400) {
          var cf2 = $("set-wipe-confirm");
          if (cf2) { cf2.focus(); try { cf2.select(); } catch (e2) {} }
        } else if (r.status === 403 || r.status === 429) {
          clearPin("set-wipe-pin");
        }
        // 409/timeout: biarkan PIN agar tekan ulang manual
      }
    } finally {
      guardWipe(); // tombol kembali sesuai aturan sesi aktif
    }
  }

  async function loadLog() {
    if (!ctl) return;
    var c = Comps.get(ctl);
    if (!c) return;
    var pin = String((($("set-log-pin") || {}).value) || "");
    if (!pin) { ctlMsg("isi pin log dulu", "err"); return; }
    busy(true);
    try {
      var r = await Lan.logGet(c.base, pin, 200);
      if (r.ok) {
        var lines = r.data && r.data.lines;
        var pre = $("log-pre");
        if (pre) pre.textContent = Array.isArray(lines) && lines.length ? lines.join("\n") : "(kosong)";
        ctlMsg("", "");
      } else {
        ctlMsg(r.error, "err");
        if (r.status === 403 || r.status === 429) clearPin("set-log-pin");
      }
    } finally {
      busy(false);
    }
  }

  function peek(btnId, inputId) {
    var btn = $(btnId), inp = $(inputId);
    if (!btn || !inp) return;
    btn.addEventListener("click", function () {
      inp.type = inp.type === "password" ? "text" : "password";
    });
  }

  /* ---------- picker PC (dipakai Live + print) ---------- */

  // opts: {title, exclude:{id:true}, preselect:id} -> done([{id,name,base}])
  function pick(opts, done) {
    opts = opts || {};
    var wrap = $("pick-wrap");
    if (!wrap) { done([]); return; }
    var gen = ++pickGen; // pengaman: hasil cek PC lama tak boleh menimpa picker baru
    pickCb = done;
    pickExclude = opts.exclude || {};
    pickSel = {};
    pickList = [];
    if (opts.preselect && !pickExclude[opts.preselect]) pickSel[opts.preselect] = true;
    var title = $("pick-title");
    if (title) title.textContent = (opts.title || "pilih computer") + " · tersambung saja";
    wrap.hidden = false;
    pickRender("[cek...]", null);
    Comps.online().then(function (list) {
      if (gen !== pickGen) return; // picker ditutup/dibuka lagi: buang hasil basi
      var vis = [];
      for (var i = 0; i < list.length; i++) if (!pickExclude[list[i].id]) vis.push(list[i]); // [+tambah pc]: PC yang sudah ikut sesi tak muncul
      pickList = vis;
      var n = 0;
      for (var j = 0; j < vis.length; j++) if (pickSel[vis[j].id]) n++;
      pickRender(n ? n + " pc dipilih" : "", vis);
    });
  }

  // list === null = masih mengecek; [] = tak ada PC tersambung ([mulai] disembunyikan, [+ pc baru] tetap ada)
  function pickRender(t, list) {
    var box = $("pick-box"), foot = $("pick-foot"), ok = $("pick-ok");
    if (!box) return;
    if (list === null || !list.length) {
      box.innerHTML = '<p class="dim">└─ ' + esc(list === null ? t : "tak ada PC tersambung. cek wifi atau [+ pc baru].") + "</p>";
      if (ok) ok.hidden = true;
      if (foot) foot.hidden = false; // [+ pc baru] = jalan keluar saat 0 PC online
      return;
    }
    box.innerHTML = list.map(function (c) {
      return '<div class="tx" data-pid="' + esc(c.id) + '"><div class="tx-mid"><span>' +
        (pickSel[c.id] ? "[x] " : "[ ] ") + esc(c.name) + "</span>" +
        '<span class="dim">' + esc(c.base) + "</span></div></div>";
    }).join("");
    if (ok) { ok.hidden = false; ok.disabled = !picked(); }
    if (foot) foot.hidden = false;
  }

  function picked() {
    var out = [];
    for (var i = 0; i < pickList.length; i++) if (pickSel[pickList[i].id]) out.push(pickList[i]);
    return out;
  }

  function pickTap(e) {
    var el = e.target && e.target.closest ? e.target.closest("[data-pid]") : null;
    if (!el) return;
    var id = el.getAttribute("data-pid");
    if (pickSel[id]) delete pickSel[id];
    else pickSel[id] = true;
    var out = picked(), ok = $("pick-ok");
    if (ok) ok.disabled = !out.length;
    pickRender(out.length ? out.length + " pc dipilih" : "", pickList);
  }

  function pickClose() {
    var wrap = $("pick-wrap");
    if (wrap) wrap.hidden = true;
    pickGen++; // batalkan hasil Comps.online() yang masih berjalan
    pickCb = null; pickList = []; pickSel = {};
  }

  function pickOk() {
    var out = picked();
    var cb = pickCb;
    pickClose();
    if (cb) cb(out);
  }

  /* ---------- nav & event ---------- */

  function gotoAdd() {
    closeCtl(); // tutup control dulu: load() dari ganti tab tak memuat status PC tak perlu
    var sel = $("nav-select");
    if (sel && sel.value !== "comp") { sel.value = "comp"; sel.dispatchEvent(new Event("change")); }
    adding = true; editing = null;
    msg("", "");
    renderList();
  }

  document.addEventListener("DOMContentLoaded", function () {
    peek("btn-watch-peek", "set-watch-pin");
    peek("btn-wipe-peek", "set-wipe-pin");
    peek("btn-log-peek", "set-log-pin");

    var box = $("comp-list");
    if (box) {
      box.addEventListener("click", onListClick);
      box.addEventListener("pointerdown", onHoldStart);
      box.addEventListener("pointerup", clearHold);
      box.addEventListener("pointercancel", clearHold);
      box.addEventListener("pointerleave", clearHold);
      box.addEventListener("pointermove", onHoldMove);
      box.addEventListener("contextmenu", function (e) { if (holdT) e.preventDefault(); });
    }
    var pb = $("pick-box");
    if (pb) pb.addEventListener("click", pickTap);

    var a = $("comp-add");
    if (a) a.addEventListener("click", function () { adding = !adding; editing = null; msg(""); renderList(); });
    var ck = $("comp-check");
    if (ck) ck.addEventListener("click", function () { busy(true); Comps.checkAll().then(function () { busy(false); renderList(); }); });

    var pbk = $("pick-cancel");
    if (pbk) pbk.addEventListener("click", pickClose);
    var pbo = $("pick-ok");
    if (pbo) pbo.addEventListener("click", pickOk);
    var pbn = $("pick-new");
    if (pbn) pbn.addEventListener("click", function () { pickClose(); gotoAdd(); });

    var bk = $("ctl-back");
    if (bk) bk.addEventListener("click", closeCtl);
    var st = $("set-status");
    if (st) {
      st.addEventListener("dblclick", function (e) {
        if (e.target && e.target.closest && e.target.closest("button")) return;
        st.classList.toggle("collapsed");
      });
      st.addEventListener("click", function (e) {
        var t = e.target;
        if (t && (t.id === "set-status-badge" || (t.closest && t.closest("#set-status-badge")))) st.classList.toggle("collapsed");
      });
    }
    var on = $("btn-watch-on"), off = $("btn-watch-off"), rel = $("btn-watch-reload"), w = $("btn-wipe");
    if (on) on.addEventListener("click", function () { setWatcher(true); });
    if (off) off.addEventListener("click", function () { setWatcher(false); });
    if (rel) rel.addEventListener("click", function () { ctlLoad(); });
    if (w) w.addEventListener("click", function () { wipe(); });
    var lg = $("btn-log-load");
    if (lg) lg.addEventListener("click", function () { loadLog(); });

    var sel = $("nav-select");
    if (sel) sel.addEventListener("change", function (e) { if (e.target.value === "comp") load(); });
    try { if (sel && sel.value === "comp") load(); else renderList(); } catch (e) {}
  });

  return { load: load, pick: pick, openCtl: openCtl, closeCtl: closeCtl, isOpen: function () { return !!ctl; } };
})();