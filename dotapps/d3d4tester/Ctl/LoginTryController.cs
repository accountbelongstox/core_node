// PY-REF: pyapps/d3-check/controller/login_try_screenshot_controller.py
// PY-REF: pyapps/d3-check/d3utils/log_analyzer.py
using System.IO;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Battlenet;
using DotApps.d3d4tester.Core.D4;
using DotApps.d3d4tester.Core.Flow;
using DotApps.d3d4tester.Services;
using DotCore.Foundations;
using DotCore.ScreenCapture;

namespace DotApps.d3d4tester.Ctl;

/// <summary>
/// Login try / manual game launch: on log "Login try" restart Battle.net when disconnected; the manual "ensure D3 / D4 running"
/// actions run the same Battle.net ready process (B) and game launch process (D) as the ROSBOT flow, bounded by
/// <see cref="ManualActionTimeout"/>. Call <see cref="Initialize"/> once at startup.
/// 1:1 Python controller/login_try_screenshot_controller.py (D4 launch is DOT-only).
/// </summary>
public static class LoginTryController
{
    private const string LogPrefix = "[LoginTryScreenshotController]";
    private const double BnRestartWaitAfterSec = 2.0;
    private static readonly TimeSpan ManualActionTimeout = TimeSpan.FromMinutes(5);

    private static int _initialized;

    /// <summary>Register the "Login try" log callback. 1:1 Python controller init + register_login_try_callback.</summary>
    public static void Initialize()
    {
        if (Interlocked.Exchange(ref _initialized, 1) == 1) return;
        RosbotLogLoginTryRegistry.LoginTryCallback = () => Task.Run(HandleLoginTry);
        ColorPrinter.Blue($"{LogPrefix} Initialized");
    }

    /// <summary>On "Login try" in log: UI check only; restart Battle.net when disconnected. 1:1 Python handle_login_try.</summary>
    public static void HandleLoginTry()
    {
        if (!GameControl.Allowed("login try Battle.net restart", needsMonitoring: false)) return;
        if (BattlenetReadyProcess.IsRunning)
        {
            ColorPrinter.Gray($"{LogPrefix} Battle.net ready process running, it handles the login");
            return;
        }
        var bn = BattlenetManager.Instance;
        var bnPath = bn.GetPath();
        if (bnPath == null)
        {
            ColorPrinter.Yellow($"{LogPrefix} No battlenet.battlenet_path in config");
            return;
        }
        if (BattlenetClientStateDetector.Detect().State != BattlenetClientState.Disconnected)
        {
            ColorPrinter.Blue($"{LogPrefix} Battle.net not disconnected (UI), skip restart");
            return;
        }
        ColorPrinter.Blue($"{LogPrefix} Disconnect detected (UI), restarting Battle.net...");
        bn.Restart(bnPath, BnRestartWaitAfterSec);
    }

    /// <summary>
    /// D3 online and not disconnected -> nothing; online but disconnected (confirmed by two captures) -> kill + relaunch; not online ->
    /// launch. Battle.net is made ready first (B). Never starts ROSBOT. 1:1 Python ensure_d3_running_from_battlenet_no_rosbot.
    /// </summary>
    public static bool EnsureD3RunningFromBattlenetNoRosbot()
    {
        bool killD3First = false;
        if (D3Manager.Instance.IsRunning())
        {
            if (!D3ScreenState.CaptureAndDetectAllD3States().States.Disconnected)
            {
                ColorPrinter.Gray($"{LogPrefix} D3 online and not disconnected, skip");
                return true;
            }
            Thread.Sleep(TimeSpan.FromSeconds(D3InterfaceConstants.C3wWaitSec));
            if (!D3ScreenState.CaptureAndDetectAllD3States().States.Disconnected)
            {
                ColorPrinter.Gray($"{LogPrefix} D3 disconnect not confirmed (second capture != disconnect), skip");
                return true;
            }
            ColorPrinter.Blue($"{LogPrefix} D3 online then disconnected (confirmed twice) -> restart from Battle.net");
            killD3First = true;
        }
        return LaunchManually(GameLaunchTarget.D3, killD3First);
    }

    /// <summary>D4 running -> nothing (state refreshed); else Battle.net ready (B) + launch (D). Never starts ROSBOT. DOT-only.</summary>
    public static bool EnsureD4RunningFromBattlenet()
    {
        if (D4Manager.Instance.IsRunning())
        {
            GameLaunchTarget.D4.OnWindowFound();
            ColorPrinter.Gray($"{LogPrefix} D4 online, skip");
            return true;
        }
        return LaunchManually(GameLaunchTarget.D4, killGameFirst: false);
    }

    private static bool LaunchManually(GameLaunchTarget target, bool killGameFirst)
    {
        var ctx = FlowContext.WithTimeout(ManualActionTimeout);
        try
        {
            return BattlenetReadyProcess.Run(ctx, activate: true) == BattlenetReadyResult.Ready
                   && GameLaunchProcess.Launch(ctx, target, killGameFirst);
        }
        catch (OperationCanceledException)
        {
            ColorPrinter.Yellow($"{LogPrefix} {target.Label} launch not finished within {ManualActionTimeout.TotalMinutes} min");
            return false;
        }
    }

}
