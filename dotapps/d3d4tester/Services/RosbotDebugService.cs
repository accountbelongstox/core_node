using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Flow;
using DotApps.d3d4tester.Ctl;
using DotCore.Foundations;
using DotCore.UIInspect;

namespace DotApps.d3d4tester.Services;

/// <summary>
/// "Debug ROSBOT" button: export the ROSBOT UI tree to JSON. (1) a window is visible -> analyze it;
/// (2) process runs but every window is hidden -> F7 to the system, wait 1 s, analyze; (3) not started -> E1 kill, E2 wait 1 s,
/// E4 start, E5a wait window + Debug/tab/Start botting (30 s), analyze. 1:1 Python timers/one_shot_tasks.py do_rosbot_debug.
/// </summary>
public static class RosbotDebugService
{
    private const string ProgramName = "rosbot";
    private const string CacheSubdir = "rosbot_ui_analyze";
    private const string DocsBasename = "rosbot_ui_elements";
    private const string LogLabel = "ROSBOT UI JSON";
    private const string ErrorNotFound = "Window not found";
    private const string DefaultTitle = "ROSBOT";
    private const int F7SettleMs = 1000;
    private const int E2SleepMs = 1000;
    private const int E5aWaitSec = 30;
    private static int _running;

    /// <summary>Register the RunLog debug button handler (idempotent).</summary>
    public static void RegisterTestAction() => TestActionRegistry.Register(I18nKeys.RosbotDebugRosbot, RunInBackground);

    /// <summary>Run on a worker thread; a click while a debug run is in progress is skipped (Python _rosdebug_running_busy).</summary>
    public static void RunInBackground()
    {
        if (Interlocked.Exchange(ref _running, 1) == 1)
        {
            ColorPrinter.Gray("[RosbotPanel] Debug ROSBOT (F7 wait) already in progress, skip");
            return;
        }
        Task.Run(async () =>
        {
            try { await RunAsync().ConfigureAwait(false); }
            catch (Exception ex) { ColorPrinter.Red($"[RosbotPanel] {LogLabel}: {ex.Message}"); }
            finally { Interlocked.Exchange(ref _running, 0); }
        });
    }

    public static async Task RunAsync()
    {
        RosbotStatusProvider.Refresh();
        var mgr = RosbotManager.Instance;
        if (RosbotUiAutomation.TryCloseD3MustBeLaunchedDialog())
            ColorPrinter.Gray("[RosbotPanel] Auto-closed 'D3 must be launched' dialog before debug");

        var window = mgr.GetAnyVisibleRosbotWindow();
        if (window == null || window.Hwnd == IntPtr.Zero)
        {
            var hidden = mgr.GetAnyRosbotWindowForDebug();
            if (hidden != null && hidden.Hwnd != IntPtr.Zero)
            {
                ColorPrinter.Blue("[RosbotPanel] ROSBOT UI JSON: process running, all windows invisible, send F7 then debug");
                if (RosbotManager.SendF7ToSystem())
                {
                    RosbotExitState.SetF7SentForRosbot();
                    ColorPrinter.Green("[RosbotPanel] F7 sent to system (pause)");
                }
                else
                {
                    ColorPrinter.Yellow("[RosbotPanel] F7 send failed");
                }
                await Task.Delay(F7SettleMs).ConfigureAwait(false);
                RosbotStatusProvider.Refresh();
                window = mgr.GetAnyVisibleRosbotWindow() ?? mgr.GetAnyRosbotWindowForDebug();
            }
            else
            {
                ColorPrinter.Blue("[RosbotPanel] ROSBOT UI JSON: not started, starting ROSBOT (E1/E2/E4/E5/E5a)...");
                mgr.KillIfRunning();
                await Task.Delay(E2SleepMs).ConfigureAwait(false);
                if (!mgr.Start())
                {
                    ColorPrinter.Red("[RosbotPanel] ROSBOT UI JSON: start failed");
                    return;
                }
                RosbotFlowHost.Current?.StartRosbotTask();
                RosbotUiAutomation.RunAfterRosbotStart(E5aWaitSec, doDebug: true, doTab: true, doStartBotting: true);
                RosbotStatusProvider.Refresh();
                window = mgr.GetAnyRosbotWindowForDebug();
            }
        }

        if (window == null || window.Hwnd == IntPtr.Zero)
        {
            ColorPrinter.Red($"[RosbotPanel] {LogLabel}: {ErrorNotFound}");
            return;
        }
        string title = string.IsNullOrWhiteSpace(window.Title) ? DefaultTitle : window.Title.Trim();
        BnUiDebugPaths.RunAnalysisAndExport(
            () => WindowAnalyzer.Instance.AnalyzeWindowByHandle(window.Hwnd, title, ProgramName),
            CacheSubdir, DocsBasename, LogLabel, ErrorNotFound);
    }
}
