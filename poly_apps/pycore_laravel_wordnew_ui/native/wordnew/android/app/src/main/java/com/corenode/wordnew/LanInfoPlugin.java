package com.corenode.wordnew;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.LinkAddress;
import android.net.LinkProperties;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.RouteInfo;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.net.Inet4Address;
import java.net.InetAddress;

/**
 * The phone's local network: IPv4 addresses with prefix length and the default
 * gateway of the active network (Wi-Fi first), for the LAN pycore scan.
 */
@CapacitorPlugin(name = "LanInfo")
public class LanInfoPlugin extends Plugin {
    @PluginMethod
    public void current(PluginCall call) {
        ConnectivityManager manager = getContext().getSystemService(ConnectivityManager.class);
        JSObject result = new JSObject();
        JSArray addresses = new JSArray();
        String gateway = "";
        boolean wifi = false;
        Network network = manager == null ? null : manager.getActiveNetwork();
        LinkProperties properties = network == null ? null : manager.getLinkProperties(network);
        NetworkCapabilities capabilities = network == null ? null : manager.getNetworkCapabilities(network);
        if (capabilities != null) {
            wifi = capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
                || capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET);
        }
        if (properties != null) {
            for (LinkAddress link : properties.getLinkAddresses()) {
                InetAddress address = link.getAddress();
                if (address instanceof Inet4Address && !address.isLoopbackAddress()) {
                    JSObject entry = new JSObject();
                    entry.put("address", address.getHostAddress());
                    entry.put("prefixLength", link.getPrefixLength());
                    addresses.put(entry);
                }
            }
            for (RouteInfo route : properties.getRoutes()) {
                InetAddress next = route.getGateway();
                if (route.isDefaultRoute() && next instanceof Inet4Address) {
                    gateway = next.getHostAddress();
                    break;
                }
            }
        }
        result.put("addresses", addresses);
        result.put("gateway", gateway);
        result.put("lan", wifi);
        call.resolve(result);
    }
}
