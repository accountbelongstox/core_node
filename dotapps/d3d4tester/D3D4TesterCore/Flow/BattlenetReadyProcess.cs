// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/rosbot_flow_battlenet.py
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core.Battlenet;
using DotCore.Foundations;
using C = DotApps.d3d4tester.Core.Battlenet.BattlenetConstants;

namespace DotApps.d3d4tester.Core.Flow;

/// <summary>Outcome of <see cref="BattlenetReadyProcess.Run"/>.</summary>
public enum BattlenetReadyResult
{
    /// <summary>Logged-in main UI (or a game is starting): reuse the client.</summary>
    Ready,

    /// <summary>battlenet.battlenet_path is not configured.</summary>
    NoPath,
}

/// <summary>
/// [B] Battle.net ready process, one sequential loop on the exclusive client-state probe (BattlenetClientStateDetector), run until the
/// client is logged in. Logged in -> reused as is. Not running -> start. Hidden in the tray -> shown again (never closed). Login
/// screens -> automatic login (CN agree + NetEase + web login, Asia fill + submit, browser / popup login). Logging in, security check,
/// verification code -> wait for the user, never restarted. Wrong region -> restart with --setregion. Disconnected / login failed, or
/// an abnormal (connecting, loading, sleeping, offline, unknown) or login state longer than the configured timeouts -> restart.
/// One run at a time: the flow runner and the Battle.net guard share <see cref="Gate"/>.
/// </summary>
public static class BattlenetReadyProcess
{
    private const string LogTag = "[B]";

    private static readonly object Gate = new();

    private static readonly BattlenetClientState[] AbnormalStates =
    {
        BattlenetClientState.AccountOffline, BattlenetClientState.Connecting, BattlenetClientState.Loading,
        BattlenetClientState.LoadingAccount, BattlenetClientState.Sleeping, BattlenetClientState.Unknown,
    };

    private static readonly BattlenetClientState[] LoginStates =
    {
        BattlenetClientState.LoginCn, BattlenetClientState.LoginCnWeb, BattlenetClientState.LoginEmail,
        BattlenetClientState.LoginPassword, BattlenetClientState.LoginAsia, BattlenetClientState.BrowserLoginWait,
    };

    private static DateTime _lastRegionSwitchUtc = DateTime.MinValue;
    private static volatile bool _running;

    /// <summary>True while a run probes the client itself (other probes stand aside).</summary>
    public static bool IsRunning => _running;

    /// <summary>
    /// Run until Battle.net is ready. activate=false (Battle.net guard) never brings windows to front except where a login step must.
    /// Throws <see cref="OperationCanceledException"/> when the context stops.
    /// </summary>
    public static BattlenetReadyResult Run(FlowContext ctx, bool activate)
    {
        while (!System.Threading.Monitor.TryEnter(Gate, 250))
            ctx.ThrowIfStopped();
        try
        {
            _running = true;
            return RunLocked(ctx, activate);
        }
        finally
        {
            _running = false;
            GameInterfaceData.Instance.SetBattlenetWakingUp(false);
            System.Threading.Monitor.Exit(Gate);
        }
    }

    /// <summary>Probe the client once and publish window + state to GameInterfaceData (UI follows).</summary>
    public static BattlenetClientStatus Probe()
    {
        var status = BattlenetClientStateDetector.Detect();
        var game = GameInterfaceData.Instance;
        bool changed = game.SetBattlenetWindowFound(BattlenetManager.Instance.HasWindow());
        changed |= game.SetBattlenetClientStatus(status);
        if (changed) game.NotifyCallbacks();
        return status;
    }

    private static BattlenetReadyResult RunLocked(FlowContext ctx, bool activate)
    {
        var bn = BattlenetManager.Instance;
        if (bn.GetPath() == null)
        {
            ColorPrinter.Yellow($"{LogTag} battlenet.battlenet_path not configured");
            return BattlenetReadyResult.NoPath;
        }
        DateTime? abnormalSince = null;
        DateTime? loginSince = null;
        DateTime lastLoginActionUtc = DateTime.MinValue;
        DateTime lastStartUtc = DateTime.MinValue;
        BattlenetClientState? lastState = null;
        while (true)
        {
            ctx.ThrowIfStopped();
            var status = Probe();
            var state = status.State;
            var now = DateTime.UtcNow;
            if (state != lastState)
            {
                ColorPrinter.Blue($"{LogTag} Battle.net state: {state}{(status.Detail != null ? $" ({status.Detail})" : "")}");
                lastState = state;
            }
            GameInterfaceData.Instance.SetBattlenetWakingUp(state is BattlenetClientState.Sleeping or BattlenetClientState.LoadingAccount);

            if (state is BattlenetClientState.Normal or BattlenetClientState.GameStarting)
            {
                if (SwitchRegionIfWrong(status.UiRegion, now))
                {
                    ctx.Wait(C.AfterStartSec);
                    continue;
                }
                ColorPrinter.Green($"{LogTag} Battle.net logged in -> reuse ({status.Detail})");
                return BattlenetReadyResult.Ready;
            }

            switch (state)
            {
                case BattlenetClientState.NotRunning:
                    ColorPrinter.Blue($"{LogTag} Battle.net not running -> start");
                    if (bn.Start()) lastStartUtc = now;
                    ctx.Wait(C.AfterStartSec);
                    continue;
                case BattlenetClientState.TrayHidden when !activate:
                    ColorPrinter.Gray($"{LogTag} Battle.net runs in the tray -> left as is (guard does not bring it up)");
                    return BattlenetReadyResult.Ready;
                case BattlenetClientState.TrayHidden when (now - lastStartUtc).TotalSeconds < C.StartupGraceSec:
                    break;
                case BattlenetClientState.TrayHidden:
                    ColorPrinter.Blue($"{LogTag} Battle.net hidden in the tray -> show it (kept running, login kept)");
                    if (bn.ShowHiddenClient()) lastStartUtc = now;
                    ctx.Wait(C.AfterStartSec);
                    continue;
                case BattlenetClientState.LoginFailed:
                case BattlenetClientState.Disconnected:
                    Restart(ctx, $"{state}");
                    lastStartUtc = DateTime.UtcNow;
                    abnormalSince = loginSince = null;
                    continue;
                case BattlenetClientState.Popup:
                    BattlenetPopupDismiss.TryCloseModal();
                    break;
                case BattlenetClientState.LoggingIn:
                case BattlenetClientState.VerificationCode:
                    break;
                case BattlenetClientState.SecurityCheck:
                    BrowserLoginAutomation.RunOnePoll();
                    break;
                case BattlenetClientState.LoginCn:
                    if ((now - lastLoginActionUtc).TotalSeconds >= C.LoginActionCooldownSec)
                    {
                        lastLoginActionUtc = now;
                        ColorPrinter.Blue($"{LogTag} CN login screen -> agree + NetEase, then web login");
                        BattlenetOperationFactory.GetOperation(C.RegionCn).PerformCnLoginFlow(0);
                    }
                    RunWebLoginPoll();
                    break;
                case BattlenetClientState.LoginCnWeb:
                case BattlenetClientState.BrowserLoginWait:
                    RunWebLoginPoll();
                    break;
                case BattlenetClientState.LoginAsia:
                case BattlenetClientState.LoginEmail:
                case BattlenetClientState.LoginPassword:
                    if ((now - lastLoginActionUtc).TotalSeconds >= C.LoginActionCooldownSec && TryAsiaLogin(activate))
                        lastLoginActionUtc = now;
                    break;
            }

            bool waitingForUser = status.IsWaitingForUser;
            abnormalSince = !waitingForUser && AbnormalStates.Contains(state) ? abnormalSince ?? now : null;
            loginSince = !waitingForUser && LoginStates.Contains(state) ? loginSince ?? now : null;
            bool stuck = state is BattlenetClientState.Sleeping or BattlenetClientState.LoadingAccount;
            double abnormalTimeoutSec = stuck
                ? C.StuckCleanupDelaySec
                : RosbotFlowHost.GetConfig(ConfigKeys.BattlenetAbnormalTimeoutSec, C.AbnormalTimeoutSecDefault);
            if (abnormalSince is { } a && RosbotFlowHost.GetConfig(ConfigKeys.BattlenetAbnormalRestartEnabled, true)
                && (now - a).TotalSeconds >= abnormalTimeoutSec)
            {
                Restart(ctx, $"{state} for {(int)(now - a).TotalSeconds}s (abnormal timeout)", clearCache: stuck);
                lastStartUtc = DateTime.UtcNow;
                abnormalSince = loginSince = null;
                continue;
            }
            if (loginSince is { } l && RosbotFlowHost.GetConfig(ConfigKeys.BattlenetLoginRestartEnabled, true)
                && (now - l).TotalSeconds >= RosbotFlowHost.GetConfig(ConfigKeys.BattlenetLoginTimeoutSec, C.LoginTimeoutSecDefault))
            {
                Restart(ctx, $"login not finished for {(int)(now - l).TotalSeconds}s ({state}, login timeout)");
                lastStartUtc = DateTime.UtcNow;
                abnormalSince = loginSince = null;
                continue;
            }
            ctx.Wait(C.ReadyPollSec);
        }
    }

    /// <summary>The client must run in the user's global region; a mismatch restarts it with --setregion (with cooldown).</summary>
    private static bool SwitchRegionIfWrong(string? uiRegion, DateTime now)
    {
        string? wanted = BattlenetManager.Instance.GetConfiguredRegion();
        if (wanted == null || uiRegion == null || uiRegion == wanted) return false;
        if ((now - _lastRegionSwitchUtc).TotalSeconds < C.RegionSwitchCooldownSec) return false;
        _lastRegionSwitchUtc = now;
        ColorPrinter.Yellow($"{LogTag} client shows region {uiRegion}, global region is {wanted} -> restart with --setregion");
        return BattlenetManager.Instance.RestartWithRegion(wanted);
    }

    /// <summary>Close + start (Close refuses while the user is logging in); Sleeping / account loading clears the cache first.</summary>
    private static void Restart(FlowContext ctx, string reason, bool clearCache = false)
    {
        ColorPrinter.Yellow($"{LogTag} {reason} -> restart Battle.net");
        var bn = BattlenetManager.Instance;
        if (clearCache)
        {
            BattlenetCacheCleanup.ClearCache();
            bn.Start();
        }
        else if (bn.GetConfiguredRegion() is { } region)
            bn.RestartWithRegion(region);
        else
            bn.Restart();
        ctx.Wait(C.AfterStartSec);
    }

    private static void RunWebLoginPoll() => BrowserLoginAutomation.RunOnePoll();

    /// <summary>Asia login with the saved credentials; the Battle.net accounts are shown once when none are saved.</summary>
    private static bool TryAsiaLogin(bool activate)
    {
        if (BattlenetFlowHooks.IsCredentialsPromptPending()) return false;
        var creds = BattlenetFlowHooks.GetLoginCredentials?.Invoke(C.RegionAsia);
        if (creds == null)
        {
            BattlenetFlowHooks.ScheduleLoginCredentialsPrompt?.Invoke(C.RegionAsia);
            ColorPrinter.Gray($"{LogTag} Asia login: no saved credentials, Battle.net accounts shown");
            return false;
        }
        var op = BattlenetOperationFactory.GetOperation(C.RegionAsia);
        if (activate)
        {
            op.ActivateWindow();
            Thread.Sleep(C.ActivateSettleMs);
        }
        if (!op.IsOnAsiaLoginScreen()) return false;
        bool ok = op.PerformAsiaLoginFillAndSubmit(creds.Value.Account, creds.Value.Password);
        if (ok) ColorPrinter.Blue($"{LogTag} Asia login: fill + submit done");
        return ok;
    }
}
