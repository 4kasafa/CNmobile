/* Port gas_service.py — vanilla fetch, global `Gas`. Tanpa modul agar jalan via file://. */
var Gas = (function () {
  "use strict";
  // constants.py:25
  var GAS_URL_KASIR = "https://script.google.com/macros/s/AKfycbw95Qnt8U-GQWt04AeG3sBpBfcBleNLfPMSr0arOXtGDH2iZiMDVoWHyBmNpW8Shejo/exec";
  var TIMEOUT_MS = 20000;

  // gas_service.py:14-33 call_api
  async function callApi(action, args) {
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS);
    try {
      var res = await fetch(GAS_URL_KASIR, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: action, args: args }),
        signal: ctrl.signal,
      });
      return await res.json();
    } catch (e) {
      return { success: false, message: "Koneksi gagal: " + (e && e.message || e) };
    } finally {
      clearTimeout(t);
    }
  }

  // gas_service.py:35-62 login (deviceId: "CNmobile" untuk HP)
  async function login(email, password) {
    var res = await callApi("checkLogin", [{
      email: String(email || "").trim(),
      password: password,
      deviceId: "CNmobile",
    }]);
    if (!res || !res.success) {
      return { success: false, message: (res && res.message) || "Email atau password salah!" };
    }
    var m = /token=([^&]+)/.exec(res.redirectUrl || "");
    var token = m ? decodeURIComponent(m[1]) : ("token_" + Date.now());
    return { success: true, token: token, user: res.user };
  }

  // gas_service.py:64-95 get_dashboard_data + rumus kurang/lebih (76-94)
  async function getDashboardData(token, cashierName) {
    var res = await callApi("getDashboardData", [token, cashierName || ""]);
    if (!res || !res.success) {
      return { success: false, message: (res && (res.error || res.message)) || "Gagal memuat data transaksi", data: [] };
    }
    var data = res.data || [];
    var totalKurang = 0, totalLebih = 0;
    for (var i = 0; i < data.length; i++) {
      var s = Number((data[i] || {}).jumlahSelisih) || 0;
      if (s < 0) totalKurang += Math.abs(s);
      else if (s > 0) totalLebih += s;
    }
    return {
      success: true,
      total_transaksi: res.totalTransaksi != null ? res.totalTransaksi : data.length,
      total_kurang: totalKurang,
      total_lebih: totalLebih,
      data: data,
    };
  }

  // gas_service.py:97-123 fetch_kasir_summary
  async function fetchKasirSummary(email, password, cashierName) {
    var l = await login(email, password);
    if (!l.success) return { success: false, stage: "login", message: l.message };
    var d = await getDashboardData(l.token, cashierName);
    if (!d.success) return { success: false, stage: "fetch", message: d.message };
    d.token = l.token;
    d.user = l.user;
    return d;
  }

  return { callApi: callApi, login: login, getDashboardData: getDashboardData, fetchKasirSummary: fetchKasirSummary };
})();
