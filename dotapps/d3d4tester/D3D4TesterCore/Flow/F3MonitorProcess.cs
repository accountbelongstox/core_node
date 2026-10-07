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
/// request, log disconnect, D3 gone, ROSBOT log timeout (F3LogTimeout), ROSBOT offline grace. D3 + ROSBOT refresh silently every
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
        ColorPrinter.Blue($"{LogTag} D3 + ROSBOT running -> monitor (log timeout, disconnect, restart requests)");
        while (true)
        {
            ctx.ThrowIfStopped();
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
                return new F3Outcome(F3Exit.Restart, RosbotRestartRequest.ReasonLogDisconnect, CountRestart: true);
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
