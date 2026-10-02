package com.corenode.wordnew;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Keeps the app's network alive while a long sync runs with the app in the background: a
 * dataSync foreground service with a low-importance notification (texts come from JS).
 */
@CapacitorPlugin(
    name = "ForegroundSync",
    permissions = { @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }) }
)
public class ForegroundSyncPlugin extends Plugin {
    @PluginMethod
    public void start(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "startAfterPermission");
            return;
        }
        launch(call);
    }

    /** The service runs with or without the notification permission; a denial only hides the notification. */
    @PermissionCallback
    private void startAfterPermission(PluginCall call) {
        launch(call);
    }

    @PluginMethod
    public void update(PluginCall call) {
        launch(call);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Context context = getContext();
        try {
            context.stopService(new Intent(context, ForegroundSyncService.class));
            call.resolve();
        } catch (RuntimeException error) {
            call.reject(error.getMessage());
        }
    }

    private void launch(PluginCall call) {
        Context context = getContext();
        Intent intent = new Intent(context, ForegroundSyncService.class)
            .putExtra(ForegroundSyncService.EXTRA_TITLE, call.getString("title", ""))
            .putExtra(ForegroundSyncService.EXTRA_TEXT, call.getString("text", ""))
            .putExtra(ForegroundSyncService.EXTRA_CHANNEL_NAME, call.getString("channelName", ""));
        try {
            ContextCompat.startForegroundService(context, intent);
            call.resolve();
        } catch (RuntimeException error) {
            call.reject(error.getMessage());
        }
    }
}
