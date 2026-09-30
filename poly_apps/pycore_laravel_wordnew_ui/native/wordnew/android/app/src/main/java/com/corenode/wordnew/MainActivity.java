package com.corenode.wordnew;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ProtocolHttpPlugin.class);
        registerPlugin(DeviceStoragePlugin.class);
        registerPlugin(LanInfoPlugin.class);
        super.onCreate(savedInstanceState);
        // Edge-to-edge on every API level: the Capacitor SystemBars inset listener is the
        // single owner of IME insets (it pads the decor view), so the window never pans.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    }
}
