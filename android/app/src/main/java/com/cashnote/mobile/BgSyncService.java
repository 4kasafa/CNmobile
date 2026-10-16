package com.cashnote.mobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;

// ponytail: service minimal agar polling JS tetap jalan saat layar mati —
// hanya notifikasi + wake lock, tanpa logika sync di native.
public class BgSyncService extends Service {
    public static final String CHANNEL_ID = "live_sync_v2";
    public static final String OLD_CHANNEL_ID = "live_sync";
    public static final int NOTIF_ID = 41;

    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;
    private static boolean running = false; // cegah update membangunkan service yang sudah mati

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String upd = intent == null ? null : intent.getStringExtra("text");
        if (upd != null) {
            if (running) update(upd);
            return START_STICKY;
        }
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            nm.deleteNotificationChannel(OLD_CHANNEL_ID); // channel lama LOW tak bisa diubah, ganti baru
            NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Live sync", NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription("Sinkron Live kasir");
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        Notification notif = buildNotif("Live sync jalan");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIF_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        } else {
            startForeground(NOTIF_ID, notif);
        }
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "CNmobile:BgSync");
        wakeLock.acquire();
        WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        if (wm != null) {
            wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "CNmobile:BgSync");
            wifiLock.acquire();
        }
        running = true;
        return START_STICKY;
    }

    // ponytail: satu builder untuk awal + update — teks beda, ID sama, bunyi sekali saja.
    private Notification buildNotif(String text) {
        PendingIntent pi = null;
        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (open != null) {
            open.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            pi = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        }
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("CNmobile")
                .setContentText(text)
                .setSmallIcon(getApplicationInfo().icon)
                .setOngoing(true)
                .setShowWhen(true)
                .setOnlyAlertOnce(true);
        if (pi != null) b.setContentIntent(pi);
        return b.build();
    }

    public void update(String text) {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        nm.notify(NOTIF_ID, buildNotif(text == null || text.isEmpty() ? "Live sync jalan" : text));
    }

    @Override
    public void onDestroy() {
        running = false;
        if (wakeLock != null && wakeLock.isHeld()) { wakeLock.release(); wakeLock = null; }
        if (wifiLock != null && wifiLock.isHeld()) { wifiLock.release(); wifiLock = null; }
        stopForeground(true);
        super.onDestroy();
    }
}
