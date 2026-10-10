// PY-REF: pyapps/d3-check/d3utils/rosbot_flow_f3_log_timeout.py
// PY-REF: pyapps/d3-check/d3utils/f3_refresh_line.py
using DotCore.Foundations;

namespace DotApps.d3d4tester.Core.Flow;

/// <summary>Why <see cref="F3MonitorProcess.Run"/> returned.</summary>
public enum F3Exit
{
    /// <summary>F3 timeout, log disconnect or a queued restart request: F4 then route from F1.</summary>
    Restart,

    /// <summary>D3 window is gone: F4 (end ROSBOT) then route from F1.</summary>
    D3Gone,

    /// <summary>ROSBOT offline for <see cref="FlowTimings.RosbotGoneGraceSec"/> with D3 running: route from F1 (C + E, D3 reused).</summary>
    RosbotGone,

    /// <summary>A ROSBOT-only restart was requested (smart echo resume failed): run E again, D3 untouched.</summary>
    RosbotRestart,
}

/// <summary>F3 result with the restart reason (reason ids map to ui.monitor.reason_*) and whether it counts as a restart.</summary>
public sealed record F3Outcome(F3Exit Exit, string ReasonId = "", string Detail = "", bool RestartBattlenet = false, bool CountRestart = false);

/// <summary>
/// [F3] D3 and ROSBOT run: one loop until something needs the flow again. Each poll: queued restart request, ROSBOT-only restart
/// request, log session timeout, D3 gone, ROSBOT log timeout (F3LogTimeout), ROSBOT offline grace. ROSBOT's "WARN - Disconnected" is
/// an exception in its own server check that ROSBOT handles while it keeps botting: the log analyzer only prints it (restarting ROSBOT
/// mid-run made it leave the game). A session timeout with D3 fine restarts ROSBOT only (D3 kept); a full D3 + ROSBOT restart needs D3
/// itself disconnected. D3 + ROSBOT refresh silently every
/// <see cref="FlowTimings.MonitorRefreshSec"/>; the status line is gray-refreshed in place.
/// </summary>
public static class F3MonitorProcess
{
    private const string LogTag = "[F3]";

    private static int _rosbotRestartRequested;

    /// <summary>Ask the running flow to restart ROSBOT only (E block), keeping D3.</summary>
    public static void RequestRosbotRestart() => Interlocked.Exchange(ref _rosbotRestartRequested, 1);

    public static F3Outcome Run(FlowContext ctx)
    {
        var game = GameInterfaceData.Instance;
        DateTime nextRefresh = DateTime.MinValue;
        DateTime? rosbotGoneSince = null;
        Interlocked.Exchange(ref _rosbotRestartRequested, 0);
        game.GetAndClearRosbotDisconnectedFromLog();
        F3LogTimeout.SetRosbotStartedAt();
        ColorPrinter.Blue($"{LogTag} D3 + ROSBOT running -> monitor (log timeout, disconnect, restart requests)");
        while (true)
        {
            ctx.ThrowIfStopped();
            if (GameControl.TownHoldActive)
            {
                F3LogTimeout.SetRosbotStartedAt();
                ctx.Wait(FlowTimings.MonitorPollSec);
                continue;
            }
            if (RosbotRestartRequest.TryConsume(out string reasonId, out string detail, out bool restartBattlenet))
                return new F3Outcome(F3Exit.Restart, reasonId, detail, restartBattlenet, CountRestart: true);
            if (Interlocked.Exchange(ref _rosbotRestartRequested, 0) == 1)
                return new F3Outcome(F3Exit.RosbotRestart);
            var now = DateTime.UtcNow;
            if (now >= nextRefresh)
            {
                nextRefresh = now.AddSeconds(FlowTimings.MonitorRefreshSec);
                RefreshSilently();
            }
            if (game.GetAndClearRosbotDisconnectedFromLog())
            {
                if (!D3ShowsFine())
                    return new F3Outcome(F3Exit.Restart, RosbotRestartRequest.ReasonLogDisconnect, CountRestart: true);
                ColorPrinter.Yellow($"{LogTag} ROSBOT logged a session timeout but D3 is fine -> restart ROSBOT only");
                return new F3Outcome(F3Exit.RosbotRestart, RosbotRestartRequest.ReasonLogDisconnect);
            }
            var s = game.GetStateSnapshot();
            if (!s.D3Running)
                return new F3Outcome(F3Exit.D3Gone);
            var step = F3LogTimeout.Run(verbose: false);
            string rosbotStatus = string.IsNullOrEmpty(s.RosbotExtendedStatus) ? RosbotDetection.StatusNotFound : s.RosbotExtendedStatus;
            ColorPrinter.GrayRefresh(F3RefreshLine.BuildF3OnlyRefreshLine($"{LogTag} ", s.D3Running, rosbotStatus, F3LogTimeout.LastShortStatus));
            if (step == F3Step.F4)
                return new F3Outcome(F3Exit.Restart, RosbotRestartRequest.ReasonLogTimeout);
            if (RosbotDetection.IsOnline(s.RosbotExtendedStatus))
                rosbotGoneSince = null;
            else if ((now - (rosbotGoneSince ??= now)).TotalSeconds >= FlowTimings.RosbotGoneGraceSec)
                return new F3Outcome(F3Exit.RosbotGone);
            ctx.Wait(FlowTimings.MonitorPollSec);
        }
    }

    /// <summary>D3 runs and its screen is not the disconnected screen (C3 templates on a fresh capture).</summary>
    public static bool D3ShowsFine() =>
        GameInterfaceData.Instance.GetStateSnapshot().D3Running
        && D3ScreenState.DetectD3AlreadyRunningState() != D3ScreenState.StateDisconnect;

    private static void RefreshSilently()
    {
        var host = RosbotFlowHost.Current;
        if (host == null) return;
        F3RefreshLine.SetSilent(true);
        try
        {
            bool changed = host.RefreshD3Status(skipDynamic: true);
            changed |= host.RefreshRosbotStatus();
            if (changed) host.NotifyStateSync();
        }
        finally
        {
            F3RefreshLine.SetSilent(false);
        }
    }
}
