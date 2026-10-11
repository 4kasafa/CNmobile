/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId: 'com.cashnote.mobile',
  appName: 'cnmobile',
  webDir: 'www',
  // LAN connector PC = http:// : WebView https://localhost butuh ini agar
  // fetch tidak diblokir mixed-content (CORS + cleartext saja tidak cukup).
  server: { allowMixedContent: true },
};

module.exports = config;
