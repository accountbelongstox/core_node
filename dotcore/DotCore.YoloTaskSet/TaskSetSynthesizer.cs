// PY-REF: none (DOT-only)
using System.Globalization;
using System.Text.Json;
using DotCore.Foundations;
using DotCore.VocAnnotator;
using DotCore.YoloTrain;
using OpenCvSharp;

namespace DotCore.YoloTaskSet;

/// <summary>Validates a task set and synthesizes an auto-labeled Ultralytics dataset (YOLO_TASKSET_SYNTHESIS_DESIGN.md §4).</summary>
public static class TaskSetSynthesizer
{
    public const string ManifestFileName = "synthesis_manifest.json";
    public const string PreviewsSubdir = "previews";

    private const int MaxPlacementAttempts = 50;
    private const int MinBoxSide = 4;
    // Feathered / antialiased fringe below ~25 % opacity is not part of the labeled extent.
    private const double LabelMaskThreshold = 63;
    private const int PreviewCount = 6;
    private const int FewBackgroundsThreshold = 5;
    private const double OversizeFit = 0.95;
    private const string OutputImageExtension = ".jpg";
    private const string PreviewExtension = ".jpg";
    private const string NegativeStemPrefix = "neg_";
    private const string TargetStemPrefix = "t";
    private const string StemNumberFormat = "D5";
    private const string TargetNumberFormat = "D2";
    private const int PercentTotal = 100;
    private const int PreviewLineThickness = 2;
    private const double PreviewFontScale = 0.6;
    private static readonly Scalar PreviewBoxColor = new(0, 255, 0);

    private sealed record Background(string Path, string Key);

    private sealed record Job(int Index, YoloSplit Split, int TargetIndex, string Stem, int Seed)
    {
        public bool IsNegative => TargetIndex < 0;
    }

    private sealed record JobOutcome(YoloSplit Split, string BackgroundKey, int[] ClassCounts)
    {
        public bool IsEmpty => ClassCounts.All(c => c == 0);
    }

    private sealed record PoolSplit(List<Background> Train, List<Background> Val)
    {
        public List<Background> For(YoloSplit split) => split == YoloSplit.Val ? Val : Train;
    }

    /// <summary>Readable resources found by validation plus the issues.</summary>
    private sealed class Inspection
    {
        public List<TaskSetIssue> Issues { get; } = new();
        public List<List<string>> Variants { get; } = new();
        public List<List<Background>> Scenes { get; } = new();
        public List<Background> CommonImages { get; } = new();
        public List<TaskResource> CommonVideos { get; } = new();

        public bool HasErrors => Issues.Any(i => i.IsError);
    }

    /// <summary>Decoded variants (lazy, shared read-only), resolved augmentation and split background pools of one run.</summary>
    private sealed class Context : IDisposable
    {
        public required TaskSet Set { get; init; }
        public required SynthesisSettings Settings { get; init; }
        public required IReadOnlyList<string> Classes { get; init; }
        public required AugmentationProfile[] Profiles { get; init; }
        public required Lazy<Mat?>[][] Variants { get; init; }
        public required PoolSplit[] Scenes { get; init; }
        public required PoolSplit Common { get; init; }

        public List<Background> TargetPool(int targetIndex, YoloSplit split) =>
            Scenes[targetIndex].For(split).Concat(Common.For(split)).ToList();

        public List<Background> NegativePool(YoloSplit split) =>
            Common.For(split).Count > 0 ? Common.For(split) : Scenes.SelectMany(p => p.For(split)).ToList();

        public void Dispose()
        {
            foreach (var v in Variants.SelectMany(x => x))
                if (v.IsValueCreated) v.Value?.Dispose();
        }
    }

    private sealed record Rendered(Mat Image, List<AnnotationBox> Boxes, Background Background) : IDisposable
    {
        public void Dispose() => Image.Dispose();
    }

    public static IReadOnlyList<TaskSetIssue> Validate(TaskSet set, string taskSetDir) => Inspect(set, taskSetDir).Issues;

    public static SynthesisResult Generate(TaskSet set, string taskSetDir, string outputDir, IProgress<SynthesisProgress>? progress, CancellationToken ct)
    {
        var inspection = Inspect(set, taskSetDir);
        ThrowOnErrors(inspection);
        if (Directory.Exists(outputDir) && Directory.EnumerateFileSystemEntries(outputDir).Any())
            throw new IOException("Dataset dir is not empty: " + outputDir);

        var warnings = inspection.Issues.ToList();
        using var ctx = BuildContext(set, taskSetDir, inspection, warnings, ct);
        var s = ctx.Settings;
        var jobs = PlanJobs(ctx);
        var previewJobs = jobs.Where(j => j.Split == YoloSplit.Train && !j.IsNegative).Take(PreviewCount).Select(j => j.Index).ToHashSet();

        foreach (var split in new[] { YoloSplit.Train, YoloSplit.Val })
        {
            Directory.CreateDirectory(Path.Combine(outputDir, YoloDataYaml.SplitImagesDir(split)));
            Directory.CreateDirectory(Path.Combine(outputDir, YoloDataYaml.SplitLabelsDir(split)));
        }
        var previewDir = Path.Combine(outputDir, PreviewsSubdir);
        Directory.CreateDirectory(previewDir);
        ColorPrinter.Blue($"[YoloTaskSet] generating {jobs.Count} images for task set {set.Name} ({set.Id}) into {outputDir}");

        var outcomes = new JobOutcome[jobs.Count];
        int done = 0;
        var options = new ParallelOptions { CancellationToken = ct, MaxDegreeOfParallelism = Math.Max(1, Environment.ProcessorCount - 1) };
        Parallel.ForEach(jobs, options, job =>
        {
            ct.ThrowIfCancellationRequested();
            using var rendered = Render(ctx, job);
            var imagePath = Path.Combine(outputDir, YoloDataYaml.SplitImagesDir(job.Split), job.Stem + OutputImageExtension);
            File.WriteAllBytes(imagePath, TaskSetImageIo.EncodeJpeg(rendered.Image, s.JpegQuality));
            var annotation = new ImageAnnotation(imagePath, rendered.Image.Width, rendered.Image.Height, rendered.Boxes);
            var lines = AnnotationIo.FormatYoloLines(annotation, ctx.Classes, skipDifficult: false);
            File.WriteAllText(Path.Combine(outputDir, YoloDataYaml.SplitLabelsDir(job.Split), job.Stem + AnnotationIo.YoloTxtExtension),
                lines.Count == 0 ? "" : string.Join("\n", lines) + "\n");
            if (previewJobs.Contains(job.Index))
            {
                DrawBoxes(rendered.Image, rendered.Boxes, ctx.Classes);
                File.WriteAllBytes(Path.Combine(previewDir, job.Stem + PreviewExtension), TaskSetImageIo.EncodeJpeg(rendered.Image, s.JpegQuality));
            }
            var counts = new int[ctx.Classes.Count];
            foreach (var b in rendered.Boxes) counts[IndexOf(ctx.Classes, b.Label)]++;
            outcomes[job.Index] = new JobOutcome(job.Split, rendered.Background.Key, counts);
            progress?.Report(new SynthesisProgress(Interlocked.Increment(ref done), jobs.Count));
        });

        var yaml = YoloDataYaml.Write(outputDir, ctx.Classes, includeTest: false);
        var instances = ctx.Classes.Select((c, i) => (c, n: outcomes.Sum(o => o.ClassCounts[i]))).ToDictionary(x => x.c, x => x.n, StringComparer.Ordinal);
        int train = outcomes.Count(o => o.Split == YoloSplit.Train);
        int val = outcomes.Count(o => o.Split == YoloSplit.Val);
        int negatives = outcomes.Count(o => o.IsEmpty);
        int failedPositives = jobs.Count(j => !j.IsNegative && outcomes[j.Index].IsEmpty);
        if (failedPositives > 0) ColorPrinter.Yellow($"[YoloTaskSet] {failedPositives} images got no placeable object and are written as negatives");
        WriteManifest(ctx, outputDir, jobs, outcomes, warnings);
        ColorPrinter.Green($"[YoloTaskSet] dataset ready: train {train}, val {val}, negatives {negatives}, instances {instances.Values.Sum()} ({outputDir})");
        return new SynthesisResult(outputDir, yaml, ctx.Classes, train, val, negatives, instances, warnings);
    }

    /// <summary>One training sample rendered in memory (clean PNG); boxes are in image pixels.</summary>
    public static PreviewResult RenderPreview(TaskSet set, string taskSetDir, int seed)
    {
        var inspection = Inspect(set, taskSetDir);
        ThrowOnErrors(inspection);
        using var ctx = BuildContext(set, taskSetDir, inspection, new List<TaskSetIssue>(), CancellationToken.None);
        var pick = new Random(seed);
        var job = new Job(0, YoloSplit.Train, pick.Next(ctx.Classes.Count), "", pick.Next());
        using var rendered = Render(ctx, job);
        var boxes = rendered.Boxes.Select(b => new PreviewBox(b.Label, b.XMin, b.YMin, b.XMax, b.YMax)).ToList();
        return new PreviewResult(TaskSetImageIo.EncodePng(rendered.Image), boxes);
    }

    private static void ThrowOnErrors(Inspection inspection)
    {
        if (!inspection.HasErrors) return;
        var errors = inspection.Issues.Where(i => i.IsError).Select(i => $"{i.Code}({i.Subject})");
        throw new InvalidOperationException("Task set validation failed: " + string.Join(", ", errors));
    }

    private static Inspection Inspect(TaskSet set, string taskSetDir)
    {
        var result = new Inspection();
        var s = set.Synthesis.Normalized();
        void Add(TaskSetIssueCode code, string subject, bool error) => result.Issues.Add(new TaskSetIssue(code, subject, error));

        if (set.Targets.Count == 0) Add(TaskSetIssueCode.NoTargets, set.Name, true);
        foreach (var dup in set.Targets.Select(t => t.Name.Trim()).Where(n => n.Length > 0)
                     .GroupBy(n => n, StringComparer.Ordinal).Where(g => g.Count() > 1))
            Add(TaskSetIssueCode.DuplicateTargetName, dup.Key, true);

        int videoFrames = 0;
        foreach (var r in set.CommonResources)
        {
            var path = TaskSetStore.ResolveResourcePath(taskSetDir, r);
            if (r.Kind == TaskResourceKind.Video)
            {
                int frames = File.Exists(path) ? VideoFrameExtractor.EstimateFrames(path, s.VideoFrameInterval, s.VideoMaxFrames) : 0;
                videoFrames += frames;
                if (frames > 0) result.CommonVideos.Add(r);
                else Add(TaskSetIssueCode.UnreadableResource, r.File, false);
            }
            else if (IsReadableBackground(path)) result.CommonImages.Add(new Background(path, r.File));
            else Add(TaskSetIssueCode.UnreadableResource, r.File, false);
        }
        int commonCount = result.CommonImages.Count + videoFrames;
        if (set.CommonResources.Count == 0) Add(TaskSetIssueCode.NoCommonResources, set.Name, false);
        if (commonCount == 1) Add(TaskSetIssueCode.SingleBackgroundShared, set.Name, false);

        foreach (var t in set.Targets)
        {
            var subject = t.Name.Trim().Length > 0 ? t.Name : t.Id;
            if (t.Name.Trim().Length == 0) Add(TaskSetIssueCode.EmptyTargetName, t.Id, true);
            var variants = new List<string>();
            foreach (var r in t.Variants)
            {
                var path = TaskSetStore.ResolveResourcePath(taskSetDir, r);
                using var mat = TaskSetImageIo.ReadBgra(path);
                if (mat != null) variants.Add(path);
                else Add(TaskSetIssueCode.UnreadableResource, r.File, false);
            }
            if (variants.Count == 0) Add(TaskSetIssueCode.NoVariants, subject, true);
            var scenes = new List<Background>();
            foreach (var r in t.Scenes)
            {
                var path = TaskSetStore.ResolveResourcePath(taskSetDir, r);
                if (IsReadableBackground(path)) scenes.Add(new Background(path, r.File));
                else Add(TaskSetIssueCode.UnreadableResource, r.File, false);
            }
            int backgrounds = scenes.Count + commonCount;
            if (backgrounds == 0) Add(TaskSetIssueCode.NoBackgrounds, subject, true);
            else if (backgrounds < FewBackgroundsThreshold) Add(TaskSetIssueCode.FewBackgrounds, subject, false);
            if (scenes.Count == 1) Add(TaskSetIssueCode.SingleBackgroundShared, subject, false);
            result.Variants.Add(variants);
            result.Scenes.Add(scenes);
        }
        return result;
    }

    private static bool IsReadableBackground(string path)
    {
        if (!File.Exists(path)) return false;
        if (ImageHeaderReader.ReadSize(path) != null) return true;
        using var mat = TaskSetImageIo.ReadBgr(path, 0);
        return mat != null;
    }

    private static Context BuildContext(TaskSet set, string taskSetDir, Inspection inspection, List<TaskSetIssue> warnings, CancellationToken ct)
    {
        var s = set.Synthesis.Normalized();
        var common = inspection.CommonImages.ToList();
        foreach (var video in inspection.CommonVideos)
        {
            var frames = VideoFrameExtractor.ExtractToCache(TaskSetStore.ResolveResourcePath(taskSetDir, video),
                TaskSetStore.FrameCacheDir(taskSetDir, video.Id), s.VideoFrameInterval, s.VideoMaxFrames, ct);
            if (frames.Count == 0) warnings.Add(new TaskSetIssue(TaskSetIssueCode.UnreadableResource, video.File, false));
            common.AddRange(frames.Select(f => new Background(f, video.File + "#" + Path.GetFileName(f))));
        }
        var rng = new Random(s.Seed);
        var scenes = inspection.Scenes.Select(p => SplitPool(p, s.ValPercent, rng)).ToArray();
        var commonSplit = SplitPool(common, s.ValPercent, rng);
        for (int i = 0; i < scenes.Length; i++)
            if (scenes[i].Train.Count + commonSplit.Train.Count == 0)
                throw new InvalidOperationException("No readable background for target " + set.Targets[i].Name);

        return new Context
        {
            Set = set,
            Settings = s,
            Classes = set.Targets.Select(t => t.Name.Trim()).ToList(),
            Profiles = set.Targets.Select(t => set.Augmentation.Resolve(t.Augmentation)).ToArray(),
            Variants = inspection.Variants.Select(paths => paths.Select(p => new Lazy<Mat?>(() => TaskSetImageIo.ReadBgra(p))).ToArray()).ToArray(),
            Scenes = scenes,
            Common = commonSplit,
        };
    }

    /// <summary>Seeded disjoint split; a single-item pool serves both splits.</summary>
    private static PoolSplit SplitPool(IReadOnlyList<Background> pool, int valPercent, Random rng)
    {
        var shuffled = pool.OrderBy(b => b.Key, StringComparer.Ordinal).ToList();
        for (int i = shuffled.Count - 1; i > 0; i--)
        {
            int j = rng.Next(i + 1);
            (shuffled[i], shuffled[j]) = (shuffled[j], shuffled[i]);
        }
        if (shuffled.Count <= 1) return new PoolSplit(shuffled, shuffled.ToList());
        int nVal = ValCount(shuffled.Count, valPercent);
        return new PoolSplit(shuffled.Skip(nVal).ToList(), shuffled.Take(nVal).ToList());
    }

    private static int ValCount(int n, int valPercent) =>
        n < 2 ? 0 : Math.Clamp((int)Math.Round(n * valPercent / (double)PercentTotal, MidpointRounding.AwayFromZero), 1, n - 1);

    private static List<Job> PlanJobs(Context ctx)
    {
        var s = ctx.Settings;
        var rng = new Random(s.Seed);
        var jobs = new List<Job>();
        void AddJobs(int targetIndex, int count, string prefix)
        {
            int nVal = ValCount(count, s.ValPercent);
            for (int i = 0; i < count; i++)
            {
                var stem = prefix + (i + 1).ToString(StemNumberFormat, CultureInfo.InvariantCulture);
                jobs.Add(new Job(jobs.Count, i < count - nVal ? YoloSplit.Train : YoloSplit.Val, targetIndex, stem, rng.Next()));
            }
        }

        int positives = 0;
        for (int t = 0; t < ctx.Set.Targets.Count; t++)
        {
            int n = Math.Clamp(ctx.Set.Targets[t].ImagesPerTarget ?? s.ImagesPerTarget, 1, 100_000);
            positives += n;
            AddJobs(t, n, TargetStemPrefix + (t + 1).ToString(TargetNumberFormat, CultureInfo.InvariantCulture) + "_");
        }
        int negatives = (int)Math.Round(positives * s.NegativePercent / (double)(PercentTotal - s.NegativePercent), MidpointRounding.AwayFromZero);
        AddJobs(-1, negatives, NegativeStemPrefix);
        return jobs;
    }

    private static Rendered Render(Context ctx, Job job)
    {
        var s = ctx.Settings;
        var rng = new Random(job.Seed);
        var pool = job.IsNegative ? ctx.NegativePool(job.Split) : ctx.TargetPool(job.TargetIndex, job.Split);
        int start = rng.Next(pool.Count);
        Mat? bg = null;
        Background? used = null;
        for (int i = 0; i < pool.Count && bg == null; i++)
        {
            used = pool[(start + i) % pool.Count];
            bg = TaskSetImageIo.ReadBgr(used.Path, s.OutputMaxSide);
        }
        if (bg == null || used == null) throw new InvalidOperationException("No readable background for " + job.Stem);

        var boxes = new List<AnnotationBox>();
        if (job.IsNegative) return new Rendered(bg, boxes, used);

        int objects = rng.Next(s.MinObjectsPerImage, s.MaxObjectsPerImage + 1);
        for (int o = 0; o < objects; o++)
        {
            int targetIndex = job.TargetIndex;
            if (o > 0 && ctx.Classes.Count > 1 && rng.NextDouble() < s.CrossTargetProbability)
                targetIndex = (job.TargetIndex + 1 + rng.Next(ctx.Classes.Count - 1)) % ctx.Classes.Count;
            var variants = ctx.Variants[targetIndex];
            if (variants.Length == 0) continue;
            var variant = variants[rng.Next(variants.Length)].Value;
            if (variant == null) continue;
            double extraScale = 1;
            if (s.ScaleMode == SynthesisSettings.ScaleModeRelative)
            {
                double longest = Math.Min(bg.Width, bg.Height) * (s.RelativeMin + rng.NextDouble() * (s.RelativeMax - s.RelativeMin));
                extraScale = longest / Math.Max(variant.Width, variant.Height);
            }
            var (obj, mask) = VariantAugmenter.Apply(variant, ctx.Profiles[targetIndex], extraScale, rng);
            try
            {
                FitInto(ref obj, ref mask, bg.Size());
                var box = Place(bg, obj, mask, ctx.Classes[targetIndex], boxes, s, rng);
                if (box != null) boxes.Add(box);
            }
            finally
            {
                obj.Dispose();
                mask.Dispose();
            }
        }
        return new Rendered(bg, boxes, used);
    }

    private static void FitInto(ref Mat obj, ref Mat mask, Size bounds)
    {
        if (obj.Width <= bounds.Width && obj.Height <= bounds.Height) return;
        double f = Math.Min(bounds.Width / (double)obj.Width, bounds.Height / (double)obj.Height) * OversizeFit;
        var size = new Size(Math.Max(1, (int)(obj.Width * f)), Math.Max(1, (int)(obj.Height * f)));
        var smallObj = new Mat();
        var smallMask = new Mat();
        Cv2.Resize(obj, smallObj, size, 0, 0, InterpolationFlags.Area);
        Cv2.Resize(mask, smallMask, size, 0, 0, InterpolationFlags.Area);
        obj.Dispose();
        mask.Dispose();
        obj = smallObj;
        mask = smallMask;
    }

    /// <summary>Random placement honoring truncation and overlap limits; composites and returns the label box, or null.</summary>
    private static AnnotationBox? Place(Mat bg, Mat obj, Mat mask, string label, List<AnnotationBox> placed, SynthesisSettings s, Random rng)
    {
        int ow = obj.Width, oh = obj.Height;
        double keep = s.MinVisibleFraction;
        int xMin = -(int)Math.Floor(ow * (1 - keep)), xMax = bg.Width - (int)Math.Ceiling(ow * keep);
        int yMin = -(int)Math.Floor(oh * (1 - keep)), yMax = bg.Height - (int)Math.Ceiling(oh * keep);
        var bgRect = new Rect(0, 0, bg.Width, bg.Height);
        for (int attempt = 0; attempt < MaxPlacementAttempts; attempt++)
        {
            int x = rng.Next(xMin, Math.Max(xMin, xMax) + 1);
            int y = rng.Next(yMin, Math.Max(yMin, yMax) + 1);
            var objRect = new Rect(x, y, ow, oh);
            var visible = objRect & bgRect;
            if (visible.Width <= 0 || visible.Height <= 0) continue;
            if ((double)visible.Width * visible.Height < keep * ow * oh) continue;
            var local = new Rect(visible.X - x, visible.Y - y, visible.Width, visible.Height);
            Rect tight;
            using (var maskRoi = new Mat(mask, local))
            using (var visibleMask = new Mat())
            {
                Cv2.Threshold(maskRoi, visibleMask, LabelMaskThreshold, byte.MaxValue, ThresholdTypes.Binary);
                tight = Cv2.BoundingRect(visibleMask);
            }
            if (tight.Width < MinBoxSide || tight.Height < MinBoxSide) continue;
            var box = new AnnotationBox(label, visible.X + tight.X, visible.Y + tight.Y, visible.X + tight.X + tight.Width, visible.Y + tight.Y + tight.Height);
            if (placed.Any(p => p.IoU(box) > s.MaxOverlapIou)) continue;
            Composite(bg, obj, mask, visible, local);
            return box;
        }
        return null;
    }

    private static void Composite(Mat bg, Mat obj, Mat mask, Rect bgRegion, Rect objRegion)
    {
        using var bgRoi = new Mat(bg, bgRegion);
        using var objRoi = new Mat(obj, objRegion);
        using var maskRoi = new Mat(mask, objRegion);
        using var objBgr = new Mat();
        Cv2.CvtColor(objRoi, objBgr, ColorConversionCodes.BGRA2BGR);
        using var w1 = new Mat();
        maskRoi.ConvertTo(w1, MatType.CV_32F, 1.0 / 255.0);
        using var w2 = new Mat();
        Cv2.Subtract(Scalar.All(1.0), w1, w2);
        using var blended = new Mat();
        Cv2.BlendLinear(objBgr, bgRoi, w1, w2, blended);
        blended.CopyTo(bgRoi);
    }

    private static void DrawBoxes(Mat image, IEnumerable<AnnotationBox> boxes, IReadOnlyList<string> classes)
    {
        foreach (var b in boxes)
        {
            var rect = new Rect((int)b.XMin, (int)b.YMin, (int)(b.XMax - b.XMin), (int)(b.YMax - b.YMin));
            Cv2.Rectangle(image, rect, PreviewBoxColor, PreviewLineThickness);
            // Class index, not name: Hershey fonts cannot render non-ASCII class names.
            Cv2.PutText(image, IndexOf(classes, b.Label).ToString(CultureInfo.InvariantCulture), new Point(rect.X + 2, Math.Max(12, rect.Y - 4)),
                HersheyFonts.HersheySimplex, PreviewFontScale, PreviewBoxColor, PreviewLineThickness);
        }
    }

    private static int IndexOf(IReadOnlyList<string> classes, string label)
    {
        for (int i = 0; i < classes.Count; i++)
            if (string.Equals(classes[i], label, StringComparison.Ordinal)) return i;
        return -1;
    }

    private static void WriteManifest(Context ctx, string outputDir, List<Job> jobs, JobOutcome[] outcomes, List<TaskSetIssue> warnings)
    {
        object SplitCounts(YoloSplit split)
        {
            var o = outcomes.Where(x => x.Split == split).ToList();
            return new
            {
                images = o.Count,
                negatives = o.Count(x => x.IsEmpty),
                instances = ctx.Classes.Select((c, i) => (c, n: o.Sum(x => x.ClassCounts[i]))).ToDictionary(x => x.c, x => x.n, StringComparer.Ordinal),
            };
        }

        var poolMembership = new Dictionary<string, SortedSet<string>>(StringComparer.Ordinal);
        foreach (var pool in ctx.Scenes.Append(ctx.Common))
            foreach (var split in new[] { YoloSplit.Train, YoloSplit.Val })
                foreach (var b in pool.For(split))
                {
                    if (!poolMembership.TryGetValue(b.Key, out var set)) poolMembership[b.Key] = set = new SortedSet<string>(StringComparer.Ordinal);
                    set.Add(YoloDataYaml.SplitName(split));
                }
        var uses = outcomes.GroupBy(o => o.BackgroundKey).ToDictionary(g => g.Key, g => g.Count(), StringComparer.Ordinal);

        var manifest = new
        {
            task_set_id = ctx.Set.Id,
            task_set_name = ctx.Set.Name,
            created_utc = DateTime.UtcNow.ToString("o", CultureInfo.InvariantCulture),
            seed = ctx.Settings.Seed,
            classes = ctx.Classes,
            synthesis = ctx.Settings,
            augmentation = ctx.Classes.Select((c, i) => (c, p: ctx.Profiles[i])).ToDictionary(x => x.c, x => x.p, StringComparer.Ordinal),
            counts = new Dictionary<string, object>
            {
                [YoloDataYaml.SplitName(YoloSplit.Train)] = SplitCounts(YoloSplit.Train),
                [YoloDataYaml.SplitName(YoloSplit.Val)] = SplitCounts(YoloSplit.Val),
            },
            planned_negatives = jobs.Count(j => j.IsNegative),
            backgrounds = poolMembership.OrderBy(kv => kv.Key, StringComparer.Ordinal).Select(kv => new
            {
                file = kv.Key,
                splits = kv.Value,
                uses = uses.TryGetValue(kv.Key, out var n) ? n : 0,
            }),
            warnings = warnings.Select(w => new { code = w.Code.ToString(), subject = w.Subject }),
        };
        File.WriteAllText(Path.Combine(outputDir, ManifestFileName), JsonSerializer.Serialize(manifest, TaskSetStore.JsonOptions));
    }
}
