// PY-REF: pyapps/d3-check/controller/d4func/exp_farming.py
// PY-REF: pyapps/d3-check/controller/d4_controller.py
// PY-REF: pyapps/d3-check/ui/panels/d4_panel.py
using DotCore.Foundations;
using OpenCvSharp;

namespace DotApps.d3d4tester.Core.D4;

/// <summary>
/// D4 pipeline facade for the controller/UI: one method per step with typed results, the full exp-farming tick,
/// the debug-window tick, the team check (Start button) and the Battle.net D4 launch.
/// 1:1 Python pyapps/d3-check/controller/d4func/exp_farming.py (steps 1–4) and the step calls of controller/d4_controller.py
/// and ui/panels/d4_panel.py (team check before start). Ticks are synchronous; call them from a background tick loop.
/// </summary>
public sealed class D4Pipeline
{
    private const string LogPrefix = "[D4Pipeline]";
    private const string ExpLogPrefix = "[ExpFarmingManager]";

    private static readonly Lazy<D4Pipeline> LazyInstance = new(() => new D4Pipeline());

    private readonly object _tickLock = new();

    private D4Pipeline() { }

    public static D4Pipeline Instance => LazyInstance.Value;

    public D4InterfaceData Data => D4InterfaceData.Instance;

    /// <summary>Write debug images (Python DEBUG = True): annotated regions, team health rows, minimap match.</summary>
    public bool DebugImages { get; set; } = true;

    /// <summary>"No team" OCR prefixes of the Find Team button (game client language list).</summary>
    public IReadOnlyList<string> FindTeamPrefixes
    {
        get => D4TeamFormationChecker.Instance.FindTeamPrefixes;
        set
        {
            var list = value is { Count: > 0 } ? value : D4Constants.FindTeamOcrPrefixes;
            D4TeamFormationChecker.Instance.FindTeamPrefixes = list;
            D4AutoTeamFormation.Instance.FindTeamPrefixes = list;
        }
    }

    /// <summary>Create the D4 output dirs (d4_screenshots, d4_annotated) and register the D4 OCR tasks.</summary>
    public void EnsureInitialized()
    {
        Directory.CreateDirectory(D4Constants.ScreenshotDir);
        Directory.CreateDirectory(D4Constants.AnnotatedDir);
        D4OcrConfig.EnsureRegistered();
        ColorPrinter.Blue($"{LogPrefix} Screenshot directory: {D4Constants.ScreenshotDir}");
        ColorPrinter.Blue($"{LogPrefix} Annotated directory: {D4Constants.AnnotatedDir}");
    }

    /// <summary>Step 1: capture the D4 window.</summary>
    public D4CaptureResult Capture() => D4ScreenshotHandler.Instance.CaptureAndCollectInfo(Data);

    /// <summary>Step 2: team health, small map, window regions, region crops.</summary>
    public D4RegionDetectionResult DetectRegions() => D4RegionDetector.Instance.DetectRegionsFromSharedData(Data, DebugImages);

    /// <summary>Step 3a: map switch edge detection (runs map OCR on a completed switch).</summary>
    public D4MapSwitchResult DetectMapSwitch() => D4MapSwitchDetector.Instance.DetectMapSwitch(Data);

    /// <summary>Step 3b: map name OCR while post-switch idle.</summary>
    public D4MapNameResult RecognizeMapName() => D4MapNameRecognizer.Instance.RecognizeMapName(Data);

    /// <summary>Step 4: save the frame; draw the full annotation once when no annotated image exists yet.</summary>
    public D4SaveResult SaveScreenshotAndAnnotate()
    {
        if (!Data.HasGameWindowImage)
        {
            ColorPrinter.Yellow($"{ExpLogPrefix} No screenshot data available for saving");
            return new D4SaveResult(null, Data.LastAnnotatedScreenshotPath);
        }
        var path = D4ScreenshotHandler.Instance.SaveScreenshotToDisk(Data, D4Constants.ScreenshotDir);
        if (!string.IsNullOrEmpty(path))
        {
            Data.LastScreenshotPath = path;
            Data.LastScreenshotTime = DateTime.Now;
        }
        if (string.IsNullOrEmpty(Data.LastAnnotatedScreenshotPath))
        {
            using var frame = Data.CloneGameWindowImage();
            if (frame != null)
            {
                using var annotated = D4WindowRegionDetector.AnnotateAll(frame, Data.GameWindowSize, Data.IsWindowedMode());
                var annotatedPath = D4ImageCrop.Save(annotated, D4ImageCrop.TimestampedPath(D4Constants.AnnotatedDir, D4Constants.AnnotatedImagePrefix), ExpLogPrefix);
                if (annotatedPath != null)
                {
                    Data.LastAnnotatedScreenshotPath = annotatedPath;
                    ColorPrinter.Green($"[ImageAnnotator] Annotated image saved: {annotatedPath}");
                }
            }
        }
        return new D4SaveResult(string.IsNullOrEmpty(path) ? null : path, Data.LastAnnotatedScreenshotPath);
    }

    /// <summary>Exp-farming tick: capture -> regions -> map switch + map name -> save. 1:1 start_exp_farming_process.</summary>
    public D4TickResult RunExpFarmingSteps()
    {
        lock (_tickLock)
        {
            var capture = Capture();
            if (!capture.Success) return new D4TickResult(false, capture, null, null, null, null);
            var regions = DetectRegions();
            if (!regions.Success) return new D4TickResult(false, capture, regions, null, null, null);
            DetectFrameMarkers();
            var mapSwitch = DetectMapSwitch();
            var mapName = RecognizeMapName();
            var save = SaveScreenshotAndAnnotate();
            return new D4TickResult(true, capture, regions, mapSwitch, mapName, save);
        }
    }

    /// <summary>Debug-window tick (not farming): capture -> regions -> on success map switch + map name. 1:1 D4Controller.process else-branch.</summary>
    public D4TickResult RunDebugWindowSteps()
    {
        lock (_tickLock)
        {
            ColorPrinter.Blue("[D4Controller] Debug window mode - performing screenshot and region detection...");
            var capture = Capture();
            ColorPrinter.Blue($"[D4Controller] Screenshot capture result: {capture.Success}");
            if (!capture.Success)
            {
                ColorPrinter.Yellow("[D4Controller] Screenshot capture failed for debug window");
                return new D4TickResult(false, capture, null, null, null, null);
            }
            var regions = DetectRegions();
            ColorPrinter.Blue($"[D4Controller] Region detection result: {regions.Success}");
            if (!regions.Success)
            {
                ColorPrinter.Yellow("[D4Controller] Region detection failed for debug window");
                return new D4TickResult(false, capture, regions, null, null, null);
            }
            DetectFrameMarkers();
            var mapSwitch = DetectMapSwitch();
            var mapName = RecognizeMapName();
            return new D4TickResult(true, capture, regions, mapSwitch, mapName, null);
        }
    }

    /// <summary>
    /// Start-button team check: capture once (windowed/fullscreen known), then the checker (title-bar activation, O, wait, OCR,
    /// auto formation). Caller aborts start only when HasTeam == false. Blocks ~3 s or more.
    /// </summary>
    public D4TeamCheckResult CheckTeamFormation()
    {
        lock (_tickLock)
        {
            var capture = Capture();
            if (!capture.Success)
                ColorPrinter.Yellow($"{LogPrefix} Capture before team check failed; checking with last known window data");
            var checker = D4TeamFormationChecker.Instance;
            checker.Run();
            return checker.LastResult ?? new D4TeamCheckResult(false, Data.HasTeam, null, false, false);
        }
    }

    /// <summary>Post-switch idle -> normal on a user action.</summary>
    public void ResetPostSwitchIdle() => D4MapSwitchDetector.Instance.ResetPostSwitchIdle(Data);

    /// <summary>Red portal in the current frame.</summary>
    public Rect? DetectRedPortal()
    {
        using var frame = Data.CloneGameWindowImage();
        return frame == null ? null : D4RedPortalDetector.Detect(frame, Data.IsWindowedMode());
    }

    /// <summary>Per-frame markers on the captured image: dungeon progress bar and red portal (logged when it appears).</summary>
    private void DetectFrameMarkers()
    {
        using var frame = Data.CloneGameWindowImage();
        if (frame == null) return;
        bool windowed = Data.IsWindowedMode();
        Data.DungeonProgress = D4DungeonProgressDetector.Detect(frame, windowed);
        var portal = D4RedPortalDetector.Detect(frame, windowed);
        if (portal != null && Data.RedPortal == null)
            ColorPrinter.Green($"{LogPrefix} Red portal detected at ({portal.Value.X},{portal.Value.Y}) {portal.Value.Width}x{portal.Value.Height}");
        Data.RedPortal = portal;
    }

    /// <summary>Clear the shared data and detector state (call on Stop); keepDebugWindow keeps the debug-window flags inside the tick lock.</summary>
    public void Reset(bool keepDebugWindow = false)
    {
        lock (_tickLock)
        {
            Data.Clear(keepDebugWindow);
            D4MapSwitchDetector.Instance.Reset();
            D4MapNameRecognizer.Instance.Reset();
        }
    }
}
