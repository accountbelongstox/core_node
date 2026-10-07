// PY-REF: none (DOT-only)
using DotApps.d3d4tester.Core.Battlenet;
using DotCore.Foundations;
using C = DotApps.d3d4tester.Core.Battlenet.BattlenetConstants;
using DotApps.d3d4tester.Constants;

namespace DotApps.d3d4tester.Core.Flow;

/// <summary>
/// Battle.net guard rules on the flow step, reading the probed client state from GameInterfaceData:
/// 1) ensure region first — the UI shows another region than the global choice -> restart with --setregion;
/// 2) abnormal timeout — connecting / disconnected / login failed / loading / sleeping / unknown longer than the configured time -> restart;
/// 3) login timeout — any login screen, browser wait or logging in longer than the configured time -> restart.
/// Logging in / security check / e-mail wait / code entry wait for the user and are never restarted (BattlenetManager.Close also refuses).
/// Each rule can be switched off in config (battlenet.*). A restart resets the B blocks so the guard starts over from login.
/// While D3 runs, or a flow job (D / E block) drives the clients, Battle.net is reused as is and no rule restarts it.
/// </summary>
public static class BattlenetStateWatchdog
{
    private const string LogTag = "[BNWatchdog]";
    private const double RegionSwitchCooldownSec = 120.0;

    private static readonly BattlenetClientState[] AbnormalStates =
    {
        BattlenetClientState.AccountOffline, BattlenetClientState.Connecting, BattlenetClientState.Disconnected, BattlenetClientState.LoginFailed,
        BattlenetClientState.Loading, BattlenetClientState.LoadingAccount, BattlenetClientState.Sleeping, BattlenetClientState.Unknown,
    };

    private static readonly BattlenetClientState[] LoginStates =
    {
        BattlenetClientState.LoginCn, BattlenetClientState.LoginCnWeb, BattlenetClientState.LoginEmail,
        BattlenetClientState.LoginPassword, BattlenetClientState.LoginAsia, BattlenetClientState.BrowserLoginWait,
    };

    private static DateTime? _abnormalSinceUtc;
    private static DateTime? _loginSinceUtc;
    private static DateTime _lastRegionSwitchUtc = DateTime.MinValue;

    public static void Tick()
    {
        var s = GameInterfaceData.Instance.GetStateSnapshot();
        var now = DateTime.UtcNow;
        if (BattlenetClientStatus.IsWaitingForUserState(s.BattlenetClientState))
        {
            _abnormalSinceUtc = null;
            _loginSinceUtc = null;
            if (s.BattlenetClientState == BattlenetClientState.SecurityCheck)
                BrowserLoginAutomation.RunOnePoll();
            return;
        }
        if (s.D3Running || RosbotFlowHost.Current?.IsFlowJobBusy == true)
        {
            _abnormalSinceUtc = null;
            _loginSinceUtc = null;
            return;
        }
        if (s.BattlenetClientState == BattlenetClientState.Popup)
        {
            BattlenetPopupDismiss.TryCloseModal();
            return;
        }
        if (EnsureRegion(s.BattlenetUiRegion, now)) return;

        _abnormalSinceUtc = AbnormalStates.Contains(s.BattlenetClientState) && s.BattlenetWindowFound ? _abnormalSinceUtc ?? now : null;
        _loginSinceUtc = LoginStates.Contains(s.BattlenetClientState) ? _loginSinceUtc ?? now : null;

        if (_abnormalSinceUtc is { } a && RosbotFlowHost.GetConfig(ConfigKeys.BattlenetAbnormalRestartEnabled, true)
            && (now - a).TotalSeconds >= RosbotFlowHost.GetConfig(ConfigKeys.BattlenetAbnormalTimeoutSec, C.AbnormalTimeoutSecDefault))
        {
            Restart($"state {s.BattlenetClientState} for {(int)(now - a).TotalSeconds}s (abnormal timeout)");
            return;
        }
        if (_loginSinceUtc is { } l && RosbotFlowHost.GetConfig(ConfigKeys.BattlenetLoginRestartEnabled, true)
            && (now - l).TotalSeconds >= RosbotFlowHost.GetConfig(ConfigKeys.BattlenetLoginTimeoutSec, C.LoginTimeoutSecDefault))
        {
            Restart($"login not finished for {(int)(now - l).TotalSeconds}s ({s.BattlenetClientState}, login timeout)");
        }
    }

    /// <summary>First rule: the client must run in the user's global region. True when a region switch was started.</summary>
    private static bool EnsureRegion(string? uiRegion, DateTime now)
    {
        string? wanted = BattlenetManager.Instance.GetConfiguredRegion();
        if (wanted == null || uiRegion == null || uiRegion == wanted) return false;
        if ((now - _lastRegionSwitchUtc).TotalSeconds < RegionSwitchCooldownSec) return false;
        _lastRegionSwitchUtc = now;
        ColorPrinter.Yellow($"{LogTag} client shows region {uiRegion}, global region is {wanted} -> restart with --setregion");
        ResetTimersAndBlocks();
        BattlenetManager.Instance.RestartWithRegion(wanted);
        return true;
    }

    private static void Restart(string reason)
    {
        ColorPrinter.Yellow($"{LogTag} {reason} -> restart Battle.net");
        ResetTimersAndBlocks();
        string? region = BattlenetManager.Instance.GetConfiguredRegion();
        if (region != null) BattlenetManager.Instance.RestartWithRegion(region);
        else BattlenetManager.Instance.Restart();
    }

    private static void ResetTimersAndBlocks()
    {
        _abnormalSinceUtc = null;
        _loginSinceUtc = null;
        BnBlockState.Reset(forBnOnly: true);
        BnBlockState.Reset(forBnOnly: false);
    }
}
