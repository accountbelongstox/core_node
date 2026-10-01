using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Battlenet;
using DotCore.Foundations;
using DotCore.UIInspect;

namespace DotApps.d3d4tester.Services;

/// <summary>
/// "Debug Battle.net UI" button: dump the Battle.net UI-Automation tree to JSON (cache dir) and copy it to docs as
/// battlenet_ui_elements[_asia|_cn]_N.json. 1:1 Python timers/one_shot_tasks.py do_battlenet_ui_analyze.
/// </summary>
public static class BattlenetUiAnalyzeService
{
    private const string ProgramName = "battlenet";
    private const string CacheSubdir = "battlenet_ui_analyze";
    private const string DocsBasename = "battlenet_ui_elements";
    private const string LogLabel = "Battle.net UI JSON";
    private const string ErrorNotFound = "Window not found";
    private static int _running;

    /// <summary>Register the RunLog debug button handler (idempotent).</summary>
    public static void RegisterTestAction() => TestActionRegistry.Register(I18nKeys.RosbotDebugBattlenetUi, RunInBackground);

    /// <summary>Run the export on a worker thread; a second click while running is ignored.</summary>
    public static void RunInBackground()
    {
        if (Interlocked.Exchange(ref _running, 1) == 1) return;
        Task.Run(() =>
        {
            try { Run(); }
            catch (Exception ex) { ColorPrinter.Red($"[RosbotPanel] {LogLabel}: {ex.Message}"); }
            finally { Interlocked.Exchange(ref _running, 0); }
        });
    }

    /// <summary>Find the window by exe (Battle.net.exe), then analyze it by handle; region suffix in the docs name when known.</summary>
    public static void Run()
    {
        string docsBasename = DocsBasenameWithRegion();
        var window = BattlenetManager.Instance.FindBattlenetWindow();
        BnUiDebugPaths.RunAnalysisAndExport(
            () => window == null
                ? WindowAnalysisResult.Fail(ErrorNotFound)
                : WindowAnalyzer.Instance.AnalyzeWindowByHandle(window.Hwnd, window.Title, ProgramName),
            CacheSubdir, docsBasename, LogLabel, ErrorNotFound);
    }

    /// <summary>1:1 Python _battlenet_docs_basename_with_region.</summary>
    private static string DocsBasenameWithRegion()
    {
        var region = GameInterfaceData.Instance.GetStateSnapshot().BattlenetRegion;
        return region is AppConstants.RegionAsia or AppConstants.RegionCn ? $"{DocsBasename}_{region}" : DocsBasename;
    }
}
