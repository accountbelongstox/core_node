package com.corenode.wordnew;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;

public class ForegroundSyncService extends Service {
    static final String ACTION_STOP = "com.corenode.wordnew.foregroundsync.STOP";
    static final String EXTRA_TITLE = "title";
    static final String EXTRA_TEXT = "text";
    static final String EXTRA_CHANNEL_NAME = "channelName";
    private static final String CHANNEL_ID = "wordnew_sync";
    private static final int NOTIFICATION_ID = 7101;
    private static final String WAKE_LOCK_TAG = "wordnew:foregroundsync";
    private static final long MAX_ACTIVE_MS = 6L * 60 * 60 * 1000;

    private PowerManager.WakeLock wakeLock;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        boolean stop = intent == null || ACTION_STOP.equals(intent.getAction());
        // A start through startForegroundService must reach startForeground even when it only stops,
        // or the system kills the app (ForegroundServiceDidNotStartInTimeException).
        enterForeground(buildNotification(
            stop ? null : intent.getStringExtra(EXTRA_TITLE),
            stop ? null : intent.getStringExtra(EXTRA_TEXT),
            stop ? null : intent.getStringExtra(EXTRA_CHANNEL_NAME)
        ));
        if (stop) {
            shutdown();
            return START_NOT_STICKY;
        }
        acquireWakeLock();
        return START_NOT_STICKY;
    }

    private void enterForeground(Notification notification) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    /** Android 15 ends a dataSync service after its time budget: release everything. */
    @Override
    public void onTimeout(int startId, int fgsType) {
        shutdown();
    }

    @Override
    public void onTimeout(int startId) {
        shutdown();
    }

    @Override
    public void onDestroy() {
        releaseWakeLock();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void shutdown() {
        releaseWakeLock();
        stopForeground(true);
        stopSelf();
    }

    private void acquireWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) return;
        PowerManager manager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (manager == null) return;
        wakeLock = manager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, WAKE_LOCK_TAG);
        wakeLock.setReferenceCounted(false);
        wakeLock.acquire(MAX_ACTIVE_MS);
    }

    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        wakeLock = null;
    }

    private Notification buildNotification(String title, String text, String channelName) {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && manager != null) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                channelName == null || channelName.isEmpty() ? CHANNEL_ID : channelName,
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setShowBadge(false);
            manager.createNotificationChannel(channel);
        }
        Intent launch = new Intent(this, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent content = PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setContentTitle(title == null ? "" : title)
            .setContentText(text == null ? "" : text)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)
            .setContentIntent(content)
            .build();
    }
}
