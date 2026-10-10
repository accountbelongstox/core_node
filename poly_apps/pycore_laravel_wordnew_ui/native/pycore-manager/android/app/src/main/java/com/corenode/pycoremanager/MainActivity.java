package com.corenode.pycoremanager;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.corenode.wordnew.AppUpdatePlugin;
import com.corenode.wordnew.DeviceStoragePlugin;
import com.corenode.wordnew.ForegroundSyncPlugin;
import com.corenode.wordnew.ImmersivePlugin;
import com.corenode.wordnew.LanInfoPlugin;
import com.corenode.wordnew.ProtocolHttpPlugin;
import com.corenode.wordnew.ShareReceiverPlugin;
import com.corenode.wordnew.TextRecognitionPlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ProtocolHttpPlugin.class);
        registerPlugin(DeviceStoragePlugin.class);
        registerPlugin(LanInfoPlugin.class);
        registerPlugin(ImmersivePlugin.class);
        registerPlugin(ForegroundSyncPlugin.class);
        registerPlugin(AppUpdatePlugin.class);
        registerPlugin(TextRecognitionPlugin.class);
        registerPlugin(ShareReceiverPlugin.class);
        super.onCreate(savedInstanceState);
        bridge.getWebView().setWebChromeClient(new GalleryChromeClient(bridge));
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    }
}
