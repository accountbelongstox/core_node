// PY-REF: none (DOT-only; Python controller/pathfinding_controller was dead grid code)
using DotCore.Foundations;
using DotCore.Utils.ImagePreprocess;
using DotCore.VocAnnotator;
using DotCore.YoloDetect;
using DotCore.YoloTrain;
using OpenCvSharp;

namespace DotApps.d3d4tester.Core.Navigation;

/// <summary>Town targets the NPC model is trained on (YOLO class names).</summary>
public static class D3TownTargets
{
    public const string Blacksmith = "blacksmith";
    public const string KanaiCube = "kanai_cube";
    public const string Stash = "stash";
    public const string Waypoint = "waypoint";
    public static readonly string[] All = { Blacksmith, KanaiCube, Stash, Waypoint };
}

/// <summary>Navigation settings: model path (empty = newest best.onnx under the YOLO data root), confidence, steps.</summary>
public sealed record D3NavigationOptions(string? ModelPath, float Confidence, int MaxSteps, bool SaveDebugImages);

public enum D3NavigationOutcome { NoModel, NoWindow, NotFound, Arrived, StepsExhausted, Stopped }

/// <summary>
/// Walk to a town target (blacksmith, Kanai's cube, stash, waypoint) with the YOLO NPC model: capture D3, detect, click the target
/// (D3 click-to-move walks there and interacts on arrival), repeat until the target box is large enough (in reach) or steps run out.
/// </summary>
public sealed class D3TownNavigator
{
    private const string LogTag = "[TownNav]";
    private const double ArriveHeightRatio = 0.28;
    private const int StepWaitMs = 1200;
    private const int ArriveWaitMs = 800;
    private const string DebugPrefix = "town_nav_";

    private static readonly Lazy<D3TownNavigator> LazyInstance = new(() => new D3TownNavigator());
    private readonly object _lock = new();
    private YoloOnnxDetector? _detector;

    private D3TownNavigator() { }

    public static D3TownNavigator Instance => LazyInstance.Value;

    /// <summary>Directory for annotated debug frames (set by the app).</summary>
    public static string? DebugDir { get; set; }

    /// <summary>Detect all town targets in the current D3 frame and log them; empty when no model or no window.</summary>
    public IReadOnlyList<YoloDetection> DetectOnce(D3NavigationOptions options)
    {
        var detector = GetDetector(options.ModelPath);
        if (detector == null) return Array.Empty<YoloDetection>();
        var frame = Capture(out _);
        if (frame == null) return Array.Empty<YoloDetection>();
        using (frame)
        {
            var detections = detector.Detect(frame, options.Confidence);
            Log(detections);
            if (options.SaveDebugImages) SaveDebug(frame, detections);
            return detections;
        }
    }

    /// <summary>Walk to the target; shouldStop is polled every step.</summary>
    public D3NavigationOutcome NavigateTo(string target, D3NavigationOptions options, Func<bool> shouldStop)
    {
        var detector = GetDetector(options.ModelPath);
        if (detector == null) return D3NavigationOutcome.NoModel;
        if (detector.ClassNames.Count > 0 && !detector.ClassNames.Contains(target))
            ColorPrinter.Yellow($"{LogTag} Model has no class '{target}' (classes: {string.Join(", ", detector.ClassNames)})");

        var click = StateAwareClickHandler.Instance;
        for (int step = 1; step <= Math.Max(1, options.MaxSteps); step++)
        {
            if (shouldStop()) return D3NavigationOutcome.Stopped;
            var frame = Capture(out var offset);
            if (frame == null) return D3NavigationOutcome.NoWindow;
            YoloDetection? hit;
            int frameHeight = frame.Height;
            using (frame)
            {
                var detections = detector.Detect(frame, options.Confidence);
                if (options.SaveDebugImages) SaveDebug(frame, detections);
                hit = detections.Where(d => d.ClassName == target).OrderByDescending(d => d.Confidence).FirstOrDefault();
            }
            if (hit == null)
            {
                ColorPrinter.Yellow($"{LogTag} Step {step}: {target} not on screen");
                return D3NavigationOutcome.NotFound;
            }
            var p = hit.Center;
            bool inReach = hit.Box.Height >= frameHeight * ArriveHeightRatio;
            ColorPrinter.Blue($"{LogTag} Step {step}: {target} at ({p.X},{p.Y}) size {hit.Box.Width}x{hit.Box.Height} conf {hit.Confidence:0.00}{(inReach ? " (in reach)" : "")}");
            click.LeftClick(p.X + offset.X, p.Y + offset.Y, 0);
            if (inReach)
            {
                Thread.Sleep(ArriveWaitMs);
                ColorPrinter.Green($"{LogTag} Arrived at {target}");
                return D3NavigationOutcome.Arrived;
            }
            Thread.Sleep(StepWaitMs);
        }
        ColorPrinter.Yellow($"{LogTag} {target} not reached within {options.MaxSteps} steps");
        return D3NavigationOutcome.StepsExhausted;
    }

    /// <summary>Configured model, else the newest best.onnx under the YOLO data root; reloaded when the path changes.</summary>
    private YoloOnnxDetector? GetDetector(string? configuredPath)
    {
        string? path = !string.IsNullOrWhiteSpace(configuredPath) ? configuredPath.Trim()
            : YoloArtifacts.FindLatestFile(YoloDataLayout.Root, YoloArtifacts.ExportedOnnxFileName);
        if (path == null || !File.Exists(path))
        {
            ColorPrinter.Yellow($"{LogTag} No NPC model: set navigation.npc_model_path or train + export best.onnx under {YoloDataLayout.Root}");
            return null;
        }
        lock (_lock)
        {
            if (_detector != null && string.Equals(_detector.ModelPath, path, StringComparison.OrdinalIgnoreCase)) return _detector;
            try
            {
                _detector?.Dispose();
                _detector = new YoloOnnxDetector(path);
                return _detector;
            }
            catch (Exception ex)
            {
                _detector = null;
                ColorPrinter.Red($"{LogTag} Model load failed ({path}): {ex.Message}");
                return null;
            }
        }
    }

    private static Mat? Capture(out (int X, int Y) offset)
    {
        offset = (0, 0);
        var sd = D3Manager.Instance.CaptureGameWindow(activateFirst: true);
        if (sd?.GameWindowImage == null)
        {
            ColorPrinter.Yellow($"{LogTag} D3 window not found");
            return null;
        }
        offset = sd.WindowOffset;
        return ImageConvert.BitmapToMat(sd.GameWindowImage);
    }

    private static void Log(IReadOnlyList<YoloDetection> detections)
    {
        if (detections.Count == 0)
        {
            ColorPrinter.Yellow($"{LogTag} No town target on screen");
            return;
        }
        foreach (var d in detections)
            ColorPrinter.Blue($"{LogTag} {d.ClassName} conf {d.Confidence:0.00} box ({d.Box.X},{d.Box.Y},{d.Box.Width}x{d.Box.Height})");
    }

    private static void SaveDebug(Mat frame, IReadOnlyList<YoloDetection> detections)
    {
        if (string.IsNullOrEmpty(DebugDir)) return;
        try
        {
            Directory.CreateDirectory(DebugDir);
            using var annotated = YoloOnnxDetector.Annotate(frame, detections);
            var path = Path.Combine(DebugDir, DebugPrefix + DateTime.Now.ToString(D3PathConstants.FileTimestampFormat) + ".png");
            Cv2.ImWrite(path, annotated);
            ColorPrinter.Gray($"[DEBUG]{LogTag} Saved {path}");
        }
        catch (Exception ex)
        {
            ColorPrinter.Gray($"[DEBUG]{LogTag} Debug image failed: {ex.Message}");
        }
    }
}
