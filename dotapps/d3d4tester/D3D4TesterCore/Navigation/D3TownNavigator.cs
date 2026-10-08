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

/// <summary>Navigation settings: model path (empty = the registry's current "navigation" model), confidence, steps.</summary>
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

    /// <summary>Matched frames a target track needs before it is clicked (one flicker neither starts nor stops a walk).</summary>
    private const int ConfirmHits = 2;
    private const int ConfirmFrameWaitMs = 120;

    private static readonly Lazy<D3TownNavigator> LazyInstance = new(() => new D3TownNavigator());
    private readonly object _lock = new();
    private (string? Configured, DateTime ModelsStamp, string? Path)? _resolved;
    private string? _classesCheckedFor;

    private D3TownNavigator() { }

    public static D3TownNavigator Instance => LazyInstance.Value;

    /// <summary>Directory for annotated debug frames (set by the app).</summary>
    public static string? DebugDir { get; set; }

    /// <summary>Detect all town targets in the current D3 frame and log them; empty when no model or no window.</summary>
    public IReadOnlyList<YoloDetection> DetectOnce(D3NavigationOptions options)
    {
        using var model = AcquireModel(options);
        if (model == null) return Array.Empty<YoloDetection>();
        var frame = Capture(out _);
        if (frame == null) return Array.Empty<YoloDetection>();
        using (frame)
        {
            var detections = model.Detector.Detect(frame, model.Profile);
            Log(detections);
            if (options.SaveDebugImages) SaveDebug(frame, detections);
            return detections;
        }
    }

    /// <summary>Walk to the target; shouldStop is polled every step.</summary>
    public D3NavigationOutcome NavigateTo(string target, D3NavigationOptions options, Func<bool> shouldStop)
    {
        using var model = AcquireModel(options);
        if (model == null) return D3NavigationOutcome.NoModel;
        var detector = model.Detector;
        if (detector.ClassNames.Count > 0 && !detector.ClassNames.Contains(target))
            ColorPrinter.Yellow($"{LogTag} Model has no class '{target}' (classes: {string.Join(", ", detector.ClassNames)})");

        var click = StateAwareClickHandler.Instance;
        var tracker = new YoloFrameTracker(new YoloTrackerOptions(MinHits: ConfirmHits, MaxMisses: 1,
            HighConfidence: options.Confidence, LowConfidence: options.Confidence));
        for (int step = 1; step <= Math.Max(1, options.MaxSteps); step++)
        {
            if (shouldStop()) return D3NavigationOutcome.Stopped;
            tracker.Reset();
            YoloTrack? hit = null;
            int frameHeight = 0;
            (int X, int Y) offset = default;
            for (int f = 0; f <= ConfirmHits && hit == null; f++)
            {
                if (f > 0) Thread.Sleep(ConfirmFrameWaitMs);
                var frame = Capture(out offset);
                if (frame == null) return D3NavigationOutcome.NoWindow;
                frameHeight = frame.Height;
                using (frame)
                {
                    var detections = detector.Detect(frame, model.Profile);
                    if (options.SaveDebugImages) SaveDebug(frame, detections);
                    hit = tracker.Update(detections).Where(t => t.ClassName == target && t.Misses == 0).OrderByDescending(t => t.Confidence).FirstOrDefault();
                }
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

    /// <summary>Make a model the current navigation model; refused (not stored) when it lacks a town target class.</summary>
    public static YoloModelResolution SetCurrentModel(string modelPath)
    {
        var check = YoloModelRegistry.Check(Path.GetFullPath(modelPath), D3TownTargets.All);
        if (check.IsOk) YoloModelRegistry.Default.SetCurrent(YoloModelRegistry.ConsumerNavigation, check.ModelPath);
        return check;
    }

    /// <summary>The registry's current navigation model checked against the town targets.</summary>
    public static YoloModelResolution ResolveCurrentModel() => YoloModelRegistry.Default.Resolve(YoloModelRegistry.ConsumerNavigation, D3TownTargets.All);

    /// <summary>Configured model path, else the registry's current navigation model (cached until _models.json changes).</summary>
    private string? ResolveModelPath(string? configuredPath)
    {
        var configured = string.IsNullOrWhiteSpace(configuredPath) ? null : configuredPath.Trim();
        if (configured != null) return File.Exists(configured) ? configured : Missing(configured);
        var stamp = YoloModelRegistry.Default.ModelsFileStamp();
        lock (_lock)
        {
            if (_resolved is { } r && r.Configured == null && r.ModelsStamp == stamp && (r.Path == null || File.Exists(r.Path))) return r.Path;
        }
        var resolution = ResolveCurrentModel();
        string? path = null;
        switch (resolution.Status)
        {
            case YoloModelResolveStatus.Ok:
                path = resolution.ModelPath;
                break;
            case YoloModelResolveStatus.MissingClasses:
                ColorPrinter.Yellow($"{LogTag} Current navigation model lacks {string.Join(", ", resolution.MissingClasses)}: {resolution.ModelPath}");
                break;
            case YoloModelResolveStatus.FileMissing:
                Missing(resolution.ModelPath ?? "");
                break;
            default:
                ColorPrinter.Yellow($"{LogTag} No NPC model: set navigation.npc_model_path or set a trained model as the navigation model ({YoloModelRegistry.Default.ModelsFile})");
                break;
        }
        lock (_lock) _resolved = (null, stamp, path);
        return path;
    }

    private static string? Missing(string path)
    {
        ColorPrinter.Yellow($"{LogTag} NPC model file not found: {path}");
        return null;
    }

    /// <summary>Model lease from the shared host plus the run's inference profile (ROI / tiling, design §11).</summary>
    private sealed class ModelUse : IDisposable
    {
        private readonly YoloModelLease _lease;

        public ModelUse(YoloModelLease lease, YoloInferenceProfile profile)
        {
            _lease = lease;
            Profile = profile;
        }

        public YoloOnnxDetector Detector => _lease.Detector;

        public YoloInferenceProfile Profile { get; }

        public void Dispose() => _lease.Dispose();
    }

    /// <summary>Lease of the resolved model from YoloModelHost.Shared, or null (logged) when none can be loaded.</summary>
    private ModelUse? AcquireModel(D3NavigationOptions options)
    {
        YoloModelLease? lease;
        try
        {
            lease = YoloModelHost.Shared.TryAcquire(() => ResolveModelPath(options.ModelPath));
        }
        catch (Exception ex)
        {
            ColorPrinter.Red($"{LogTag} Model load failed: {ex.Message}");
            return null;
        }
        if (lease == null) return null;
        var path = lease.ModelPath;
        var classes = lease.Detector.ClassNames;
        lock (_lock)
        {
            if (!string.Equals(_classesCheckedFor, path, StringComparison.OrdinalIgnoreCase))
            {
                _classesCheckedFor = path;
                var missing = D3TownTargets.All.Where(t => classes.Count > 0 && !classes.Contains(t)).ToList();
                if (missing.Count > 0) ColorPrinter.Yellow($"{LogTag} Model {path} lacks classes: {string.Join(", ", missing)}");
            }
        }
        var inference = YoloArtifacts.RunDirOfModel(path) is { } runDir ? YoloRunInfo.Load(runDir)?.Inference : null;
        return new ModelUse(lease, YoloInferenceProfile.FromInference(inference) with { Confidence = options.Confidence });
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
        try
        {
            return ImageConvert.BitmapToMat(sd.GameWindowImage);
        }
        finally
        {
            sd.GameWindowImage.Dispose();
            sd.FullscreenImage?.Dispose();
        }
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
