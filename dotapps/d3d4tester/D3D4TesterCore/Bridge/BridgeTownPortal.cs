// PY-REF: none (DOT-only)
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core.Flow;
using DotCore.Foundations;
using DotCore.Utils.Input;

namespace DotApps.d3d4tester.Core.Bridge;

/// <summary>
/// The single town portal key path (the plugin API cannot cast the portal): bring D3 to the front and press the configured key
/// (rosbot.bridge_follow_town_portal_key, default t) under the GameControl lease. Used by "pause + stay in town", the trigger action
/// "town portal" and, driven by the 1 s TickDriver, whenever the plugin reports needs_town: town standby is outside town (once per
/// StandbyRetryMs until the hero is in town; a cast interrupted by a hit is pressed again) or follow mode lost its target outside
/// town (once per FollowRetryMs; in town the plugin then uses the target's banner).
/// </summary>
public static class BridgeTownPortal
{
    private const string LogTag = "[BridgeTownPortal]";
    /// <summary>Plugin follow / standby state: the hero must go to town.</summary>
    public const string StateNeedsTown = "needs_town";
    private const int FollowRetryMs = 15000;
    private const int StandbyRetryMs = 6000;
    private const int LeaseWaitMs = 5000;
    private const string LeaseFollow = "follow town portal";
    private const string LeaseStandby = "standby town portal";

    private static DateTime _lastPressUtc = DateTime.MinValue;
    private static int _installed;

    public static void Install()
    {
        if (Interlocked.Exchange(ref _installed, 1) == 1) return;
        TickDriver.Instance.RegisterEveryTick(OnTick);
    }

    /// <summary>Configured town portal key (one setting for follow, standby and the trigger action).</summary>
    public static string Key =>
        RosbotFlowHost.GetConfig(ConfigKeys.BridgeFollowTownPortalKey, ConfigKeys.BridgeFollowTownPortalKeyDefault) is { Length: > 0 } key
            ? key : ConfigKeys.BridgeFollowTownPortalKeyDefault;

    /// <summary>Activate D3 and press the town portal key under the lease; false when D3 / the lease / the key is not available.</summary>
    public static bool Press(string actor, int leaseWaitMs = LeaseWaitMs)
    {
        using var lease = GameControl.TryAcquire(actor, leaseWaitMs);
        if (lease == null) return false;
        if (!D3Manager.Instance.ActivateWindow())
        {
            ColorPrinter.Yellow($"{LogTag} {actor}: D3 window not activated");
            return false;
        }
        bool sent = ClickHandler.Instance.PressKey(Key);
        ColorPrinter.Blue($"{LogTag} {actor}: town portal key '{Key}' {(sent ? "sent" : "not sent")}");
        return sent;
    }

    private static void OnTick(IFlowTick tick)
    {
        var snapshot = GameInterfaceData.Instance.GetStateSnapshot();
        if (!snapshot.RosbotBridgeFresh || snapshot.RosbotBridge is not { InGame: true, Dead: false } bridge) return;
        bool standby = bridge is { StandbyEnabled: true, StandbyState: StateNeedsTown };
        bool follow = bridge is { FollowEnabled: true, FollowState: StateNeedsTown };
        if (!standby && !follow) return;
        var now = DateTime.UtcNow;
        if ((now - _lastPressUtc).TotalMilliseconds < (standby ? StandbyRetryMs : FollowRetryMs)) return;
        _lastPressUtc = now;
        Press(standby ? LeaseStandby : LeaseFollow, 0);
    }
}
