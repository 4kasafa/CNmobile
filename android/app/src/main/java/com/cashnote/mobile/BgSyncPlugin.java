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

// ponytail: bridge tipis start(state)/stop/openBatterySettings — tanpa event.
// v1.6.0: JS tak lagi kirim teks notif; ia kirim state absolut, service yang polling + menulis notif.
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
        startSvc(call.getString("state", null));
        call.resolve();
    }

    @PermissionCallback
    private void notifCb(PluginCall call) {
        if (getPermissionState("notif") == PermissionState.GRANTED) {
            startSvc(call.getString("state", null));
            call.resolve();
        } else {
            call.reject("denied-notif");
        }
    }

    private void startSvc(String state) {
        Context ctx = getContext();
        Intent intent = new Intent(ctx, BgSyncService.class);
        if (state != null && !state.isEmpty()) intent.putExtra("state", state);
        ContextCompat.startForegroundService(ctx, intent);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), BgSyncService.class));
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
