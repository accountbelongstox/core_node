// PY-REF: none (DOT-only)
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core.Flow;
using DotCore.Foundations;
using DotCore.Utils.Input;

namespace DotApps.d3d4tester.Core.Bridge;

/// <summary>
/// Follow mode helper for what the plugin API cannot do: when the bridge plugin follows a party member, lost him outside town and
/// reports needs_town, bring D3 to the front and press the town portal key (rosbot.bridge_follow_town_portal_key, default t), at most
/// once per RetryMs; in town the plugin then uses the leader's banner. Driven by the 1 s TickDriver.
/// </summary>
public static class BridgeFollowTownPortal
{
    private const string LogTag = "[BridgeFollow]";
    public const string StateNeedsTown = "needs_town";
    private const int RetryMs = 15000;
    private const int ActivateSettleMs = 300;

    private static DateTime _lastPressUtc = DateTime.MinValue;
    private static int _installed;

    public static void Install()
    {
        if (Interlocked.Exchange(ref _installed, 1) == 1) return;
        TickDriver.Instance.RegisterEveryTick(OnTick);
    }

    private static void OnTick(IFlowTick tick)
    {
        var snapshot = GameInterfaceData.Instance.GetStateSnapshot();
        if (snapshot.RosbotBridge is not { FollowEnabled: true, FollowState: StateNeedsTown } || !snapshot.RosbotBridgeFresh) return;
        var now = DateTime.UtcNow;
        if ((now - _lastPressUtc).TotalMilliseconds < RetryMs) return;
        _lastPressUtc = now;
        string key = RosbotFlowHost.GetConfig(ConfigKeys.BridgeFollowTownPortalKey, ConfigKeys.BridgeFollowTownPortalKeyDefault) ?? ConfigKeys.BridgeFollowTownPortalKeyDefault;
        IntPtr d3 = D3WindowFinder.FindFirstHandle();
        if (d3 == IntPtr.Zero || !NativeWindowHelper.ActivateWindow(d3))
        {
            ColorPrinter.Yellow($"{LogTag} leader lost outside town, D3 window not activated");
            return;
        }
        Thread.Sleep(ActivateSettleMs);
        bool sent = ClickHandler.Instance.PressKey(key);
        ColorPrinter.Blue($"{LogTag} leader lost outside town, town portal key '{key}' {(sent ? "sent" : "not sent")}");
    }
}
