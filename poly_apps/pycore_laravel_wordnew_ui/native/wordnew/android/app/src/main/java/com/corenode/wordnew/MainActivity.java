package com.corenode.wordnew;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ProtocolHttpPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
