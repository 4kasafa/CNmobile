package com.cashnote.mobile;

import android.os.Bundle;
import android.view.View;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
// ponytail: daftarkan SEBELUM super.onCreate (bridgeBuilder dibekukan saat load)
@Override protected void onCreate(Bundle savedInstanceState) {
registerPlugin(BgSyncPlugin.class);
super.onCreate(savedInstanceState);
}
// ponytail: Capacitor abaikan activity_main.xml — matikan glow/scrollbar di WebView bridge
@Override public void onStart() {
super.onStart();
if (getBridge() != null && getBridge().getWebView() != null) {
getBridge().getWebView().setOverScrollMode(View.OVER_SCROLL_NEVER);
getBridge().getWebView().setVerticalScrollBarEnabled(false);
getBridge().getWebView().setHorizontalScrollBarEnabled(false);
}
}}
