// PY-REF: none (DOT-only)
using System.Text.Json;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Battlenet;

namespace DotApps.d3d4tester.Tools.BnProbe;

/// <summary>
/// Dev probe: passively scan the live Battle.net client with the app's own detection code (no clicks, no activation) and write
/// the control list plus every detector result to JSON. Args: [outputDir] [--watch seconds] | --replay scan.json [scan.json ...]
/// (re-classify recorded scans offline with the current code) | --open "name or automation id" [outputDir]
/// (dev only: click that Battle.net control, e.g. the account avatar menu, wait, then scan the opened menu).
/// </summary>
public static class Program
{
    private const string FilePrefix = "bnprobe_";
    private const string TimestampFormat = "yyyyMMdd_HHmmss";
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };

    public static int Main(string[] args)
    {
        if (args.Length > 0 && args[0] == "--resources")
        {
            using var sampler = new DotCore.Utils.SystemResourceSampler();
            var groups = new Dictionary<string, IReadOnlyCollection<int>>
            {
                ["battlenet"] = BattlenetManager.Instance.GetProcessIds(),
                ["d3"] = D3Manager.Instance.GetProcessIds(),
            };
            for (int i = 0; i < 3; i++)
            {
                Thread.Sleep(1000);
                var snap = sampler.Sample(groups);
                Console.WriteLine($"[BnProbe] system {snap.System}");
                foreach (var (k, v) in snap.Groups) Console.WriteLine($"[BnProbe]   {k}: {v}");
            }
            return 0;
        }
        if (args.Length > 0 && args[0] == "--weblogin")
        {
            Console.WriteLine($"[BnProbe] web login automation poll: {BrowserLoginAutomation.RunOnePoll()}");
            return 0;
        }
        if (args.Length > 1 && args[0] == "--open")
        {
            OpenAndProbe(args[1], args.Length > 2 ? args[2] : Directory.GetCurrentDirectory());
            return 0;
        }
        if (args.Length > 1 && args[0] == "--replay")
        {
            foreach (var file in args.Skip(1)) Replay(file);
            return 0;
        }
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

    private const int AfterOpenMs = 1500;

    private static void OpenAndProbe(string target, string outputDir)
    {
        var controls = BattlenetControlTree.EnumerateLight(forceRefresh: true);
        var control = BattlenetControlTree.FindByAutomationId(controls, target, exactMatch: true)
                      ?? BattlenetControlTree.FindByName(controls, new[] { target });
        if (control == null)
        {
            Console.WriteLine($"[BnProbe] --open: control '{target}' not found");
            return;
        }
        Console.WriteLine($"[BnProbe] --open: clicking {control.Type} '{control.Name}' id={control.AutomationId}");
        BattlenetControlTree.ClickControl(control);
        Thread.Sleep(AfterOpenMs);
        Directory.CreateDirectory(outputDir);
        ProbeOnce(outputDir);
    }

    private static void Replay(string file)
    {
        using var doc = JsonDocument.Parse(File.ReadAllText(file));
        var controls = doc.RootElement.GetProperty("controls").EnumerateArray().Select(c => new BattlenetControl(
            c.GetProperty("Name").GetString() ?? "",
            c.GetProperty("AutomationId").GetString() ?? "",
            c.GetProperty("Type").GetString() ?? "",
            null,
            c.GetProperty("IsEnabled").ValueKind == JsonValueKind.True,
            c.GetProperty("IsOffscreen").ValueKind == JsonValueKind.True,
            c.GetProperty("Level").GetInt32())).ToList();
        string? uiRegion = BattlenetClientStateDetector.UiRegion(controls);
        var status = BattlenetOperationFactory.GetOperation(uiRegion).ClassifyClientState(controls) with { UiRegion = uiRegion };
        Console.WriteLine($"[BnProbe] replay {Path.GetFileName(file)}: state={status.State} ui_region={status.UiRegion ?? "-"} detail={status.Detail ?? "-"} game_ui={status.GameUi}");
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
            templateDir = D3TemplatePaths.GetTemplateDir(),
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
        Console.WriteLine($"[BnProbe] template_dir={D3TemplatePaths.GetTemplateDir()}");
        Console.WriteLine($"[BnProbe] state={classified.State} ui_region={classified.UiRegion ?? "-"} detail={classified.Detail ?? "-"} controls={controls.Count} -> {path}");
    }
}
