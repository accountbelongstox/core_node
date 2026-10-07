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
/// Login try / game launch controller: on log "Login try" restart Battle.net when disconnected; the single D block (tray restore,
/// activate, game tab + Play, window poll) for D3 and D4, used by the flow master (Battle.net already confirmed by the B block) and by
/// the manual "ensure D3 / D4 running" actions (login-first); full-screen login_try capture. UI-only Battle.net checks (no OCR).
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
    private const int AfterActivateLoginCheckMs = 500;
    private const int AfterLoginByRegionMs = 3000;
    private const int LoginPollIdleMs = 2000;
    private const int D12SleepMs = 5000;
    private const double D12PollTimeoutSec = 10.0;
    private const double D12PollIntervalSec = 0.5;
    private const int D12PollLogEveryN = 4;
    private const int MaxLoginRounds = 5;

    private static int _initialized;

    /// <summary>
    /// A game launched from Battle.net by the D block: window manager, tab + Play click, state write on window found, and whether
    /// ROSBOT is ended right before Play (D11a, D3 only).
    /// </summary>
    private sealed record LaunchTarget(string Label, GameWindowManager Manager, Func<IBattlenetOperation, bool> ClickTabAndPlay, Action OnWindowFound,
        bool EndRosbotBeforePlay);

    private static readonly LaunchTarget D3Target = new(
        "D3",
        D3Manager.Instance,
        BattlenetGameLauncher.ClickD3TabAndPlay,
        () => GameInterfaceData.Instance.SetD3Status(true),
        EndRosbotBeforePlay: true);

    private static readonly LaunchTarget D4Target = new(
        "D4",
        D4Manager.Instance,
        BattlenetGameLauncher.ClickD4TabAndPlay,
        () => GameInterfaceData.Instance.D4.GameRunning = true,
        EndRosbotBeforePlay: false);

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
    /// Manual actions only (the flow master uses the B block): ensure Battle.net is logged in (normal_available): start when missing;
    /// disconnected / browser-wait -> restart; login screen -> login by region. Never kills D3. 1:1 Python _ensure_battlenet_logged_in_first.
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
        ColorPrinter.Yellow($"{LogPrefix} Battle.net not confirmed logged in; skip game launch");
        return false;
    }

    /// <summary>
    /// Flow master [D1]: launch D3 from the Battle.net the B block confirmed. True only when this call launched D3 (D13: the caller marks
    /// "just entered"); a D3 that is already running is reused by the flow, never relaunched.
    /// </summary>
    public static bool LaunchD3FromBattlenet()
    {
        if (D3Manager.Instance.IsRunning())
        {
            ColorPrinter.Gray($"{LogPrefix} [D1] D3 already running, reuse it (no launch)");
            return false;
        }
        return LaunchFromBattlenet(D3Target, killGameFirst: false);
    }

    /// <summary>
    /// The D block, one pass: [D4] tray restore + activate Battle.net -> [D5] logged-in UI required (else the B block / login-first owns
    /// Battle.net; never restarts it) -> [D11a] end ROSBOT (D3) -> [D9/D11] game tab + Play -> [D12] wait -> [D12b] poll the game window
    /// -> [D13] found: state write. A missing window returns false; the caller retries later instead of restarting Battle.net.
    /// </summary>
    private static bool LaunchFromBattlenet(LaunchTarget target, bool killGameFirst)
    {
        string tag = $"{LogPrefix} [D {target.Label}]";
        if (killGameFirst)
        {
            ColorPrinter.Gray($"{tag} [D3] end current {target.Label} process -> wait");
            target.Manager.KillIfRunning();
            Thread.Sleep(AfterKillD3Ms);
        }
        if (!Bn.HasWindow())
            Bn.RestoreFromTray();
        if (!Bn.ActivateWindow())
        {
            ColorPrinter.Yellow($"{tag} [D6f] Battle.net window not found");
            return false;
        }
        Thread.Sleep(AfterActivateMs);
        var op = BattlenetStatusProvider.GetOperation();
        if (op.IsLoadingUiVisible() || !op.GetDynamicState().NormalAvailable)
        {
            ColorPrinter.Yellow($"{tag} [D5] Battle.net not on the logged-in main UI, skip launch (Battle.net left as is)");
            return false;
        }
        if (target.EndRosbotBeforePlay)
        {
            ColorPrinter.Gray($"{tag} [D11a] end ROSBOT before starting {target.Label}");
            RosbotManager.Instance.KillIfRunning();
        }
        if (!target.ClickTabAndPlay(op))
        {
            ColorPrinter.Yellow($"{tag} [D8] {target.Label} tab / Play not available");
            return false;
        }
        ColorPrinter.Gray($"{tag} [D12] wait then poll {target.Label} window up to {D12PollTimeoutSec}s...");
        Thread.Sleep(D12SleepMs);
        if (!target.Manager.PollUntilWindowAppears(D12PollTimeoutSec, D12PollIntervalSec, D12PollLogEveryN))
        {
            ColorPrinter.Yellow($"{tag} [D13] {target.Label} window not found in time");
            return false;
        }
        target.OnWindowFound();
        GameInterfaceData.Instance.NotifyCallbacks();
        ColorPrinter.Green($"{tag} [D13] {target.Label} window found");
        return true;
    }

    /// <summary>
    /// D3 online and not disconnected -> nothing; online but disconnected (confirmed by two captures) -> kill + relaunch from Battle.net;
    /// not online -> launch from Battle.net (login-first). Never starts ROSBOT. 1:1 Python ensure_d3_running_from_battlenet_no_rosbot.
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
        return EnsureBattlenetLoggedInFirst(bnPath) && LaunchFromBattlenet(D3Target, killD3First);
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
        return EnsureBattlenetLoggedInFirst(bnPath) && LaunchFromBattlenet(D4Target, killGameFirst: false);
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
