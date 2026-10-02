package com.corenode.wordnew;

import android.app.Activity;
import android.content.pm.ActivityInfo;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Immersive playback: hides the status and navigation bars (a swipe shows them
 * for a moment) and optionally turns the screen to landscape; exit restores
 * both. The activity handles orientation changes itself (manifest
 * configChanges), so the page keeps its state.
 */
@CapacitorPlugin(name = "Immersive")
public class ImmersivePlugin extends Plugin {
    @PluginMethod
    public void enter(PluginCall call) {
        boolean landscape = call.getBoolean("landscape", true);
        Activity activity = getActivity();
        activity.runOnUiThread(() -> {
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(activity.getWindow(), activity.getWindow().getDecorView());
            controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            controller.hide(WindowInsetsCompat.Type.systemBars());
            if (landscape) activity.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
            call.resolve();
        });
    }

    @PluginMethod
    public void exit(PluginCall call) {
        Activity activity = getActivity();
        activity.runOnUiThread(() -> {
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(activity.getWindow(), activity.getWindow().getDecorView());
            controller.show(WindowInsetsCompat.Type.systemBars());
            activity.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
            call.resolve();
        });
    }
}
