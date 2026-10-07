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
        BattlenetGameLauncher.ClickD3TabAndPlay,
        () => GameInterfaceData.Instance.SetD3Status(true));

    private static readonly LaunchTarget D4Target = new(
        "D4",
        D4Manager.Instance,
        BattlenetGameLauncher.ClickD4TabAndPlay,
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
        if (region != BattlenetConstants.RegionCn)
        {
            if (AsiaCredentialsService.IsDialogPending) return false;
            var creds = AsiaCredentialsService.GetCredentials(BattlenetConstants.RegionAsia);
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
