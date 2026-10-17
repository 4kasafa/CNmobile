/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId: 'com.cashnote.mobile',
  appName: 'cnmobile',
  webDir: 'www',
  // LAN connector PC = http:// : WebView https://localhost butuh ini agar
  // fetch tidak diblokir mixed-content (CORS + cleartext saja tidak cukup).
  // Kunci HARUS "android" (root): native CapConfig membaca
  // android.allowMixedContent, bukan server.allowMixedContent.
  android: { allowMixedContent: true },
  // ponytail: default Capacitor = #ffffff -> WebView putih sesaat sebelum CSS cat.
  // App ini gelap (#000) sejak awal, samakan.
  backgroundColor: '#000000',
};

module.exports = config;
