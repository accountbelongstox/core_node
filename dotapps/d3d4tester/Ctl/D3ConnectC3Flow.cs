using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Flow;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Ctl;

/// <summary>Result of the blocking C3 loop.</summary>
public enum C3LoopResult
{
    /// <summary>Start or game_tool path completed (teleport + ROSBOT).</summary>
    Success,

    /// <summary>F1d + F1c ran; caller must not restart Battle.net (next tick F_Entry -> B2).</summary>
    Disconnect,

    /// <summary>D3 still connecting; do not kill D3 or restart Battle.net, retry next tick.</summary>
    Connecting,

    /// <summary>Other / timeout; caller may retry from D14.</summary>
    Fallthrough,
}

/// <summary>
/// Blocking C3 connect loop (caller ran C2 resize): capture + match all states each C3W_WAIT; disconnect double-confirm;
/// d3_start_game_button click resets the 3-minute deadline; D13 game_tool needs two consecutive hits; then C4 branch
/// (start -> fragment 1 + C10/C7; game_tool -> fragment 2 or, in teleport cooldown, ROSBOT start clicks only) and ROSBOT (re)start.
/// 1:1 Python controller/login_try_screenshot_controller.py _run_c3_loop_and_handle_branch.
/// </summary>
public static class D3ConnectC3Flow
{
    private const string LogPrefix = "[LoginTryScreenshotController]";
    private const int RosbotRestartPauseMs = 1000;

    public static C3LoopResult RunC3LoopAndHandleBranch(bool d3JustEntered = false)
    {
        var deadline = DateTime.UtcNow.AddSeconds(D3InterfaceConstants.C3C3wTimeoutSec);
        string? state = null;
        while (DateTime.UtcNow < deadline)
        {
            if (!D3Manager.Instance.IsRunning())
            {
                ColorPrinter.Gray($"{LogPrefix} [C3] D3 no longer running (e.g. F4 killed), break to D block");
                state = null;
                break;
            }
            state = FlowCD3Direct.RunC3ScreenshotState();
            if (state == D3StartGameAndTeleport.StateDisconnect)
            {
                WaitC3w();
                if (FlowCD3Direct.RunC3ScreenshotState() == D3StartGameAndTeleport.StateDisconnect)
                    break;
                ColorPrinter.Gray($"{LogPrefix} [C3] disconnect not confirmed (second step != disconnect), continue loop");
                WaitC3w();
                continue;
            }
            if (state == D3StartGameAndTeleport.StateGameTool)
            {
                if (d3JustEntered)
                {
                    WaitC3w();
                    var state2 = FlowCD3Direct.RunC3ScreenshotState();
                    if (state2 != D3StartGameAndTeleport.StateGameTool)
                    {
                        state = state2;
                        WaitC3w();
                        continue;
                    }
                }
                break;
            }
            if (state == D3StartGameAndTeleport.StateStart)
            {
                if (D3StartGameAndTeleport.ClickStartGameButtonIfFound())
                {
                    deadline = DateTime.UtcNow.AddSeconds(D3InterfaceConstants.C3C3wTimeoutSec);
                    ColorPrinter.Gray($"{LogPrefix} [C3] d3_start_game_button detected, clicked and reset 3min (Start Game may be stuck)");
                }
                WaitC3w();
                continue;
            }
            WaitC3w();
        }
        if (DateTime.UtcNow >= deadline && state is not (D3StartGameAndTeleport.StateDisconnect or D3StartGameAndTeleport.StateStart or D3StartGameAndTeleport.StateGameTool))
        {
            if (state == D3StartGameAndTeleport.StateWait)
            {
                ColorPrinter.Gray($"{LogPrefix} [C3] timeout but last state was connecting (wait), do not kill D3, next tick retry");
                return C3LoopResult.Connecting;
            }
            state = FlowCD3Direct.RunC3ScreenshotState();
        }
        ColorPrinter.Gray($"{LogPrefix} [C] progress: run_c4_branch_result -> {state ?? "None"} (d3_just_entered={d3JustEntered})");
        string branch;
        if (state == D3StartGameAndTeleport.StateGameTool && d3JustEntered)
        {
            branch = ExtensionFlowState.BranchGameTool;
            ColorPrinter.Gray($"{LogPrefix} [C] progress: branch_result={branch} (skip C10: D13 just entered game, ROSBOT_FLOW_MERMAID)");
        }
        else
        {
            branch = FlowCD3Direct.RunC4BranchResult(state);
            ColorPrinter.Gray($"{LogPrefix} [C] progress: branch_result={branch}");
        }

        if (branch == ExtensionFlowState.BranchDisconnect)
        {
            if (state == D3StartGameAndTeleport.StateDisconnect)
                ColorPrinter.Yellow($"{LogPrefix}[C4] D3 disconnected (C3 template: run_c3_screenshot_state matched d3_disconnected), F1d+F1c then C12->D1");
            else
                ColorPrinter.Yellow($"{LogPrefix}[C4] D3 disconnected (C10b: check_d3_online_by_m_similarity returned False, before/after M >= threshold), F1d+F1c then C12->D1");
            FlowCD3Direct.RunC4DisconnectThenF1dF1c();
            return C3LoopResult.Disconnect;
        }
        if (branch == ExtensionFlowState.BranchStart)
        {
            var r1 = D3StartGameAndTeleport.TryFragment1ClickStartGameWaitGameTool();
            if (r1 == true && D3StartGameAndTeleport.SendMThenTeleportThreeClicks())
            {
                OnTeleportSuccessRestartRosbot();
                return C3LoopResult.Success;
            }
            if (r1 != true)
                FlowCD3Direct.RunC12EndD3();
            return C3LoopResult.Fallthrough;
        }
        if (branch == ExtensionFlowState.BranchGameTool)
        {
            if (ExtensionFlowState.Instance.IsInTeleportCooldown())
            {
                RosbotUiAutomation.RunAfterRosbotStart(doDebug: true, doTab: true, doStartBotting: true);
                return C3LoopResult.Success;
            }
            if (D3StartGameAndTeleport.TryFragment2GameToolPressMThenClicks())
            {
                OnTeleportSuccessRestartRosbot();
                return C3LoopResult.Success;
            }
            FlowCD3Direct.RunC12EndD3();
            return C3LoopResult.Fallthrough;
        }
        if (branch == ExtensionFlowState.BranchWait)
        {
            ColorPrinter.Gray($"{LogPrefix} [C3] connecting (wait): do not kill D3, next tick retry");
            return C3LoopResult.Connecting;
        }
        FlowCD3Direct.RunC12EndD3();
        return C3LoopResult.Fallthrough;
    }

    /// <summary>Teleport done: mark success, D3 running, kill + (auto) start ROSBOT, F3 baseline, task start, ROSBOT start clicks.</summary>
    private static void OnTeleportSuccessRestartRosbot()
    {
        ExtensionFlowState.Instance.SetLastTeleportSuccessNow();
        GameInterfaceData.Instance.SetD3Status(true);
        RosbotManager.Instance.KillIfRunning();
        Thread.Sleep(RosbotRestartPauseMs);
        if (ConfigBinding.GetValue(ConfigKeys.RosSettingsAutoStartRosbot, true) && RosbotManager.Instance.Start())
        {
            F3LogTimeout.SetRosbotStartedAt();
            RosbotFlowHost.Current?.StartRosbotTask();
            RosbotUiAutomation.RunAfterRosbotStart(doDebug: true, doTab: true, doStartBotting: true);
        }
    }

    private static void WaitC3w() => Thread.Sleep(TimeSpan.FromSeconds(D3InterfaceConstants.C3wWaitSec));
}
