// PY-REF: none (DOT-only)
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using DotCore.YoloTrain;
using OpenCvSharp;

namespace DotCore.YoloTaskSet;

/// <summary>Preview (cached context, S16), per-target augmentation grid (U5), dataset estimate (T10) and manifest inference info.</summary>
public static partial class TaskSetSynthesizer
{
    private const int GridMaxCount = 100;
    private const int GridPadding = 4;
    private const int GridMinCell = 96;
    private const int GridMaxZoom = 8;
    private const int GridCheckerSide = 4;
    private static readonly Scalar GridCheckerLight = Scalar.All(200);
    private static readonly Scalar GridCheckerDark = Scalar.All(150);

    private static readonly SemaphoreSlim PreviewGate = new(1, 1);
    private static Context? _previewContext;
    private static string? _previewKey;

    /// <summary>One training sample rendered in memory (clean PNG); boxes are in image pixels.</summary>
    public static PreviewResult RenderPreview(TaskSet set, string taskSetDir, int seed) => RenderPreview(set, taskSetDir, seed, null, null, CancellationToken.None);

    /// <summary>
    /// Like RenderPreview(set, dir, seed) for one target (null = random). The validated context (decoded variants, extracted video frames)
    /// is cached until the task set or a resource file changes; progress reports video frame extraction.
    /// </summary>
    public static PreviewResult RenderPreview(TaskSet set, string taskSetDir, int seed, string? targetId, IProgress<SynthesisProgress>? progress, CancellationToken ct)
    {
        var key = PreviewKey(set, taskSetDir);
        PreviewGate.Wait(ct);
        try
        {
            if (_previewContext == null || _previewKey != key)
            {
                _previewContext?.Dispose();
                _previewContext = null;
                _previewKey = null;
                var inspection = Inspect(set, taskSetDir);
                ThrowOnErrors(inspection);
                _previewContext = BuildContext(set, taskSetDir, inspection, new List<TaskSetIssue>(), progress, ct);
                _previewKey = key;
            }
            var ctx = _previewContext;
            var pick = new Random(seed);
            int targetIndex = targetId == null ? pick.Next(ctx.Classes.Count) : set.Targets.FindIndex(t => t.Id == targetId);
            if (targetIndex < 0) throw new ArgumentException("Unknown target id: " + targetId, nameof(targetId));
            var job = new Job(0, YoloSplit.Train, targetIndex, "", pick.Next());
            using var rendered = Render(ctx, job);
            var boxes = rendered.Boxes.Select(b => new PreviewBox(b.Label, b.XMin, b.YMin, b.XMax, b.YMax)).ToList();
            return new PreviewResult(TaskSetImageIo.EncodePng(rendered.Image), boxes);
        }
        finally
        {
            PreviewGate.Release();
        }
    }

    private static string PreviewKey(TaskSet set, string taskSetDir)
    {
        var text = new StringBuilder(JsonSerializer.Serialize(set, TaskSetStore.JsonOptions)).Append('|').Append(Path.GetFullPath(taskSetDir));
        var resources = set.Targets.SelectMany(t => t.Variants.Concat(t.Scenes)).Concat(set.CommonResources).Concat(set.Distractors);
        foreach (var r in resources)
        {
            var info = new FileInfo(TaskSetStore.ResolveResourcePath(taskSetDir, r));
            text.Append('|').Append(info.Exists ? info.LastWriteTimeUtc.Ticks : 0).Append(':').Append(info.Exists ? info.Length : 0);
        }
        foreach (var source in set.SegmentSources)
        {
            var frames = new DirectoryInfo(TaskSetStore.SegmentFramesDir(TaskSetStore.ResolveSegmentDir(source)));
            var files = frames.Exists ? frames.EnumerateFiles().ToList() : new List<FileInfo>();
            text.Append('|').Append(files.Count).Append(':').Append(files.Count == 0 ? 0 : files.Max(f => f.LastWriteTimeUtc.Ticks));
        }
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text.ToString())));
    }

    /// <summary>PNG grid of count augmented variants of one target on a checkerboard (small icons enlarged with Nearest).</summary>
    public static byte[] RenderAugmentationGrid(TaskSet set, string taskSetDir, string targetId, int count, int seed)
    {
        int targetIndex = set.Targets.FindIndex(t => t.Id == targetId);
        if (targetIndex < 0) throw new ArgumentException("Unknown target id: " + targetId, nameof(targetId));
        var target = set.Targets[targetIndex];
        var s = set.Synthesis.Normalized();
        var profile = set.Augmentation.Resolve(target.Augmentation);
        var variants = target.Variants.Select(r => (Resource: r, Image: TaskSetImageIo.ReadBgra(TaskSetStore.ResolveResourcePath(taskSetDir, r))))
            .Where(v => v.Image != null).ToList();
        var items = new List<(Mat Bgra, Mat Mask)>();
        try
        {
            if (variants.Count == 0) throw new InvalidOperationException("No readable variant for target " + target.Name);
            var rng = new Random(seed);
            var reference = new Size(s.NativeWindowWidth, s.NativeWindowHeight);
            for (int i = 0; i < Math.Clamp(count, 1, GridMaxCount); i++)
            {
                var (resource, image) = variants[rng.Next(variants.Count)];
                var (scale, fixedScale) = ObjectScale(image!, resource, 1.0, reference, s, rng);
                items.Add(VariantAugmenter.Apply(image!, profile, scale, rng, fixedScale));
            }
            int cell = items.Max(x => Math.Max(x.Bgra.Width, x.Bgra.Height)) + 2 * GridPadding;
            int cols = (int)Math.Ceiling(Math.Sqrt(items.Count));
            int rows = (items.Count + cols - 1) / cols;
            using var canvas = new Mat(rows * cell, cols * cell, MatType.CV_8UC3, GridCheckerLight);
            for (int y = 0; y < canvas.Height; y += GridCheckerSide)
                for (int x = (y / GridCheckerSide) % 2 * GridCheckerSide; x < canvas.Width; x += 2 * GridCheckerSide)
                    Cv2.Rectangle(canvas, new Rect(x, y, GridCheckerSide, GridCheckerSide), GridCheckerDark, -1);
            for (int i = 0; i < items.Count; i++)
            {
                var (obj, mask) = items[i];
                int ox = (i % cols) * cell + (cell - obj.Width) / 2, oy = (i / cols) * cell + (cell - obj.Height) / 2;
                Composite(canvas, obj, mask, new Rect(ox, oy, obj.Width, obj.Height), new Rect(0, 0, obj.Width, obj.Height));
            }
            int zoom = Math.Clamp(GridMinCell / cell, 1, GridMaxZoom);
            if (zoom == 1) return TaskSetImageIo.EncodePng(canvas);
            using var large = new Mat();
            Cv2.Resize(canvas, large, new Size(canvas.Width * zoom, canvas.Height * zoom), 0, 0, InterpolationFlags.Nearest);
            return TaskSetImageIo.EncodePng(large);
        }
        finally
        {
            foreach (var (bgra, mask) in items)
            {
                bgra.Dispose();
                mask.Dispose();
            }
            foreach (var v in variants) v.Image?.Dispose();
        }
    }

    /// <summary>
    /// Planned image counts without rendering. With taskSetDir: val availability per target, holdout images, background and variant sizes
    /// from file headers; without: upper bounds from the settings. ValImages excludes holdout images.
    /// </summary>
    public static TaskSetEstimate Estimate(TaskSet set, string? taskSetDir = null)
    {
        var s = set.Synthesis.Normalized();
        var classes = set.Targets.Select(t => t.Name.Trim()).ToList();
        Func<int, bool> hasVal = _ => true;
        int holdout = 0, bgWidth = 0, bgHeight = 0, maxObject = 0;
        (int Train, int Val) real = (0, 0);
        if (taskSetDir != null)
        {
            var inspection = Inspect(set, taskSetDir);
            int commonVal = ValGroups(inspection.CommonImages.Select(b => b.Group).Concat(inspection.CommonVideos.Select(v => v.Id))
                .Concat(inspection.SegmentBackgrounds.Select(b => b.Group)).ToList(), s).Count;
            var targetVal = inspection.Scenes.Select(sc => ValGroups(sc.Select(b => b.Group).ToList(), s).Count + commonVal > 0).ToArray();
            hasVal = t => t < 0 ? targetVal.Any(v => v) : targetVal[t];
            holdout = inspection.Holdout.Count;
            real = RealSplitCounts(inspection.RealFrames, s);
            var images = inspection.Scenes.SelectMany(x => x).Concat(inspection.CommonImages).Concat(inspection.SegmentBackgrounds).ToList();
            bgWidth = images.Select(b => b.Width).DefaultIfEmpty(0).Max();
            bgHeight = images.Select(b => b.Height).DefaultIfEmpty(0).Max();
            double bgScale = images.Select(b => b.Resource.EffectivePixelScale).DefaultIfEmpty(1).Max();
            for (int t = 0; t < inspection.Variants.Count; t++)
            {
                var p = set.Augmentation.Resolve(set.Targets[t].Augmentation);
                double factor = s.UsesDpiSteps ? s.DpiSteps.Max() * (1 + s.ScaleJitter) : p.ScaleMax;
                foreach (var v in inspection.Variants[t])
                    if (TaskSetImageIo.ReadSize(v.Path) is { } size)
                        maxObject = Math.Max(maxObject, s.IsNative
                            ? (int)Math.Ceiling(Math.Max(size.Width, size.Height) * factor * bgScale / v.Resource.EffectivePixelScale)
                            : s.SizesFromSource && v.Resource.HasSourceSize
                                ? (int)Math.Ceiling(Math.Max(size.Width, size.Height) * p.ScaleMax * Math.Min(bgWidth, bgHeight)
                                    / Math.Max(1, Math.Min(v.Resource.SourceWidth, v.Resource.SourceHeight)))
                                : (int)Math.Ceiling(Math.Min(s.OutputMaxSide, Math.Min(bgWidth, bgHeight)) * s.RelativeMax * p.ScaleMax));
            }
        }
        var (jobs, _) = PlanJobs(set, s, hasVal);
        int width, height;
        if (s.IsNative)
        {
            width = bgWidth > 0 ? Math.Min(s.NativeWindowWidth, bgWidth) : s.NativeWindowWidth;
            height = bgHeight > 0 ? Math.Min(s.NativeWindowHeight, bgHeight) : s.NativeWindowHeight;
        }
        else if (bgWidth > 0 && bgHeight > 0)
        {
            double f = Math.Min(1, s.OutputMaxSide / (double)Math.Max(bgWidth, bgHeight));
            width = (int)Math.Round(bgWidth * f);
            height = (int)Math.Round(bgHeight * f);
        }
        else
        {
            width = height = s.OutputMaxSide;
        }
        return new TaskSetEstimate(classes, jobs.Count(j => j.Split == YoloSplit.Train) + real.Train, jobs.Count(j => j.Split == YoloSplit.Val) + real.Val,
            jobs.Count(j => j.IsNegative), holdout, width, height, Math.Max(width, height), maxObject, s.ScaleMode, real.Train, real.Val);
    }

    /// <summary>The "inference" block of a dataset's synthesis_manifest.json, or null (no manifest, general-mode dataset, older format).</summary>
    public static SynthesisInferenceInfo? ReadInferenceInfo(string datasetDir)
    {
        var path = Path.Combine(datasetDir, ManifestFileName);
        try
        {
            if (!File.Exists(path)) return null;
            using var doc = JsonDocument.Parse(File.ReadAllText(path));
            return doc.RootElement.TryGetProperty("inference", out var el) ? el.Deserialize<SynthesisInferenceInfo>(TaskSetStore.JsonOptions) : null;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException)
        {
            return null;
        }
    }
}
