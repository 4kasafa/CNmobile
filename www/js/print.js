/* Print: port tabs/calculate_tab.py — denominasi + pengeluaran + preview 58/80 + kirim struk.
   Total Sistem dari sesi Live aktif (Store.listTx). Kirim via POST /api/print ke CNdesktop
   (kontrak milik PC — HP kirim JSON, PC bangun struk + cetak USB thermal). */
var Print = (function () {
  "use strict";
  var DENOMS = [100000, 75000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100];
  var K_META = "cn_print_meta";
  var ARABIC_LINE = '"شكراً جزيلاً"';

  function $(id) { return document.getElementById(id); }
  function toInt(v) { var n = parseInt(v, 10); return isNaN(n) ? 0 : n; }
  function rupiah(v) {
    var n = toInt(v);
    var f = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return n < 0 ? "Rp -" + f : "Rp " + f;
  }
  function dots(v) { return String(Math.abs(toInt(v))).replace(/\B(?=(\d{3})+(?!\d))/g, "."); }
  function nowStamp() {
    var d = new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; };
    return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear() + " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
  }
  function todayStamp() {
    var d = new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; };
    return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear();
  }

  var S = { qty: {}, expense: 0, note: "", size: "58", sysCash: 0, noncash: 0, hasSession: false, sessionLabel: "", seq: 0, metaOpen: true, expOpen: false };

  // ——— meta persist (kasir/cabang/shift/size/qty/expense/note) ———
  function loadMeta() {
    var m = null;
    try { m = JSON.parse(localStorage.getItem(K_META)); } catch (e) {}
    m = m || {};
    DENOMS.forEach(function (d) { S.qty[d] = Math.max(0, toInt((m.qty || {})[d])); });
    S.expense = Math.max(0, toInt(m.expense));
    S.note = String(m.note || "");
    S.size = m.size === "80" ? "80" : "58";
    return m;
  }
  function saveMeta() {
    try {
      localStorage.setItem(K_META, JSON.stringify({
        kasir: $("in-kasir") ? $("in-kasir").value : "",
        kasir_id: $("in-kasir-id") ? $("in-kasir-id").value : "",
        cabang: $("in-cabang") ? $("in-cabang").value : "",
        shift: $("in-shift") ? $("in-shift").value : "",
        size: S.size, qty: S.qty, expense: S.expense, note: S.note,
        fold: S.metaOpen ? 0 : 1, // cermin cn_session_collapsed: 1 = lipat
      }));
    } catch (e) {}
  }
  // entri Setoran terbaru periode berjalan dari bucket arsip email aktif
  // (urutan sama dgn setoran.js renderList: parseDate desc)
  function latestSetoran() {
    try {
      var email = "";
      try { var c0 = JSON.parse(localStorage.getItem("cn_cred")); email = (c0 && c0.email) || ""; } catch (e0) {}
      var arch = JSON.parse(localStorage.getItem("cn_setoran_archive")) || {};
      var b = (email && arch[email]) || null;
      var arr = (b && Array.isArray(b.data) ? b.data : []).slice();
      if (typeof Conflict !== "undefined" && Conflict.currentPeriode) {
        var cur = Conflict.currentPeriode();
        arr = arr.filter(function (it) {
          var p = Conflict.periodeOf(it && it.tanggal);
          return p === null || p === cur;
        });
      }
      if (typeof Conflict !== "undefined" && Conflict.parseDate) {
        arr.sort(function (a, b) {
          var da = Conflict.parseDate(a && a.tanggal), db = Conflict.parseDate(b && b.tanggal);
          return (db ? db.getTime() : -1) - (da ? da.getTime() : -1);
        });
      }
      var i, it;
      for (i = 0; i < arr.length; i++) {
        it = arr[i] || {};
        if (it.kasir || it.cabang || it.shift) return it;
      }
      if (b && b.cashier) return { kasir: b.cashier };
    } catch (e) {}
    return null;
  }
  function normShift(s) {
    if (/malam/i.test(s || "")) return "Malam";
    if (/pagi/i.test(s || "")) return "Pagi";
    return "";
  }
  // isi yg kosong saja — jangan timpa editan user tiap pindah tab; force via [ambil setoran]
  function fillFromSetoran(force) {
    var it = latestSetoran();
    if (!it) return false;
    var k = $("in-kasir"), cb = $("in-cabang"), sh = $("in-shift");
    if (k && (force || !k.value)) k.value = it.kasir || k.value;
    if (cb && (force || !cb.value)) cb.value = it.cabang || cb.value;
    if (sh) {
      var ns = normShift(it.shift);
      if (ns && (force || !sh.value)) sh.value = ns;
    }
    return true;
  }
  function metaComplete() {
    return !!($("in-kasir") && $("in-kasir").value.trim() &&
      $("in-kasir-id") && $("in-kasir-id").value.trim() &&
      $("in-cabang") && $("in-cabang").value.trim() &&
      $("in-shift") && $("in-shift").value);
  }
  function renderMeta() {
    var line = $("print-meta-line"), form = $("print-meta-form");
    if (!line || !form) return;
    line.hidden = S.metaOpen;
    form.hidden = !S.metaOpen;
    if (!S.metaOpen) {
      var kid = $("in-kasir-id") ? $("in-kasir-id").value.trim() : "";
      $("print-meta-info").textContent = "└─ " + $("in-kasir").value.trim() +
        " · " + $("in-cabang").value.trim() + " · " + String($("in-shift").value).toUpperCase() +
        (kid ? " · " + kid : "");
    }
  }
  function bootMeta() {
    var m = loadMeta();
    if ($("in-kasir")) $("in-kasir").value = m.kasir || "";
    if ($("in-kasir-id")) $("in-kasir-id").value = m.kasir_id || "";
    if ($("in-cabang")) $("in-cabang").value = m.cabang || "";
    if ($("in-shift")) $("in-shift").value = m.shift || "";
    fillFromSetoran(false);
    if (m.fold === 0) S.metaOpen = true;
    else if (m.fold === 1) S.metaOpen = false;
    else S.metaOpen = !metaComplete(); // default: lipat bila prefill lengkap
    if (S.metaOpen && !metaComplete()) msg("└─ login Setoran dulu biar detail terisi.", "");
    saveMeta();
    renderMeta();
  }

  // ——— denominasi (calculate_tab.py:439-464) ———
  function renderDenoms() {
    var box = $("denom-list");
    if (!box) return;
    box.innerHTML = DENOMS.map(function (d) {
      return '<div class="denom" data-denom="' + d + '">' +
        '<p class="denom-top">┌──<span class="pu">(' + dots(d) + ')</span><span class="pp">-[<span class="sub" id="sub-' + d + '">Rp 0</span>]</span></p>' +
        '<div class="field"><label for="q-' + d + '">└─ lbr</label>' +
        '<input id="q-' + d + '" type="text" inputmode="numeric" pattern="[0-9]*" placeholder="0" value="' + (S.qty[d] || "") + '"></div></div>';
    }).join("");
    DENOMS.forEach(function (d) {
      var inp = $("q-" + d);
      inp.addEventListener("input", function () {
        // validate_numeric ala desktop: digit saja, kosong = 0
        var clean = inp.value.replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, "");
        if (clean !== inp.value) inp.value = clean;
        S.qty[d] = toInt(clean);
        saveMeta();
        updateTotals();
      });
    });
  }
  function fisikTotal() {
    var t = 0;
    DENOMS.forEach(function (d) { t += S.qty[d] * d; });
    return t;
  }
  function paintSubtotals() {
    DENOMS.forEach(function (d) {
      var el = $("sub-" + d);
      if (el) el.textContent = rupiah(S.qty[d] * d);
    });
  }

  // ——— Total Sistem dari sesi Live (cash_portion/noncash_portion :25-40) ———
  async function refreshSys() {
    var my = ++S.seq;
    var sysCash = 0, noncash = 0, hasSession = false, label = "belum ada sesi";
    try {
      var ss = await Store.listSessions(10);
      var open = null, i;
      for (i = 0; i < ss.length; i++) if (ss[i].status === "open") { open = ss[i]; break; }
      if (open) {
        hasSession = true;
        var rows = await Store.listTx(open.id);
        rows.forEach(function (r) {
          var k = String(r.kategori || "").toLowerCase();
          if (k === "tunai") sysCash += toInt(r.total);
          else if (k === "nontunai") noncash += toInt(r.total);
          else if (k === "split") { sysCash += toInt(r.tunai); noncash += toInt(r.nontunai); }
          else { sysCash += toInt(r.tunai); noncash += toInt(r.nontunai); }
        });
        var nf = 0; // isian manual HILANG ikut struk (cermin banner Live)
        if (Store.getFills) {
          var fills = await Store.getFills(open.id);
          for (var fk in fills) {
            if (!fills.hasOwnProperty(fk)) continue;
            nf++;
            var fr = fills[fk] || {}, fkk = String(fr.kategori || "").toLowerCase();
            if (fkk === "tunai") sysCash += toInt(fr.total);
            else if (fkk === "nontunai") noncash += toInt(fr.total);
            else if (fkk === "split") { sysCash += toInt(fr.tunai); noncash += toInt(fr.nontunai); }
            else { sysCash += toInt(fr.tunai); noncash += toInt(fr.nontunai); }
          }
        }
        label = open.id + " · " + (rows.length + nf) + " tx";
      }
    } catch (e) {}
    if (my !== S.seq) return; // basi
    S.sysCash = sysCash; S.noncash = noncash; S.hasSession = hasSession; S.sessionLabel = label;
    updateTotals();
  }
  function updateTotals() {
    paintSubtotals();
    var fisik = fisikTotal();
    var jual = fisik + S.noncash + S.expense; // calculate_tab.py:639
    if ($("val-fisik")) $("val-fisik").textContent = rupiah(fisik);
    if ($("val-nontunai")) $("val-nontunai").textContent = rupiah(S.noncash);
    if ($("val-jual")) $("val-jual").textContent = rupiah(jual);
    if ($("val-sys")) $("val-sys").textContent = S.hasSession ? rupiah(S.sysCash) : "—";
    var de = $("val-diff");
    if (de) {
      if (!S.hasSession) { de.textContent = "—"; de.className = ""; }
      else {
        var diff = fisik - S.sysCash;
        de.textContent = diff > 0 ? "+ " + rupiah(diff) : rupiah(diff);
        de.className = diff > 0 ? "pos" : (diff < 0 ? "neg" : "");
      }
    }
    if ($("print-session")) $("print-session").textContent = S.sessionLabel;
    renderExpense();
  }

  // ——— pengeluaran lipat ala meta (ganti popup Toplevel desktop :291-432; tanpa sheet konflik).
  // Buka via [ubah]/[+], tutup via [batal] (buang ketikan) / [simpan] / [hapus]. ———
  function syncExpenseInputs() {
    if ($("exp-amt")) $("exp-amt").value = S.expense ? dots(S.expense) : "";
    if ($("exp-note")) $("exp-note").value = S.note;
  }
  function renderExpense() {
    var head = $("expense-head"), form = $("expense-form");
    if (!head) return;
    head.hidden = S.expOpen;
    if (form) form.hidden = !S.expOpen;
    if (!S.expOpen) {
      var sum = $("expense-sum"), open = $("btn-exp-open");
      if (sum) sum.textContent = (S.expense || S.note)
        ? "· Rp " + dots(S.expense) + (S.note ? " · " + S.note : "") + " "
        : "";
      if (open) open.textContent = (S.expense || S.note) ? "[ubah]" : "[+]";
    }
  }
  function openExpense() {
    S.expOpen = true;
    syncExpenseInputs();
    renderExpense();
    if ($("exp-amt")) $("exp-amt").focus();
  }
  function closeExpense() { S.expOpen = false; renderExpense(); }
  function renderExpenseForm() {
    var box = $("print-expense");
    if (!box || $("expense-form")) { renderExpense(); return; }
    var f = document.createElement("div");
    f.id = "expense-form";
    f.hidden = true;
    f.innerHTML =
      '<div class="field"><label for="exp-amt">└─ nominal</label>' +
      '<input id="exp-amt" type="text" inputmode="numeric" placeholder="0"></div>' +
      '<div class="field"><label for="exp-note">└─ ket</label>' +
      '<input id="exp-note" type="text" placeholder="cth: refund kelebihan transfer"></div>' +
      '<div class="row"><button id="btn-exp-save" type="button">[simpan]</button>' +
      '<button id="btn-exp-del" type="button">[hapus]</button>' +
      '<button id="btn-exp-cancel" type="button">[batal]</button></div>';
    box.appendChild(f);
    syncExpenseInputs();
    if ($("btn-exp-open")) $("btn-exp-open").addEventListener("click", openExpense);
    $("btn-exp-save").addEventListener("click", function () {
      S.expense = Math.max(0, toInt($("exp-amt").value.replace(/[^0-9]/g, "")));
      S.note = $("exp-note").value.trim();
      saveMeta();
      msg(S.expense || S.note ? "└─ pengeluaran tersimpan." : "└─ pengeluaran kosong.", "");
      closeExpense();
      updateTotals();
    });
    $("btn-exp-del").addEventListener("click", function () {
      S.expense = 0; S.note = ""; saveMeta();
      syncExpenseInputs();
      msg("└─ pengeluaran dihapus.", "");
      closeExpense();
      updateTotals();
    });
    $("btn-exp-cancel").addEventListener("click", function () {
      syncExpenseInputs(); // tutup: buang ketikan, kembali ke tersimpan
      msg("", "");
      closeExpense();
      updateTotals();
    });
    $("exp-amt").addEventListener("input", function () {
      var v = $("exp-amt").value.replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, "");
      $("exp-amt").value = v;
    });
    renderExpense();
  }

  function msg(t, cls) {
    var m = $("print-msg");
    if (!m) return;
    m.textContent = t || "";
    m.className = "msg" + (cls ? " " + cls : "");
  }

  // ——— struk (calculate_tab.py:534-567, 601-667; tanpa gambar Arab B64 — baris teks saja) ———
  function kvLine(label, value, w) {
    label = String(label); value = String(value);
    var sp = w - label.length - value.length;
    if (sp < 1) return label + " " + value;
    return label + new Array(sp + 1).join(" ") + value;
  }
  function amountLine(label, amount, w) {
    var right = "Rp " + dots(amount);
    var sp = w - label.length - right.length;
    if (sp >= 2) return [label + new Array(sp + 1).join(" ") + right];
    var parts = label.split(" ", 2);
    if (parts.length === 2) {
      var sp1 = w - parts[0].length - right.length;
      if (sp1 >= 1) return [parts[0] + new Array(sp1 + 1).join(" ") + right, parts[1]];
    }
    return [label + " " + right];
  }
  function wrapText(t, w) {
    var words = String(t).split(/\s+/).filter(Boolean), out = [], cur = "";
    words.forEach(function (wd) {
      if (!cur) cur = wd;
      else if ((cur + " " + wd).length <= w) cur += " " + wd;
      else { out.push(cur); cur = wd; }
    });
    if (cur) out.push(cur);
    return out.length ? out : [""];
  }
  function center(s, w) {
    s = String(s);
    if (s.length >= w) return s.slice(0, w);
    var pad = w - s.length, l = Math.floor(pad / 2);
    return new Array(l + 1).join(" ") + s + new Array(pad - l + 1).join(" ");
  }
  function withMargin(lines, w, margin) {
    margin = margin == null ? 2 : margin;
    var inner = Math.max(w - margin * 2, 10), pad = new Array(margin + 1).join(" ");
    return lines.map(function (ln) {
      if (!ln) return "";
      var c = String(ln).slice(0, inner);
      return pad + c + new Array(inner - c.length + 1).join(" ") + pad;
    });
  }
  function generateReceipt(w) {
    var inner = Math.max(w - 4, 10);
    var kasir = $("in-kasir") ? $("in-kasir").value.trim() : "";
    var kasirId = $("in-kasir-id") ? $("in-kasir-id").value.trim() : "";
    var cabang = $("in-cabang") ? $("in-cabang").value.trim() : "";
    var shift = $("in-shift") ? $("in-shift").value.trim() : "";
    var fisik = fisikTotal();
    var lines = [];
    lines.push(center("TOKO LAY", inner));
    lines.push(center("Laporan Penjualan", inner));
    lines.push(new Array(inner + 1).join("-"));
    lines.push(kvLine("Tanggal", todayStamp(), inner));
    lines.push(kvLine("Cabang", cabang || "-", inner));
    lines.push(kvLine("Shift", shift || "-", inner));
    lines.push(kvLine("Kasir", kasir || "-", inner));
    lines.push(kvLine("User ID", kasirId || "-", inner));
    lines.push(new Array(inner + 1).join("-"));
    var phys = [];
    DENOMS.forEach(function (d) {
      var q = S.qty[d];
      if (q > 0) {
        var left = dots(d) + " x " + q, right = "Rp " + dots(q * d);
        var sp = inner - left.length - right.length;
        phys.push(sp < 1 ? left + "\n" + right : left + new Array(sp + 1).join(" ") + right);
      }
    });
    amountLine("Total Penjualan", fisik + S.noncash + S.expense, inner).forEach(function (l) { lines.push(l); });
    lines.push(amountLine("Non Tunai", S.noncash, inner)[0]);
    lines.push(amountLine("Pengeluaran", S.expense, inner)[0]);
    lines.push(new Array(inner + 1).join("-"));
    lines.push(center("-- Rincian Uang Fisik --", inner));
    phys.forEach(function (l) { lines.push(l); });
    lines.push(new Array(inner + 1).join("-"));
    lines.push(amountLine("TOTAL FISIK", fisik, inner)[0]);
    lines.push(new Array(inner + 1).join("-"));
    if (S.note.trim()) {
      var first = true;
      S.note.trim().split("\n").forEach(function (raw) {
        wrapText((first ? "Ket: " : "") + raw.trim(), inner).forEach(function (wl) { lines.push(center(wl, inner)); });
        first = false;
      });
    }
    lines.push(center(nowStamp(), inner));
    lines.push(center(ARABIC_LINE, inner));
    return withMargin(lines, w, 2).join("\n");
  }

  // ——— preview + validasi (calculate_tab.py:487-514) ———
  function width() { return S.size === "80" ? 48 : 32; }
  function paintSizeBtns() {
    if ($("btn-size-58")) $("btn-size-58").classList.toggle("on", S.size === "58");
    if ($("btn-size-80")) $("btn-size-80").classList.toggle("on", S.size === "80");
  }
  function doPreview() {
    var kasir = $("in-kasir") ? $("in-kasir").value.trim() : "";
    if (!kasir) { msg("└─ pilih/isi kasir dulu.", "err"); if ($("in-kasir")) $("in-kasir").focus(); return; }
    if ($("in-kasir-id") && !$("in-kasir-id").value.trim()) { msg("└─ isi id kasir dulu.", "err"); $("in-kasir-id").focus(); return; }
    if (fisikTotal() === 0) { msg("└─ total fisik nol, isi denominasi dulu.", "err"); return; }
    saveMeta();
    $("receipt-pre").textContent = generateReceipt(width());
    $("print-preview").hidden = false;
    paintSizeBtns();
    msg("", "");
    $("receipt-pre").scrollIntoView({ block: "nearest" });
  }
  function hidePreview() { $("print-preview").hidden = true; }

  function doClear() {
    DENOMS.forEach(function (d) { S.qty[d] = 0; var i = $("q-" + d); if (i) i.value = ""; });
    S.expense = 0; S.note = ""; saveMeta();
    hidePreview(); msg("└─ bersih.", "");
    updateTotals();
  }
  // ——— kirim struk ke PC (kontrak prompt.md; PC bangun struk + cetak, tanpa GET status) ———
  function buildPayload() {
    var qty = {};
    DENOMS.forEach(function (d) { if (S.qty[d] > 0) qty[String(d)] = S.qty[d]; });
    return {
      kasir: $("in-kasir") ? $("in-kasir").value.trim() : "",
      branch: $("in-cabang") ? $("in-cabang").value.trim() : "",
      shift: $("in-shift") ? $("in-shift").value : "",
      user_id: ($("in-kasir-id") ? $("in-kasir-id").value.trim() : "") || "-",
      qty: qty,
      expense_amount: S.expense,
      expense_note: S.note,
      nontunai_amount: S.noncash, // dari sesi Live (Nontunai.total + Split.nontunai); 0 bila offline
      size: S.size,
    };
  }
  function setSendBusy(busy) {
    ["btn-print-send", "btn-print-send2"].forEach(function (id) {
      var b = $(id);
      if (b) b.disabled = !!busy;
    });
  }
  // printer bisa ada di PC mana pun: pilih tiap kirim (PC tersambung saja, terakhir dipakai tercentang).
  // Batal/tutup picker = tak ada POST /api/print terkirim.
  async function doSend(afterId) {
    var kasir = $("in-kasir") ? $("in-kasir").value.trim() : "";
    if (!kasir) { msg("└─ pilih/isi kasir dulu.", "err"); if ($("in-kasir")) $("in-kasir").focus(); return; }
    if ($("in-kasir-id") && !$("in-kasir-id").value.trim()) { msg("└─ isi id kasir dulu.", "err"); $("in-kasir-id").focus(); return; }
    if (fisikTotal() === 0) { msg("└─ total fisik nol, isi denominasi dulu.", "err"); return; }
    if (typeof Comp === "undefined" || !Comp.pick) { msg("└─ ui computer belum siap.", "err"); return; }
    var lu = Comps.lastUsed();
    Comp.pick({ title: "kirim ke pc", exclude: {}, preselect: lu ? lu.id : null, after: afterId || "print-actions" }, function (comps) {
      if (!comps || !comps.length) { msg("└─ tak ada PC dipilih: batal kirim.", "err"); return; }
      sendTo(comps[0]);
    });
  }
  async function sendTo(comp) {
    var my = ++S.seq; // basi: abaikan hasil bila sesi berganti di tengah kirim
    setSendBusy(true);
    msg("└─ mengirim ke " + comp.name + " ...", "");
    try { Comps.touch(comp.id); } catch (e) {}
    var r = await Lan.print(comp.base, buildPayload());
    setSendBusy(false); // selalu: jangan kunci tombol bila sesi berganti di tengah kirim
    if (my !== S.seq) return; // basi: hasil diabaikan, tombol sudah aktif lagi
    if (r.ok && r.data) {
      var t = (r.data.total != null) ? " · fisik " + rupiah(r.data.total) : "";
      var nt = (r.data.nontunai > 0) ? " · NT " + rupiah(r.data.nontunai) : "";
      msg("└─ tercetak di " + (comp.name + "/" + (r.data.printer || "printer")) + t + nt, "ok");
    } else {
      msg("└─ gagal: " + ((r && r.error) || "tanpa respon"), "err");
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!$("view-print")) return;
    bootMeta();
    renderDenoms();
    renderExpenseForm();
    paintSizeBtns();
    ["in-kasir", "in-kasir-id", "in-cabang", "in-shift"].forEach(function (id) {
      var el = $(id);
      // ponytail: input+change — ketikan tersimpan walau pindah tab tanpa blur
      if (el) { el.addEventListener("input", saveMeta); el.addEventListener("change", saveMeta); }
    });
    if ($("btn-print-preview")) $("btn-print-preview").addEventListener("click", doPreview);
    if ($("btn-print-clear")) $("btn-print-clear").addEventListener("click", doClear);
    // anchor per tombol: picker muncul tepat di bawah [kirim] yang dipencet
    if ($("btn-print-send")) $("btn-print-send").addEventListener("click", function () { doSend("print-actions"); });
    if ($("btn-print-send2")) $("btn-print-send2").addEventListener("click", function () { doSend("print-preview-actions"); });
    if ($("btn-print-back")) $("btn-print-back").addEventListener("click", hidePreview);
    if ($("btn-size-58")) $("btn-size-58").addEventListener("click", function () { S.size = "58"; saveMeta(); $("receipt-pre").textContent = generateReceipt(width()); paintSizeBtns(); });
    if ($("btn-size-80")) $("btn-size-80").addEventListener("click", function () { S.size = "80"; saveMeta(); $("receipt-pre").textContent = generateReceipt(width()); paintSizeBtns(); });
    if ($("btn-meta-edit")) $("btn-meta-edit").addEventListener("click", function () {
      S.metaOpen = true; saveMeta(); renderMeta();
      if ($("in-kasir")) $("in-kasir").focus();
    });
    if ($("btn-print-meta-close")) $("btn-print-meta-close").addEventListener("click", function () {
      if (!metaComplete()) { msg("└─ lengkapi kasir + id + cabang + shift dulu.", "err"); return; }
      S.metaOpen = false; saveMeta(); renderMeta(); msg("", "");
    });
    if ($("btn-print-meta-pull")) $("btn-print-meta-pull").addEventListener("click", function () {
      if (fillFromSetoran(true)) { saveMeta(); renderMeta(); msg("└─ detail diambil dari Setoran terbaru.", "ok"); }
      else msg("└─ cache Setoran kosong, login dulu.", "err");
    });
    var nav = $("nav-select");
    if (nav) nav.addEventListener("change", function (e) {
      if (e.target.value !== "print") return;
      fillFromSetoran(false); saveMeta(); renderMeta();
      refreshSys();
    });
    refreshSys();
    updateTotals();
  });

  return { refresh: refreshSys, preview: doPreview, _state: S };
})();
