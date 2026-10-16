package com.cashnote.mobile;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import androidx.core.content.ContextCompat;

import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

// ponytail: bridge tipis start/stop/openBatterySettings — tanpa state, tanpa event.
@CapacitorPlugin(
    name = "BgSync",
    permissions = @Permission(alias = "notif", strings = { Manifest.permission.POST_NOTIFICATIONS })
)
public class BgSyncPlugin extends Plugin {

    @PluginMethod
    public void start(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && getPermissionState("notif") != PermissionState.GRANTED) {
            requestPermissionForAlias("notif", call, "notifCb");
            return;
        }
        startSvc();
        call.resolve();
    }

    @PermissionCallback
    private void notifCb(PluginCall call) {
        if (getPermissionState("notif") == PermissionState.GRANTED) {
            startSvc();
            call.resolve();
        } else {
            call.reject("denied-notif");
        }
    }

    private void startSvc() {
        Context ctx = getContext();
        ContextCompat.startForegroundService(ctx, new Intent(ctx, BgSyncService.class));
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), BgSyncService.class));
        call.resolve();
    }

    @PluginMethod
    public void update(PluginCall call) {
        String text = call.getString("text", "Live sync jalan");
        Context ctx = getContext();
        Intent intent = new Intent(ctx, BgSyncService.class);
        intent.putExtra("text", text);
        ContextCompat.startForegroundService(ctx, intent); // aman: service sudah foreground, hanya antar teks
        call.resolve();
    }

    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        try {
            Context ctx = getContext();
            PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
            if (!pm.isIgnoringBatteryOptimizations(ctx.getPackageName())) {
                Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + ctx.getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(intent);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }
}
