package com.cashnote.mobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

// ponytail: v1.6.0 — service jadi pemilik polling. Renderer WebView di-freeze Android
// saat app tak terlihat (bukti v1.5.3: "[beat +7 · 250d]" dari 1 jam background), jadi
// timer JS tak bisa diandalkan. Polling pindah ke sini; WebView tetap pemilik data
// (localStorage) dan hanya kirim state absolut untuk Keeps notifikasi akurat.
public class BgSyncService extends Service {
    public static final String CHANNEL_ID = "live_sync_v2";
    public static final String OLD_CHANNEL_ID = "live_sync";
    public static final int NOTIF_ID = 41;

    private static final String PREF_STATE = "state";
    private static final long POLL_MS = 2000;
    private static final int HTTP_MS = 3000;

    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;
    private ScheduledExecutorService exec;
    private static boolean running = false; // cegah update membangunkan service yang sudah mati

    // count/total/last: state absolut dari JS + delta tick. Satu lock untuk tick & applyState.
    private long count, total, lastTotal;
    private String lastTime = "";
    private JSONArray pcs = new JSONArray();
    private SharedPreferences prefs;

    // ponytail: MainActivity butuh tahu bg aktif/tidak -> WebView boleh diam.
    public static boolean isRunning() {
        return running;
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String state = intent == null ? null : intent.getStringExtra("state");
        if (running) {
            // service hidup: JS kirim state baru (reseed) atau intent kosong (START_STICKY).
            if (state != null) applyState(state);
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
        prefs = getSharedPreferences("cnmobile_bg", MODE_PRIVATE);
        running = true;
        if (state != null) {
            applyState(state);
        } else if (prefs.getString(PREF_STATE, null) != null) {
            applyState(prefs.getString(PREF_STATE, "")); // restart START_STICKY: lanjut dari state tersimpan
        }
        ensureExec();
        return START_STICKY;
    }

    // ponytail: executor single-thread, fixedDelay 2s -> tick tak menumpuk walau fetch lambat.
    private void ensureExec() {
        if (exec != null && !exec.isShutdown()) return;
        exec = Executors.newSingleThreadScheduledExecutor();
        exec.scheduleWithFixedDelay(new Runnable() {
            @Override public void run() { tick(); }
        }, 1000, POLL_MS, TimeUnit.MILLISECONDS);
    }

    // JS kirim {pcs:[{comp_id,base,since,alive}],count,total,lastTotal,lastTime} — total absolut.
    private synchronized void applyState(String json) {
        try {
            JSONObject o = new JSONObject(json);
            JSONArray p = o.optJSONArray("pcs");
            if (p != null) pcs = p;
            count = o.optLong("count", count);
            total = o.optLong("total", total);
            lastTotal = o.optLong("lastTotal", lastTotal);
            String lt = o.optString("lastTime", lastTime);
            lastTime = lt == null ? "" : lt;
            persist();
            notifyText();
        } catch (Exception e) {
            // state rusak: biarkan state lama, tick tetap jalan
        }
    }

    // satu tick: semua PC bergantian, lalu tulis notif. gagal 1 PC tak ganggu PC lain.
    private synchronized void tick() {
        try {
            int alive = 0;
            long newCount = count, newTotal = total, newLast = lastTotal;
            String newTime = lastTime;
            for (int i = 0; i < pcs.length(); i++) {
                JSONObject pc = pcs.optJSONObject(i);
                if (pc == null) continue;
                String base = pc.optString("base", "");
                long since = pc.optLong("since", 0);
                if (base.isEmpty()) continue;
                JSONArray rows = fetch(base, since);
                if (rows == null) {
                    pc.put("alive", 0);
                    continue;
                }
                pc.put("alive", 1);
                alive++;
                newCount += rows.length();
                for (int r = 0; r < rows.length(); r++) {
                    JSONObject row = rows.optJSONObject(r);
                    if (row == null) continue;
                    newTotal += row.optLong("total", 0);
                    long id = row.optLong("id", 0);
                    if (id > since) pc.put("since", id);
                }
                if (rows.length() > 0) {
                    JSONObject lastRow = rows.optJSONObject(rows.length() - 1);
                    if (lastRow != null) {
                        newLast = lastRow.optLong("total", 0);
                        String ca = lastRow.optString("created_at", "");
                        if (ca.length() >= 16) newTime = ca.substring(11, 16);
                    }
                }
            }
            count = newCount; total = newTotal; lastTotal = newLast; lastTime = newTime;
            if (pcs.length() > 0) notifyText(alive == pcs.length());
            persist();
        } catch (Exception e) {
            // satu tick gagal = coba lagi 2 detik lagi
        }
    }

    // GET {base}/api/transactions?since=N&limit=50 -> JSONArray baris, atau null bila gagal/tidak terjangkau.
    private JSONArray fetch(String base, long since) {
        HttpURLConnection cn = null;
        try {
            URL url = new URL(base.replaceAll("/+$", "") + "/api/transactions?since=" + since + "&limit=50");
            cn = (HttpURLConnection) url.openConnection();
            cn.setRequestMethod("GET");
            cn.setConnectTimeout(HTTP_MS);
            cn.setReadTimeout(HTTP_MS);
            if (cn.getResponseCode() != 200) return null;
            InputStream in = cn.getInputStream();
            BufferedReader rd = new BufferedReader(new InputStreamReader(in, "UTF-8"));
            StringBuilder sb = new StringBuilder();
            String ln;
            while ((ln = rd.readLine()) != null) sb.append(ln);
            String body = sb.toString().trim();
            if (body.startsWith("[")) return new JSONArray(body);
            return new JSONArray(new JSONObject(body).optJSONArray("rows")); // ponytail: bentuk {rows:[..]} juga sah
        } catch (Exception e) {
            return null;
        } finally {
            if (cn != null) cn.disconnect();
        }
    }

    private void persist() {
        if (prefs == null) return;
        try {
            JSONObject o = new JSONObject();
            o.put("pcs", pcs);
            o.put("count", count);
            o.put("total", total);
            o.put("lastTotal", lastTotal);
            o.put("lastTime", lastTime);
            prefs.edit().putString(PREF_STATE, o.toString()).apply();
        } catch (Exception e) {
            // persist gagal = state tetap di memori, tick lanjut
        }
    }

    // format sama dgn pushBg lama: "N tx · Rp X · terakhir Rp Y HH:MM · [ok|PUTUS]"
    private void notifyText() { notifyText(pcs.length() > 0 && allAlive()); }
    private void notifyText(boolean ok) {
        StringBuilder sb = new StringBuilder();
        sb.append(count).append(" tx · ").append(rp(total));
        if (lastTime != null && !lastTime.isEmpty()) sb.append(" · terakhir ").append(rp(lastTotal)).append(" ").append(lastTime);
        sb.append(ok ? " · [ok]" : " · [PUTUS]");
        update(sb.toString());
    }
    private boolean allAlive() {
        for (int i = 0; i < pcs.length(); i++) {
            JSONObject pc = pcs.optJSONObject(i);
            if (pc != null && pc.optInt("alive", 0) == 0) return false;
        }
        return pcs.length() > 0;
    }

    // ponytail: cermin rupiah() live.js (pemisah ribuan titik).
    private static String rp(long n) {
        if (n == 0) return "Rp 0";
        boolean neg = n < 0;
        String s = String.valueOf(Math.abs(n));
        StringBuilder out = new StringBuilder();
        int c = 0;
        for (int i = s.length() - 1; i >= 0; i--) {
            out.append(s.charAt(i));
            if (++c % 3 == 0 && i > 0) out.append('.');
        }
        return (neg ? "Rp -" : "Rp ") + out.reverse();
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

    private void update(String text) {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        nm.notify(NOTIF_ID, buildNotif(text == null || text.isEmpty() ? "Live sync jalan" : text));
    }

    @Override
    public void onDestroy() {
        running = false;
        if (exec != null) { exec.shutdownNow(); exec = null; }
        if (wakeLock != null && wakeLock.isHeld()) { wakeLock.release(); wakeLock = null; }
        if (wifiLock != null && wifiLock.isHeld()) { wifiLock.release(); wifiLock = null; }
        stopForeground(true);
        super.onDestroy();
    }
}