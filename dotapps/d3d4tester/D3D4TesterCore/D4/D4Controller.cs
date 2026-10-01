using DotCore.Foundations;

namespace DotApps.d3d4tester.Core.D4;

/// <summary>
/// D4 main controller: one <see cref="Process"/> call per 3 s tick while EXP farming runs or the debug window is open.
/// 1:1 Python pyapps/d3-check/controller/d4_controller.py; the farming steps (controller/d4func/exp_farming.py ExpFarmingManager)
/// are <see cref="D4Pipeline.RunExpFarmingSteps"/>. The debug window refresh (update_debug_window_images_if_open) is <see cref="DebugImagesUpdated"/>.
/// </summary>
public sealed class D4Controller
{
    private const string LogPrefix = "[D4Controller]";
    private const string Separator80 = "================================================================================";
    private const string Dash80 = "--------------------------------------------------------------------------------";
    private const int SummaryPathMaxLength = 60;
    private const int SummaryPathTailLength = 57;

    private static readonly Lazy<D4Controller> LazyInstance = new(() =>
    {
        var c = new D4Controller();
        ColorPrinter.Green("[Global] D4 controller initialized");
        return c;
    });

    private int _tickCounter;

    private D4Controller()
    {
        D4Pipeline.Instance.EnsureInitialized();
        _ = D4UiStatusUpdater.Instance;
        _ = D4EventManager.Instance;
        ColorPrinter.Green($"{LogPrefix} Initialized");
    }

    public static D4Controller Instance => LazyInstance.Value;

    private static D4InterfaceData Data => D4InterfaceData.Instance;

    /// <summary>Farming ticks since the last start.</summary>
    public int TickCounter => Volatile.Read(ref _tickCounter);

    /// <summary>Raised on the tick thread after region crops were refreshed while the debug window is open.</summary>
    public event Action? DebugImagesUpdated;

    /// <summary>True when a tick should run (interceptor: farming or debug window). 1:1 get_interceptor.</summary>
    public bool ShouldProcess => Data.IsExpFarmingRunning() || Data.DebugWindowOpen;

    /// <summary>One tick. 1:1 process.</summary>
    public void Process()
    {
        if (Data.IsExpFarmingRunning())
        {
            int tick = Interlocked.Increment(ref _tickCounter);
            Console.WriteLine("\n" + Separator80);
            ColorPrinter.Blue($"[D4 EXP Farming] Tick #{tick}");
            Console.WriteLine(Separator80);
            var result = D4Pipeline.Instance.RunExpFarmingSteps();
            D4UiStatusUpdater.Instance.UpdateUiStatus(tick);
            D4EventManager.Instance.CheckStateChanges();
            UpdateDebugWindowIfOpen();
            PrintTickSummary(result.Success);
        }
        else if (Data.DebugWindowOpen)
        {
            var result = D4Pipeline.Instance.RunDebugWindowSteps();
            if (result.Success) UpdateDebugWindowIfOpen();
        }
    }

    /// <summary>Reset the tick counter and set the running flag. 1:1 start_exp_farming.</summary>
    public void StartExpFarming()
    {
        Volatile.Write(ref _tickCounter, 0);
        Data.ExpFarmingRunning = true;
        Console.WriteLine("\n" + Separator80);
        ColorPrinter.Green("[D4 EXP Farming] Started");
        Console.WriteLine(Separator80 + "\n");
    }

    /// <summary>Clear the running flag. 1:1 stop_exp_farming.</summary>
    public void StopExpFarming()
    {
        Data.ExpFarmingRunning = false;
        Console.WriteLine("\n" + Separator80);
        ColorPrinter.Green($"[D4 EXP Farming] Stopped (Total ticks: {TickCounter})");
        Console.WriteLine(Separator80 + "\n");
    }

    public bool IsExpFarmingRunning() => Data.IsExpFarmingRunning();

    /// <summary>Typed replacement of get_state_dict (D4InterfaceData.get_summary).</summary>
    public D4StatusSnapshot GetState() => D4UiStatusUpdater.Instance.Collect(TickCounter);

    private void UpdateDebugWindowIfOpen()
    {
        ColorPrinter.Blue($"{LogPrefix} Checking debug window status: {Data.DebugWindowOpen}");
        if (!Data.DebugWindowOpen)
        {
            ColorPrinter.Yellow($"{LogPrefix} Debug window is closed, skipping update");
            return;
        }
        ColorPrinter.Blue($"{LogPrefix} Debug window is open, updating images...");
        ColorPrinter.Blue($"{LogPrefix} detected_regions has {Data.RegionImageCount} region images");
        DebugImagesUpdated?.Invoke();
        ColorPrinter.Green($"{LogPrefix} Debug window images updated (if open)");
    }

    /// <summary>1:1 _print_tick_summary.</summary>
    private static void PrintTickSummary(bool success)
    {
        var (w, h) = Data.GameWindowSize;
        int regionCount = Data.DetectedRegions?.Count ?? 0;
        int pointCount = Data.DetectedPoints?.Count ?? 0;
        var screenshot = Data.LastScreenshotPath;
        var annotated = Data.LastAnnotatedScreenshotPath;
        Console.WriteLine(Dash80);
        ColorPrinter.Green($"[Summary] Status: {(success ? "[OK] Success" : "[ERROR] Failed")}");
        ColorPrinter.Blue($"[Summary] DEBUG Mode: {(D4Pipeline.Instance.DebugImages ? "Enabled" : "Disabled")}");
        ColorPrinter.Blue($"[Summary] Window: {w}x{h} ({(Data.IsWindowedMode() ? "Windowed" : "Fullscreen")})");
        ColorPrinter.Blue($"[Summary] Detected: {regionCount} regions, {pointCount} points");
        if (!string.IsNullOrEmpty(screenshot))
            ColorPrinter.Blue($"[Summary] Screenshot: {ShortenPath(screenshot)}");
        if (!string.IsNullOrEmpty(annotated))
            ColorPrinter.Blue($"[Summary] Annotated: {ShortenPath(annotated)}");
        Console.WriteLine(Separator80 + "\n");
    }

    private static string ShortenPath(string path) =>
        path.Length > SummaryPathMaxLength ? "..." + path[^SummaryPathTailLength..] : path;
}
