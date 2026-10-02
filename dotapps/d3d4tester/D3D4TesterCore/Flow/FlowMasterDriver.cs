// PY-REF: pyapps/d3-check/d3utils/rosbot_flow/flow_master_driver.py
// PY-REF: pyapps/d3-check/d3utils/rosbot_flow_f0_entry.py
// PY-REF: pyapps/d3-check/d3utils/rosbot_flow_f1_d3_online.py
// PY-REF: pyapps/d3-check/d3utils/rosbot_task_processor.py
using DotCore.Foundations;

namespace DotApps.d3d4tester.Core.Flow;

/// <summary>Steps executed within one flow-master tick. 1:1 Python FlowMasterStep.</summary>
public enum FlowMasterStep
{
    ReReadAbort,
    RefreshForRouting,
    F3OnlyMode,
    ExtensionTick,
    F0Prejudge,
    F0ActionB1,
    F0ActionB2,
    F0ActionC1,
    F0C1Extension,
    F3F4
}

/// <summary>F0 pre-judge result. 1:1 Python F0Action (b1 -> B2_HasWin, c1 -> C1_Entry).</summary>
public enum F0Action
{
    B1,
    B2,
    C1
}

/// <summary>
/// ROSBOT flow master (flow_master_enabled), one call per 2 s flow tick. Order: F3-only gate (D3 + ROSBOT running/paused ->
/// only F3 timeout, never the C branch; D3 refresh every 5 ticks, ROSBOT every 2nd refresh cycle) -> routing refresh (light D3 +
/// ROSBOT; log-disconnect restart; ROSBOT-vanished F3 check) -> extension tick (C branch) -> F0 (B1 BN ready flow, B2 enter B2,
/// C1 C branch or extension ROSBOT start). F3 timeout -> F4 -> B2 is the unattended restart loop.
/// 1:1 Python d3utils/rosbot_flow/flow_master_driver.py + rosbot_flow_f0_entry.py + rosbot_flow_f1_d3_online.py.
/// </summary>
public static class FlowMasterDriver
{
    private const string LogTag = "[FlowMaster]";
    private const bool FlowMasterBn = false;
    private const int F3OnlyRefreshIntervalTicks = 5;
    private const int F3OnlyRosbotRefreshEveryNCycles = 2;

    private static readonly object Lock = new();
    private static F0Action? _lastF0Action;
    private static ExtensionStepResult? _lastExtensionResult;
    private static F3Step? _lastF3Result;
    private static int _f3OnlyRefreshCounter;
    private static int _f3OnlyRosbotRefreshCycle;

    public static F0Action? LastF0Action
    {
        get { lock (Lock) return _lastF0Action; }
    }

    public static ExtensionStepResult? LastExtensionResult
    {
        get { lock (Lock) return _lastExtensionResult; }
    }

    public static F3Step? LastF3Result
    {
        get { lock (Lock) return _lastF3Result; }
    }

    private static IRosbotFlowHost? Host => RosbotFlowHost.Current;

    private static GameInterfaceStateSnapshot State => GameInterfaceData.Instance.GetStateSnapshot();

    /// <summary>D3 and ROSBOT both present (running/paused) -> F3 timeout loop only. 1:1 Python _is_f3_only_mode.</summary>
    public static bool IsF3OnlyMode()
    {
        var s = State;
        return s.D3Running && RosbotDetection.IsOnline(s.RosbotExtendedStatus);
    }

    /// <summary>
    /// One flow-master tick. statusPrefix (e.g. "[A2/A3] Tick #N dt=Xs | ") makes the F3-only path print one gray-refresh line.
    /// 1:1 Python tick_flow_master(tick_count, start_rosbot_task, status_prefix).
    /// </summary>
    public static void Tick(int flowTick, Action startRosbotTask, string? statusPrefix = null)
    {
        if (!RosbotFlowState.Instance.FlowMasterEnabled)
            return;
        var game = GameInterfaceData.Instance;

        if (IsF3OnlyMode())
        {
            RunF3OnlyMode(statusPrefix);
            return;
        }

        var ext = ExtensionFlowState.Instance;
        bool inAction = !ext.IsIdle && ext.IsInActionGroup;
        if (!inAction)
        {
            ColorPrinter.Gray($"{LogTag} step={StepName(FlowMasterStep.RefreshForRouting)}: light D3 + ROSBOT...");
            string prevRosbotStatus = State.RosbotExtendedStatus;
            bool d3Changed = RefreshD3(skipDynamic: true);
            bool rosbotChanged = RefreshRosbot();
            if (game.GetAndClearRosbotDisconnectedFromLog())
            {
                RestartAfterLogDisconnect();
                return;
            }
            var now = State;
            if (RosbotDetection.IsOnline(prevRosbotStatus) && now.RosbotExtendedStatus == RosbotDetection.StatusNotFound && now.D3Running)
            {
                ColorPrinter.Gray($"{LogTag} ROSBOT disappeared, check F3 timeout...");
                var step = RunF3(verbose: true);
                if (step == F3Step.F4)
                {
                    ColorPrinter.Gray($"{LogTag} F3: timeout detected after ROSBOT gone -> F4 -> B2_HasWin");
                    RunF4AndEnterB2();
                    return;
                }
            }
            if (d3Changed || rosbotChanged)
                Host?.NotifyStateSync();
        }

        if (!ext.IsIdle)
        {
            if (ext.IsInActionGroup)
            {
                ColorPrinter.Gray($"{LogTag} in action group, skip refresh, extension_flow_tick_step (one step) only");
            }
            else
            {
                ColorPrinter.Gray($"{LogTag} step={StepName(FlowMasterStep.ExtensionTick)}: full D3+ROSBOT, extension_flow_tick_step...");
                bool d3Changed = RefreshD3(skipDynamic: false);
                bool rosbotChanged = RefreshRosbot();
                if (d3Changed || rosbotChanged)
                    Host?.NotifyStateSync();
            }
            if (RunExtensionStep(flowTick, startRosbotTask))
                return;
            RunF3F4IfF3Only();
            return;
        }

        ColorPrinter.Gray($"{LogTag} step={StepName(FlowMasterStep.F0Prejudge)}: run_f0_prejudge_entry...");
        var action = RunF0PrejudgeEntry();
        lock (Lock) _lastF0Action = action;
        ColorPrinter.Gray($"{LogTag} F0 pre-judge -> {action.ToString().ToLowerInvariant()} (b1=B2, c1=C1, b2=enter B2)");

        switch (action)
        {
            case F0Action.B1:
            {
                ColorPrinter.Gray($"{LogTag} step={StepName(FlowMasterStep.F0ActionB1)}: refresh BN only (skip D3 full, ROSBOT)...");
                if (RefreshBattlenet())
                    Host?.NotifyStateSync();
                ColorPrinter.Gray($"{LogTag} step={StepName(FlowMasterStep.F0ActionB1)}: tick_battlenet_ready_flow(no_activate=False)...");
                var (done, result) = BattlenetReadyFlow.Tick(noActivate: false);
                if (done && result == BattlenetReadyFlow.ResultConfirmed)
                {
                    BnBlockState.SetTickConfirmed(FlowMasterBn);
                    Host?.TriggerExtensionRosbotStart();
                }
                break;
            }
            case F0Action.B2:
                ColorPrinter.Gray($"{LogTag} step={StepName(FlowMasterStep.F0ActionB2)}: refresh BN only, enter_battlenet_at_b2...");
                if (RefreshBattlenet())
                    Host?.NotifyStateSync();
                ColorPrinter.Gray($"{LogTag} step={StepName(FlowMasterStep.F0ActionB2)}: enter_battlenet_at_b2...");
                BnBlockState.EnterBattlenetAtB2(FlowMasterBn);
                break;
            case F0Action.C1:
            {
                ColorPrinter.Gray($"{LogTag} step={StepName(FlowMasterStep.F0ActionC1)}: refresh D3+ROSBOT only (skip BN)...");
                bool d3Changed = RefreshD3(skipDynamic: false);
                bool rosbotChanged = RefreshRosbot();
                if (d3Changed || rosbotChanged)
                    Host?.NotifyStateSync();
                var s = State;
                bool needCBranch = ext.IsIdle
                    && BnBlockState.GetEverConfirmed(FlowMasterBn)
                    && s.D3Running
                    && !RosbotDetection.IsOnline(s.RosbotExtendedStatus);
                if (needCBranch)
                {
                    bool d3JustEntered = game.GetAndClearD3JustEnteredFromD13();
                    if (d3JustEntered)
                        ColorPrinter.Gray($"{LogTag} D13 just entered game -> start_extension_flow_c_branch(d3_just_entered=True) for C7a map teleport (ROSBOT_FLOW_MERMAID)");
                    ColorPrinter.Gray($"{LogTag} step={StepName(FlowMasterStep.F0C1Extension)}: start_extension_flow_c_branch, extension_flow_tick_step...");
                    ext.StartCBranch(d3JustEntered);
                    if (RunExtensionStep(flowTick, startRosbotTask))
                        return;
                }
                else
                {
                    ColorPrinter.Gray($"{LogTag} step={StepName(FlowMasterStep.F0ActionC1)}: trigger_extension_rosbot_start...");
                    Host?.TriggerExtensionRosbotStart();
                }
                RunF3F4IfF3Only();
                break;
            }
        }
    }

    /// <summary>[F0] pre-judge: F1 only (d3_running from this tick's light refresh). No -> B1 (go B2_HasWin), yes -> C1. 1:1 Python run_f0_prejudge_entry + run_f1_d3_online.</summary>
    public static F0Action RunF0PrejudgeEntry()
    {
        ColorPrinter.Gray("[F0] Pre-judge entry -> F1");
        if (!State.D3Running)
        {
            ColorPrinter.Gray("[F0] F1: D3 not online -> B2_HasWin");
            return F0Action.B1;
        }
        ColorPrinter.Gray("[F0] F1: D3 online -> C1_Entry");
        return F0Action.C1;
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
                bool d3Changed = RefreshD3(skipDynamic: true);
                bool rosbotChanged = doRosbotRefresh && RefreshRosbot();
                if (d3Changed || rosbotChanged)
                    Host?.NotifyStateSync();
            }
            finally
            {
                F3RefreshLine.SetSilent(false);
            }
        }
        var step = RunF3(verbose: false);
        string prefix = statusPrefix ?? $"{LogTag} step={StepName(FlowMasterStep.F3OnlyMode)} | ";
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
            ColorPrinter.Gray($"{LogTag} F3: timeout -> F4 -> B2_HasWin");
            RunF4AndEnterB2();
        }
    }

    /// <summary>Returns true when the C branch finished this tick (success or fallthrough).</summary>
    private static bool RunExtensionStep(int flowTick, Action startRosbotTask)
    {
        var result = ExtensionFlowTickStep.Step(flowTick, startRosbotTask);
        lock (Lock) _lastExtensionResult = result;
        if (result == ExtensionStepResult.Success)
        {
            Host?.TriggerExtensionRosbotStarted(true, false);
            return true;
        }
        if (result == ExtensionStepResult.Fallthrough)
        {
            Host?.TriggerExtensionRosbotStarted(false, false);
            return true;
        }
        return false;
    }

    private static void RunF3F4IfF3Only()
    {
        if (!IsF3OnlyMode()) return;
        ColorPrinter.Gray($"{LogTag} step={StepName(FlowMasterStep.F3F4)}: F3 timeout (D3+ROSBOT both present)...");
        if (RunF3(verbose: true) == F3Step.F4)
        {
            ColorPrinter.Gray($"{LogTag} F3: timeout -> F4 -> B2_HasWin");
            RunF4AndEnterB2();
        }
    }

    private static F3Step RunF3(bool verbose)
    {
        var step = F3LogTimeout.Run(verbose);
        lock (Lock) _lastF3Result = step;
        return step;
    }

    private static void RestartAfterLogDisconnect()
    {
        ColorPrinter.Yellow($"{LogTag} ROSBOT disconnect detected -> F4 -> B2_HasWin");
        RosbotExitState.IncrementTotalRestartCount();
        RunF4AndEnterB2();
    }

    /// <summary>F4, then refresh so the next tick's gate sees D3/ROSBOT gone (no duplicate F3 50 %), then enter B2.</summary>
    private static void RunF4AndEnterB2()
    {
        F4CloseD3SendF7.Run();
        bool d3Changed = RefreshD3(skipDynamic: true);
        bool rosbotChanged = RefreshRosbot();
        if (d3Changed || rosbotChanged)
            Host?.NotifyStateSync();
        BnBlockState.EnterBattlenetAtB2(FlowMasterBn);
    }

    private static bool RefreshD3(bool skipDynamic) => Host?.RefreshD3Status(skipDynamic) ?? false;

    private static bool RefreshRosbot() => Host?.RefreshRosbotStatus() ?? false;

    private static bool RefreshBattlenet() => Host?.RefreshBattlenetStatus() ?? false;

    /// <summary>Python step value (snake_case) for log parity.</summary>
    private static string StepName(FlowMasterStep step) => step switch
    {
        FlowMasterStep.ReReadAbort => "re_read_abort",
        FlowMasterStep.RefreshForRouting => "refresh_for_routing",
        FlowMasterStep.F3OnlyMode => "f3_only_mode",
        FlowMasterStep.ExtensionTick => "extension_tick",
        FlowMasterStep.F0Prejudge => "f0_prejudge",
        FlowMasterStep.F0ActionB1 => "f0_action_b1",
        FlowMasterStep.F0ActionB2 => "f0_action_b2",
        FlowMasterStep.F0ActionC1 => "f0_action_c1",
        FlowMasterStep.F0C1Extension => "f0_c1_extension",
        _ => "f3_f4"
    };
}
