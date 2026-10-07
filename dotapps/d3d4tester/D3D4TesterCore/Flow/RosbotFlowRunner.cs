// PY-REF: pyapps/d3-check/d3utils/rosbot_flow/flow_master_driver.py
// PY-REF: pyapps/d3-check/d3utils/rosbot_flow_f0_entry.py
// PY-REF: pyapps/d3-check/d3utils/rosbot_flow_f1_d3_online.py
// PY-REF: pyapps/d3-check/d3utils/rosbot_flow_f4_close_d3_send_f7.py
using DotCore.Foundations;

namespace DotApps.d3d4tester.Core.Flow;

/// <summary>
/// The ROSBOT flow (docs/ROSBOT_FLOW_MERMAID.md) as one sequential procedure on its own thread, started by "Start monitoring" and
/// cancelled by "Stop monitoring" (every wait ends at once). One cycle:
/// [F1] D3 running? no -> [B] Battle.net ready (reused when logged in) -> [D] launch D3 (just entered); yes -> D3 reused.
/// [F2] ROSBOT online? no -> [C] D3 screen + map teleport -> [E] start ROSBOT. Then [F3] monitor until a restart (F4: end D3 +
/// ROSBOT), D3 gone (F4), ROSBOT gone (D3 kept) or a ROSBOT-only restart (E again). The cycle repeats until stopped.
/// </summary>
public static class RosbotFlowRunner
{
    private const string LogTag = "[Flow]";

    private static readonly FlowThread Worker = new("RosbotFlow", RunCycle);
    private static bool _d3JustEntered;

    private static GameInterfaceStateSnapshot State => GameInterfaceData.Instance.GetStateSnapshot();

    public static bool IsRunning => Worker.IsRunning;

    /// <summary>Start monitoring: set the flow flag and start the flow thread (idempotent).</summary>
    public static void Start()
    {
        RosbotFlowState.Instance.SetFlowMasterEnabled(true);
        Worker.Start();
    }

    /// <summary>Stop monitoring: clear the flow flag and cancel the flow at its current step.</summary>
    public static void Stop()
    {
        RosbotFlowState.Instance.SetFlowMasterEnabled(false);
        Worker.Stop();
    }

    private static void RunCycle(FlowContext ctx)
    {
        Refresh();
        if (!State.D3Running)
        {
            ColorPrinter.Blue($"{LogTag} [F1] D3 not running -> [B] Battle.net -> [D] launch D3");
            if (BattlenetReadyProcess.Run(ctx, activate: true) == BattlenetReadyResult.NoPath)
            {
                ctx.Wait(FlowTimings.NoBattlenetPathRetrySec);
                return;
            }
            if (!D3Manager.Instance.IsRunning())
            {
                if (!GameLaunchProcess.Launch(ctx, GameLaunchTarget.D3))
                {
                    ctx.Wait(FlowTimings.D3LaunchRetrySec);
                    return;
                }
                _d3JustEntered = true;
            }
            Refresh();
        }
        else
            ColorPrinter.Blue($"{LogTag} [F1] D3 running -> reuse it");

        if (!RosbotDetection.IsOnline(State.RosbotExtendedStatus))
        {
            bool justEntered = _d3JustEntered;
            _d3JustEntered = false;
            if (D3DirectProcess.Run(ctx, justEntered) != D3DirectResult.Ready)
                return;
            if (!StartRosbot(ctx))
                return;
        }
        else
            ColorPrinter.Blue($"{LogTag} [F2] ROSBOT online -> reuse it");

        while (true)
        {
            var outcome = F3MonitorProcess.Run(ctx);
            switch (outcome.Exit)
            {
                case F3Exit.Restart:
                    ColorPrinter.Yellow($"{LogTag} restart ({outcome.ReasonId} {outcome.Detail}) -> [F4] end D3 + ROSBOT");
                    if (outcome.CountRestart) RosbotExitState.IncrementTotalRestartCount();
                    RosbotRestartRequest.NotifyExecuted(outcome.ReasonId, outcome.Detail, outcome.RestartBattlenet);
                    RunF4();
                    return;
                case F3Exit.D3Gone:
                    ColorPrinter.Yellow($"{LogTag} D3 is gone -> [F4] end ROSBOT");
                    RunF4();
                    return;
                case F3Exit.RosbotGone:
                    ColorPrinter.Yellow($"{LogTag} ROSBOT offline -> route again (D3 reused)");
                    return;
                case F3Exit.RosbotRestart:
                    ColorPrinter.Yellow($"{LogTag} ROSBOT restart requested -> [E]");
                    if (!StartRosbot(ctx)) return;
                    continue;
            }
        }
    }

    /// <summary>[F2] + [E] on the host; false (after the retry wait) when ROSBOT could not be started.</summary>
    private static bool StartRosbot(FlowContext ctx)
    {
        if (RosbotFlowHost.Current?.RunRosbotStart(ctx) == true)
            return true;
        ColorPrinter.Yellow($"{LogTag} [E] ROSBOT not started, retry in {FlowTimings.RosbotStartRetrySec}s");
        ctx.Wait(FlowTimings.RosbotStartRetrySec);
        return false;
    }

    /// <summary>[F4a] end D3, [F4b] F7 to the system + end ROSBOT by PID.</summary>
    private static void RunF4()
    {
        D3Manager.Instance.KillIfRunning();
        if (RosbotManager.SendF7ToSystem())
            RosbotExitState.SetF7SentForRosbot();
        var rosbot = RosbotManager.Instance;
        rosbot.KillIfRunning();
        rosbot.InvalidateLookupCache();
        Refresh();
    }

    private static void Refresh()
    {
        var host = RosbotFlowHost.Current;
        if (host == null) return;
        bool changed = host.RefreshD3Status(skipDynamic: true);
        changed |= host.RefreshRosbotStatus();
        if (changed) host.NotifyStateSync();
    }
}
