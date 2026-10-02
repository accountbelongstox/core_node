// PY-REF: none (DOT-only)
using System.Text.Json;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Battlenet;

namespace DotApps.d3d4tester.Tools.BnProbe;

/// <summary>
/// Dev probe: passively scan the live Battle.net client with the app's own detection code (no clicks, no activation) and write
/// the control list plus every detector result to JSON. Args: [outputDir] [--watch seconds].
/// </summary>
public static class Program
{
    private const string FilePrefix = "bnprobe_";
    private const string TimestampFormat = "yyyyMMdd_HHmmss";
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };

    public static int Main(string[] args)
    {
        string outputDir = args.Length > 0 && !args[0].StartsWith("--", StringComparison.Ordinal) ? args[0] : Directory.GetCurrentDirectory();
        int watchSec = ReadWatchSeconds(args);
        Directory.CreateDirectory(outputDir);
        do
        {
            ProbeOnce(outputDir);
            if (watchSec > 0) Thread.Sleep(TimeSpan.FromSeconds(watchSec));
        }
        while (watchSec > 0);
        return 0;
    }

    private static int ReadWatchSeconds(string[] args)
    {
        int i = Array.IndexOf(args, "--watch");
        return i >= 0 && i + 1 < args.Length && int.TryParse(args[i + 1], out int s) && s > 0 ? s : 0;
    }

    private static void ProbeOnce(string outputDir)
    {
        var window = BattlenetManager.Instance.FindBattlenetWindow();
        var controls = BattlenetControlTree.EnumerateLight(forceRefresh: true);
        var cn = BattlenetOperationFactory.GetOperationBase(BattlenetConstants.RegionCn);
        var asia = BattlenetOperationFactory.GetOperationBase(BattlenetConstants.RegionAsia);
        var judge = new BattlenetRegionJudge(controls);
        using var process = BattlenetManager.Instance.GetProcess();
        var classified = BattlenetClientStateDetector.Detect();
        var report = new
        {
            time = DateTime.Now.ToString("o"),
            window = window == null ? null : new { hwnd = window.Hwnd.ToInt64(), window.Title },
            classified = new { state = classified.State.ToString(), classified.UiRegion, classified.Detail },
            detectors = new
            {
                cnDynamic = cn.GetDynamicState(),
                asiaDynamic = asia.GetDynamicState(),
                cnLoginUi = judge.IsCnLoginUi(),
                cnLoginReady = cn.IsLoginScreenReady(),
                asiaLoginUi = judge.IsAsiaLoginUi(),
                asiaEmailStep = judge.IsAsiaEmailStep(),
                asiaPasswordStep = judge.IsAsiaPasswordStep(),
                asiaCombinedLogin = judge.IsAsiaCombinedLoginUi(),
                cnMainUi = judge.HasCnMainUi(),
                asiaMainUi = judge.HasAsiaMainUi(),
                connecting = judge.HasConnecting(),
                disconnect = judge.HasDisconnect(),
                loginFailed = cn.IsLoginFailedScreen(),
                browserLoginWait = cn.IsOnBrowserLoginWaitScreen(),
                loadingUi = cn.IsLoadingUiVisible(),
                cnGameStarting = cn.IsGameStarting(),
                asiaGameStarting = asia.IsGameStarting(),
                sleepMode = BattlenetStuckDetector.IsSleepMode(process),
                fetchingAccount = BattlenetStuckDetector.IsFetchingAccountInfo(process),
            },
            controls = controls.Select(c => new { c.Level, c.Type, c.Name, c.AutomationId, c.IsEnabled, c.IsOffscreen }),
        };
        string path = Path.Combine(outputDir, FilePrefix + DateTime.Now.ToString(TimestampFormat) + ".json");
        File.WriteAllText(path, JsonSerializer.Serialize(report, JsonOptions));
        Console.WriteLine($"[BnProbe] state={classified.State} ui_region={classified.UiRegion ?? "-"} detail={classified.Detail ?? "-"} controls={controls.Count} -> {path}");
    }
}
