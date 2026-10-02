// PY-REF: pyapps/d3-check/controller/login_try_screenshot_controller.py
// PY-REF: pyapps/d3-check/d3utils/log_analyzer.py
// PY-REF: pyapps/d3-check/d3utils/rosbot_flow_battlenet.py
using System.IO;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Battlenet;
using DotApps.d3d4tester.Core.D4;
using DotApps.d3d4tester.Core.Flow;
using DotApps.d3d4tester.Services;
using DotCore.Foundations;
using DotCore.ScreenCapture;

namespace DotApps.d3d4tester.Ctl;

/// <summary>
/// Login try / game launch controller: on log "Login try" restart Battle.net when disconnected; screenshot trigger (login by region);
/// ensure Battle.net logged in; D block (tray restore, game tab + Play, window poll) for D3 and D4 with the D3 C3 connect loop;
/// ensure D3 / D4 running without ROSBOT; full-screen login_try capture. UI-only Battle.net checks (no OCR).
/// Call <see cref="Initialize"/> once at startup. 1:1 Python controller/login_try_screenshot_controller.py (D4 launch is DOT-only).
/// </summary>
public static class LoginTryController
{
    private const string LogPrefix = "[LoginTryScreenshotController]";
    private const double BnRestartWaitAfterSec = 2.0;
    private const int AfterRestartMs = 5000;
    private const int AfterBnStartMs = 3000;
    private const int AfterKillD3Ms = 5000;
    private const int AfterActivateMs = 1000;
    private const int AfterActivateFastMs = 300;
    private const int AfterActivateLoginCheckMs = 500;
    private const int AfterD3TabMs = 800;
    private const int AfterLoginFlowMs = 2000;
    private const int AfterLoginByRegionMs = 3000;
    private const int LoginPollIdleMs = 2000;
    private const int D12SleepMs = 3000;
    private const double D12PollTimeoutSec = 8.0;
    private const double D12PollIntervalSec = 0.5;
    private const int D12PollLogEveryN = 4;
    private const int MaxRounds = 3;
    private const int MaxOuterRetries = 3;
    private const int MaxLoginRounds = 5;

    private static int _initialized;

    /// <summary>A game launched from Battle.net by the D block: window manager, tab + Play click, state write on window found.</summary>
    private sealed record LaunchTarget(string Label, GameWindowManager Manager, Func<IBattlenetOperation, bool> ClickTabAndPlay, Action OnWindowFound);

    private static readonly LaunchTarget D3Target = new(
        "D3",
        D3Manager.Instance,
        op =>
        {
            if (!op.ClickD3Tab()) return false;
            Thread.Sleep(AfterD3TabMs);
            return op.ClickStartGame();
        },
        () => GameInterfaceData.Instance.SetD3Status(true));

    private static readonly LaunchTarget D4Target = new(
        "D4",
        D4Manager.Instance,
        D4Pipeline.LaunchFromBattlenet,
        () => GameInterfaceData.Instance.D4.GameRunning = true);

    /// <summary>Register the "Login try" log callback and prepare the screenshot directory. 1:1 Python controller init + register_login_try_callback.</summary>
    public static void Initialize()
    {
        if (Interlocked.Exchange(ref _initialized, 1) == 1) return;
        try
        {
            Directory.CreateDirectory(LoginTryDir);
        }
        catch (Exception ex)
        {
            ColorPrinter.Yellow($"{LogPrefix} {ex.Message}");
        }
        RosbotLogLoginTryRegistry.LoginTryCallback = () => Task.Run(HandleLoginTry);
        ColorPrinter.Blue($"{LogPrefix} Initialized");
    }

    private static string LoginTryDir => Path.Combine(D3InterfaceConstants.TmpRootDir, D3InterfaceConstants.LoginTrySubdir);

    private static BattlenetManager Bn => BattlenetManager.Instance;

    /// <summary>battlenet.battlenet_path when it is an existing file; else null. 1:1 Python BattlenetManager.get_path.</summary>
    private static string? GetBattlenetPath() => Bn.GetPath();

    private static void RestartBattlenet(string bnPath) => Bn.Restart(bnPath, BnRestartWaitAfterSec);

    /// <summary>On "Login try" in log: UI check only; restart Battle.net when disconnected. 1:1 Python handle_login_try.</summary>
    public static void HandleLoginTry()
    {
        var bnPath = GetBattlenetPath();
        if (bnPath == null)
        {
            ColorPrinter.Yellow($"{LogPrefix} No battlenet.battlenet_path in config");
            return;
        }
        if (!BattlenetStatusProvider.GetOperation().GetDynamicState().Disconnected)
        {
            ColorPrinter.Blue($"{LogPrefix} Battle.net not disconnected (UI), skip restart");
            return;
        }
        ColorPrinter.Blue($"{LogPrefix} Disconnect detected (UI), restarting Battle.net...");
        RestartBattlenet(bnPath);
    }

    /// <summary>Screenshot trigger: normal -> skip; disconnected -> restart; on login -> login flow by region. 1:1 Python handle_screenshot_trigger.</summary>
    public static void HandleScreenshotTrigger()
    {
        var bnPath = GetBattlenetPath();
        if (bnPath == null)
        {
            ColorPrinter.Yellow($"{LogPrefix} No battlenet.battlenet_path in config, skip screenshot trigger");
            return;
        }
        var s = BattlenetStatusProvider.GetOperation().GetDynamicState();
        if (s.NormalAvailable)
        {
            ColorPrinter.Blue($"{LogPrefix} Battle.net normal_available (UI), skip re-login");
            return;
        }
        if (s.Disconnected)
        {
            ColorPrinter.Blue($"{LogPrefix} Battle.net disconnected (UI), restart...");
            RestartBattlenet(bnPath);
            return;
        }
        if (s.OnLogin)
        {
            ColorPrinter.Blue($"{LogPrefix} Battle.net on login (UI), run login flow by region");
            RunLoginFlowUiByRegion();
            return;
        }
        ColorPrinter.Blue($"{LogPrefix} Battle.net state not login/disconnect/normal, skip");
    }

    /// <summary>CN login via UI Automation only: agree + NetEase, then Login button. 1:1 Python _run_cn_login_flow_ui_only.</summary>
    private static void RunCnLoginFlowUiOnly()
    {
        const string cnLog = LogPrefix + "[CN]";
        var op = BattlenetStatusProvider.GetOperation();
        if (!op.IsOnLoginScreen()) return;
        if (op.PerformCnLoginFlow())
        {
            ColorPrinter.Blue($"{cnLog} UI login flow done (agree + NetEase), proceeding to Login button");
            RunCnLoginFlowClickLoginButton();
        }
        else
        {
            ColorPrinter.Yellow($"{cnLog} perform_cn_login_flow failed (not CN or UI not found), skip");
        }
    }

    /// <summary>
    /// Login by region (config only): Asia = fill + submit with cached credentials (dialog scheduled when missing); CN = UI flow.
    /// Returns true if a login action was performed. 1:1 Python _run_login_flow_ui_by_region.
    /// </summary>
    private static bool RunLoginFlowUiByRegion()
    {
        var op = BattlenetStatusProvider.GetOperation();
        if (!op.IsOnLoginScreen()) return false;
        var region = BattlenetStatusProvider.GetRegion();
        if (region == null)
        {
            ColorPrinter.Gray($"{LogPrefix} Battle.net region not in config, skip login flow by region");
            return false;
        }
        if (region != AppConstants.RegionCn)
        {
            if (AsiaCredentialsService.IsDialogPending) return false;
            var creds = AsiaCredentialsService.GetCredentials(AsiaCredentialsService.RegionAsia);
            if (creds == null)
            {
                AsiaCredentialsService.ScheduleCredentialsDialog();
                ColorPrinter.Gray($"{LogPrefix} Asia login: no cached credentials, dialog scheduled");
                return false;
            }
            if (!op.IsOnAsiaLoginScreen()) return false;
            bool ok = op.PerformAsiaLoginFillAndSubmit(creds.Value.email, creds.Value.password);
            if (ok) ColorPrinter.Blue($"{LogPrefix} Asia login: fill + submit done (same as BN_LoginAsia)");
            return ok;
        }
        RunCnLoginFlowUiOnly();
        return true;
    }

    /// <summary>After agree + NetEase + wait: click Login via UI Automation only. 1:1 Python _run_cn_login_flow_click_login_button.</summary>
    private static void RunCnLoginFlowClickLoginButton()
    {
        const string cnLog = LogPrefix + "[CN]";
        if (BattlenetStatusProvider.GetOperation().ClickCnLoginButton())
            ColorPrinter.Blue($"{cnLog} Login button clicked (UI)");
        else
            ColorPrinter.Yellow($"{cnLog} Login button not found (UI), skip");
    }

    /// <summary>Restart Battle.net and wait so the caller can retry from step 1. 1:1 Python _restart_battlenet_and_retry_from_step1.</summary>
    private static void RestartBattlenetAndRetryFromStep1(string bnPath)
    {
        ColorPrinter.Yellow($"{LogPrefix} Start Game / Game tool not found in time; restart Battle.net and retry from step 1...");
        RestartBattlenet(bnPath);
        Thread.Sleep(AfterRestartMs);
    }

    /// <summary>
    /// Ensure Battle.net is logged in (normal_available): start when missing; disconnected / browser-wait -> restart; login screen ->
    /// login by region. Never kills D3. 1:1 Python _ensure_battlenet_logged_in_first.
    /// </summary>
    private static bool EnsureBattlenetLoggedInFirst(string bnPath)
    {
        var op = BattlenetStatusProvider.GetOperation();
        if (!Bn.HasWindow())
        {
            ColorPrinter.Blue($"{LogPrefix} Battle.net window not found, starting Battle.net...");
            Bn.Start(bnPath);
            Thread.Sleep(AfterBnStartMs);
        }
        Bn.ActivateWindow();
        Thread.Sleep(AfterActivateLoginCheckMs);
        for (int i = 0; i < MaxLoginRounds; i++)
        {
            var s = op.GetDynamicState();
            if (s.NormalAvailable)
            {
                ColorPrinter.Blue($"{LogPrefix} Battle.net confirmed logged in (UI), now allow D3 check");
                return true;
            }
            if (s.Disconnected)
            {
                ColorPrinter.Blue($"{LogPrefix} Battle.net disconnected (UI), restarting...");
                RestartBattlenet(bnPath);
                Thread.Sleep(AfterRestartMs);
                continue;
            }
            if (s.OnLogin)
            {
                if (op.IsOnBrowserLoginWaitScreen())
                {
                    ColorPrinter.Blue($"{LogPrefix} Battle.net on browser-login-wait (initial), restart and go to step 1...");
                    RestartBattlenet(bnPath);
                    Thread.Sleep(AfterRestartMs);
                    continue;
                }
                ColorPrinter.Blue($"{LogPrefix} Battle.net on login screen (UI), running login flow by region...");
                RunLoginFlowUiByRegion();
                Thread.Sleep(AfterLoginByRegionMs);
                continue;
            }
            Thread.Sleep(LoginPollIdleMs);
        }
        ColorPrinter.Yellow($"{LogPrefix} Battle.net not confirmed logged in; skip D3 branch, run Battle.net flow only");
        return false;
    }

    /// <summary>Ensure Battle.net running and logged in (no D3, no ROSBOT). 1:1 Python ensure_battlenet_only.</summary>
    public static bool EnsureBattlenetOnly()
    {
        var bnPath = GetBattlenetPath();
        if (bnPath == null)
        {
            ColorPrinter.Yellow($"{LogPrefix} No battlenet.battlenet_path, skip ensure_battlenet_only");
            return false;
        }
        return EnsureBattlenetLoggedInFirst(bnPath);
    }

    /// <summary>
    /// D block only: BN logged in, optional game kill, tray + activate BN, game tab + Play, window poll. No C branch, no ROSBOT.
    /// 1:1 Python _run_d_block_launch_d3_only (target D3); the same block launches D4.
    /// </summary>
    private static bool RunDBlockLaunchGameOnly(string bnPath, bool killGameFirst, LaunchTarget target)
    {
        if (!EnsureBattlenetLoggedInFirst(bnPath)) return false;
        var op = BattlenetStatusProvider.GetOperation();
        string tag = $"{LogPrefix} [D-only {target.Label}]";
        for (int outer = 0; outer < MaxOuterRetries; outer++)
        {
            bool launched = false;
            for (int round = 0; round < MaxRounds; round++)
            {
                ColorPrinter.Gray($"{tag} progress: find_windows...");
                if (!Bn.HasWindow())
                {
                    ColorPrinter.Blue($"{tag} [D2] No Battle.net window -> start Battle.net -> wait");
                    Bn.Start(bnPath);
                    Thread.Sleep(AfterBnStartMs);
                    continue;
                }
                if (killGameFirst)
                {
                    ColorPrinter.Gray($"{tag} progress: kill_if_running + sleep(5)...");
                    target.Manager.KillIfRunning();
                    Thread.Sleep(AfterKillD3Ms);
                }
                ColorPrinter.Gray($"{tag} progress: tray + activate_window...");
                Bn.RestoreFromTray();
                if (!Bn.ActivateWindow())
                {
                    if (round < MaxRounds - 1) continue;
                    return false;
                }
                Thread.Sleep(AfterActivateMs);
                var s = op.GetDynamicState();
                if (s.Disconnected || (!s.OnLogin && !s.NormalAvailable))
                {
                    RestartBattlenet(bnPath);
                    Thread.Sleep(AfterRestartMs);
                    continue;
                }
                if (s.OnLogin)
                {
                    RunCnLoginFlowUiOnly();
                    Thread.Sleep(AfterLoginFlowMs);
                    continue;
                }
                if (!target.ClickTabAndPlay(op))
                {
                    RestartBattlenet(bnPath);
                    Thread.Sleep(AfterRestartMs);
                    continue;
                }
                launched = true;
                break;
            }
            if (!launched) continue;
            ColorPrinter.Gray($"{tag} [D12] sleep(3) then poll {target.Label} window 8s...");
            Thread.Sleep(D12SleepMs);
            if (!target.Manager.PollUntilWindowAppears(D12PollTimeoutSec, D12PollIntervalSec, D12PollLogEveryN))
            {
                RestartBattlenetAndRetryFromStep1(bnPath);
                continue;
            }
            target.OnWindowFound();
            GameInterfaceData.Instance.NotifyCallbacks();
            ColorPrinter.Green($"{tag} {target.Label} window found");
            return true;
        }
        ColorPrinter.Yellow($"{tag} Exhausted retries");
        return false;
    }

    /// <summary>
    /// D3 online and not disconnected -> nothing; online but disconnected (confirmed by two captures) -> kill + relaunch from Battle.net;
    /// not online -> launch from Battle.net. Never starts ROSBOT. 1:1 Python ensure_d3_running_from_battlenet_no_rosbot.
    /// </summary>
    public static bool EnsureD3RunningFromBattlenetNoRosbot()
    {
        var bnPath = GetBattlenetPath();
        if (bnPath == null)
        {
            ColorPrinter.Yellow($"{LogPrefix} No battlenet.battlenet_path, skip ensure_d3_running_from_battlenet_no_rosbot");
            return false;
        }
        bool killD3First;
        if (D3Manager.Instance.IsRunning())
        {
            var (_, first) = D3StartGameAndTeleport.CaptureAndDetectAllD3States();
            if (!first.Disconnected)
            {
                ColorPrinter.Gray($"{LogPrefix} D3 online and not disconnected, skip");
                return true;
            }
            ColorPrinter.Gray($"{LogPrefix} First capture: d3_disconnected template matched; confirming with second capture (avoid false positive)...");
            Thread.Sleep(TimeSpan.FromSeconds(D3InterfaceConstants.C3wWaitSec));
            var (_, second) = D3StartGameAndTeleport.CaptureAndDetectAllD3States();
            if (!second.Disconnected)
            {
                ColorPrinter.Gray($"{LogPrefix} D3 disconnect not confirmed (second capture != disconnect), skip");
                return true;
            }
            ColorPrinter.Blue($"{LogPrefix} D3 online then disconnected (confirmed twice) -> restart from Battle.net");
            killD3First = true;
        }
        else
        {
            ColorPrinter.Blue($"{LogPrefix} D3 not online -> start from Battle.net");
            killD3First = false;
        }
        return RunDBlockLaunchGameOnly(bnPath, killD3First, D3Target);
    }

    /// <summary>
    /// D4 running -> nothing (state refreshed); else launch from Battle.net (D4 tab + Play, idempotent when Battle.net already
    /// reports D4 starting) and poll the D4 window. Never starts ROSBOT. DOT-only (Python D4BattlenetOperation had no caller).
    /// </summary>
    public static bool EnsureD4RunningFromBattlenet()
    {
        var bnPath = GetBattlenetPath();
        if (bnPath == null)
        {
            ColorPrinter.Yellow($"{LogPrefix} No battlenet.battlenet_path, skip ensure_d4_running_from_battlenet");
            return false;
        }
        if (D4Manager.Instance.IsRunning())
        {
            D4Target.OnWindowFound();
            ColorPrinter.Gray($"{LogPrefix} D4 online, skip");
            return true;
        }
        ColorPrinter.Blue($"{LogPrefix} D4 not online -> start from Battle.net");
        return RunDBlockLaunchGameOnly(bnPath, killGameFirst: false, D4Target);
    }

    /// <summary>
    /// Step 1 for starting ROSBOT. F3-only (D3 + ROSBOT online) -> true. D3 running + BN confirmed -> C1/C2/C3 loop (or A8 only for F2).
    /// Else D block: BN window, kill D3, activate, D3 tab + one-shot Play (BN_WaitPlay drives retries), D12 poll, D13 -> C branch.
    /// 1:1 Python ensure_battlenet_started_and_login_check(for_f2_only).
    /// </summary>
    public static bool EnsureBattlenetStartedAndLoginCheck(bool forF2Only = false)
    {
        var bnPath = GetBattlenetPath();
        if (bnPath == null)
        {
            ColorPrinter.Yellow($"{LogPrefix} No battlenet.battlenet_path in config, skip step 1");
            return false;
        }
        var g = GameInterfaceData.Instance.GetStateSnapshot();
        if (g.D3Running && g.RosbotExtendedStatus is ("running" or "paused"))
        {
            ColorPrinter.Gray($"{LogPrefix} F3-only mode (D3+ROSBOT both present), skip C/D branch; flow master handles log timeout only");
            return true;
        }

        bool hasD3Process = D3Manager.Instance.IsRunning();
        bool fromTickFastPath = false;
        bool battlenetConfirmed;
        if (hasD3Process)
        {
            if (g.BattlenetWindowFound && g.BattlenetNormalAvailable)
            {
                battlenetConfirmed = true;
                ColorPrinter.Gray($"{LogPrefix} D3 running -> use cached BN state, skip BN login check (direct C)");
            }
            else
            {
                battlenetConfirmed = EnsureBattlenetLoggedInFirst(bnPath);
                if (battlenetConfirmed)
                    ColorPrinter.Gray($"{LogPrefix} D3 running, BN confirmed after one check");
            }
        }
        else
        {
            ColorPrinter.Gray($"{LogPrefix} progress: D3 not running -> battlenet_confirmed branch...");
            if (ExtensionFlowState.Instance.GetRequestDBlockFromB7())
            {
                ColorPrinter.Gray($"{LogPrefix} progress: branch get_request_d_block_from_b7");
                ExtensionFlowState.Instance.GetAndClearRequestDBlockFromB7();
                if (IsBnFlowInLoginPhase())
                {
                    battlenetConfirmed = EnsureBattlenetLoggedInFirst(bnPath);
                    if (!battlenetConfirmed)
                        ColorPrinter.Blue($"{LogPrefix} D block from B7 but flow on login screen -> run Battle.net flow only (no D3 small map check yet)");
                }
                else
                {
                    battlenetConfirmed = true;
                    ColorPrinter.Blue($"{LogPrefix} D block from B7 (no operable UI): run D3 tab, Play, region (CN/Asia) then C or D");
                }
            }
            else if (BnBlockState.Get(true).GetAndClearTickConfirmed() || BnBlockState.Get(false).GetAndClearTickConfirmed())
            {
                ColorPrinter.Gray($"{LogPrefix} progress: branch get_and_clear_battlenet_tick_confirmed (tick-confirmed)");
                battlenetConfirmed = true;
                fromTickFastPath = true;
                ColorPrinter.Blue($"{LogPrefix} Battle.net confirmed by tick flow, running D3 part only");
            }
            else
            {
                ColorPrinter.Gray($"{LogPrefix} progress: branch _ensure_battlenet_logged_in_first...");
                battlenetConfirmed = EnsureBattlenetLoggedInFirst(bnPath);
                if (!battlenetConfirmed)
                    ColorPrinter.Blue($"{LogPrefix} Battle.net not confirmed; run Battle.net flow only, do not touch D3");
            }
            if (!battlenetConfirmed) fromTickFastPath = false;
        }

        if (!battlenetConfirmed && IsBnFlowInLoginPhase())
        {
            ColorPrinter.Blue($"{LogPrefix} Flow on login screen, skip D block (no kill/restart); tick flow will perform login");
            return false;
        }
        if (hasD3Process && !battlenetConfirmed && FlowCD3Direct.RunC3ScreenshotState() == D3StartGameAndTeleport.StateWait)
        {
            ColorPrinter.Gray($"{LogPrefix} D3 running but BN not confirmed; C3 one-step=connecting, do not kill D3, next tick retry");
            return false;
        }
        if (battlenetConfirmed && hasD3Process)
        {
            if (forF2Only)
            {
                ColorPrinter.Gray($"{LogPrefix} A8 confirmed (BN+D3), for_f2_only=True -> skip C branch, return for F2 (ROSBOT online check)");
                return true;
            }
            if (FlowCD3Direct.RunC1Entry(battlenetConfirmed, hasD3Process))
            {
                ColorPrinter.Blue($"{LogPrefix} [C1] entry -> [C2] Resize -> [C3] loop (doc C1->C2->C3, already present at start)");
                FlowCD3Direct.RunC2Resize();
                ColorPrinter.Gray($"{LogPrefix} [C] progress: _run_c3_loop_and_handle_branch(d3_just_entered=False)...");
                var c3 = D3ConnectC3Flow.RunC3LoopAndHandleBranch(d3JustEntered: false);
                if (c3 == C3LoopResult.Success) return true;
                if (c3 is C3LoopResult.Disconnect or C3LoopResult.Connecting) return false;
            }
        }

        var op = BattlenetStatusProvider.GetOperation();
        for (int outer = 0; outer < MaxOuterRetries; outer++)
        {
            bool launched = false;
            for (int round = 0; round < MaxRounds; round++)
            {
                if (fromTickFastPath && outer == 0 && round == 0)
                {
                    var fast = RunDFastPath(op);
                    fromTickFastPath = false;
                    if (fast == null) return false;
                    if (fast == true)
                    {
                        launched = true;
                        break;
                    }
                    continue;
                }
                var step = RunDRound(op, bnPath, round);
                if (step == null) return false;
                if (step == true)
                {
                    launched = true;
                    break;
                }
            }
            if (!launched) continue;

            ColorPrinter.Gray($"{LogPrefix} [D12] progress: sleep(3) then poll D3 window up to 8s...");
            Thread.Sleep(D12SleepMs);
            if (!D3Manager.Instance.PollUntilWindowAppears(D12PollTimeoutSec, D12PollIntervalSec, D12PollLogEveryN))
            {
                RestartBattlenetAndRetryFromStep1(bnPath);
                return false;
            }
            GameInterfaceData.Instance.SetD3Status(true);
            if (forF2Only)
            {
                ExtensionFlowState.Instance.SetD3JustEnteredFromD13(true);
                ColorPrinter.Gray($"{LogPrefix} [D13] D3 window found, for_f2_only=True -> skip C branch, set d3_just_entered_from_d13 for next C1 tick C7a (ROSBOT_FLOW_MERMAID)");
                return true;
            }
            if (FlowCD3Direct.RunC1Entry(true, true))
            {
                FlowCD3Direct.RunC2Resize();
                ColorPrinter.Gray($"{LogPrefix} [D13] just entered game -> _run_c3_loop_and_handle_branch(d3_just_entered=True), skip C10 when game_tool");
                var c3 = D3ConnectC3Flow.RunC3LoopAndHandleBranch(d3JustEntered: true);
                if (c3 == C3LoopResult.Success) return true;
                if (c3 is C3LoopResult.Disconnect or C3LoopResult.Connecting) return false;
            }
            RestartBattlenetAndRetryFromStep1(bnPath);
            return false;
        }
        ColorPrinter.Yellow($"{LogPrefix} Exhausted outer retries; step 1 did not complete");
        return false;
    }

    /// <summary>Tick-confirmed fast path (skip kill + tray): true = Play clicked, false = retry normal round, null = loading (return).</summary>
    private static bool? RunDFastPath(IBattlenetOperation op)
    {
        ColorPrinter.Gray($"{LogPrefix} [D fast] progress: find_windows...");
        if (!Bn.HasWindow()) return false;
        ColorPrinter.Gray($"{LogPrefix} [D fast] progress: activate_window...");
        Bn.ActivateWindow();
        Thread.Sleep(AfterActivateFastMs);
        if (op.IsLoadingUiVisible())
        {
            ColorPrinter.Gray($"{LogPrefix} Battle.net is loading, skip this tick and retry next tick");
            return null;
        }
        ColorPrinter.Gray($"{LogPrefix} [D fast] progress: get_dynamic_state...");
        if (!op.GetDynamicState().NormalAvailable) return false;
        ColorPrinter.Green($"{LogPrefix} [D fast] Tick-confirmed: click D3 tab + one shot Play (flow drives wait)");
        ColorPrinter.Gray($"{LogPrefix} [D fast] progress: before starting D3 try to end ROSBOT...");
        RosbotManager.Instance.KillIfRunning();
        ColorPrinter.Gray($"{LogPrefix} [D fast] progress: click_d3_tab...");
        if (!op.ClickD3Tab()) return false;
        ColorPrinter.Gray($"{LogPrefix} [D fast] progress: click_play_button_if_visible (one shot, no timer)...");
        return op.ClickPlayButtonIfVisible(forceRefresh: true);
    }

    /// <summary>One D round: true = Play clicked, false = retry next round, null = stop (return false to caller).</summary>
    private static bool? RunDRound(IBattlenetOperation op, string bnPath, int round)
    {
        ColorPrinter.Gray($"{LogPrefix} [D] progress: find_windows...");
        if (!Bn.HasWindow())
        {
            ColorPrinter.Blue($"{LogPrefix} [D2] No Battle.net window -> start Battle.net -> wait");
            Bn.Start(bnPath);
            Thread.Sleep(AfterBnStartMs);
            return false;
        }
        ColorPrinter.Gray($"{LogPrefix} [D] progress: kill_if_running + sleep(5)...");
        D3Manager.Instance.KillIfRunning();
        Thread.Sleep(AfterKillD3Ms);
        ColorPrinter.Blue($"{LogPrefix} [D3] End current D3 process if any -> wait 5s; [D4] Tray/activate Battle.net -> wait 1s");
        ColorPrinter.Gray($"{LogPrefix} [D] progress: find_and_click_tray_icon + activate_window...");
        Bn.RestoreFromTray();
        if (!Bn.ActivateWindow())
        {
            ColorPrinter.Yellow($"{LogPrefix} Battle.net window not found for activate");
            return round < MaxRounds - 1 ? false : null;
        }
        Thread.Sleep(AfterActivateMs);
        if (op.IsLoadingUiVisible())
        {
            ColorPrinter.Gray($"{LogPrefix} Battle.net is loading, skip this tick and retry next tick");
            return null;
        }
        ColorPrinter.Gray($"{LogPrefix} [D] progress: get_dynamic_state...");
        var s = op.GetDynamicState();
        if (s.Disconnected)
        {
            ColorPrinter.Blue($"{LogPrefix} Battle.net disconnected (UI), restart and retry...");
            RestartBattlenet(bnPath);
            Thread.Sleep(AfterRestartMs);
            return false;
        }
        if (s.OnLogin)
        {
            ColorPrinter.Blue($"{LogPrefix} Battle.net on login screen (UI), run login flow by region then retry...");
            RunLoginFlowUiByRegion();
            Thread.Sleep(AfterLoginFlowMs);
            return false;
        }
        if (!s.NormalAvailable)
        {
            ColorPrinter.Yellow($"{LogPrefix} Battle.net not normal_available (UI), restart and retry...");
            RestartBattlenet(bnPath);
            Thread.Sleep(AfterRestartMs);
            return false;
        }
        ColorPrinter.Green($"{LogPrefix} Battle.net normal_available (UI), click D3 tab + one shot Play (flow drives)");
        ColorPrinter.Gray($"{LogPrefix} [D] progress: before starting D3 try to end ROSBOT...");
        RosbotManager.Instance.KillIfRunning();
        ColorPrinter.Gray($"{LogPrefix} [D] progress: click_d3_tab...");
        if (!op.ClickD3Tab())
        {
            ColorPrinter.Yellow($"{LogPrefix} D3 tab click failed (UI), restart and retry...");
            RestartBattlenet(bnPath);
            Thread.Sleep(AfterRestartMs);
            return false;
        }
        ColorPrinter.Gray($"{LogPrefix} [D] progress: click_play_button_if_visible (one shot, no timer)...");
        if (!op.ClickPlayButtonIfVisible(forceRefresh: true))
        {
            ColorPrinter.Gray($"{LogPrefix} [D] Play not visible this tick; flow BN_WaitPlay will click next tick, return for tick drive");
            return null;
        }
        return true;
    }

    private static bool IsBnFlowInLoginPhase() => BnBlockState.IsInLoginPhase(true) || BnBlockState.IsInLoginPhase(false);

    /// <summary>Full-screen capture saved to the login_try directory; returns saved paths or null. 1:1 Python capture_screenshot.</summary>
    public static (string? FullscreenPath, string? GameWindowPath)? CaptureScreenshot()
    {
        ColorPrinter.Blue($"{LogPrefix} Capturing full-screen screenshot...");
        var sd = ScreenCaptureService.GetScreenshotProvider().Gen();
        if (sd == null)
        {
            ColorPrinter.Yellow($"{LogPrefix} Failed to capture screenshot");
            return null;
        }
        var saved = sd.Save(LoginTryDir, D3InterfaceConstants.LoginTryScreenshotPrefix);
        if (saved.FullscreenPath != null)
            ColorPrinter.Green($"{LogPrefix} Screenshot saved: {saved.FullscreenPath}");
        return saved;
    }
}
