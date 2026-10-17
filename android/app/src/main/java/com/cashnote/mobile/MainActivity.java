package com.cashnote.mobile;

import android.os.Bundle;
import android.view.View;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
// ponytail: daftarkan SEBELUM super.onCreate (bridgeBuilder dibekukan saat load)
@Override protected void onCreate(Bundle savedInstanceState) {
registerPlugin(BgSyncPlugin.class);
super.onCreate(savedInstanceState);
// Renderer WebView dibekukan Android saat app tak terlihat -> timer JS mati -> polling Live beku.
// API resmi anti-freeze: IMPORTANT + canBePaused=false.
if (getBridge() != null && getBridge().getWebView() != null) {
getBridge().getWebView().setRendererPriorityPolicy(android.webkit.WebView.RENDERER_PRIORITY_IMPORTANT, false);
}
}
// ponytail: Capacitor abaikan activity_main.xml — matikan glow/scrollbar di WebView bridge
@Override public void onStart() {
super.onStart();
if (getBridge() != null && getBridge().getWebView() != null) {
getBridge().getWebView().setOverScrollMode(View.OVER_SCROLL_NEVER);
getBridge().getWebView().setVerticalScrollBarEnabled(false);
getBridge().getWebView().setHorizontalScrollBarEnabled(false);
}
}
// ponytail: WebView tak terlihat -> Chromium throttle timer -> polling live.js mati.
// Paksa "terlihat" 1 detik setelah onStop (tundaan wajib: Android dispatch GONE sendiri
// setelah onStop, tanpa tundaan override kita tertimpa). Hanya saat bg sync ON.
@Override public void onStop() {
super.onStop();
if (BgSyncService.isRunning() && getBridge() != null && getBridge().getWebView() != null) {
final android.webkit.WebView wv = getBridge().getWebView();
new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(new Runnable() {
@Override public void run() { wv.dispatchWindowVisibilityChanged(View.VISIBLE); }
}, 1000);
}
}}
