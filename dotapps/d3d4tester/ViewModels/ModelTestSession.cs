// PY-REF: none (DOT-only)
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.Json;
using DotCore.VocAnnotator;
using DotCore.YoloDetect;
using DotCore.YoloTaskSet;
using DotCore.YoloTrain;
using OpenCvSharp;

namespace DotApps.d3d4tester.ViewModels;

/// <summary>
/// Detection mode of the model test: Auto = the model's inference profile (design section 11); Full = whole-frame letterbox;
/// Roi = letterbox of the ROI only; Tiled = native-size tiles over the whole frame (or the user ROI), ignoring the model's ROI hint.
/// </summary>
public enum ModelTestMode { Auto, Full, Roi, Tiled }

/// <summary>User overrides applied on top of the model profile. Tile size 0 / overlap &lt; 0 / null Roi keep the profile value.</summary>
public sealed record ModelTestSettings(ModelTestMode Mode, float Confidence, float Iou, int TileSize, int TileOverlap, Rect? Roi, bool Track);

/// <summary>Which analyzed video frames a batch export writes.</summary>
public enum ModelTestExportFilter { EveryN, LowConfidence, WithClass }

/// <summary>One detected frame. The frame owns Image and disposes it. Flicker maps track id to its lost-and-recovered count.</summary>
public sealed class ModelTestFrame : IDisposable
{
    private static readonly IReadOnlyDictionary<int, int> NoFlicker = new Dictionary<int, int>();

    public ModelTestFrame(Mat image, IReadOnlyList<YoloDetection> detections, IReadOnlyList<YoloTrack> tracks, double captureMs, YoloDetectTiming timing,
        double fps = 0, int frameIndex = -1, TimeSpan? timestamp = null, IReadOnlyDictionary<int, int>? flicker = null)
    {
        Image = image;
        Detections = detections;
        Tracks = tracks;
        CaptureMs = captureMs;
        Timing = timing;
        Fps = fps;
        FrameIndex = frameIndex;
        Timestamp = timestamp;
        Flicker = flicker ?? NoFlicker;
    }

    public Mat Image { get; }

    public IReadOnlyList<YoloDetection> Detections { get; }

    public IReadOnlyList<YoloTrack> Tracks { get; }

    public double CaptureMs { get; }

    public YoloDetectTiming Timing { get; }

    /// <summary>Measured processing rate of the producing loop; 0 for single frames.</summary>
    public double Fps { get; }

    /// <summary>Video frame index; -1 for still images and live frames.</summary>
    public int FrameIndex { get; }

    public TimeSpan? Timestamp { get; }

    public IReadOnlyDictionary<int, int> Flicker { get; }

    /// <summary>Cached detections (video analysis) instead of a fresh inference.</summary>
    public bool FromCache { get; init; }

    public void Dispose() => Image.Dispose();
}

/// <summary>Per-frame detections of a whole-video pass, keyed by model, profile and step; persisted as {video}.detections.json.</summary>
public sealed class ModelTestVideoAnalysis
{
    public const string CacheSuffix = ".detections.json";

    public ModelTestVideoAnalysis(string key, int frameCount, int frameStep, IReadOnlyList<string> classes, IReadOnlyDictionary<int, IReadOnlyList<YoloDetection>> frames)
    {
        Key = key;
        FrameCount = frameCount;
        FrameStep = frameStep;
        Classes = classes;
        Frames = frames;
    }

    public string Key { get; }

    public int FrameCount { get; }

    public int FrameStep { get; }

    public IReadOnlyList<string> Classes { get; }

    public IReadOnlyDictionary<int, IReadOnlyList<YoloDetection>> Frames { get; }

    public static string CachePath(string videoPath) => videoPath + CacheSuffix;

    /// <summary>Analyzed frame at or before frameIndex within one step (scrubbing between analyzed frames).</summary>
    public int? NearestFrame(int frameIndex)
    {
        int f = frameIndex - frameIndex % Math.Max(1, FrameStep);
        return Frames.ContainsKey(f) ? f : null;
    }

    internal sealed record CachedBox(int C, string N, float S, int X, int Y, int W, int H);

    internal sealed record CacheFile(string Key, int FrameCount, int FrameStep, List<string> Classes, Dictionary<int, List<CachedBox>> Frames);

    internal void Save(string path)
    {
        var file = new CacheFile(Key, FrameCount, FrameStep, Classes.ToList(), Frames.ToDictionary(
            kv => kv.Key, kv => kv.Value.Select(d => new CachedBox(d.ClassId, d.ClassName, d.Confidence, d.Box.X, d.Box.Y, d.Box.Width, d.Box.Height)).ToList()));
        var tmp = path + ".tmp";
        File.WriteAllText(tmp, JsonSerializer.Serialize(file));
        File.Move(tmp, path, overwrite: true);
    }

    internal static ModelTestVideoAnalysis? Load(string path, string key)
    {
        if (!File.Exists(path)) return null;
        try
        {
            var file = JsonSerializer.Deserialize<CacheFile>(File.ReadAllText(path));
            if (file == null || file.Key != key) return null;
            var frames = file.Frames.ToDictionary(kv => kv.Key, kv => (IReadOnlyList<YoloDetection>)kv.Value
                .Select(b => new YoloDetection(b.C, b.N, b.S, new Rect(b.X, b.Y, b.W, b.H))).ToList());
            return new ModelTestVideoAnalysis(file.Key, file.FrameCount, file.FrameStep, file.Classes, frames);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException or NotSupportedException)
        {
            return null;
        }
    }
}

/// <summary>Physical monitor rectangles (virtual-screen pixels), primary first.</summary>
public static class ModelTestScreens
{
    private const uint MonitorInfoPrimary = 1;

    public static IReadOnlyList<Rect> Monitors()
    {
        var list = new List<(Rect Bounds, bool Primary)>();
        EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, (monitor, _, _, _) =>
        {
            var info = new MonitorInfo { Size = Marshal.SizeOf<MonitorInfo>() };
            if (GetMonitorInfo(monitor, ref info))
                list.Add((new Rect(info.Monitor.Left, info.Monitor.Top, info.Monitor.Right - info.Monitor.Left, info.Monitor.Bottom - info.Monitor.Top),
                    (info.Flags & MonitorInfoPrimary) != 0));
            return true;
        }, IntPtr.Zero);
        return list.OrderByDescending(m => m.Primary).ThenBy(m => m.Bounds.X).ThenBy(m => m.Bounds.Y).Select(m => m.Bounds).ToList();
    }

    private delegate bool MonitorEnumProc(IntPtr monitor, IntPtr hdc, IntPtr rect, IntPtr data);

    [StructLayout(LayoutKind.Sequential)]
    private struct NativeRect
    {
        public int Left, Top, Right, Bottom;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MonitorInfo
    {
        public int Size;
        public NativeRect Monitor;
        public NativeRect Work;
        public uint Flags;
    }

    [DllImport("user32.dll")]
    private static extern bool EnumDisplayMonitors(IntPtr hdc, IntPtr clip, MonitorEnumProc callback, IntPtr data);

    [DllImport("user32.dll")]
    private static extern bool GetMonitorInfo(IntPtr monitor, ref MonitorInfo info);
}

/// <summary>
/// Model-test runtime (no WPF): holds a lease on the shared session of the loaded model (YoloModelHost), maps the UI mode to an
/// inference profile and runs still-image, video and live passes off the caller's thread. Hard-example sinks write labeled data
/// (unreviewed model provenance) and task-set resources.
/// </summary>
public sealed class ModelTestSession : IDisposable
{
    private const string PngExtension = ".png";
    private const string JpgExtension = ".jpg";
    private const string StemFormat = "yyyyMMdd_HHmmss_fff";
    private const string FrameStemFormat = "{0}_f{1:D6}";
    private const double FpsSmoothing = 0.2;
    private const int ProgressEvery = 5;

    private readonly object _gate = new();
    private readonly YoloModelHost _host;
    private YoloModelLease? _lease;
    private YoloInferenceProfile _profile = YoloInferenceProfile.Default;
    private YoloLiveDetector? _live;

    public ModelTestSession(YoloModelHost? host = null) => _host = host ?? YoloModelHost.Shared;

    public YoloOnnxDetector? Detector
    {
        get { lock (_gate) return _lease?.Detector; }
    }

    /// <summary>True when the loaded model file was replaced since loading (re-export).</summary>
    public bool IsStale
    {
        get { lock (_gate) return _lease?.IsStale == true; }
    }

    /// <summary>Profile recorded with the model (ROI hint, tile size, scale mode); Default when unknown.</summary>
    public YoloInferenceProfile ModelProfile
    {
        get { lock (_gate) return _profile; }
    }

    /// <summary>Execution provider choice; null = the host default options (config yolo_detect.*).</summary>
    public YoloDetectorOptions OptionsFor(YoloExecutionProvider? provider) =>
        provider is { } p ? _host.DefaultOptions with { Provider = p } : _host.DefaultOptions;

    /// <summary>
    /// Acquire the model's shared session (blocking; call off the UI thread, with video playback stopped). Stops the live loop;
    /// the previous lease is released after the swap. A re-exported file (stale lease) is reloaded.
    /// </summary>
    public YoloOnnxDetector Load(string onnxPath, YoloInferenceProfile? profile, YoloDetectorOptions? options = null)
    {
        StopLive();
        var lease = _host.Acquire(onnxPath, options);
        YoloModelLease? old;
        lock (_gate)
        {
            old = _lease;
            _lease = lease;
            _profile = profile ?? YoloInferenceProfile.Default;
        }
        old?.Dispose();
        return lease.Detector;
    }

    /// <summary>The inference profile for a mode: model profile values unless the user overrides them.</summary>
    public YoloInferenceProfile BuildProfile(ModelTestSettings s)
    {
        var p = ModelProfile;
        var roi = s.Roi ?? p.Roi;
        int tile = s.TileSize > 0 ? s.TileSize : 0;
        YoloInferenceProfile Tiled(Rect? region) => new(YoloScaleMode.Native, tile > 0 ? tile : p.TileWidth, tile > 0 ? tile : p.TileHeight,
            s.TileOverlap >= 0 ? s.TileOverlap : p.TileOverlap, region, s.Confidence, s.Iou);
        return s.Mode switch
        {
            ModelTestMode.Full => new YoloInferenceProfile(YoloScaleMode.Relative, Confidence: s.Confidence, Iou: s.Iou),
            ModelTestMode.Roi => new YoloInferenceProfile(YoloScaleMode.Relative, Roi: roi, Confidence: s.Confidence, Iou: s.Iou),
            ModelTestMode.Tiled => Tiled(s.Roi),
            _ => p.ScaleMode == YoloScaleMode.Native ? Tiled(roi) : p with { Roi = roi, Confidence = s.Confidence, Iou = s.Iou },
        };
    }

    /// <summary>Tracks start and continue at the detection threshold (the detector already drops lower scores).</summary>
    public static YoloTrackerOptions TrackerOptions(ModelTestSettings s) =>
        YoloTrackerOptions.Default with { HighConfidence = s.Confidence, LowConfidence = s.Confidence };

    /// <summary>Detect on a still image; takes ownership of image.</summary>
    public ModelTestFrame DetectStill(Mat image, ModelTestSettings settings, double captureMs = 0)
    {
        var detector = Detector ?? throw new InvalidOperationException("No model loaded.");
        var result = detector.DetectTimed(image, BuildProfile(settings));
        return new ModelTestFrame(image, result.Detections, Array.Empty<YoloTrack>(), captureMs, result.Timing);
    }

    /// <summary>
    /// Plays a video from startFrame: decode, detect and track in one pass (single VideoCapture), paced to fps x speed
    /// (speed &lt;= 0 = as fast as possible). onFrame receives an owned frame; returns the last frame index reached.
    /// </summary>
    public int PlayVideo(string videoPath, int startFrame, int endFrame, double fps, Func<double> speed, ModelTestSettings settings,
        Action<ModelTestFrame> onFrame, CancellationToken ct)
    {
        var detector = Detector ?? throw new InvalidOperationException("No model loaded.");
        var options = new YoloVideoOptions(1, startFrame, endFrame, BuildProfile(settings), settings.Track, TrackerOptions(settings));
        var flicker = new FlickerCounter();
        int last = startFrame - 1;
        var clock = Stopwatch.StartNew();
        double dueMs = 0, lastMs = -1, intervalEma = 0;
        foreach (var f in new YoloVideoDetector(detector).Run(videoPath, options, ct))
        {
            last = f.FrameIndex;
            double now = clock.Elapsed.TotalMilliseconds;
            if (lastMs >= 0) intervalEma = intervalEma <= 0 ? now - lastMs : intervalEma + FpsSmoothing * (now - lastMs - intervalEma);
            lastMs = now;
            onFrame(new ModelTestFrame(f.Image.Clone(), f.Detections, f.Tracks, 0, f.Timing, intervalEma > 0 ? 1000.0 / intervalEma : 0,
                f.FrameIndex, f.Timestamp, flicker.Update(f.Tracks)));
            double rate = speed();
            if (fps <= 0 || rate <= 0) continue;
            dueMs += 1000.0 / (fps * rate);
            int wait = (int)(dueMs - clock.Elapsed.TotalMilliseconds);
            if (wait > 0) ct.WaitHandle.WaitOne(wait);
            else if (wait < -1000) dueMs = clock.Elapsed.TotalMilliseconds;
        }
        return last;
    }

    /// <summary>One video frame (frame stepping / scrubbing): cached detections when the analysis has it, else a fresh detection.</summary>
    public ModelTestFrame? DetectVideoFrame(string videoPath, int frameIndex, double fps, ModelTestSettings settings, ModelTestVideoAnalysis? analysis)
    {
        if (analysis?.Frames.TryGetValue(frameIndex, out var cached) == true)
        {
            var image = ReadVideoFrame(videoPath, frameIndex);
            if (image == null) return null;
            var timestamp = fps > 0 ? TimeSpan.FromSeconds(frameIndex / fps) : (TimeSpan?)null;
            return new ModelTestFrame(image, cached, Array.Empty<YoloTrack>(), 0, default, 0, frameIndex, timestamp) { FromCache = true };
        }
        var detector = Detector ?? throw new InvalidOperationException("No model loaded.");
        var options = new YoloVideoOptions(1, frameIndex, frameIndex + 1, BuildProfile(settings), false);
        foreach (var f in new YoloVideoDetector(detector).Run(videoPath, options))
            return new ModelTestFrame(f.Image.Clone(), f.Detections, f.Tracks, 0, f.Timing, 0, f.FrameIndex, f.Timestamp);
        return null;
    }

    /// <summary>Owned BGR frame of a video, or null when it cannot be read.</summary>
    public static Mat? ReadVideoFrame(string videoPath, int frameIndex)
    {
        using var capture = new VideoCapture(videoPath);
        if (!capture.IsOpened()) return null;
        if (frameIndex > 0) capture.Set(VideoCaptureProperties.PosFrames, frameIndex);
        var frame = new Mat();
        if (capture.Read(frame) && !frame.Empty()) return frame;
        frame.Dispose();
        return null;
    }

    // ---------- whole-video analysis ----------

    /// <summary>Cache key: model file + write time, resolved profile (thresholds included), frame step and video file stamp.</summary>
    public string AnalysisKey(string videoPath, ModelTestSettings settings, int frameStep)
    {
        var detector = Detector ?? throw new InvalidOperationException("No model loaded.");
        var model = new FileInfo(detector.ModelPath);
        var video = new FileInfo(videoPath);
        return string.Create(CultureInfo.InvariantCulture,
            $"{model.FullName}|{model.LastWriteTimeUtc.Ticks}|{BuildProfile(settings)}|{Math.Max(1, frameStep)}|{video.Length}|{video.LastWriteTimeUtc.Ticks}");
    }

    /// <summary>Saved analysis of the video for this key, or null.</summary>
    public ModelTestVideoAnalysis? LoadAnalysis(string videoPath, ModelTestSettings settings, int frameStep) =>
        ModelTestVideoAnalysis.Load(ModelTestVideoAnalysis.CachePath(videoPath), AnalysisKey(videoPath, settings, frameStep));

    /// <summary>
    /// Detect every frameStep-th frame of the whole video (no tracking), report (done, total), and save the cache next to the
    /// video (kept in memory only when the folder is read-only). Null when cancelled.
    /// </summary>
    public ModelTestVideoAnalysis? AnalyzeVideo(string videoPath, int frameCount, ModelTestSettings settings, int frameStep,
        IProgress<(int Done, int Total)>? progress, CancellationToken ct)
    {
        var detector = Detector ?? throw new InvalidOperationException("No model loaded.");
        int step = Math.Max(1, frameStep);
        int total = (frameCount + step - 1) / step;
        var key = AnalysisKey(videoPath, settings, step);
        var frames = new Dictionary<int, IReadOnlyList<YoloDetection>>();
        var options = new YoloVideoOptions(step, 0, -1, BuildProfile(settings), false);
        foreach (var f in new YoloVideoDetector(detector).Run(videoPath, options, ct))
        {
            frames[f.FrameIndex] = f.Detections;
            if (frames.Count % ProgressEvery == 0) progress?.Report((frames.Count, total));
        }
        if (ct.IsCancellationRequested) return null;
        progress?.Report((frames.Count, total));
        var analysis = new ModelTestVideoAnalysis(key, frameCount, step, detector.ClassNames, frames);
        try
        {
            analysis.Save(ModelTestVideoAnalysis.CachePath(videoPath));
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
        }
        return analysis;
    }

    /// <summary>Analyzed frames selected by the filter (EveryN over analyzed frames, any box below lowConfidence, any box of className).</summary>
    public static IReadOnlyList<int> SelectFrames(ModelTestVideoAnalysis analysis, ModelTestExportFilter filter, int everyN, float lowConfidence, string? className) =>
        analysis.Frames.Keys.OrderBy(f => f).Where((f, i) => filter switch
        {
            ModelTestExportFilter.LowConfidence => analysis.Frames[f].Any(d => d.Confidence < lowConfidence),
            ModelTestExportFilter.WithClass => analysis.Frames[f].Any(d => d.ClassName == className),
            _ => i % Math.Max(1, everyN) == 0,
        }).ToList();

    /// <summary>Write the selected analyzed frames as JPG + JSON + VOC (unreviewed model provenance) in one sequential decode. Returns the count.</summary>
    public static int ExportFrames(string videoPath, ModelTestVideoAnalysis analysis, IReadOnlyList<int> frames, string dir, string source,
        IProgress<(int Done, int Total)>? progress, CancellationToken ct)
    {
        var wanted = new HashSet<int>(frames);
        int last = frames.Count == 0 ? -1 : frames.Max(), written = 0;
        using var capture = new VideoCapture(videoPath);
        if (!capture.IsOpened()) return 0;
        using var frame = new Mat();
        for (int index = 0; index <= last && !ct.IsCancellationRequested; index++)
        {
            if (!wanted.Contains(index))
            {
                if (!capture.Grab()) break;
                continue;
            }
            if (!capture.Read(frame) || frame.Empty()) break;
            SaveLabeled(frame, analysis.Frames[index], dir, FrameStem(videoPath, index), source, JpgExtension);
            written++;
            if (written % ProgressEvery == 0) progress?.Report((written, wanted.Count));
        }
        progress?.Report((written, wanted.Count));
        return written;
    }

    // ---------- live ----------

    /// <summary>Start a live loop over provider frames (owned Mats or null); onFrame receives owned frames on the loop thread.</summary>
    public void StartLive(Func<Mat?> provider, ModelTestSettings settings, double targetFps, Action<ModelTestFrame> onFrame, Action<Exception> onFault)
    {
        var detector = Detector ?? throw new InvalidOperationException("No model loaded.");
        StopLive();
        // Dedicated capture/infer loop (DOT_ARCHITECTURE section 3 exception to TickDriver): newest frame only, FPS-capped.
        var live = new YoloLiveDetector(detector, provider, LiveOptions(settings, targetFps));
        var flicker = new FlickerCounter();
        live.FrameProcessed += (_, f) => onFrame(new ModelTestFrame(f.Image.Clone(), f.Detections, f.Tracks, f.CaptureMs, f.Timing, f.Fps,
            flicker: flicker.Update(f.Tracks)));
        live.Faulted += (_, ex) => onFault(ex);
        lock (_gate) _live = live;
        live.Start();
    }

    /// <summary>Apply new thresholds / mode / rate to the running live loop (no restart).</summary>
    public void UpdateLive(ModelTestSettings settings, double targetFps)
    {
        YoloLiveDetector? live;
        lock (_gate) live = _live;
        if (live == null) return;
        bool trackChanged = live.Options.Track != settings.Track;
        live.Options = LiveOptions(settings, targetFps);
        if (trackChanged) live.ResetTracks();
    }

    public bool IsLive
    {
        get { lock (_gate) return _live?.IsRunning == true; }
    }

    /// <summary>Stop and dispose the live loop (waits for the loop thread; never call from a frame callback).</summary>
    public void StopLive()
    {
        YoloLiveDetector? live;
        lock (_gate)
        {
            live = _live;
            _live = null;
        }
        live?.Dispose();
    }

    public void Dispose()
    {
        StopLive();
        YoloModelLease? old;
        lock (_gate)
        {
            old = _lease;
            _lease = null;
        }
        old?.Dispose();
    }

    private YoloLiveOptions LiveOptions(ModelTestSettings settings, double targetFps) =>
        new(targetFps, BuildProfile(settings), settings.Track, TrackerOptions(settings));

    /// <summary>Counts per track how often it was lost (predicted) and found again: flicker marks weak classes.</summary>
    private sealed class FlickerCounter
    {
        private readonly Dictionary<int, (int Misses, int Count)> _state = new();

        public IReadOnlyDictionary<int, int> Update(IReadOnlyList<YoloTrack> tracks)
        {
            var next = new Dictionary<int, (int Misses, int Count)>();
            foreach (var t in tracks)
            {
                var (misses, count) = _state.TryGetValue(t.TrackId, out var s) ? s : (0, 0);
                next[t.TrackId] = (t.Misses, misses > 0 && t.Misses == 0 ? count + 1 : count);
            }
            _state.Clear();
            foreach (var kv in next) _state[kv.Key] = kv.Value;
            return next.ToDictionary(kv => kv.Key, kv => kv.Value.Count);
        }
    }

    // ---------- run metadata ----------

    /// <summary>Inference profile recorded with a run; null when the run has none (annotated datasets).</summary>
    public static YoloInferenceProfile? ProfileFromRun(YoloRunInfo? info) =>
        info?.Inference is { } inference ? YoloInferenceProfile.FromInference(inference) : null;

    /// <summary>Runs with an exported ONNX model, newest first.</summary>
    public static IReadOnlyList<YoloRunEntry> ListModelRuns() =>
        YoloModelRegistry.Default.ListRuns().Where(r => r.Onnx != null).ToList();

    /// <summary>Run entry of a model file inside {run}/weights; null for loose files.</summary>
    public static YoloRunEntry? RunOfModel(string onnxPath) =>
        YoloArtifacts.RunDirOfModel(onnxPath) is { } runDir ? YoloModelRegistry.ReadRun(runDir) : null;

    // ---------- hard-example sinks ----------

    /// <summary>File stem for a saved frame: source stem (or timestamp) plus the video frame index.</summary>
    public static string FrameStem(string? sourcePath, int frameIndex)
    {
        var stem = string.IsNullOrEmpty(sourcePath) ? DateTime.Now.ToString(StemFormat, CultureInfo.InvariantCulture) : Path.GetFileNameWithoutExtension(sourcePath);
        return frameIndex >= 0 ? string.Format(CultureInfo.InvariantCulture, FrameStemFormat, stem, frameIndex) : stem;
    }

    /// <summary>
    /// Write the frame plus JSON + VOC annotations into dir (annotator layout: annotations next to images), marked as unreviewed
    /// model pseudo-labels (source from AutoLabelService.SourceOf) so the annotator lists them for review.
    /// </summary>
    public static string SaveLabeled(Mat image, IEnumerable<YoloDetection> detections, string dir, string stem, string source, string extension = PngExtension)
    {
        Directory.CreateDirectory(dir);
        var imagePath = UniquePath(dir, stem, extension);
        Cv2.ImWrite(imagePath, image);
        var boxes = detections.Select(d => new AnnotationBox(d.ClassName, d.Box.X, d.Box.Y, d.Box.X + d.Box.Width, d.Box.Y + d.Box.Height, Confidence: d.Confidence));
        var annotation = new ImageAnnotation(imagePath, image.Width, image.Height, boxes) { Source = source, Reviewed = false };
        AnnotationIo.Save(annotation, dir, new AnnotationSaveOptions(WriteVoc: true));
        return imagePath;
    }

    /// <summary>PNG of a region (clipped to the image); null when the region is empty.</summary>
    public static byte[]? CropPng(Mat image, Rect region)
    {
        var r = region.Intersect(new Rect(0, 0, image.Width, image.Height));
        if (r.Width <= 0 || r.Height <= 0) return null;
        using var crop = new Mat(image, r);
        Cv2.ImEncode(PngExtension, crop, out var bytes);
        return bytes;
    }

    /// <summary>Add a cropped object as a variant of the target (fresh load, store saves). Returns the target name, null when missing.</summary>
    public static string? AddVariant(TaskSetStore store, string taskSetId, string targetId, byte[] png, string originalPath, string nameHint)
    {
        var set = store.Load(taskSetId);
        var target = set?.Targets.FirstOrDefault(t => t.Id == targetId);
        if (set == null || target == null) return null;
        store.AddVariantFromPng(set, target, png, originalPath, nameHint);
        return target.Name;
    }

    /// <summary>Add a frame as a common (negative) resource of the task set. Returns the task set name, null when missing.</summary>
    public static string? AddCommonNegative(TaskSetStore store, string taskSetId, Mat image, string nameHint)
    {
        var set = store.Load(taskSetId);
        if (set == null) return null;
        var tempDir = Path.Combine(Path.GetTempPath(), Path.GetRandomFileName());
        Directory.CreateDirectory(tempDir);
        try
        {
            var path = Path.Combine(tempDir, nameHint + PngExtension);
            Cv2.ImWrite(path, image);
            store.AddCommon(set, path);
            return set.Name;
        }
        finally
        {
            Directory.Delete(tempDir, true);
        }
    }

    /// <summary>"x,y,w,h" (negative x / y from the right / bottom, w / h &lt;= 0 to the edge); null when empty or malformed.</summary>
    public static Rect? ParseRect(string? text)
    {
        var parts = (text ?? "").Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length != 4) return null;
        var v = new int[4];
        for (int i = 0; i < 4; i++)
            if (!int.TryParse(parts[i], NumberStyles.Integer, CultureInfo.InvariantCulture, out v[i])) return null;
        return new Rect(v[0], v[1], v[2], v[3]);
    }

    public static string FormatRect(Rect? r) =>
        r is { } v ? string.Create(CultureInfo.InvariantCulture, $"{v.X},{v.Y},{v.Width},{v.Height}") : "";

    private static string UniquePath(string dir, string stem, string extension)
    {
        var path = Path.Combine(dir, stem + extension);
        for (int i = 1; File.Exists(path); i++)
            path = Path.Combine(dir, string.Create(CultureInfo.InvariantCulture, $"{stem}_{i}{extension}"));
        return path;
    }
}
