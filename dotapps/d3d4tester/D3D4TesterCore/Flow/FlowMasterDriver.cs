// PY-REF: pyapps/d3-check/d3utils/rosbot_flow/flow_master_driver.py
// PY-REF: pyapps/d3-check/d3utils/rosbot_flow_f0_entry.py
// PY-REF: pyapps/d3-check/d3utils/rosbot_flow_f1_d3_online.py
// PY-REF: pyapps/d3-check/d3utils/rosbot_task_processor.py
using DotCore.Foundations;

namespace DotApps.d3d4tester.Core.Flow;

/// <summary>
/// ROSBOT flow master (docs/ROSBOT_FLOW_MERMAID.md), the only owner of D3 / Battle.net / ROSBOT while monitoring is on; one call per
/// 2 s flow tick. Order: blocking job busy (D or E block on the extension worker) -> wait; queued restart -> F4 -> B2; F3-only
/// (D3 + ROSBOT online) -> F3 log timeout; C branch active -> one C step (Success = A8 -> E block); F1 D3 running -> reuse it, C1;
/// F1 no -> B block (Battle.net reused when logged in) -> B16 confirmed -> D block (launch D3, D13 marks "just entered").
/// After a job, routing waits <see cref="PostJobSettleTicks"/> so state probes see the result before acting again.
/// </summary>
public static class FlowMasterDriver
{
    private const string LogTag = "[FlowMaster]";
    private const bool FlowMasterBn = false;
    private const int F3OnlyRefreshIntervalTicks = 5;
    private const int F3OnlyRosbotRefreshEveryNCycles = 2;
    private const int PostJobSettleTicks = 3;
    private const int DLaunchRetryTicks = 15;

    private static readonly object Lock = new();
    private static int _f3OnlyRefreshCounter;
    private static int _f3OnlyRosbotRefreshCycle;
    private static int _lastBusyFlowTick = int.MinValue / 2;
    private static int _dLaunchNotBeforeTick;

    private static IRosbotFlowHost? Host => RosbotFlowHost.Current;

    private static GameInterfaceStateSnapshot State => GameInterfaceData.Instance.GetStateSnapshot();

    /// <summary>D3 and ROSBOT both present (running/paused) -> F3 timeout loop only. 1:1 Python _is_f3_only_mode.</summary>
    public static bool IsF3OnlyMode()
    {
        var s = State;
        return s.D3Running && RosbotDetection.IsOnline(s.RosbotExtendedStatus);
    }

    /// <summary>One flow-master tick. statusPrefix (e.g. "[A2/A3] Tick #N dt=Xs | ") prefixes the F3-only gray-refresh line.</summary>
    public static void Tick(int flowTick, string? statusPrefix = null)
    {
        if (!RosbotFlowState.Instance.FlowMasterEnabled)
            return;

        if (Host?.IsFlowJobBusy == true)
        {
            lock (Lock) _lastBusyFlowTick = flowTick;
            ColorPrinter.Gray($"{LogTag} flow job (D/E block) running on the extension worker, wait");
            RefreshD3AndRosbot();
            return;
        }

        if (RosbotRestartRequest.TryConsume(out string restartReason, out string restartDetail, out bool restartBattlenet))
        {
            ColorPrinter.Yellow($"{LogTag} Restart requested ({restartReason}: {restartDetail}) restart_battlenet={restartBattlenet} -> F4 -> B2");
            RosbotExitState.IncrementTotalRestartCount();
            RunF4AndEnterB2(restartReason, restartDetail, restartBattlenet);
            return;
        }

        if (IsF3OnlyMode())
        {
            RunF3OnlyMode(statusPrefix);
            return;
        }

        var ext = ExtensionFlowState.Instance;
        if (!ext.IsInActionGroup && RefreshForRouting())
            return;

        int settleLeft;
        lock (Lock) settleLeft = _lastBusyFlowTick + PostJobSettleTicks - flowTick;
        if (settleLeft > 0)
        {
            ColorPrinter.Gray($"{LogTag} flow job finished, settle {settleLeft} more tick(s) before routing");
            return;
        }

        if (!ext.IsIdle)
        {
            RunExtensionStep(flowTick);
            return;
        }

        if (State.D3Running)
        {
            bool d3JustEntered = ext.GetAndClearD3JustEnteredFromD13();
            ColorPrinter.Gray($"{LogTag} [F1] D3 online -> reuse it, [C1] C branch (d3_just_entered={d3JustEntered})");
            ext.StartCBranch(d3JustEntered);
            RunExtensionStep(flowTick);
            return;
        }

        ColorPrinter.Gray($"{LogTag} [F1] D3 not online -> [B] Battle.net ready flow");
        RunBattlenetThenLaunchD3(flowTick);
    }

    /// <summary>Light D3 + ROSBOT refresh; log disconnect -> restart, ROSBOT vanished with D3 up -> F3 check. True when a restart ran.</summary>
    private static bool RefreshForRouting()
    {
        string prevRosbotStatus = State.RosbotExtendedStatus;
        RefreshD3AndRosbot();
        if (GameInterfaceData.Instance.GetAndClearRosbotDisconnectedFromLog())
        {
            RestartAfterLogDisconnect();
            return true;
        }
        var now = State;
        if (RosbotDetection.IsOnline(prevRosbotStatus) && now.RosbotExtendedStatus == RosbotDetection.StatusNotFound && now.D3Running)
        {
            ColorPrinter.Gray($"{LogTag} ROSBOT disappeared, check F3 timeout...");
            if (F3LogTimeout.Run(verbose: true) == F3Step.F4)
            {
                ColorPrinter.Gray($"{LogTag} F3: timeout detected after ROSBOT gone -> F4 -> B2");
                RunF4AndEnterB2(RosbotRestartRequest.ReasonLogTimeout);
                return true;
            }
        }
        return false;
    }

    /// <summary>[B] one B-block tick (Battle.net reused when already logged in); B16 confirmed -> [D] launch D3 on the worker.</summary>
    private static void RunBattlenetThenLaunchD3(int flowTick)
    {
        if (Host?.RefreshBattlenetStatus() == true)
            Host.NotifyStateSync();
        var (done, result) = BattlenetReadyFlow.Tick(noActivate: false);
        if (!done || result != BattlenetReadyFlow.ResultConfirmed)
            return;
        lock (Lock)
        {
            if (flowTick < _dLaunchNotBeforeTick)
            {
                ColorPrinter.Gray($"{LogTag} [B16] Battle.net confirmed, D block retry in {_dLaunchNotBeforeTick - flowTick} tick(s)");
                return;
            }
            _dLaunchNotBeforeTick = flowTick + DLaunchRetryTicks;
        }
        ColorPrinter.Blue($"{LogTag} [B16] Battle.net confirmed -> [D1] launch D3 from Battle.net");
        Host?.TriggerD3Launch();
    }

    private static void RunF3OnlyMode(string? statusPrefix)
    {
        ExtensionFlowState.Instance.Reset();
        bool shouldRefresh;
        bool doRosbotRefresh = false;
        lock (Lock)
        {
            _f3OnlyRefreshCounter++;
            shouldRefresh = _f3OnlyRefreshCounter % F3OnlyRefreshIntervalTicks == 0;
            if (shouldRefresh)
            {
                _f3OnlyRosbotRefreshCycle++;
                doRosbotRefresh = _f3OnlyRosbotRefreshCycle % F3OnlyRosbotRefreshEveryNCycles == 1;
            }
        }
        if (shouldRefresh)
        {
            F3RefreshLine.SetSilent(true);
            try
            {
                bool d3Changed = RefreshD3();
                bool rosbotChanged = doRosbotRefresh && RefreshRosbot();
                if (d3Changed || rosbotChanged)
                    Host?.NotifyStateSync();
            }
            finally
            {
                F3RefreshLine.SetSilent(false);
            }
        }
        var step = F3LogTimeout.Run(verbose: false);
        string prefix = statusPrefix ?? $"{LogTag} f3_only_mode | ";
        var s = State;
        string rosbotStatus = string.IsNullOrEmpty(s.RosbotExtendedStatus) ? RosbotDetection.StatusNotFound : s.RosbotExtendedStatus;
        ColorPrinter.GrayRefresh(F3RefreshLine.BuildF3OnlyRefreshLine(prefix, s.D3Running, rosbotStatus, F3LogTimeout.LastShortStatus));
        if (GameInterfaceData.Instance.GetAndClearRosbotDisconnectedFromLog())
        {
            RestartAfterLogDisconnect();
            return;
        }
        if (step == F3Step.F4)
        {
            ColorPrinter.Gray($"{LogTag} F3: timeout -> F4 -> B2");
            RunF4AndEnterB2(RosbotRestartRequest.ReasonLogTimeout);
        }
    }

    /// <summary>One C step; Success = A8 -> E block (F2 gate, E1-E6) on the worker; Fallthrough = next tick routes again from F1.</summary>
    private static void RunExtensionStep(int flowTick)
    {
        var result = ExtensionFlowTickStep.Step(flowTick);
        if (result == ExtensionStepResult.Success)
        {
            ColorPrinter.Blue($"{LogTag} [A8] C branch done -> [F2]/[E] start ROSBOT");
            Host?.TriggerExtensionRosbotStart();
        }
        else if (result == ExtensionStepResult.Fallthrough)
        {
            ColorPrinter.Gray($"{LogTag} C branch fell through, next tick routes from F1");
        }
    }

    private static void RestartAfterLogDisconnect()
    {
        ColorPrinter.Yellow($"{LogTag} ROSBOT disconnect detected -> F4 -> B2");
        RosbotExitState.IncrementTotalRestartCount();
        RunF4AndEnterB2(RosbotRestartRequest.ReasonLogDisconnect);
    }

    /// <summary>F4, then refresh so the next tick sees D3/ROSBOT gone, reset the C branch and enter B2.</summary>
    private static void RunF4AndEnterB2(string reasonId, string detail = "", bool restartBattlenet = false)
    {
        RosbotRestartRequest.NotifyExecuted(reasonId, detail, restartBattlenet);
        F4CloseD3SendF7.Run();
        RefreshD3AndRosbot();
        ExtensionFlowState.Instance.Reset();
        BnBlockState.EnterBattlenetAtB2(FlowMasterBn);
    }

    private static void RefreshD3AndRosbot()
    {
        bool d3Changed = RefreshD3();
        bool rosbotChanged = RefreshRosbot();
        if (d3Changed || rosbotChanged)
            Host?.NotifyStateSync();
    }

    private static bool RefreshD3() => Host?.RefreshD3Status(skipDynamic: true) ?? false;

    private static bool RefreshRosbot() => Host?.RefreshRosbotStatus() ?? false;
}
