// PY-REF: pyapps/d3-check/d3utils/rosbot_flow/extension_flow_tick_step.py
using DotApps.d3d4tester.Core.Flow.ActionGroups;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Core.Flow;

/// <summary>extension_flow_tick_step return value.</summary>
public enum ExtensionStepResult
{
    Idle,
    Running,
    Success,
    Fallthrough,
}

/// <summary>
/// C-branch extension flow tick machine: one step per flow tick, no sleeps; all timing by flow tick count.
/// C_ENTRY -> C2 resize -> C3 loop (deadline C3DeadlineTicks) with disconnect double-confirm -> C4 branch;
/// start -> kill ROSBOT + Start Game click -> C5w; game_tool -> C10 M-similarity (skipped when just entered or after a
/// recent teleport) -> C7a M + bounty verify (2 rounds) -> map_teleport action group -> D3 status, ROSBOT (re)start, F3 baseline.
/// Failure paths end D3 (C12). 1:1 Python d3utils/rosbot_flow/extension_flow_tick_step.py.
/// </summary>
public static class ExtensionFlowTickStep
{
    private const string LogPrefix = "[ExtensionFlow]";
    private const string ConfigAutoStartRosbot = "ros_settings.auto_start_rosbot";

    private static ExtensionFlowState S => ExtensionFlowState.Instance;

    /// <summary>Result of the last <see cref="Step"/> call.</summary>
    public static ExtensionStepResult LastResult { get; private set; } = ExtensionStepResult.Idle;

    /// <summary>Run one step on the flow tick; true when the C branch is active (the step consumed this tick).</summary>
    public static bool Tick(IFlowTick tick, RosbotFlowState state)
    {
        var result = Step(tick.FlowTick, () => RosbotFlowHost.Current?.StartRosbotTask());
        return result != ExtensionStepResult.Idle;
    }

    /// <summary>One step of the extension flow state machine. 1:1 Python extension_flow_tick_step(current_tick, start_rosbot_task_fn).</summary>
    public static ExtensionStepResult Step(int currentTick, Action startRosbotTask)
    {
        LastResult = StepCore(currentTick, startRosbotTask);
        return LastResult;
    }

    private static ExtensionStepResult StepCore(int currentTick, Action startRosbotTask)
    {
        var phase = S.Phase;
        if (phase == ExtensionPhase.Idle)
            return ExtensionStepResult.Idle;

        if (phase == ExtensionPhase.CActionGroup)
            return StepActionGroup(startRosbotTask);

        if (phase is ExtensionPhase.CC3Wait or ExtensionPhase.CC3Disconfirm or ExtensionPhase.CC10Wait or ExtensionPhase.CC7aWait)
        {
            int w = S.WaitTicksRemaining - 1;
            S.WaitTicksRemaining = Math.Max(0, w);
            if (w > 0)
                return ExtensionStepResult.Running;
            switch (phase)
            {
                case ExtensionPhase.CC3Wait:
                    S.Phase = ExtensionPhase.CC3Loop;
                    return ExtensionStepResult.Running;
                case ExtensionPhase.CC3Disconfirm:
                    if (FlowCD3Direct.RunC3ScreenshotState() == D3StartGameAndTeleport.StateDisconnect)
                    {
                        S.Phase = ExtensionPhase.CC4Branch;
                        S.BranchResult = ExtensionFlowState.BranchDisconnect;
                    }
                    else
                    {
                        S.LastC3State = null;
                        S.Phase = ExtensionPhase.CC3Loop;
                    }
                    return ExtensionStepResult.Running;
                case ExtensionPhase.CC10Wait:
                    S.Phase = ExtensionPhase.CC10Compare;
                    return ExtensionStepResult.Running;
                default:
                    S.Phase = ExtensionPhase.CC7aVerifyBounty;
                    return ExtensionStepResult.Running;
            }
        }

        switch (phase)
        {
            case ExtensionPhase.CEntry:
                if (!FlowCD3Direct.RunC1Entry(true, true))
                    return ResetAndFallthrough(endD3: false);
                ColorPrinter.Gray($"{LogPrefix} [C1] entry -> [C2] Resize -> [C3] loop (tick-driven)");
                FlowCD3Direct.RunC2Resize();
                S.Phase = ExtensionPhase.CC3Loop;
                S.DeadlineTick = currentTick + D3InterfaceConstants.C3DeadlineTicks;
                return ExtensionStepResult.Running;

            case ExtensionPhase.CC3Loop:
                return StepC3Loop(currentTick);

            case ExtensionPhase.CF1WaitGameTool:
                return StepC5wWaitGameTool(currentTick);

            case ExtensionPhase.CC4Branch:
                return StepC4Branch(currentTick);

            case ExtensionPhase.CC10SendM:
                if (S.Titles is not { Count: > 0 })
                    S.Titles = D3WindowConstants.DiabloIIIWindowTitles;
                if (!D3StartGameAndTeleport.StepC10SendM())
                    return ResetAndFallthrough(endD3: true);
                S.Phase = ExtensionPhase.CC10Wait;
                S.WaitTicksRemaining = 1;
                return ExtensionStepResult.Running;

            case ExtensionPhase.CC10Compare:
                if (D3StartGameAndTeleport.StepC10Compare() != true)
                    return ResetAndFallthrough(endD3: true);
                S.C7aRound = 1;
                S.Phase = ExtensionPhase.CC7aSendM;
                return ExtensionStepResult.Running;

            case ExtensionPhase.CC7aVerifyBounty:
                return StepC7aVerifyBounty();

            case ExtensionPhase.CC7aSendM:
                if (D3StartGameAndTeleport.StepC7aVerifyBountyProgress())
                {
                    ColorPrinter.Green($"{LogPrefix}[C7a] Pre-check found bounty progress, map open -> immediately map_teleport action group (per doc: click in same tick)");
                    StartMapTeleportActionGroup();
                    return ExtensionStepResult.Running;
                }
                if (!D3StartGameAndTeleport.StepC7aSendM())
                    return ResetAndFallthrough(endD3: true);
                S.Phase = ExtensionPhase.CC7aWait;
                S.WaitTicksRemaining = 1;
                return ExtensionStepResult.Running;

            case ExtensionPhase.CC7bMinimize:
                ColorPrinter.Gray($"{LogPrefix}[C7b] Received C_C7b_MINIMIZE, ensure map open first: redirect to C7a");
                S.C7aRound = 1;
                S.Phase = ExtensionPhase.CC7aSendM;
                return ExtensionStepResult.Running;
        }
        return ExtensionStepResult.Running;
    }

    private static ExtensionStepResult StepActionGroup(Action startRosbotTask)
    {
        var groupId = S.ActionGroupId;
        int stepIndex = S.ActionGroupStepIndex;
        var group = ActionGroupRegistry.Get(groupId);
        if (group == null)
            return ResetAndFallthrough(endD3: true);
        var result = group.RunStep(stepIndex, S.ActionGroupContext);
        if (result == ActionStepResult.Fail)
            return ResetAndFallthrough(endD3: true);
        if (result == ActionStepResult.Done)
        {
            if (groupId == MapTeleportGroup.GroupId)
            {
                GameInterfaceData.Instance.SetD3Status(true);
                RosbotManager.Instance.KillIfRunning();
                if (RosbotFlowHost.GetConfig(ConfigAutoStartRosbot, true) && RosbotManager.Instance.Start())
                {
                    F3LogTimeout.SetRosbotStartedAt();
                    startRosbotTask();
                }
                S.SetLastTeleportSuccessNow();
            }
            S.Reset();
            return ExtensionStepResult.Success;
        }
        S.ActionGroupStepIndex = stepIndex + 1;
        return ExtensionStepResult.Running;
    }

    private static ExtensionStepResult StepC3Loop(int currentTick)
    {
        var state = FlowCD3Direct.RunC3ScreenshotState();
        if (currentTick >= S.DeadlineTick)
        {
            S.Phase = ExtensionPhase.CC4Branch;
            S.BranchResult = state ?? ExtensionFlowState.BranchOther;
            return ExtensionStepResult.Running;
        }
        if (state == D3StartGameAndTeleport.StateDisconnect)
        {
            S.LastC3State = D3StartGameAndTeleport.StateDisconnect;
            S.Phase = ExtensionPhase.CC3Disconfirm;
            S.WaitTicksRemaining = 1;
            return ExtensionStepResult.Running;
        }
        if (state == D3StartGameAndTeleport.StateGameTool)
        {
            S.Phase = ExtensionPhase.CC4Branch;
            S.BranchResult = ExtensionFlowState.BranchGameTool;
            return ExtensionStepResult.Running;
        }
        if (state == D3StartGameAndTeleport.StateStart)
        {
            ColorPrinter.Gray($"{LogPrefix}[C5] Before starting D3 try to end ROSBOT to avoid ROSBOT running while others not causing later check to exit");
            RosbotManager.Instance.KillIfRunning();
            if (D3StartGameAndTeleport.ClickStartGameButtonIfFound())
                S.DeadlineTick = currentTick + D3InterfaceConstants.C3DeadlineTicks;
        }
        S.Phase = ExtensionPhase.CC3Wait;
        S.WaitTicksRemaining = 1;
        return ExtensionStepResult.Running;
    }

    private static ExtensionStepResult StepC5wWaitGameTool(int currentTick)
    {
        if (currentTick >= S.DeadlineTick)
        {
            ColorPrinter.Yellow($"{LogPrefix}[Fragment1] C5w timeout -> C12");
            return ResetAndFallthrough(endD3: true);
        }
        var state = D3StartGameAndTeleport.DetectD3AlreadyRunningState();
        if (state == D3StartGameAndTeleport.StateGameTool)
        {
            ColorPrinter.Green($"{LogPrefix}[Fragment1] d3_game_tool appeared after Start Game click");
            S.Phase = ExtensionPhase.CC10SendM;
            return ExtensionStepResult.Running;
        }
        if (state == D3StartGameAndTeleport.StateDisconnect)
        {
            ColorPrinter.Yellow($"{LogPrefix}[Fragment1] d3_disconnected during C5w -> C12");
            return ResetAndFallthrough(endD3: true);
        }
        return ExtensionStepResult.Running;
    }

    private static ExtensionStepResult StepC4Branch(int currentTick)
    {
        var branch = S.BranchResult ?? ExtensionFlowState.BranchOther;
        if (branch == ExtensionFlowState.BranchDisconnect)
        {
            ColorPrinter.Yellow($"{LogPrefix}[C4] D3 disconnected, F1d+F1c then C12->D1");
            FlowCD3Direct.RunC4DisconnectThenF1dF1c();
            S.Reset();
            return ExtensionStepResult.Fallthrough;
        }
        if (branch == ExtensionFlowState.BranchStart)
        {
            S.Titles = D3WindowConstants.DiabloIIIWindowTitles;
            S.DeadlineTick = currentTick + D3InterfaceConstants.C5wDeadlineTicks;
            S.Phase = ExtensionPhase.CF1WaitGameTool;
            return ExtensionStepResult.Running;
        }
        if (branch == ExtensionFlowState.BranchGameTool)
        {
            S.Titles = D3WindowConstants.DiabloIIIWindowTitles;
            bool justEntered = S.D3JustEntered;
            bool skipC10JustOpened = S.IsInTeleportCooldown();
            if (justEntered || skipC10JustOpened)
            {
                if (skipC10JustOpened && !justEntered)
                    ColorPrinter.Gray($"{LogPrefix}[C3_GameToolOrigin] Teleport just completed, skip C10 (fresh game not check M disconnect) -> C7a");
                else
                    ColorPrinter.Gray($"{LogPrefix}[C3_GameToolOrigin] Just entered game (D13), skip C6/C10 -> C7a");
                S.C7aRound = 1;
                S.Phase = ExtensionPhase.CC7aSendM;
            }
            else
            {
                S.Phase = ExtensionPhase.CC10SendM;
            }
            return ExtensionStepResult.Running;
        }
        return ResetAndFallthrough(endD3: true);
    }

    private static ExtensionStepResult StepC7aVerifyBounty()
    {
        if (D3StartGameAndTeleport.StepC7aVerifyBountyProgress())
        {
            ColorPrinter.Green($"{LogPrefix}[C7a] Bounty progress found, map open -> immediately map_teleport action group (per doc: click in same tick)");
            StartMapTeleportActionGroup();
            return ExtensionStepResult.Running;
        }
        if (S.C7aRound == 1)
        {
            ColorPrinter.Gray($"{LogPrefix}[C7a] Round 1 no bounty progress, round 2 press M and detect again");
            S.C7aRound = 2;
            if (!D3StartGameAndTeleport.StepC7aSendM())
                return ResetAndFallthrough(endD3: true);
            S.Phase = ExtensionPhase.CC7aWait;
            S.WaitTicksRemaining = 1;
            return ExtensionStepResult.Running;
        }
        ColorPrinter.Yellow($"{LogPrefix}[C7a] No bounty progress after two M rounds; per doc do not kill D3, still run map_teleport action group");
        StartMapTeleportActionGroup();
        return ExtensionStepResult.Running;
    }

    /// <summary>Start the map_teleport action group (minimize -> wait one tick -> teleport), one step per tick.</summary>
    private static void StartMapTeleportActionGroup()
    {
        S.Phase = ExtensionPhase.CActionGroup;
        S.ActionGroupId = MapTeleportGroup.GroupId;
        S.ActionGroupStepIndex = 0;
        S.ActionGroupContext = new Dictionary<string, object?>
        {
            [MapTeleportGroup.ContextKeyTitles] = S.GetTitlesOrDefault().ToList(),
        };
    }

    private static ExtensionStepResult ResetAndFallthrough(bool endD3)
    {
        if (endD3) FlowCD3Direct.RunC12EndD3();
        S.Reset();
        return ExtensionStepResult.Fallthrough;
    }
}
