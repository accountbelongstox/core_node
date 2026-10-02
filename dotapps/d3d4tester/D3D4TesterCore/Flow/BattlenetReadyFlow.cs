// PY-REF: pyapps/d3-check/d3utils/rosbot_flow_battlenet.py
// PY-REF: pyapps/d3-check/d3utils/tick_driver.py
using DotApps.d3d4tester.Core.Battlenet;
using DotCore.Foundations;
using C = DotApps.d3d4tester.Core.Battlenet.BattlenetConstants;

namespace DotApps.d3d4tester.Core.Flow;

/// <summary>
/// Battle.net ready flow (B block) as a tick state machine: BN_Entry -> BN_Win -> BN_First/BN_Start -> ... -> BN_Confirmed.
/// One call per 2 s flow tick; runs several steps in the same tick until a wait node or a result. Two contexts:
/// noActivate=true (Ensure Battle.net only, no window activation / no tab clicks) and noActivate=false (Flow master).
/// Results: "confirmed" | "exit" | "wait" | "".
/// 1:1 Python d3utils/rosbot_flow_battlenet.py (tick_battlenet_ready_flow, reset_flow_master_bn_block, helpers).
/// </summary>
public static class BattlenetReadyFlow
{
    public const string ResultConfirmed = "confirmed";
    public const string ResultExit = "exit";
    public const string ResultWait = "wait";
    public const string ResultNone = "";

    private const string LogTag = "[BNFlow]";
    private const int MaxStepsPerTick = 64;

    private static readonly object TickLock = new();

    /// <summary>Reset Flow-master's B block (flow master turned off / shutdown hook). 1:1 Python reset_flow_master_bn_block.</summary>
    public static void ResetFlowMasterBnBlock() => BnBlockState.Reset(false);

    /// <summary>Current node of one flow (debug). 1:1 Python get_battlenet_flow_node.</summary>
    public static BnStep GetBattlenetFlowNode(bool forBnOnly = false) => BnBlockState.GetCurrentStep(forBnOnly);

    /// <summary>True if either flow is on a login step. 1:1 Python is_bn_flow_in_login_phase().</summary>
    public static bool IsBnFlowInLoginPhase() => BnBlockState.IsInLoginPhase(true) || BnBlockState.IsInLoginPhase(false);

    /// <summary>Clear both flows' tick-confirmed; true if either was set. 1:1 Python get_and_clear_battlenet_tick_confirmed().</summary>
    public static bool GetAndClearBattlenetTickConfirmed()
    {
        bool bnOnly = BnBlockState.Get(true).GetAndClearTickConfirmed();
        bool flowMaster = BnBlockState.Get(false).GetAndClearTickConfirmed();
        return bnOnly || flowMaster;
    }

    /// <summary>
    /// Run one tick of the Battle.net ready flow. Returns (Done, Result); Done=true when the flow exits or is confirmed.
    /// 1:1 Python tick_battlenet_ready_flow(no_activate).
    /// </summary>
    public static (bool Done, string Result) Tick(bool noActivate = false)
    {
        lock (TickLock)
            return TickCore(noActivate);
    }

    private static (bool Done, string Result) TickCore(bool noActivate)
    {
        bool forBnOnly = noActivate;
        var ctx = BnBlockState.Get(forBnOnly);
        if (noActivate && !RosbotFlowState.Instance.BnOnlyEnabled)
        {
            ColorPrinter.Gray($"{LogTag} flow aborted | reason: Ensure Battle.net only disabled this tick");
            BnBlockState.Reset(true);
            return (true, ResultExit);
        }
        string? bnPath = BattlenetManager.Instance.GetPath();
        if (bnPath == null)
        {
            ColorPrinter.Yellow($"{LogTag} No battlenet path, skip");
            return (true, ResultExit);
        }

        var op = BattlenetOperationFactory.GetOperation();
        var game = GameInterfaceData.Instance;
        double now = NowSec();

        for (int guard = 0; guard < MaxStepsPerTick; guard++)
        {
            ColorPrinter.Gray($"{LogTag} progress: tick_battlenet_ready_flow node={ctx.CurrentStep}");
            switch (ctx.CurrentStep)
            {
                case BnStep.BN_Entry:
                    ColorPrinter.Blue($"{LogTag} flow B1→B2 | reason: entry (F1 No->B2 per diagram), check Battle.net window this tick");
                    ctx.CurrentStep = BnStep.BN_Win;
                    continue;

                case BnStep.BN_Win:
                {
                    if (!game.GetStateSnapshot().BattlenetWindowFound)
                    {
                        ColorPrinter.Blue($"{LogTag} flow B2→B3 | reason: no window, start Battle.net");
                        ctx.CurrentStep = BnStep.BN_Start;
                        continue;
                    }
                    ColorPrinter.Gray($"{LogTag} progress: B2 has window (from refresh)");
                    op.SaveUiElementsSnapshot("B2", "B2_has_window");
                    ColorPrinter.Blue($"{LogTag} flow B2→B4 | reason: has window, check if current is login page (flowchart B4)");
                    ctx.CurrentStep = BnStep.BN_First;
                    continue;
                }

                case BnStep.BN_Start:
                    ColorPrinter.Blue($"{LogTag} flow B3→B7 | reason: started Battle.net, wait {(int)C.FlowWaitAfterStartSec}s then poll elements");
                    BattlenetManager.Instance.Start(bnPath);
                    ctx.WaitUntil = now + C.FlowWaitAfterStartSec;
                    ctx.B7PollDeadline = 0;
                    ctx.B7SkipCount = 0;
                    ctx.CurrentStep = BnStep.BN_Wait;
                    return (false, ResultNone);

                case BnStep.BN_Wait:
                {
                    if (now < ctx.WaitUntil)
                    {
                        ColorPrinter.Gray($"{LogTag} flow B7 skip this tick | reason: wait deadline not reached, wait");
                        return (false, ResultWait);
                    }
                    if (ctx.B7PollDeadline == 0)
                        ctx.B7PollDeadline = now + C.FlowPollTimeoutSec;
                    if (now >= ctx.B7PollDeadline)
                    {
                        ColorPrinter.Yellow($"{LogTag} flow B7→B5 | reason: [B8] timeout no elements found ({(int)C.FlowPollTimeoutSec}s = 2 min), exit and restart");
                        ctx.B5EntryReason = "B7_timeout_no_elements";
                        ctx.CurrentStep = BnStep.BN_Exit;
                        ctx.B7PollDeadline = 0;
                        ctx.B7SkipCount = 0;
                        continue;
                    }
                    op.SaveUiElementsSnapshot("B7", "B7_poll_elements");
                    ColorPrinter.Gray($"{LogTag} progress: B7 get_dynamic_state...");
                    var s = op.GetDynamicState();
                    bool elemReady = s.NormalAvailable || s.Disconnected || (s.OnLogin && (op.IsLoginScreenReady() || op.IsOnAsiaLoginScreen()));
                    if (elemReady)
                    {
                        ctx.B7SkipCount = 0;
                        if (op.IsLoginFailedScreen())
                        {
                            ColorPrinter.Yellow($"{LogTag} flow B7→B5 | reason: login failed (Continue Offline/Cancel), exit Battle.net and back to B1");
                            ctx.B5EntryReason = "B7_login_failed";
                            ctx.CurrentStep = BnStep.BN_Exit;
                            continue;
                        }
                        ColorPrinter.Blue($"{LogTag} flow B7→B8→B9 | reason: operable UI found (main/disconnected/login-ready), first screen B9");
                        ctx.CurrentStep = BnStep.BN_WaitResult;
                        ctx.B7PollDeadline = 0;
                        continue;
                    }
                    if (op.TryClosePopup())
                    {
                        ColorPrinter.Gray($"{LogTag} flow B7 skip this tick | reason: closed popup, wait next tick");
                        return (false, ResultWait);
                    }
                    ctx.B7SkipCount++;
                    if (ctx.B7SkipCount >= C.B7TriggerDAfterSkips && (now - ctx.B7LastTriggerTime) >= C.B7TriggerDCooldownSec)
                    {
                        ColorPrinter.Blue($"{LogTag} flow B7: no operable elements for {ctx.B7SkipCount} ticks -> trigger D block (D3 tab, Play, region)");
                        ExtensionFlowState.Instance.SetRequestDBlockFromB7();
                        BattlenetFlowHooks.TriggerExtensionRosbotStart?.Invoke();
                        ctx.B7SkipCount = 0;
                        ctx.B7LastTriggerTime = now;
                    }
                    ColorPrinter.Gray($"{LogTag} flow B7 skip this tick | reason: no operable elements yet (may still be loading), wait");
                    return (false, ResultWait);
                }

                case BnStep.BN_WaitResult:
                    op.SaveUiElementsSnapshot("B8", "B8_to_B9");
                    ColorPrinter.Blue($"{LogTag} flow B8→B9 | reason: elements found, enter first screen B9");
                    ctx.CurrentStep = BnStep.BN_UI;
                    continue;

                case BnStep.BN_UI:
                {
                    if (!game.GetStateSnapshot().BattlenetWindowFound)
                    {
                        ColorPrinter.Blue($"{LogTag} flow B9→B2 | reason: no window this tick, re-check (avoid unknown→B5)");
                        ctx.CurrentStep = BnStep.BN_Win;
                        continue;
                    }
                    op.SaveUiElementsSnapshot("B9", "B9_first_screen");
                    if (op.IsLoginFailedScreen())
                    {
                        ColorPrinter.Yellow($"{LogTag} flow B9→B5 | reason: login failed (Continue Offline/Cancel), exit Battle.net and back to B1");
                        ctx.B5EntryReason = "B9_login_failed";
                        ctx.CurrentStep = BnStep.BN_Exit;
                        continue;
                    }
                    ColorPrinter.Blue($"{LogTag} flow B9 first screen | reason: decide current UI (login/main/disconnected/other)");
                    ColorPrinter.Gray($"{LogTag} progress: B9 get_dynamic_state...");
                    var s = op.GetDynamicState();
                    if (s.Connecting)
                    {
                        ColorPrinter.Gray($"{LogTag} connecting, keep wait");
                        return (false, ResultWait);
                    }
                    if (s.NormalAvailable)
                    {
                        ColorPrinter.Green($"{LogTag} flow B9→B12 continue | reason: main/logged-in (D3 tab+{PlayLabel(s.PlayButtonName)} visible), confirmed");
                        return Confirm(ctx);
                    }
                    if (s.OnLogin)
                    {
                        if (op.IsOnBrowserLoginWaitScreen())
                        {
                            ColorPrinter.Blue($"{LogTag} flow B9→B5 | reason: browser login wait popup, exit Battle.net (flowchart)");
                            ctx.B5EntryReason = "B9_browser_login_wait";
                            ctx.CurrentStep = BnStep.BN_Exit;
                            continue;
                        }
                        if (PreferredRegion() == C.RegionAsia)
                        {
                            ColorPrinter.Blue($"{LogTag} flow B9→BN_LoginAsia | reason: region Asia, run Asia login");
                            ctx.CurrentStep = BnStep.BN_LoginAsia;
                        }
                        else
                        {
                            ColorPrinter.Blue($"{LogTag} flow B9→B10 | reason: login screen (CN), step1 agree and confirm");
                            ctx.CurrentStep = BnStep.BN_Login1;
                        }
                        continue;
                    }
                    if (s.Disconnected)
                    {
                        ColorPrinter.Blue($"{LogTag} flow B9→B5 | reason: disconnected, exit and restart");
                        ctx.B5EntryReason = "B9_disconnected";
                        ctx.CurrentStep = BnStep.BN_Exit;
                        continue;
                    }
                    ColorPrinter.Blue($"{LogTag} flow B9→B6 | reason: unknown state (flowchart B15c→B6), re-activate and poll");
                    ctx.CurrentStep = BnStep.BN_Act;
                    continue;
                }

                case BnStep.BN_Login1:
                {
                    op.SaveUiElementsSnapshot("B10", "B10_agree_netease");
                    ColorPrinter.Blue($"{LogTag} flow B10 run | reason: step1 agree+NetEase immediately, then B11 web login automation");
                    if (!noActivate)
                    {
                        op.ActivateWindow();
                        Thread.Sleep(C.ActivateSettleMs);
                    }
                    if (!op.PerformCnLoginFlow(0))
                        ColorPrinter.Yellow($"{LogTag} flow B10→B11 | reason: agree/NetEase failed, still go B11 wait OAuth return");
                    else
                        ColorPrinter.Blue($"{LogTag} flow B10→B11 | reason: agree/NetEase done, same-tick try web login automation");
                    BattlenetFlowHooks.ResetOauthDone?.Invoke();
                    ctx.OauthWaitUntil = now + C.FlowOauthWaitSec;
                    ctx.BrowserFallbackDeadline = 0;
                    ctx.B11DeadlineTick = CurrentFlowTick() + C.B11MaxTicks;
                    if (RunWebLoginPoll())
                    {
                        ColorPrinter.Green($"{LogTag} flow B10→B12 same-tick | reason: web login success right after agree");
                        ctx.B11DeadlineTick = 0;
                        return Confirm(ctx);
                    }
                    ctx.CurrentStep = BnStep.BN_Login2;
                    return (false, ResultNone);
                }

                case BnStep.BN_Login2:
                {
                    op.SaveUiElementsSnapshot("B11", "B11_browser_ocr");
                    if (op.IsLoginFailedScreen())
                    {
                        ColorPrinter.Yellow($"{LogTag} flow B11→B5 | reason: login failed (Continue Offline/Cancel), exit Battle.net and back to B1");
                        ctx.B5EntryReason = "B11_login_failed";
                        ctx.CurrentStep = BnStep.BN_Exit;
                        continue;
                    }
                    int currentTick = CurrentFlowTick();
                    if (ctx.B11DeadlineTick == 0)
                    {
                        ctx.B11DeadlineTick = currentTick + C.B11MaxTicks;
                        ColorPrinter.Blue($"{LogTag} flow B11 | web login by UI automation: popup/browser confirm or login form (timeout {C.B11MaxTicks} ticks = {(int)C.BrowserLoginTimeoutSec}s)");
                    }
                    if (currentTick >= ctx.B11DeadlineTick)
                    {
                        ColorPrinter.Yellow($"{LogTag} flow B11→B5 | reason: web login timeout ({C.B11MaxTicks} ticks), exit and restart");
                        ctx.B5EntryReason = "B11_browser_fallback_timeout";
                        ctx.B11DeadlineTick = 0;
                        ctx.CurrentStep = BnStep.BN_Exit;
                        continue;
                    }
                    if (RunWebLoginPoll())
                    {
                        ColorPrinter.Green($"{LogTag} flow B11→B12 continue | reason: web login success, confirmed");
                        ctx.B11DeadlineTick = 0;
                        return Confirm(ctx);
                    }
                    ColorPrinter.Gray($"{LogTag} flow B11 skip this tick | reason: web login automation polling (popup/browser confirm or login form), wait");
                    return (false, ResultWait);
                }

                case BnStep.BN_LoginAsia:
                {
                    if (BattlenetFlowHooks.IsCredentialsDialogPending())
                    {
                        ColorPrinter.Gray($"{LogTag} flow BN_LoginAsia skip | reason: credentials dialog open, skip tick until closed");
                        return (false, ResultWait);
                    }
                    var creds = BattlenetFlowHooks.GetAsiaCredentials?.Invoke();
                    if (creds == null)
                    {
                        BattlenetFlowHooks.ScheduleCredentialsDialog?.Invoke();
                        ColorPrinter.Gray($"{LogTag} flow BN_LoginAsia skip | reason: no cached credentials, dialog scheduled once");
                        return (false, ResultWait);
                    }
                    op.SaveUiElementsSnapshot("BN_LoginAsia", "asia_login");
                    if (!noActivate)
                    {
                        op.ActivateWindow();
                        Thread.Sleep(C.ActivateSettleMs);
                    }
                    if (op.IsOnAsiaLoginScreen() && op.PerformAsiaLoginFillAndSubmit(creds.Value.Email, creds.Value.Password))
                        ColorPrinter.Blue($"{LogTag} flow BN_LoginAsia | reason: fill whatever present + submit done, re-poll UI");
                    ctx.CurrentStep = BnStep.BN_UI;
                    continue;
                }

                case BnStep.BN_First:
                {
                    op.SaveUiElementsSnapshot("B4", "B4_first_check");
                    if (op.IsLoginFailedScreen())
                    {
                        ColorPrinter.Yellow($"{LogTag} flow B4→B5 | reason: login failed (Continue Offline/Cancel), exit Battle.net and back to B1");
                        ctx.B5EntryReason = "B4_login_failed";
                        ctx.CurrentStep = BnStep.BN_Exit;
                        continue;
                    }
                    if (op.IsOnBrowserLoginWaitScreen())
                    {
                        ColorPrinter.Blue($"{LogTag} flow B4→B5 | reason: browser login wait popup, exit Battle.net (flowchart)");
                        ctx.B5EntryReason = "B4_browser_login_wait";
                        ctx.CurrentStep = BnStep.BN_Exit;
                        continue;
                    }
                    if (game.GetStateSnapshot().BattlenetOnLoginScreen)
                    {
                        ColorPrinter.Blue($"{LogTag} flow B4→B5 | reason: current is login page (CN/Asia), exit then B1→B3→B7→B9→B10/BN_LoginAsia");
                        ctx.B5EntryReason = "B4_login_page_CN_Asia";
                        ctx.CurrentStep = BnStep.BN_Exit;
                        continue;
                    }
                    ColorPrinter.Blue($"{LogTag} flow B4→B6 | reason: current not login page (flowchart: no->activate, poll UI)");
                    ctx.CurrentStep = BnStep.BN_Act;
                    continue;
                }

                case BnStep.BN_Act:
                    op.SaveUiElementsSnapshot("B6", "B6_to_WaitPlay_or_B13");
                    if (!noActivate)
                    {
                        BattlenetManager.Instance.ActivateWindow();
                        if (op.ClickD3Tab())
                        {
                            ColorPrinter.Blue($"{LogTag} flow B6→BN_WaitPlay | reason: clicked D3 tab, wait Play only (skip full UI traverse)");
                            ctx.B13PollDeadline = now + C.FlowWaitPlaySec;
                            ctx.CurrentStep = BnStep.BN_WaitPlay;
                            continue;
                        }
                        ColorPrinter.Blue($"{LogTag} flow B6→B13 | reason: D3 tab not found or already selected, enter B13 poll");
                    }
                    else
                        ColorPrinter.Blue($"{LogTag} flow B6→B13 | reason: UI poll only (no activate), enter B13 poll state");
                    ctx.CurrentStep = BnStep.BN_Poll;
                    continue;

                case BnStep.BN_WaitPlay:
                    if (op.ClickPlayButtonIfVisible(forceRefresh: true))
                    {
                        ColorPrinter.Green($"{LogTag} flow BN_WaitPlay→BN_Confirmed | reason: Play visible, clicked (skip full traverse)");
                        return Confirm(ctx);
                    }
                    if (now >= ctx.B13PollDeadline)
                    {
                        ColorPrinter.Blue($"{LogTag} flow BN_WaitPlay→B13 | reason: wait Play timeout, full poll");
                        ctx.B13PollDeadline = now + C.FlowPollTimeoutSec;
                        ctx.CurrentStep = BnStep.BN_Poll;
                        continue;
                    }
                    return (false, ResultWait);

                case BnStep.BN_Poll:
                {
                    if (ctx.B13PollDeadline == 0)
                        ctx.B13PollDeadline = now + C.FlowPollTimeoutSec;
                    op.SaveUiElementsSnapshot("B13", "B13_poll");
                    if (op.IsLoginFailedScreen())
                    {
                        ColorPrinter.Yellow($"{LogTag} flow B13→B5 | reason: login failed (Continue Offline/Cancel), exit Battle.net and back to B1");
                        ctx.B5EntryReason = "B13_login_failed";
                        ctx.CurrentStep = BnStep.BN_Exit;
                        continue;
                    }
                    var s = op.GetDynamicState();
                    if (s.Connecting)
                    {
                        ColorPrinter.Gray($"{LogTag} connecting, keep wait");
                        return (false, ResultWait);
                    }
                    if (s.NormalAvailable)
                    {
                        ColorPrinter.Green($"{LogTag} flow B13→B16 continue | reason: [B14] poll logged-in (D3 tab+{PlayLabel(s.PlayButtonName)} visible), confirmed");
                        return Confirm(ctx);
                    }
                    if (s.Disconnected)
                    {
                        ColorPrinter.Blue($"{LogTag} flow B13→B5 | reason: [B15a] disconnected, exit and restart");
                        ctx.B5EntryReason = "B13_disconnected";
                        ctx.CurrentStep = BnStep.BN_Exit;
                        continue;
                    }
                    if (op.IsOnBrowserLoginWaitScreen())
                    {
                        ColorPrinter.Blue($"{LogTag} flow B13→B5 | reason: browser login wait popup, exit Battle.net (flowchart)");
                        ctx.B5EntryReason = "B13_browser_login_wait";
                        ctx.CurrentStep = BnStep.BN_Exit;
                        continue;
                    }
                    if (s.OnLogin)
                    {
                        if (PreferredRegion() == C.RegionAsia)
                        {
                            ColorPrinter.Blue($"{LogTag} flow B13→BN_LoginAsia | reason: region Asia, go Asia login");
                            ctx.CurrentStep = BnStep.BN_LoginAsia;
                        }
                        else
                        {
                            ColorPrinter.Blue($"{LogTag} flow B13→B10 | reason: poll result login screen (CN), go B10/B11");
                            ctx.CurrentStep = BnStep.BN_Login1;
                        }
                        continue;
                    }
                    if (now >= ctx.B13PollDeadline)
                    {
                        ColorPrinter.Yellow($"{LogTag} flow B13→B5 | reason: [B15b] timeout no elements ({(int)C.FlowPollTimeoutSec}s), exit and restart");
                        ctx.B13PollDeadline = 0;
                        ctx.B5EntryReason = "B13_timeout_no_elements";
                        ctx.CurrentStep = BnStep.BN_Exit;
                        continue;
                    }
                    if (!noActivate && op.ClickD3Tab())
                        ColorPrinter.Blue($"{LogTag} flow B13→B6 | reason: [B15c] unknown state, clicked D3 tab (Asia/CN), re-activate and poll");
                    else
                        ColorPrinter.Blue($"{LogTag} flow B13→B6 | reason: [B15c] unknown state, re-activate and poll (flowchart B15c→B6)");
                    ctx.B13PollDeadline = 0;
                    ctx.CurrentStep = BnStep.BN_Act;
                    continue;
                }

                case BnStep.BN_Confirmed:
                {
                    if (!game.GetStateSnapshot().BattlenetWindowFound)
                    {
                        ctx.CurrentStep = BnStep.BN_Win;
                        continue;
                    }
                    if (op.TryClosePopup())
                    {
                        ColorPrinter.Gray($"{LogTag} flow BN_Confirmed: closed in-UI popup (floating ad), wait next tick");
                        return (false, ResultWait);
                    }
                    var s = op.GetDynamicState();
                    if (s.Connecting) return (false, ResultWait);
                    if (s.NormalAvailable) return (true, ResultConfirmed);
                    if (s.OnLogin)
                    {
                        ctx.CurrentStep = BnStep.BN_UI;
                        continue;
                    }
                    if (s.Disconnected)
                    {
                        ctx.B5EntryReason = "BN_Confirmed_disconnected";
                        ctx.CurrentStep = BnStep.BN_Exit;
                        continue;
                    }
                    ctx.CurrentStep = BnStep.BN_UI;
                    continue;
                }

                case BnStep.BN_Exit:
                {
                    op.SaveUiElementsSnapshot("B5", "B5_exit");
                    string entryReason = string.IsNullOrEmpty(ctx.B5EntryReason) ? "exit" : ctx.B5EntryReason;
                    ColorPrinter.Blue($"{LogTag} flow B5→B5w | reason: {entryReason} -> kill Battle.net, wait {(int)C.FlowExitWaitSec}s then back to B1");
                    BattlenetManager.Instance.Kill();
                    ctx.WaitUntil = now + C.FlowExitWaitSec;
                    ctx.CurrentStep = BnStep.BN_ExitWait;
                    return (false, ResultNone);
                }

                case BnStep.BN_ExitWait:
                    if (now < ctx.WaitUntil)
                    {
                        ColorPrinter.Gray($"{LogTag} flow B5w skip this tick | reason: waiting Battle.net exit ({(int)C.FlowExitWaitSec}s), wait");
                        return (false, ResultWait);
                    }
                    ColorPrinter.Blue($"{LogTag} flow B5w→B1 | reason: Battle.net exited, back to entry B1");
                    ctx.CurrentStep = BnStep.BN_Entry;
                    continue;

                default:
                    return (false, ResultNone);
            }
        }
        return (false, ResultNone);
    }

    private static (bool Done, string Result) Confirm(BnBlockState ctx)
    {
        ctx.CurrentStep = BnStep.BN_Confirmed;
        ctx.BnFlowEverConfirmed = true;
        return (true, ResultConfirmed);
    }

    /// <summary>One web login automation poll; true on success (also notifies the OAuth waiters).</summary>
    private static bool RunWebLoginPoll()
    {
        if (BrowserLoginAutomation.RunOnePoll() != BrowserLoginAutomation.PollResult.Success) return false;
        BattlenetFlowHooks.NotifyOauthDone?.Invoke();
        return true;
    }

    private static string? PreferredRegion() => GameInterfaceData.Instance.GetStateSnapshot().BattlenetRegion;

    private static string PlayLabel(string? playButtonName)
        => playButtonName != null && BattlenetRegionJudge.ContainsAny(playButtonName, C.PlayPlayingNameSubstrings) ? "Playing" : "Play";

    private static double NowSec() => Environment.TickCount64 / 1000.0;

    /// <summary>Flow tick from the global 1 s clock; when the clock is not running, derive it from wall time (1 flow tick = 2 s). 1:1 get_flow_tick_from_global.</summary>
    private static int CurrentFlowTick()
    {
        var driver = TickDriver.Instance;
        return driver.GlobalTick > 0 ? driver.FlowTick : (int)(Environment.TickCount64 / (long)(C.B11TickIntervalSec * 1000));
    }
}
