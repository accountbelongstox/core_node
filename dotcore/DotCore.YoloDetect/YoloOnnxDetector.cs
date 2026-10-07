// PY-REF: none (DOT-only; Python used the Ultralytics runtime)
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using DotCore.Foundations;
using Microsoft.ML.OnnxRuntime;
using OpenCvSharp;

namespace DotCore.YoloDetect;

/// <summary>One detection in source-image pixels.</summary>
public sealed record YoloDetection(int ClassId, string ClassName, float Confidence, Rect Box)
{
    public Point Center => new(Box.X + Box.Width / 2, Box.Y + Box.Height / 2);

    /// <summary>Bottom center of the box (an NPC's feet / the floor point to click).</summary>
    public Point BottomCenter => new(Box.X + Box.Width / 2, Box.Y + Box.Height);
}

/// <summary>Time spent in one detect call, summed over its passes (1 per ROI / full frame, 1 per tile).</summary>
public readonly record struct YoloDetectTiming(double PreMs, double InferMs, double PostMs, int Passes)
{
    public double TotalMs => PreMs + InferMs + PostMs;
}

public sealed record YoloDetectionResult(IReadOnlyList<YoloDetection> Detections, YoloDetectTiming Timing);

/// <summary>
/// Ultralytics YOLO detection model exported to ONNX (`yolo export format=onnx`): input [1,3,H,W] RGB 0..1 letterboxed,
/// output [1, 4 + classes, anchors] (cx, cy, w, h, class scores), its transpose, or the end-to-end [1, N, 6]
/// (x1, y1, x2, y2, score, class). Class names come from the model's "names" metadata.
/// Thread-safe for concurrent Detect calls (InferenceSession.Run is thread-safe; input buffers are pooled per call).
/// </summary>
public sealed class YoloOnnxDetector : IDisposable
{
    private const string LogTag = "[YoloOnnxDetector]";
    private const string NamesMetadataKey = "names";
    private const string ImgszMetadataKey = "imgsz";
    private const string End2EndMetadataKey = "end2end";
    private const int DefaultInputSize = 640;
    private const int End2EndColumns = 6;
    private const int BoxChannels = 4;
    private const double LetterboxPadValue = 114;
    private const float TruncatedContainment = 0.6f;
    private const string CpuProviderName = "CPU";
    private const string CudaProviderName = "CUDA";
    private const string DirectMlProviderName = "DirectML";
    private const string OrtCudaProvider = "CUDAExecutionProvider";
    private const string OrtDmlProvider = "DmlExecutionProvider";
    private static readonly Regex NameEntry = new(@"(\d+)\s*:\s*(?:'((?:[^'\\]|\\.)*)'|""((?:[^""\\]|\\.)*)"")", RegexOptions.Compiled);
    private static readonly Regex IntToken = new(@"\d+", RegexOptions.Compiled);
    private static readonly Regex PyEscape = new(@"\\(.)", RegexOptions.Compiled);

    private readonly InferenceSession _session;
    private readonly RunOptions _runOptions = new();
    private readonly string[] _inputNames;
    private readonly string[] _outputNames;
    private readonly bool _end2End;
    private readonly IReadOnlyDictionary<int, string> _names;
    private readonly ConcurrentBag<Workspace> _workspaces = new();
    private volatile bool _disposed;

    public string ModelPath { get; }

    /// <summary>Names ordered by class id; ids missing from the metadata are their number.</summary>
    public IReadOnlyList<string> ClassNames { get; }

    public int InputWidth { get; }

    public int InputHeight { get; }

    /// <summary>Execution provider actually in use (CPU, CUDA or DirectML).</summary>
    public string ExecutionProvider { get; }

    public YoloDetectorOptions Options { get; }

    public YoloOnnxDetector(string modelPath, YoloDetectorOptions? options = null)
    {
        ModelPath = modelPath;
        Options = options ?? YoloDetectorOptions.Default;
        (_session, ExecutionProvider) = CreateSession(modelPath, Options);
        var input = _session.InputMetadata.First();
        _inputNames = new[] { input.Key };
        _outputNames = new[] { _session.OutputMetadata.First().Key };
        var metadata = _session.ModelMetadata.CustomMetadataMap;
        var (metaH, metaW) = ReadImgsz(metadata);
        var dims = input.Value.Dimensions;
        InputHeight = dims.Length == 4 && dims[2] > 0 ? dims[2] : metaH;
        InputWidth = dims.Length == 4 && dims[3] > 0 ? dims[3] : metaW;
        _end2End = metadata.TryGetValue(End2EndMetadataKey, out var e2e) && bool.TryParse(e2e, out bool isE2e) && isE2e;
        _names = ReadClassNames(metadata);
        int count = _names.Count == 0 ? 0 : _names.Keys.Max() + 1;
        ClassNames = Enumerable.Range(0, count).Select(ClassName).ToList();
        if (Options.WarmUp)
        {
            using var blank = new Mat(InputHeight, InputWidth, MatType.CV_8UC3, Scalar.All(LetterboxPadValue));
            Detect(blank, 1f, 1f);
        }
        ColorPrinter.Blue($"{LogTag} Loaded {Path.GetFileName(modelPath)} input={InputWidth}x{InputHeight} ep={ExecutionProvider} end2end={_end2End} classes=[{string.Join(", ", ClassNames)}]");
    }

    public string ClassName(int classId) => _names.TryGetValue(classId, out var name) ? name : classId.ToString();

    /// <summary>Detect objects in a BGR (or BGRA / gray) image; boxes above the confidence threshold after class-wise NMS.</summary>
    public IReadOnlyList<YoloDetection> Detect(Mat image, float confidence = 0.35f, float iou = 0.45f) =>
        Detect(image, null, confidence, iou);

    /// <summary>Detect inside a region of interest (whole image when null); boxes are in full-image pixels.</summary>
    public IReadOnlyList<YoloDetection> Detect(Mat image, Rect? roi, float confidence = 0.35f, float iou = 0.45f) =>
        RunSingle(image, roi, true, confidence, iou, null);

    /// <summary>
    /// Sliding-window detection at native scale: tiles of tileWidth x tileHeight (0 = model input) with overlap pixels
    /// (&lt; 0 = a quarter of the smaller tile side) over the roi (whole image when null), each letterboxed without upscaling,
    /// merged by a global class-wise NMS that drops boxes cut by an inner tile edge when a whole copy exists.
    /// </summary>
    public IReadOnlyList<YoloDetection> DetectTiled(Mat image, int tileWidth = 0, int tileHeight = 0, int overlap = -1,
        Rect? roi = null, float confidence = 0.35f, float iou = 0.45f) =>
        RunTiled(image, tileWidth, tileHeight, overlap, roi, confidence, iou, null);

    /// <summary>Applies a model's inference contract (design §11): ROI, tiling for native scale, or a full-frame letterbox.</summary>
    public IReadOnlyList<YoloDetection> Detect(Mat image, YoloInferenceProfile profile) => RunProfile(image, profile, null);

    /// <summary>Detect(image, profile) plus the pre-processing / inference / post-processing time.</summary>
    public YoloDetectionResult DetectTimed(Mat image, YoloInferenceProfile profile)
    {
        var timer = new TimingAccumulator();
        var detections = RunProfile(image, profile, timer);
        return new YoloDetectionResult(detections, timer.ToTiming());
    }

    /// <summary>Copy of the image with labeled boxes (debug output).</summary>
    public static Mat Annotate(Mat image, IEnumerable<YoloDetection> detections)
    {
        var copy = image.Clone();
        foreach (var d in detections)
            DrawBox(copy, d.Box, $"{d.ClassName} {d.Confidence:0.00}", Scalar.LimeGreen);
        return copy;
    }

    /// <summary>Copy of the image with tracked boxes labeled "#id class confidence", one color per track id.</summary>
    public static Mat Annotate(Mat image, IEnumerable<YoloTrack> tracks)
    {
        var copy = image.Clone();
        foreach (var t in tracks)
            DrawBox(copy, t.Box, $"#{t.TrackId} {t.ClassName} {t.Confidence:0.00}", TrackColor(t.TrackId));
        return copy;
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _session.Dispose();
        _runOptions.Dispose();
        while (_workspaces.TryTake(out var ws)) ws.Dispose();
    }

    private sealed class TimingAccumulator
    {
        public double PreMs, InferMs, PostMs;
        public int Passes;
        public readonly Stopwatch Watch = new();

        public YoloDetectTiming ToTiming() => new(PreMs, InferMs, PostMs, Passes);
    }

    /// <summary>Per-call preprocessing buffers: the pinned input tensor (as OrtValue) and the Mats letterboxed into it.</summary>
    private sealed class Workspace : IDisposable
    {
        public readonly Mat Converted = new(), Resized = new(), Padded = new(), Scaled = new();
        public readonly Mat[] Planes;
        public readonly OrtValue Input;

        public Workspace(int height, int width)
        {
            var buffer = GC.AllocateArray<float>(3 * height * width, pinned: true);
            Input = OrtValue.CreateTensorValueFromMemory(buffer, new long[] { 1, 3, height, width });
            IntPtr basePtr = Marshal.UnsafeAddrOfPinnedArrayElement(buffer, 0);
            long planeBytes = (long)height * width * sizeof(float);
            Planes = Enumerable.Range(0, 3)
                .Select(p => Mat.FromPixelData(height, width, MatType.CV_32FC1, basePtr + (nint)(p * planeBytes)))
                .ToArray();
        }

        public void Dispose()
        {
            foreach (var m in Planes) m.Dispose();
            Converted.Dispose();
            Resized.Dispose();
            Padded.Dispose();
            Scaled.Dispose();
            Input.Dispose();
        }
    }

    private readonly record struct Candidate(YoloDetection Detection, bool Truncated);

    private IReadOnlyList<YoloDetection> RunProfile(Mat image, YoloInferenceProfile profile, TimingAccumulator? timer)
    {
        if (image == null || image.Empty()) return Array.Empty<YoloDetection>();
        var roi = profile.ResolveRoi(image.Width, image.Height);
        if (profile.ScaleMode == YoloScaleMode.Relative) return RunSingle(image, roi, true, profile.Confidence, profile.Iou, timer);
        int tw = profile.TileWidth > 0 ? profile.TileWidth : InputWidth;
        int th = profile.TileHeight > 0 ? profile.TileHeight : InputHeight;
        var region = roi ?? new Rect(0, 0, image.Width, image.Height);
        if (region.Width <= tw && region.Height <= th)
            return RunSingle(image, region, false, profile.Confidence, profile.Iou, timer);
        return RunTiled(image, tw, th, profile.TileOverlap, roi, profile.Confidence, profile.Iou, timer);
    }

    private IReadOnlyList<YoloDetection> RunSingle(Mat image, Rect? roi, bool allowUpscale, float confidence, float iou,
        TimingAccumulator? timer)
    {
        if (image == null || image.Empty()) return Array.Empty<YoloDetection>();
        if (ClipRegion(image, roi) is not { } region) return Array.Empty<YoloDetection>();
        var raw = DetectRegion(image, region, allowUpscale, confidence, timer);
        timer?.Watch.Restart();
        var result = MergeTiles(raw.Select(d => new Candidate(d, false)).ToList(), iou);
        if (timer != null) timer.PostMs += timer.Watch.Elapsed.TotalMilliseconds;
        return result;
    }

    private IReadOnlyList<YoloDetection> RunTiled(Mat image, int tileWidth, int tileHeight, int overlap, Rect? roi,
        float confidence, float iou, TimingAccumulator? timer)
    {
        if (image == null || image.Empty()) return Array.Empty<YoloDetection>();
        if (ClipRegion(image, roi) is not { } region) return Array.Empty<YoloDetection>();
        int tw = Math.Min(tileWidth > 0 ? tileWidth : InputWidth, region.Width);
        int th = Math.Min(tileHeight > 0 ? tileHeight : InputHeight, region.Height);
        int ov = overlap >= 0 ? overlap : Math.Min(tw, th) / 4;

        var candidates = new List<Candidate>();
        foreach (int ty in TileStarts(region.Y, region.Height, th, ov))
        {
            foreach (int tx in TileStarts(region.X, region.Width, tw, ov))
            {
                var tile = new Rect(tx, ty, tw, th);
                foreach (var d in DetectRegion(image, tile, false, confidence, timer))
                    candidates.Add(new Candidate(d, IsCutByInnerEdge(d.Box, tile, region)));
            }
        }
        timer?.Watch.Restart();
        var result = MergeTiles(candidates, iou);
        if (timer != null) timer.PostMs += timer.Watch.Elapsed.TotalMilliseconds;
        return result;
    }

    private static void DrawBox(Mat canvas, Rect box, string label, Scalar color)
    {
        Cv2.Rectangle(canvas, box, color, 2);
        Cv2.PutText(canvas, label, new Point(box.X, Math.Max(12, box.Y - 4)), HersheyFonts.HersheySimplex, 0.5, color, 1);
    }

    private static Scalar TrackColor(int trackId)
    {
        int h = (trackId * 47) % 180;
        using var hsv = new Mat(1, 1, MatType.CV_8UC3, new Scalar(h, 220, 255));
        using var bgr = new Mat();
        Cv2.CvtColor(hsv, bgr, ColorConversionCodes.HSV2BGR);
        var px = bgr.At<Vec3b>(0, 0);
        return new Scalar(px.Item0, px.Item1, px.Item2);
    }

    private static Rect? ClipRegion(Mat image, Rect? roi)
    {
        var full = new Rect(0, 0, image.Width, image.Height);
        var r = roi?.Intersect(full) ?? full;
        return r.Width > 0 && r.Height > 0 ? r : null;
    }

    private static IEnumerable<int> TileStarts(int origin, int length, int tile, int overlap)
    {
        if (length <= tile)
        {
            yield return origin;
            yield break;
        }
        int step = Math.Max(1, tile - overlap);
        int last = length - tile;
        for (int p = 0; p < last; p += step) yield return origin + p;
        yield return origin + last;
    }

    private static bool IsCutByInnerEdge(Rect box, Rect tile, Rect region) =>
        (box.X <= tile.X && tile.X > region.X)
        || (box.Y <= tile.Y && tile.Y > region.Y)
        || (box.Right >= tile.Right && tile.Right < region.Right)
        || (box.Bottom >= tile.Bottom && tile.Bottom < region.Bottom);

    /// <summary>Raw (pre-NMS) detections of one region, mapped to full-image pixels.</summary>
    private List<YoloDetection> DetectRegion(Mat image, Rect region, bool allowUpscale, float confidence, TimingAccumulator? timer)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
        if (!_workspaces.TryTake(out var ws)) ws = new Workspace(InputHeight, InputWidth);
        try
        {
            timer?.Watch.Restart();
            using var sub = new Mat(image, region);
            var (scale, padX, padY) = Preprocess(sub, allowUpscale, ws);
            if (timer != null) { timer.PreMs += timer.Watch.Elapsed.TotalMilliseconds; timer.Watch.Restart(); }

            using var outputs = _session.Run(_runOptions, _inputNames, new[] { ws.Input }, _outputNames);
            if (timer != null) { timer.InferMs += timer.Watch.Elapsed.TotalMilliseconds; timer.Watch.Restart(); timer.Passes++; }

            var output = outputs[0];
            var shape = output.GetTensorTypeAndShape().Shape;
            var found = Decode(output.GetTensorDataAsSpan<float>(), (int)shape[1], (int)shape[2], confidence, scale, padX, padY, region);
            if (timer != null) timer.PostMs += timer.Watch.Elapsed.TotalMilliseconds;
            return found;
        }
        finally
        {
            if (_disposed) ws.Dispose();
            else _workspaces.Add(ws);
        }
    }

    private List<YoloDetection> Decode(ReadOnlySpan<float> data, int d1, int d2, float confidence, float scale, float padX, float padY,
        Rect region)
    {
        var found = new List<YoloDetection>();
        if (_end2End && d2 == End2EndColumns)
        {
            for (int r = 0; r < d1; r++)
            {
                int o = r * d2;
                if (data[o + 4] >= confidence)
                    AddBox(found, data[o], data[o + 1], data[o + 2], data[o + 3], data[o + 4], (int)data[o + 5], scale, padX, padY, region);
            }
            return found;
        }

        bool transposed = d1 > d2;
        int channels = transposed ? d2 : d1, anchors = transposed ? d1 : d2;
        int channelStride = transposed ? 1 : anchors, anchorStride = transposed ? channels : 1;
        for (int a = 0; a < anchors; a++)
        {
            int baseIndex = a * anchorStride;
            int bestClass = -1;
            float best = 0f;
            for (int c = BoxChannels; c < channels; c++)
            {
                float s = data[baseIndex + c * channelStride];
                if (s > best) { best = s; bestClass = c - BoxChannels; }
            }
            if (best < confidence) continue;
            float cx = data[baseIndex], cy = data[baseIndex + channelStride];
            float w = data[baseIndex + 2 * channelStride], h = data[baseIndex + 3 * channelStride];
            AddBox(found, cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2, best, bestClass, scale, padX, padY, region);
        }
        return found;
    }

    private void AddBox(List<YoloDetection> found, float x1, float y1, float x2, float y2, float score, int cls,
        float scale, float padX, float padY, Rect region)
    {
        x1 = (x1 - padX) / scale; x2 = (x2 - padX) / scale;
        y1 = (y1 - padY) / scale; y2 = (y2 - padY) / scale;
        var rect = new Rect((int)Math.Round(x1) + region.X, (int)Math.Round(y1) + region.Y,
            (int)Math.Round(x2 - x1), (int)Math.Round(y2 - y1)).Intersect(region);
        if (rect.Width <= 0 || rect.Height <= 0) return;
        found.Add(new YoloDetection(cls, ClassName(cls), score, rect));
    }

    /// <summary>Letterboxes into the workspace's pinned input tensor (RGB planes, 0..1, pad 114).</summary>
    private (float Scale, float PadX, float PadY) Preprocess(Mat image, bool allowUpscale, Workspace ws)
    {
        float scale = Math.Min((float)InputWidth / image.Width, (float)InputHeight / image.Height);
        if (!allowUpscale) scale = Math.Min(scale, 1f);
        int w = Math.Max(1, (int)Math.Round(image.Width * scale)), h = Math.Max(1, (int)Math.Round(image.Height * scale));
        int left = (InputWidth - w) / 2, top = (InputHeight - h) / 2;

        Mat bgr = image;
        if (image.Channels() == 4) { Cv2.CvtColor(image, ws.Converted, ColorConversionCodes.BGRA2BGR); bgr = ws.Converted; }
        else if (image.Channels() == 1) { Cv2.CvtColor(image, ws.Converted, ColorConversionCodes.GRAY2BGR); bgr = ws.Converted; }
        Mat sized = bgr;
        if (w != bgr.Width || h != bgr.Height)
        {
            Cv2.Resize(bgr, ws.Resized, new Size(w, h), 0, 0, InterpolationFlags.Linear);
            sized = ws.Resized;
        }
        Cv2.CopyMakeBorder(sized, ws.Padded, top, InputHeight - h - top, left, InputWidth - w - left, BorderTypes.Constant,
            Scalar.All(LetterboxPadValue));
        ws.Padded.ConvertTo(ws.Scaled, MatType.CV_32FC3, 1.0 / 255.0);
        Cv2.ExtractChannel(ws.Scaled, ws.Planes[0], 2);
        Cv2.ExtractChannel(ws.Scaled, ws.Planes[1], 1);
        Cv2.ExtractChannel(ws.Scaled, ws.Planes[2], 0);
        return (scale, left, top);
    }

    /// <summary>Greedy class-wise NMS; whole boxes win over boxes cut by a tile edge, which also drop when mostly inside a kept box.</summary>
    private static IReadOnlyList<YoloDetection> MergeTiles(List<Candidate> candidates, float iou)
    {
        var kept = new List<Candidate>();
        foreach (var c in candidates.OrderBy(c => c.Truncated).ThenByDescending(c => c.Detection.Confidence))
        {
            bool suppressed = false;
            foreach (var k in kept)
            {
                if (k.Detection.ClassId != c.Detection.ClassId) continue;
                var a = k.Detection.Box;
                var b = c.Detection.Box;
                var inter = a.Intersect(b);
                if (inter.Width <= 0 || inter.Height <= 0) continue;
                double interArea = (double)inter.Width * inter.Height;
                double union = (double)a.Width * a.Height + (double)b.Width * b.Height - interArea;
                double smaller = Math.Min((double)a.Width * a.Height, (double)b.Width * b.Height);
                if (interArea / union > iou || ((c.Truncated || k.Truncated) && interArea / smaller > TruncatedContainment))
                {
                    suppressed = true;
                    break;
                }
            }
            if (!suppressed) kept.Add(c);
        }
        return kept.Select(k => k.Detection).OrderByDescending(d => d.Confidence).ToList();
    }

    private static (InferenceSession Session, string Provider) CreateSession(string modelPath, YoloDetectorOptions options)
    {
        var available = OrtEnv.Instance().GetAvailableProviders();
        var wanted = options.Provider switch
        {
            YoloExecutionProvider.Auto => new[] { YoloExecutionProvider.Cuda, YoloExecutionProvider.DirectML },
            YoloExecutionProvider.Cpu => Array.Empty<YoloExecutionProvider>(),
            _ => new[] { options.Provider },
        };
        foreach (var provider in wanted)
        {
            string ortName = provider == YoloExecutionProvider.Cuda ? OrtCudaProvider : OrtDmlProvider;
            if (!available.Contains(ortName)) continue;
            try
            {
                using var so = NewSessionOptions(options);
                if (provider == YoloExecutionProvider.Cuda) so.AppendExecutionProvider_CUDA(options.DeviceId);
                else so.AppendExecutionProvider_DML(options.DeviceId);
                return (new InferenceSession(modelPath, so), provider == YoloExecutionProvider.Cuda ? CudaProviderName : DirectMlProviderName);
            }
            catch (Exception ex)
            {
                ColorPrinter.Yellow($"{LogTag} {ortName} unavailable, falling back: {ex.Message}");
            }
        }
        using var cpu = NewSessionOptions(options);
        return (new InferenceSession(modelPath, cpu), CpuProviderName);
    }

    private static SessionOptions NewSessionOptions(YoloDetectorOptions options)
    {
        var so = new SessionOptions { GraphOptimizationLevel = GraphOptimizationLevel.ORT_ENABLE_ALL };
        if (options.IntraOpThreads > 0) so.IntraOpNumThreads = options.IntraOpThreads;
        return so;
    }

    /// <summary>Ultralytics writes imgsz as "[h, w]" (or one number); missing = the default square.</summary>
    private static (int H, int W) ReadImgsz(IReadOnlyDictionary<string, string> metadata)
    {
        if (!metadata.TryGetValue(ImgszMetadataKey, out var raw)) return (DefaultInputSize, DefaultInputSize);
        var numbers = IntToken.Matches(raw).Select(m => int.Parse(m.Value)).Where(v => v > 0).ToList();
        return numbers.Count switch
        {
            0 => (DefaultInputSize, DefaultInputSize),
            1 => (numbers[0], numbers[0]),
            _ => (numbers[0], numbers[1]),
        };
    }

    /// <summary>Ultralytics writes names as a Python dict repr: {0: 'blacksmith', 1: "kanai's cube"}.</summary>
    private static IReadOnlyDictionary<int, string> ReadClassNames(IReadOnlyDictionary<string, string> metadata)
    {
        var names = new Dictionary<int, string>();
        if (!metadata.TryGetValue(NamesMetadataKey, out var raw) || string.IsNullOrWhiteSpace(raw)) return names;
        foreach (Match m in NameEntry.Matches(raw))
        {
            string quoted = m.Groups[2].Success ? m.Groups[2].Value : m.Groups[3].Value;
            names[int.Parse(m.Groups[1].Value)] = PyEscape.Replace(quoted, "$1");
        }
        return names;
    }
}
