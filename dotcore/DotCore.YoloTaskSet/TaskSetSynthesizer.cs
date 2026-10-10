// PY-REF: none (DOT-only)
using System.Globalization;
using System.Text;
using System.Text.Json;
using DotCore.Foundations;
using DotCore.VocAnnotator;
using DotCore.YoloTrain;
using OpenCvSharp;

namespace DotCore.YoloTaskSet;

/// <summary>Validates a task set and synthesizes an auto-labeled Ultralytics dataset (YOLO_TASKSET_SYNTHESIS_DESIGN.md §4).</summary>
public static partial class TaskSetSynthesizer
{
    public const string ManifestFileName = "synthesis_manifest.json";
    public const string PreviewsSubdir = "previews";
    public const string PartialSuffix = ".partial";

    private const int MaxPlacementAttempts = 50;
    private const int MinBoxSide = 4;
    // Feathered / antialiased fringe below ~25 % opacity is not part of the labeled extent.
    private const double LabelMaskThreshold = 63;
    private const int PreviewCount = 6;
    private const int FewBackgroundsThreshold = 5;
    private const double OversizeFit = 0.95;
    private const string PreviewExtension = ".jpg";
    private const string NegativeStemPrefix = "neg_";
    private const string TargetStemPrefix = "t";
    private const string HoldoutStemPrefix = "real_";
    private const string StemNumberFormat = "D5";
    private const string TargetNumberFormat = "D2";
    private const string FrameKeySeparator = "#";
    private const int PercentTotal = 100;
    private const int PreviewLineThickness = 2;
    private const double PreviewFontScale = 0.6;
    private const double NativeJitterLimit = 0.1;
    private const int InpaintRadius = 3;
    private const int InpaintMargin = 2;
    private const int JpegSeedSalt = 0x5A17;
    private const int ColorCastSeedSalt = 0x3C71;
    private const ulong FnvOffset = 14695981039346656037UL;
    private const ulong FnvPrime = 1099511628211UL;
    private const int SplitHashBuckets = 1_000_000;
    private static readonly Scalar PreviewBoxColor = new(0, 255, 0);

    /// <summary>Background image (or cached video frame); Group = split unit (resource id: all frames of a video share it).</summary>
    private sealed record Background(string Path, string Key, string Group, TaskResource Resource, int Width, int Height);

    private sealed record VariantRef(string Path, TaskResource Resource);

    private sealed record HoldoutItem(string ImagePath, ImageAnnotation Annotation);

    private sealed class VariantEntry
    {
        public required Lazy<Mat?> Image { get; init; }
        public required TaskResource Resource { get; init; }

        /// <summary>Region the variant was cut from (with the source size known), for source placement; null otherwise.</summary>
        public VariantRegion? SourceRegion { get; init; }
    }

    private sealed record Job(int Index, YoloSplit Split, int TargetIndex, string Stem, int Seed)
    {
        public bool IsNegative => TargetIndex < 0;
    }

    private sealed record JobOutcome(YoloSplit Split, string BackgroundKey, int[] ClassCounts, int ImageWidth, int ImageHeight,
        int MinObjectSide, int MaxObjectSide, bool Failed)
    {
        public bool IsEmpty => ClassCounts.All(c => c == 0);
    }

    private sealed record PoolSplit(List<Background> Train, List<Background> Val)
    {
        public List<Background> For(YoloSplit split) => split == YoloSplit.Val ? Val : Train;
        public IEnumerable<Background> All => Train.Concat(Val);
    }

    /// <summary>Readable resources found by validation plus the issues.</summary>
    private sealed class Inspection
    {
        public List<TaskSetIssue> Issues { get; } = new();
        public List<List<VariantRef>> Variants { get; } = new();

        /// <summary>Per target: compound variants of other targets that carry it as a labeled part.</summary>
        public List<List<VariantRef>> Carriers { get; } = new();
        public List<List<Background>> Scenes { get; } = new();
        public List<Background> CommonImages { get; } = new();
        public List<TaskResource> CommonVideos { get; } = new();
        public List<VariantRef> Distractors { get; } = new();
        public List<HoldoutItem> Holdout { get; } = new();
        public List<Background> SegmentBackgrounds { get; } = new();
        public List<SegmentFrame> RealFrames { get; } = new();

        public bool HasErrors => Issues.Any(i => i.IsError);
    }

    /// <summary>Decoded variants (lazy, shared read-only), resolved augmentation, split background pools and the background cache of one run.</summary>
    private sealed class Context : IDisposable
    {
        public required TaskSet Set { get; init; }
        public required SynthesisSettings Settings { get; init; }
        public required IReadOnlyList<string> Classes { get; init; }
        public required AugmentationProfile[] Profiles { get; init; }
        public required AugmentationProfile DistractorProfile { get; init; }
        public required VariantEntry[][] Variants { get; init; }
        public required VariantEntry[][] Carriers { get; init; }
        public required VariantEntry[] Distractors { get; init; }
        public required PoolSplit[] Scenes { get; init; }
        public required PoolSplit Common { get; init; }
        public required SynthesisBackgroundCache Cache { get; init; }
        public required IReadOnlyList<HoldoutItem> Holdout { get; init; }
        public required IReadOnlyList<SegmentFrame> RealFrames { get; init; }

        /// <summary>Classes of source-placed targets (fixed UI): their boxes are overlays that world objects never cover.</summary>
        public required IReadOnlySet<string> OverlayClasses { get; init; }

        public List<Background> TargetPool(int targetIndex, YoloSplit split) =>
            Scenes[targetIndex].For(split).Concat(Common.For(split)).ToList();

        public List<Background> NegativePool(YoloSplit split) =>
            Common.For(split).Concat(Scenes.SelectMany(p => p.For(split))).DistinctBy(b => b.Key).ToList();

        public List<Background> Pool(Job job) => job.IsNegative ? NegativePool(job.Split) : TargetPool(job.TargetIndex, job.Split);

        public bool HasVal(int targetIndex) => (targetIndex < 0 ? NegativePool(YoloSplit.Val) : TargetPool(targetIndex, YoloSplit.Val)).Count > 0;

        /// <summary>
        /// Variants of a target for a split (its carriers when it has none): val-only variants serve val only (when the split has none, all serve).
        /// </summary>
        public IReadOnlyList<VariantEntry> VariantsFor(int targetIndex, YoloSplit split)
        {
            var all = Variants[targetIndex].Length > 0 ? Variants[targetIndex] : Carriers[targetIndex];
            if (all.Length == 0) return all;
            var matching = all.Where(v => v.Resource.ValOnly == (split == YoloSplit.Val)).ToArray();
            return matching.Length > 0 ? matching : all;
        }

        public IEnumerable<Background> AllBackgrounds => Scenes.Append(Common).SelectMany(p => p.All).DistinctBy(b => b.Key);

        public void Dispose()
        {
            foreach (var v in Variants.SelectMany(x => x).Concat(Carriers.SelectMany(x => x)).Concat(Distractors))
                if (v.Image.IsValueCreated) v.Image.Value?.Dispose();
            Cache.Dispose();
        }
    }

    private sealed record Rendered(Mat Image, List<AnnotationBox> Boxes, Background Background) : IDisposable
    {
        public void Dispose() => Image.Dispose();
    }

    /// <summary>Visible pixels of an object already in the image (occupancy for occlusion checks); Box is null for distractors.</summary>
    private sealed class Placed : IDisposable
    {
        public required Rect Rect { get; init; }
        public required Mat Visible { get; init; }
        public required int FullArea { get; init; }

        /// <summary>Top-left of the whole pasted object (may lie outside the image when truncated).</summary>
        public Point Origin { get; init; }
        public int VisibleCount { get; set; }
        public AnnotationBox? Box { get; set; }

        /// <summary>Screen overlay (NPC window, its parts, HUD): world objects and distractors are never pasted over it.</summary>
        public bool Overlay { get; init; }

        public void Dispose() => Visible.Dispose();
    }

    private sealed record ImageRegion(Rect Rect, int PitchX, int PitchY);

    public static IReadOnlyList<TaskSetIssue> Validate(TaskSet set, string taskSetDir) => Validate(set, taskSetDir, null, CancellationToken.None);

    /// <summary>Structural checks plus (when contamination_check) template matching of variants over backgrounds.</summary>
    public static IReadOnlyList<TaskSetIssue> Validate(TaskSet set, string taskSetDir, IProgress<SynthesisProgress>? progress, CancellationToken ct) =>
        ValidateDetailed(set, taskSetDir, progress, ct).Issues;

    /// <summary>Validate plus the contamination hits (empty when contamination_check is off or structural errors exist).</summary>
    public static TaskSetValidation ValidateDetailed(TaskSet set, string taskSetDir, IProgress<SynthesisProgress>? progress, CancellationToken ct)
    {
        var inspection = Inspect(set, taskSetDir);
        var issues = inspection.Issues.ToList();
        IReadOnlyList<ContaminationHit> hits = Array.Empty<ContaminationHit>();
        if (set.Synthesis.Normalized().ContaminationCheck && !inspection.HasErrors)
        {
            hits = FindContamination(set, taskSetDir, inspection, progress, ct);
            issues.AddRange(hits.Select(ToIssue));
        }
        return new TaskSetValidation(issues, hits);
    }

    public static SynthesisResult Generate(TaskSet set, string taskSetDir, string outputDir, IProgress<SynthesisProgress>? progress, CancellationToken ct)
    {
        var inspection = Inspect(set, taskSetDir);
        ThrowOnErrors(inspection);
        outputDir = Path.GetFullPath(outputDir).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        if (Directory.Exists(outputDir) && Directory.EnumerateFileSystemEntries(outputDir).Any())
            throw new IOException("Dataset dir is not empty: " + outputDir);
        var partialDir = outputDir + PartialSuffix;
        if (Directory.Exists(partialDir)) Directory.Delete(partialDir, recursive: true);

        var warnings = inspection.Issues.ToList();
        using var ctx = BuildContext(set, taskSetDir, inspection, warnings, null, ct);
        try
        {
            var result = GenerateInto(ctx, partialDir, outputDir, warnings, progress, ct);
            if (Directory.Exists(outputDir)) Directory.Delete(outputDir);
            Directory.Move(partialDir, outputDir);
            var yaml = YoloDataYaml.Write(outputDir, ctx.Classes, includeTest: result.HoldoutImages > 0 && ctx.Settings.HoldoutSplit == SynthesisSettings.HoldoutSplitTest);
            ColorPrinter.Green($"[YoloTaskSet] dataset ready: train {result.TrainImages}, val {result.ValImages}, negatives {result.NegativeImages}, " +
                $"holdout {result.HoldoutImages}, failed {result.FailedJobs}, instances {result.Instances.Values.Sum()} ({outputDir})");
            return result with { DatasetDir = outputDir, DataYamlPath = yaml };
        }
        catch
        {
            TryDeleteDir(partialDir);
            throw;
        }
    }

    private static SynthesisResult GenerateInto(Context ctx, string dir, string finalDir, List<TaskSetIssue> warnings,
        IProgress<SynthesisProgress>? progress, CancellationToken ct)
    {
        var s = ctx.Settings;
        var (jobs, movedToTrain) = PlanJobs(ctx.Set, s, ctx.HasVal);
        var previewJobs = jobs.Where(j => j.Split == YoloSplit.Train && !j.IsNegative).Take(PreviewCount).Select(j => j.Index).ToHashSet();
        foreach (var split in new[] { YoloSplit.Train, YoloSplit.Val })
        {
            Directory.CreateDirectory(Path.Combine(dir, YoloDataYaml.SplitImagesDir(split)));
            Directory.CreateDirectory(Path.Combine(dir, YoloDataYaml.SplitLabelsDir(split)));
        }
        var previewDir = Path.Combine(dir, PreviewsSubdir);
        Directory.CreateDirectory(previewDir);
        ColorPrinter.Blue($"[YoloTaskSet] generating {jobs.Count} images for task set {ctx.Set.Name} ({ctx.Set.Id}) into {finalDir}");

        var outcomes = new JobOutcome[jobs.Count];
        int done = 0;
        var options = new ParallelOptions { CancellationToken = ct, MaxDegreeOfParallelism = Math.Max(1, Environment.ProcessorCount - 1) };
        Parallel.ForEach(jobs, options, job =>
        {
            ct.ThrowIfCancellationRequested();
            outcomes[job.Index] = RunJob(ctx, job, dir, previewDir, previewJobs.Contains(job.Index));
            progress?.Report(new SynthesisProgress(Interlocked.Increment(ref done), jobs.Count));
        });

        var holdoutSplit = s.HoldoutSplit == SynthesisSettings.HoldoutSplitTest ? YoloSplit.Test : YoloSplit.Val;
        int holdout = WriteHoldout(ctx, dir, holdoutSplit);
        var real = WriteRealFrames(ctx, dir, ct);
        var written = outcomes.Where(o => !o.Failed).ToList();
        var counted = written.Concat(real).ToList();
        var instances = ctx.Classes.Select((c, i) => (c, n: counted.Sum(o => o.ClassCounts[i]))).ToDictionary(x => x.c, x => x.n, StringComparer.Ordinal);
        int train = counted.Count(o => o.Split == YoloSplit.Train);
        int val = counted.Count(o => o.Split == YoloSplit.Val);
        int negatives = written.Count(o => o.IsEmpty);
        int failed = outcomes.Count(o => o.Failed);
        int failedPositives = jobs.Count(j => !j.IsNegative && !outcomes[j.Index].Failed && outcomes[j.Index].IsEmpty);
        if (failedPositives > 0) ColorPrinter.Yellow($"[YoloTaskSet] {failedPositives} images got no placeable object and are written as negatives");
        if (failed > 0) ColorPrinter.Yellow($"[YoloTaskSet] {failed} images failed to render and were skipped");
        var inference = InferenceInfo(ctx, counted);
        WriteManifest(ctx, dir, jobs, outcomes, warnings, inference, holdout, holdoutSplit, movedToTrain, real);
        if (real.Count > 0) ColorPrinter.Blue($"[YoloTaskSet] real segment frames: train {real.Count(r => r.Split == YoloSplit.Train)}, val {real.Count(r => r.Split == YoloSplit.Val)}");
        return new SynthesisResult(finalDir, Path.Combine(finalDir, YoloDataYaml.FileName), ctx.Classes, train, val, negatives, instances, warnings,
            inference, holdout, failed, real.Count);
    }

    private static JobOutcome RunJob(Context ctx, Job job, string dir, string previewDir, bool preview)
    {
        var s = ctx.Settings;
        var imagePath = Path.Combine(dir, YoloDataYaml.SplitImagesDir(job.Split), job.Stem + s.OutputExtension);
        var labelPath = Path.Combine(dir, YoloDataYaml.SplitLabelsDir(job.Split), job.Stem + AnnotationIo.YoloTxtExtension);
        try
        {
            using var rendered = Render(ctx, job);
            VariantAugmenter.ApplyColorCast(rendered.Image, s.SceneColorCast, new Random(job.Seed ^ ColorCastSeedSalt));
            int quality = s.JpegQualityMin is { } qMin ? new Random(job.Seed ^ JpegSeedSalt).Next(qMin, s.JpegQuality + 1) : s.JpegQuality;
            File.WriteAllBytes(imagePath, TaskSetImageIo.Encode(rendered.Image, s.IsPng, quality));
            var annotation = new ImageAnnotation(imagePath, rendered.Image.Width, rendered.Image.Height, rendered.Boxes);
            var lines = AnnotationIo.FormatYoloLines(annotation, ctx.Classes, skipDifficult: false);
            File.WriteAllText(labelPath, lines.Count == 0 ? "" : string.Join("\n", lines) + "\n");
            if (preview)
            {
                DrawBoxes(rendered.Image, rendered.Boxes, ctx.Classes);
                File.WriteAllBytes(Path.Combine(previewDir, job.Stem + PreviewExtension), TaskSetImageIo.EncodeJpeg(rendered.Image, s.JpegQuality));
            }
            var counts = new int[ctx.Classes.Count];
            foreach (var b in rendered.Boxes) counts[IndexOf(ctx.Classes, b.Label)]++;
            int minSide = rendered.Boxes.Count == 0 ? 0 : rendered.Boxes.Min(b => (int)Math.Min(b.Width, b.Height));
            int maxSide = rendered.Boxes.Count == 0 ? 0 : rendered.Boxes.Max(b => (int)Math.Max(b.Width, b.Height));
            return new JobOutcome(job.Split, rendered.Background.Key, counts, rendered.Image.Width, rendered.Image.Height, minSide, maxSide, false);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            ColorPrinter.Yellow($"[YoloTaskSet] skipped {job.Stem}: {ex.Message}");
            TryDeleteFile(imagePath);
            TryDeleteFile(labelPath);
            return new JobOutcome(job.Split, "", new int[ctx.Classes.Count], 0, 0, 0, 0, true);
        }
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
        var classes = set.Targets.Select(t => t.Name.Trim()).ToHashSet(StringComparer.Ordinal);
        void Add(TaskSetIssueCode code, string subject, bool error) => result.Issues.Add(new TaskSetIssue(code, subject, error));

        (int Width, int Height)? CheckedSize(TaskResource r, string path)
        {
            var size = TaskSetImageIo.ReadSize(path);
            if (size == null) Add(TaskSetIssueCode.UnreadableResource, r.File, false);
            else if ((long)size.Value.Width * size.Value.Height > s.MaxResourcePixels)
            {
                Add(TaskSetIssueCode.ResourceTooLarge, r.File, false);
                return null;
            }
            return size;
        }

        void CheckBoxes(TaskResource r)
        {
            foreach (var b in r.Boxes ?? Enumerable.Empty<ResourceBox>())
                if (!b.Mask && !classes.Contains(b.Label.Trim()))
                    Add(TaskSetIssueCode.UnknownBoxLabel, r.File + " " + b.Label, false);
        }

        Background? CheckBackground(TaskResource r)
        {
            var path = TaskSetStore.ResolveResourcePath(taskSetDir, r);
            if (CheckedSize(r, path) is not { } size) return null;
            if (r.Regions?.Any(g => g.ClampTo(size.Width, size.Height) == null) == true) Add(TaskSetIssueCode.InvalidRegion, r.File, false);
            CheckBoxes(r);
            return new Background(path, r.File, r.Id, r, size.Width, size.Height);
        }

        if (set.Targets.Count == 0) Add(TaskSetIssueCode.NoTargets, set.Name, true);
        foreach (var dup in set.Targets.Select(t => t.Name.Trim()).Where(n => n.Length > 0)
                     .GroupBy(n => n, StringComparer.Ordinal).Where(g => g.Count() > 1))
            Add(TaskSetIssueCode.DuplicateTargetName, dup.Key, true);

        int videoFrames = 0;
        foreach (var r in set.CommonResources)
        {
            if (r.Kind == TaskResourceKind.Video)
            {
                var path = TaskSetStore.ResolveResourcePath(taskSetDir, r);
                int frames = File.Exists(path) ? VideoFrameExtractor.EstimateFrames(path, s.VideoFrameInterval, s.VideoMaxFrames) : 0;
                videoFrames += frames;
                if (frames > 0)
                {
                    result.CommonVideos.Add(r);
                    CheckBoxes(r);
                }
                else Add(TaskSetIssueCode.UnreadableResource, r.File, false);
            }
            else if (CheckBackground(r) is { } bg) result.CommonImages.Add(bg);
        }
        InspectSegments(set, s, classes, result);
        int commonCount = result.CommonImages.Count + videoFrames + result.SegmentBackgrounds.Count;
        var commonGroups = result.CommonImages.Select(b => b.Group).Concat(result.CommonVideos.Select(v => v.Id))
            .Concat(result.SegmentBackgrounds.Select(b => b.Group)).ToList();
        int commonVal = ValGroups(commonGroups, s).Count;
        if (set.CommonResources.Count == 0 && result.SegmentBackgrounds.Count == 0) Add(TaskSetIssueCode.NoCommonResources, set.Name, false);
        if (s.UsesDpiSteps && s.ScaleJitter > NativeJitterLimit) Add(TaskSetIssueCode.NativeScaleJitterLarge, set.Name, false);

        foreach (var t in set.Targets)
        {
            var subject = t.Name.Trim().Length > 0 ? t.Name : t.Id;
            if (t.Name.Trim().Length == 0) Add(TaskSetIssueCode.EmptyTargetName, t.Id, true);
            var variants = new List<VariantRef>();
            foreach (var r in t.Variants)
            {
                var path = TaskSetStore.ResolveResourcePath(taskSetDir, r);
                if (CheckedSize(r, path) == null) continue;
                variants.Add(new VariantRef(path, r));
                if (!r.IsCompound && VariantExtractor.InspectAlpha(path) is { HasTransparency: false }) Add(TaskSetIssueCode.VariantWithoutAlpha, r.File, false);
            }
            var scenes = t.Scenes.Select(CheckBackground).OfType<Background>().ToList();
            int backgrounds = scenes.Count + commonCount;
            if (backgrounds == 0) Add(TaskSetIssueCode.NoBackgrounds, subject, true);
            else
            {
                if (backgrounds < FewBackgroundsThreshold) Add(TaskSetIssueCode.FewBackgrounds, subject, false);
                if (ValGroups(scenes.Select(b => b.Group).ToList(), s).Count + commonVal == 0) Add(TaskSetIssueCode.NoValBackground, subject, false);
            }
            if (s.IsNative && !s.UsesDpiSteps)
            {
                var p = set.Augmentation.Resolve(t.Augmentation);
                if (p.ScaleMin < 1 - NativeJitterLimit || p.ScaleMax > 1 + NativeJitterLimit) Add(TaskSetIssueCode.NativeScaleJitterLarge, subject, false);
            }
            result.Variants.Add(variants);
            result.Scenes.Add(scenes);
        }

        // Compound variants carry labeled parts: a target whose label is a part elsewhere needs no own variant (pasted through its carriers).
        for (int t = 0; t < set.Targets.Count; t++)
        {
            var target = set.Targets[t];
            var subject = target.Name.Trim().Length > 0 ? target.Name : target.Id;
            var carriers = result.Variants.Where((_, i) => i != t).SelectMany(v => v)
                .Where(v => v.Resource.Boxes?.Any(b => b.Label.Trim() == target.Name.Trim()) == true).ToList();
            result.Carriers.Add(carriers);
            var usable = result.Variants[t].Concat(carriers).ToList();
            if (usable.Count == 0) Add(TaskSetIssueCode.NoVariants, subject, true);
            else if (target.PlacesAtSource && !usable.Any(v => SourceRegionOf(v.Resource) != null)) Add(TaskSetIssueCode.PlacementSourceUnknown, subject, false);
        }

        foreach (var r in set.Distractors)
        {
            var path = TaskSetStore.ResolveResourcePath(taskSetDir, r);
            if (CheckedSize(r, path) != null) result.Distractors.Add(new VariantRef(path, r));
        }
        InspectHoldout(set, taskSetDir, result);
        return result;
    }

    private static void InspectHoldout(TaskSet set, string taskSetDir, Inspection result)
    {
        foreach (var source in set.HoldoutSources)
        {
            var imagesDir = ResolveDir(taskSetDir, source.ImagesDir);
            var annotationDir = string.IsNullOrWhiteSpace(source.AnnotationDir) ? imagesDir : ResolveDir(taskSetDir, source.AnnotationDir);
            int before = result.Holdout.Count;
            foreach (var image in AnnotationIo.ListImages(imagesDir))
                if (AnnotationIo.Load(image, annotationDir) is { } annotation)
                    result.Holdout.Add(new HoldoutItem(image, annotation));
            if (result.Holdout.Count == before) result.Issues.Add(new TaskSetIssue(TaskSetIssueCode.HoldoutUnreadable, source.ImagesDir, false));
        }
    }

    private static string ResolveDir(string taskSetDir, string dir) =>
        string.IsNullOrWhiteSpace(dir) ? "" : Path.GetFullPath(Path.IsPathRooted(dir) ? dir : Path.Combine(taskSetDir, dir));

    private static Context BuildContext(TaskSet set, string taskSetDir, Inspection inspection, List<TaskSetIssue> warnings,
        IProgress<SynthesisProgress>? progress, CancellationToken ct)
    {
        var s = set.Synthesis.Normalized();
        var common = inspection.CommonImages.Concat(inspection.SegmentBackgrounds).ToList();
        int videosDone = 0;
        foreach (var video in inspection.CommonVideos)
        {
            ct.ThrowIfCancellationRequested();
            common.AddRange(VideoBackgrounds(taskSetDir, video, s, warnings, ct));
            progress?.Report(new SynthesisProgress(++videosDone, inspection.CommonVideos.Count));
        }
        var scenes = inspection.Scenes.Select(p => SplitPool(p, s)).ToArray();
        var commonSplit = SplitPool(common, s);
        for (int i = 0; i < scenes.Length; i++)
            if (scenes[i].Train.Count + commonSplit.Train.Count == 0)
                throw new InvalidOperationException("No readable background for target " + set.Targets[i].Name);

        VariantEntry Entry(VariantRef v) => new()
        {
            Image = new Lazy<Mat?>(() => TaskSetImageIo.ReadBgra(v.Path)), Resource = v.Resource, SourceRegion = SourceRegionOf(v.Resource),
        };
        return new Context
        {
            Set = set,
            Settings = s,
            Classes = set.Targets.Select(t => t.Name.Trim()).ToList(),
            Profiles = set.Targets.Select(t => set.Augmentation.Resolve(t.Augmentation)).ToArray(),
            DistractorProfile = set.Augmentation.Normalized(),
            Variants = inspection.Variants.Select(list => list.Select(Entry).ToArray()).ToArray(),
            Carriers = inspection.Carriers.Select(list => list.Select(Entry).ToArray()).ToArray(),
            Distractors = inspection.Distractors.Select(Entry).ToArray(),
            Scenes = scenes,
            Common = commonSplit,
            Cache = new SynthesisBackgroundCache(s.BackgroundCacheSize, s.IsNative ? 0 : s.OutputMaxSide),
            Holdout = inspection.Holdout,
            RealFrames = inspection.RealFrames,
            OverlayClasses = set.Targets.Where(t => t.PlacesAtSource).Select(t => t.Name.Trim()).ToHashSet(StringComparer.Ordinal),
        };
    }

    private static List<Background> VideoBackgrounds(string taskSetDir, TaskResource video, SynthesisSettings s, List<TaskSetIssue> warnings, CancellationToken ct)
    {
        var frames = VideoFrameExtractor.ExtractToCache(TaskSetStore.ResolveResourcePath(taskSetDir, video),
            TaskSetStore.FrameCacheDir(taskSetDir, video.Id), s.VideoFrameInterval, s.VideoMaxFrames, ct);
        var size = frames.Count > 0 ? TaskSetImageIo.ReadSize(frames[0]) : null;
        if (size == null)
        {
            warnings.Add(new TaskSetIssue(TaskSetIssueCode.UnreadableResource, video.File, false));
            return new List<Background>();
        }
        return frames.Select(f => new Background(f, video.File + FrameKeySeparator + Path.GetFileName(f), video.Id, video, size.Value.Width, size.Value.Height)).ToList();
    }

    /// <summary>Stable per-group split (S14): a group goes to val when hash(seed, group) falls below val_percent; adding a group never moves others.</summary>
    private static PoolSplit SplitPool(IReadOnlyList<Background> pool, SynthesisSettings s)
    {
        var val = ValGroups(pool.Select(b => b.Group).ToList(), s);
        var ordered = pool.OrderBy(b => b.Key, StringComparer.Ordinal).ToList();
        return new PoolSplit(ordered.Where(b => !val.Contains(b.Group)).ToList(), ordered.Where(b => val.Contains(b.Group)).ToList());
    }

    /// <summary>Val groups; a single group stays train-only, otherwise both splits get at least one group.</summary>
    private static HashSet<string> ValGroups(IReadOnlyList<string> groups, SynthesisSettings s)
    {
        var distinct = groups.Distinct(StringComparer.Ordinal).Select(g => (g, u: StableUnit(s.Seed, g))).OrderBy(x => x.u).ThenBy(x => x.g, StringComparer.Ordinal).ToList();
        var val = new HashSet<string>(StringComparer.Ordinal);
        if (distinct.Count < 2) return val;
        double p = s.ValPercent / (double)PercentTotal;
        foreach (var (g, u) in distinct)
            if (u < p) val.Add(g);
        if (val.Count == 0) val.Add(distinct[0].g);
        if (val.Count == distinct.Count) val.Remove(distinct[^1].g);
        return val;
    }

    private static double StableUnit(int seed, string key)
    {
        ulong h = FnvOffset;
        foreach (var b in Encoding.UTF8.GetBytes(seed.ToString(CultureInfo.InvariantCulture) + "|" + key))
        {
            h ^= b;
            h *= FnvPrime;
        }
        return (h % SplitHashBuckets) / (double)SplitHashBuckets;
    }

    private static int ValCount(int n, int valPercent) =>
        n < 2 ? 0 : Math.Clamp((int)Math.Round(n * valPercent / (double)PercentTotal, MidpointRounding.AwayFromZero), 1, n - 1);

    /// <summary>Jobs per target and negatives; val jobs of a target (or negatives, index -1) without a val background are generated as train.</summary>
    private static (List<Job> Jobs, int MovedToTrain) PlanJobs(TaskSet set, SynthesisSettings s, Func<int, bool> hasVal)
    {
        var rng = new Random(s.Seed);
        var jobs = new List<Job>();
        int moved = 0;
        void AddJobs(int targetIndex, int count, string prefix)
        {
            int nVal = ValCount(count, s.ValPercent);
            bool val = hasVal(targetIndex);
            if (!val) moved += nVal;
            for (int i = 0; i < count; i++)
            {
                var stem = prefix + (i + 1).ToString(StemNumberFormat, CultureInfo.InvariantCulture);
                var split = i < count - nVal || !val ? YoloSplit.Train : YoloSplit.Val;
                jobs.Add(new Job(jobs.Count, split, targetIndex, stem, rng.Next()));
            }
        }

        int positives = 0;
        for (int t = 0; t < set.Targets.Count; t++)
        {
            int n = Math.Clamp(set.Targets[t].ImagesPerTarget ?? s.ImagesPerTarget, 1, 100_000);
            positives += n;
            AddJobs(t, n, TargetStemPrefix + (t + 1).ToString(TargetNumberFormat, CultureInfo.InvariantCulture) + "_");
        }
        int negatives = (int)Math.Round(positives * s.NegativePercent / (double)(PercentTotal - s.NegativePercent), MidpointRounding.AwayFromZero);
        AddJobs(-1, negatives, NegativeStemPrefix);
        return (jobs, moved);
    }

    private static Rendered Render(Context ctx, Job job)
    {
        var s = ctx.Settings;
        var rng = new Random(job.Seed);
        var pool = ctx.Pool(job);
        if (pool.Count == 0) pool = job.IsNegative ? ctx.NegativePool(YoloSplit.Train) : ctx.TargetPool(job.TargetIndex, YoloSplit.Train);
        int start = rng.Next(pool.Count);
        SynthesisBackgroundCache.Lease? lease = null;
        Background? used = null;
        for (int i = 0; i < pool.Count && lease == null; i++)
        {
            used = pool[(start + i) % pool.Count];
            lease = ctx.Cache.Acquire(used.Path);
        }
        if (lease == null || used == null) throw new InvalidOperationException("No readable background for " + job.Stem);

        Mat image;
        double f;
        Point origin;
        using (lease)
        {
            var full = lease.Image;
            if (s.IsNative)
            {
                var window = ChooseWindow(used, full.Size(), s, rng);
                image = new Mat(full, window).Clone();
                f = 1;
                origin = window.Location;
            }
            else
            {
                image = full.Clone();
                f = used.Width > 0 ? full.Width / (double)used.Width : 1;
                origin = new Point(0, 0);
            }
        }

        var placed = new List<Placed>();
        try
        {
            ApplyResourceBoxes(image, used, f, origin, ctx.Classes, ctx.OverlayClasses, placed, s);
            var regions = MapRegions(used, f, origin, image.Size());
            double bgScale = used.Resource.EffectivePixelScale;
            var picks = new List<int>();
            if (!job.IsNegative)
            {
                int objects = rng.Next(s.MinObjectsPerImage, s.MaxObjectsPerImage + 1);
                for (int o = 0; o < objects; o++)
                {
                    int targetIndex = job.TargetIndex;
                    if (o > 0 && ctx.Classes.Count > 1 && rng.NextDouble() < s.CrossTargetProbability)
                        targetIndex = (job.TargetIndex + 1 + rng.Next(ctx.Classes.Count - 1)) % ctx.Classes.Count;
                    picks.Add(targetIndex);
                }
            }
            void Paste(int targetIndex)
            {
                var variants = ctx.VariantsFor(targetIndex, job.Split);
                if (variants.Count == 0) return;
                var target = ctx.Set.Targets[targetIndex];
                var entry = PickVariant(variants, target, rng);
                var anchor = target.PlacesAtSource ? SourceAnchor(entry, used, f, origin, image.Size(), target.PlacementJitter) : null;
                PasteObject(image, entry, ctx.Profiles[targetIndex], ctx.Classes[targetIndex], bgScale, placed, regions, s, rng, anchor);
            }
            // World objects, then distractors, then source-anchored targets (UI overlays, one per target and image) so nothing covers the UI.
            foreach (int t in picks.Where(t => !ctx.Set.Targets[t].PlacesAtSource)) Paste(t);
            if (ctx.Distractors.Length > 0 && s.MaxDistractorsPerImage > 0 && rng.NextDouble() < s.DistractorProbability)
            {
                int n = rng.Next(1, s.MaxDistractorsPerImage + 1);
                for (int d = 0; d < n; d++)
                    PasteObject(image, ctx.Distractors[rng.Next(ctx.Distractors.Length)], ctx.DistractorProfile, null, bgScale, placed, regions, s, rng);
            }
            foreach (int t in picks.Where(t => ctx.Set.Targets[t].PlacesAtSource).Distinct()) Paste(t);
            // Compound parts may carry labels of classes outside this task set: those stay unlabeled pixels.
            var boxes = placed.Where(p => p.Box != null && IndexOf(ctx.Classes, p.Box.Label) >= 0).Select(p => p.Box!).ToList();
            return new Rendered(image, boxes, used);
        }
        catch
        {
            image.Dispose();
            throw;
        }
        finally
        {
            foreach (var p in placed) p.Dispose();
        }
    }

    /// <summary>
    /// Native-resolution window (S2). With placement regions (and in_region_probability &gt; 0) the window always contains a region point,
    /// so objects then land in a region with exactly in_region_probability.
    /// </summary>
    private static Rect ChooseWindow(Background bg, Size full, SynthesisSettings s, Random rng)
    {
        int w = Math.Min(s.NativeWindowWidth, full.Width), h = Math.Min(s.NativeWindowHeight, full.Height);
        var regions = (bg.Resource.Regions ?? new List<PlacementRegion>()).Select(r => r.ClampTo(full.Width, full.Height)).OfType<PixelRect>().ToList();
        int x, y;
        if (regions.Count > 0 && s.InRegionProbability > 0)
        {
            var r = regions[rng.Next(regions.Count)];
            int px = r.X + rng.Next(r.Width), py = r.Y + rng.Next(r.Height);
            x = Math.Clamp(px - rng.Next(w), 0, full.Width - w);
            y = Math.Clamp(py - rng.Next(h), 0, full.Height - h);
        }
        else
        {
            x = rng.Next(full.Width - w + 1);
            y = rng.Next(full.Height - h + 1);
        }
        return new Rect(x, y, w, h);
    }

    private static Rect MapRect(PixelRect r, double f, Point origin) =>
        new((int)Math.Round((r.X - origin.X) * f), (int)Math.Round((r.Y - origin.Y) * f),
            Math.Max(1, (int)Math.Round(r.Width * f)), Math.Max(1, (int)Math.Round(r.Height * f)));

    private static List<ImageRegion> MapRegions(Background bg, double f, Point origin, Size image)
    {
        var bounds = new Rect(0, 0, image.Width, image.Height);
        var list = new List<ImageRegion>();
        foreach (var r in bg.Resource.Regions ?? new List<PlacementRegion>())
        {
            var rect = MapRect(r, f, origin) & bounds;
            if (rect.Width > 0 && rect.Height > 0)
                list.Add(new ImageRegion(rect, (int)Math.Round(r.SnapPitchX * f), (int)Math.Round(r.SnapPitchY * f)));
        }
        return list;
    }

    /// <summary>Resource boxes: a class label mostly inside the image becomes a real positive (and occupancy); others are inpainted away.</summary>
    private static void ApplyResourceBoxes(Mat image, Background bg, double f, Point origin, IReadOnlyList<string> classes, IReadOnlySet<string> overlayClasses,
        List<Placed> placed, SynthesisSettings s)
    {
        var boxes = bg.Resource.Boxes;
        if (boxes == null || boxes.Count == 0) return;
        var bounds = new Rect(0, 0, image.Width, image.Height);
        var masks = new List<Rect>();
        foreach (var b in boxes)
        {
            var full = MapRect(b, f, origin);
            var clipped = full & bounds;
            if (clipped.Width <= 0 || clipped.Height <= 0) continue;
            int classIndex = b.Mask ? -1 : IndexOf(classes, b.Label.Trim());
            bool keepLabel = classIndex >= 0 && clipped.Width * (double)clipped.Height >= s.MinVisibleFraction * full.Width * full.Height
                && clipped.Width >= MinBoxSide && clipped.Height >= MinBoxSide;
            if (!keepLabel)
            {
                masks.Add(clipped);
                continue;
            }
            placed.Add(new Placed
            {
                Rect = clipped,
                Visible = new Mat(clipped.Height, clipped.Width, MatType.CV_8UC1, Scalar.All(byte.MaxValue)),
                FullArea = full.Width * full.Height,
                VisibleCount = clipped.Width * clipped.Height,
                Box = new AnnotationBox(classes[classIndex], clipped.X, clipped.Y, clipped.Right, clipped.Bottom),
                Overlay = overlayClasses.Contains(classes[classIndex]),
            });
        }
        if (masks.Count > 0) InpaintRects(image, masks);
    }

    /// <summary>Augments and places one variant (label null = unlabeled distractor). Size: §4 scale modes plus the pixel-scale ratio (S3).</summary>
    private static void PasteObject(Mat image, VariantEntry entry, AugmentationProfile profile, string? label, double bgScale,
        List<Placed> placed, IReadOnlyList<ImageRegion> regions, SynthesisSettings s, Random rng, SourceAnchorPoint? anchor = null)
    {
        var variant = entry.Image.Value;
        if (variant == null) return;
        var parts = label == null ? null : entry.Resource.Boxes;
        bool compound = parts is { Count: > 0 };
        // Labeled parts follow the object by scale only: no flip, rotation or one-sided stretch for compound variants.
        if (compound)
        {
            profile = profile.Clone();
            (profile.FlipHorizontal, profile.RotationMaxDegrees, profile.LeftStretchMax, profile.RightStretchMax) = (false, 0, 0, 0);
        }
        var (extraScale, fixedScale) = ObjectScale(variant, entry.Resource, bgScale, image.Size(), s, rng);
        var (obj, mask) = VariantAugmenter.Apply(variant, profile, extraScale, rng, fixedScale);
        try
        {
            FitInto(ref obj, ref mask, image.Size());
            if (Place(image, obj, mask, compound ? null : label, placed, regions, s, rng, anchor) is not { } p) return;
            placed.Add(p);
            if (compound) AddParts(p, parts!, obj.Width / (double)variant.Width, obj.Height / (double)variant.Height, image.Size(), placed, s, p.Overlay);
        }
        finally
        {
            obj.Dispose();
            mask.Dispose();
        }
    }

    /// <summary>Labeled parts of a pasted compound variant, scaled with it; a part keeps its label when min_visible_fraction of it is in the image.</summary>
    private static void AddParts(Placed whole, IReadOnlyList<ResourceBox> parts, double sx, double sy, Size image, List<Placed> placed, SynthesisSettings s,
        bool overlay)
    {
        var bounds = new Rect(0, 0, image.Width, image.Height);
        foreach (var part in parts)
        {
            if (part.Label.Trim().Length == 0) continue;
            var full = new Rect(whole.Origin.X + (int)Math.Round(part.X * sx), whole.Origin.Y + (int)Math.Round(part.Y * sy),
                Math.Max(1, (int)Math.Round(part.Width * sx)), Math.Max(1, (int)Math.Round(part.Height * sy)));
            var visible = full & bounds;
            if (visible.Width < MinBoxSide || visible.Height < MinBoxSide || visible.Width * (double)visible.Height < s.MinVisibleFraction * full.Width * full.Height) continue;
            placed.Add(new Placed
            {
                Rect = visible,
                Visible = new Mat(visible.Height, visible.Width, MatType.CV_8UC1, Scalar.All(byte.MaxValue)),
                FullArea = full.Width * full.Height,
                VisibleCount = visible.Width * visible.Height,
                Box = new AnnotationBox(part.Label.Trim(), visible.X, visible.Y, visible.Right, visible.Bottom),
                Origin = full.Location,
                Overlay = overlay,
            });
        }
    }

    private static (double Scale, bool Fixed) ObjectScale(Mat variant, TaskResource resource, double bgScale, Size image, SynthesisSettings s, Random rng)
    {
        if (!s.IsNative)
        {
            if (s.SizesFromSource && resource.HasSourceSize)
                return (Math.Min(image.Width, image.Height) / (double)Math.Min(resource.SourceWidth, resource.SourceHeight), false);
            double longest = Math.Min(image.Width, image.Height) * (s.RelativeMin + rng.NextDouble() * (s.RelativeMax - s.RelativeMin));
            return (longest / Math.Max(variant.Width, variant.Height), false);
        }
        double ratio = bgScale / resource.EffectivePixelScale;
        if (!s.UsesDpiSteps) return (ratio, false);
        double step = s.DpiSteps[rng.Next(s.DpiSteps.Count)];
        double jitter = 1 + (rng.NextDouble() * 2 - 1) * s.ScaleJitter;
        return (ratio * step * jitter, true);
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

    private static int RandomIn(Random rng, int min, int max) => rng.Next(Math.Min(min, max), Math.Max(min, max) + 1);

    /// <summary>Top-left inside a region (object fully inside when it fits), snapped to the region's slot grid.</summary>
    private static Point RegionPosition(ImageRegion r, int ow, int oh, Random rng)
    {
        int Axis(int start, int length, int size, int pitch)
        {
            int span = length - size;
            if (span < 0) return start + RandomIn(rng, span, 0);
            if (pitch > 0) return start + pitch * rng.Next(span / pitch + 1);
            return start + rng.Next(span + 1);
        }
        return new Point(Axis(r.Rect.X, r.Rect.Width, ow, r.PitchX), Axis(r.Rect.Y, r.Rect.Height, oh, r.PitchY));
    }

    /// <summary>
    /// Random placement honoring truncation, overlap and occlusion (S7: every earlier labeled object must keep min_visible_fraction
    /// of its mask pixels); composites, re-tightens occluded labels and returns the placed object, or null.
    /// </summary>
    private static Placed? Place(Mat image, Mat obj, Mat mask, string? label, List<Placed> placed, IReadOnlyList<ImageRegion> regions,
        SynthesisSettings s, Random rng, SourceAnchorPoint? anchor = null)
    {
        int ow = obj.Width, oh = obj.Height;
        double keep = s.MinVisibleFraction;
        int xMin = -(int)Math.Floor(ow * (1 - keep)), xMax = image.Width - (int)Math.Ceiling(ow * keep);
        int yMin = -(int)Math.Floor(oh * (1 - keep)), yMax = image.Height - (int)Math.Ceiling(oh * keep);
        var bounds = new Rect(0, 0, image.Width, image.Height);
        using var bin = new Mat();
        Cv2.Threshold(mask, bin, LabelMaskThreshold, byte.MaxValue, ThresholdTypes.Binary);
        int fullArea = Cv2.CountNonZero(bin);
        if (fullArea == 0) return null;
        bool inRegion = regions.Count > 0 && rng.NextDouble() < s.InRegionProbability;
        var covered = new int[placed.Count];
        for (int attempt = 0; attempt < MaxPlacementAttempts; attempt++)
        {
            var pos = anchor is { } a
                ? new Point(a.CenterX - ow / 2 + RandomIn(rng, -a.JitterX, a.JitterX), a.CenterY - oh / 2 + RandomIn(rng, -a.JitterY, a.JitterY))
                : inRegion && attempt < MaxPlacementAttempts / 2
                    ? RegionPosition(regions[rng.Next(regions.Count)], ow, oh, rng)
                    : new Point(RandomIn(rng, xMin, xMax), RandomIn(rng, yMin, yMax));
            var objRect = new Rect(pos.X, pos.Y, ow, oh);
            var visible = objRect & bounds;
            if (visible.Width <= 0 || visible.Height <= 0) continue;
            var local = new Rect(visible.X - pos.X, visible.Y - pos.Y, visible.Width, visible.Height);
            using var visibleBin = new Mat(bin, local);
            int visibleCount = Cv2.CountNonZero(visibleBin);
            if (visibleCount < keep * fullArea) continue;
            var tight = Cv2.BoundingRect(visibleBin);
            if (tight.Width < MinBoxSide || tight.Height < MinBoxSide) continue;
            var box = label == null ? null
                : new AnnotationBox(label, visible.X + tight.X, visible.Y + tight.Y, visible.X + tight.X + tight.Width, visible.Y + tight.Y + tight.Height);
            // A source-anchored object (UI panel) lies on top like the real overlay: it may hide earlier objects, which lose their label below keep.
            bool overlay = anchor != null;
            if (!overlay && box != null && placed.Any(p => p.Box != null && p.Box.IoU(box) > s.MaxOverlapIou)) continue;
            if (!overlay && placed.Any(p => p.Overlay && (p.Rect & visible) is { Width: > 0, Height: > 0 })) continue;
            if (!OcclusionAllowed(placed, visible, visibleBin, overlay ? 0 : keep, covered)) continue;

            Composite(image, obj, mask, visible, local);
            for (int i = 0; i < placed.Count; i++)
            {
                if (covered[i] > 0) Occlude(placed[i], visible, visibleBin, covered[i]);
                if (overlay && placed[i].Box != null && placed[i].VisibleCount < keep * placed[i].FullArea) placed[i].Box = null;
            }
            return new Placed { Rect = visible, Visible = visibleBin.Clone(), FullArea = fullArea, VisibleCount = visibleCount, Box = box, Origin = pos, Overlay = overlay };
        }
        return null;
    }

    private static bool OcclusionAllowed(List<Placed> placed, Rect rect, Mat bin, double keep, int[] covered)
    {
        Array.Clear(covered);
        for (int i = 0; i < placed.Count; i++)
        {
            var p = placed[i];
            var inter = p.Rect & rect;
            if (inter.Width <= 0 || inter.Height <= 0) continue;
            using var a = new Mat(p.Visible, new Rect(inter.X - p.Rect.X, inter.Y - p.Rect.Y, inter.Width, inter.Height));
            using var b = new Mat(bin, new Rect(inter.X - rect.X, inter.Y - rect.Y, inter.Width, inter.Height));
            using var both = new Mat();
            Cv2.BitwiseAnd(a, b, both);
            covered[i] = Cv2.CountNonZero(both);
            if (p.Box != null && p.VisibleCount - covered[i] < keep * p.FullArea) return false;
        }
        return true;
    }

    private static void Occlude(Placed p, Rect rect, Mat bin, int covered)
    {
        var inter = p.Rect & rect;
        using var a = new Mat(p.Visible, new Rect(inter.X - p.Rect.X, inter.Y - p.Rect.Y, inter.Width, inter.Height));
        using var b = new Mat(bin, new Rect(inter.X - rect.X, inter.Y - rect.Y, inter.Width, inter.Height));
        using var notB = new Mat();
        Cv2.BitwiseNot(b, notB);
        Cv2.BitwiseAnd(a, notB, a);
        p.VisibleCount -= covered;
        if (p.Box == null) return;
        var tight = Cv2.BoundingRect(p.Visible);
        p.Box = new AnnotationBox(p.Box.Label, p.Rect.X + tight.X, p.Rect.Y + tight.Y, p.Rect.X + tight.Right, p.Rect.Y + tight.Bottom);
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

    private static int WriteHoldout(Context ctx, string dir, YoloSplit split)
    {
        if (ctx.Holdout.Count == 0) return 0;
        var imagesDir = Path.Combine(dir, YoloDataYaml.SplitImagesDir(split));
        var labelsDir = Path.Combine(dir, YoloDataYaml.SplitLabelsDir(split));
        Directory.CreateDirectory(imagesDir);
        Directory.CreateDirectory(labelsDir);
        int written = 0;
        foreach (var item in ctx.Holdout)
        {
            var stem = HoldoutStemPrefix + (written + 1).ToString(StemNumberFormat, CultureInfo.InvariantCulture);
            var dest = Path.Combine(imagesDir, stem + Path.GetExtension(item.ImagePath).ToLowerInvariant());
            var size = item.Annotation.Width > 0 && item.Annotation.Height > 0
                ? (item.Annotation.Width, item.Annotation.Height)
                : TaskSetImageIo.ReadSize(item.ImagePath);
            if (size == null) continue;
            File.Copy(item.ImagePath, dest, overwrite: false);
            var annotation = new ImageAnnotation(dest, size.Value.Item1, size.Value.Item2, item.Annotation.Boxes);
            var lines = AnnotationIo.FormatYoloLines(annotation, ctx.Classes, skipDifficult: false);
            File.WriteAllText(Path.Combine(labelsDir, stem + AnnotationIo.YoloTxtExtension), lines.Count == 0 ? "" : string.Join("\n", lines) + "\n");
            written++;
        }
        return written;
    }

    private static SynthesisInferenceInfo InferenceInfo(Context ctx, IReadOnlyCollection<JobOutcome> written)
    {
        var s = ctx.Settings;
        var sides = ctx.AllBackgrounds.Select(b => Math.Max(b.Width, b.Height)).DefaultIfEmpty(0).ToList();
        var withObjects = written.Where(o => o.MaxObjectSide > 0).ToList();
        int maxObject = withObjects.Select(o => o.MaxObjectSide).DefaultIfEmpty(0).Max();
        int minObject = withObjects.Select(o => o.MinObjectSide).DefaultIfEmpty(0).Min();
        int width = written.Select(o => o.ImageWidth).DefaultIfEmpty(s.IsNative ? s.NativeWindowWidth : s.OutputMaxSide).Max();
        int height = written.Select(o => o.ImageHeight).DefaultIfEmpty(s.IsNative ? s.NativeWindowHeight : s.OutputMaxSide).Max();
        return new SynthesisInferenceInfo(s.ScaleMode, width, height, sides.Min(), sides.Max(), maxObject, minObject, 2 * maxObject, ctx.Set.InferenceRoiHint);
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

    private static void TryDeleteFile(string path)
    {
        try
        {
            if (File.Exists(path)) File.Delete(path);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            ColorPrinter.Gray($"[YoloTaskSet] cannot delete {path}: {ex.Message}");
        }
    }

    private static void TryDeleteDir(string path)
    {
        try
        {
            if (Directory.Exists(path)) Directory.Delete(path, recursive: true);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            ColorPrinter.Gray($"[YoloTaskSet] cannot delete {path}: {ex.Message}");
        }
    }

    private static void WriteManifest(Context ctx, string outputDir, List<Job> jobs, JobOutcome[] outcomes, List<TaskSetIssue> warnings,
        SynthesisInferenceInfo inference, int holdout, YoloSplit holdoutSplit, int movedToTrain, IReadOnlyList<JobOutcome> real)
    {
        object RealCounts(YoloSplit split)
        {
            var o = real.Where(x => x.Split == split).ToList();
            return new
            {
                images = o.Count,
                instances = ctx.Classes.Select((c, i) => (c, n: o.Sum(x => x.ClassCounts[i]))).ToDictionary(x => x.c, x => x.n, StringComparer.Ordinal),
            };
        }

        object SplitCounts(YoloSplit split)
        {
            var o = outcomes.Where(x => x.Split == split && !x.Failed).ToList();
            return new
            {
                images = o.Count,
                negatives = o.Count(x => x.IsEmpty),
                instances = ctx.Classes.Select((c, i) => (c, n: o.Sum(x => x.ClassCounts[i]))).ToDictionary(x => x.c, x => x.n, StringComparer.Ordinal),
            };
        }

        var membership = new Dictionary<string, (string Group, SortedSet<string> Splits, int Width, int Height)>(StringComparer.Ordinal);
        foreach (var pool in ctx.Scenes.Append(ctx.Common))
            foreach (var split in new[] { YoloSplit.Train, YoloSplit.Val })
                foreach (var b in pool.For(split))
                {
                    if (!membership.TryGetValue(b.Key, out var m))
                        membership[b.Key] = m = (b.Group, new SortedSet<string>(StringComparer.Ordinal), b.Width, b.Height);
                    m.Splits.Add(YoloDataYaml.SplitName(split));
                }
        var uses = outcomes.Where(o => !o.Failed).GroupBy(o => o.BackgroundKey).ToDictionary(g => g.Key, g => g.Count(), StringComparer.Ordinal);

        var manifest = new
        {
            task_set_id = ctx.Set.Id,
            task_set_name = ctx.Set.Name,
            created_utc = DateTime.UtcNow.ToString("o", CultureInfo.InvariantCulture),
            seed = ctx.Settings.Seed,
            classes = ctx.Classes,
            synthesis = ctx.Settings,
            inference,
            augmentation = ctx.Classes.Select((c, i) => (c, p: ctx.Profiles[i])).ToDictionary(x => x.c, x => x.p, StringComparer.Ordinal),
            counts = new Dictionary<string, object>
            {
                [YoloDataYaml.SplitName(YoloSplit.Train)] = SplitCounts(YoloSplit.Train),
                [YoloDataYaml.SplitName(YoloSplit.Val)] = SplitCounts(YoloSplit.Val),
            },
            planned_negatives = jobs.Count(j => j.IsNegative),
            val_jobs_moved_to_train = movedToTrain,
            failed_jobs = outcomes.Count(o => o.Failed),
            failed_stems = jobs.Where(j => outcomes[j.Index].Failed).Select(j => j.Stem),
            holdout = new
            {
                images = holdout,
                split = YoloDataYaml.SplitName(holdoutSplit),
                sources = ctx.Set.HoldoutSources.Select(h => new { images_dir = h.ImagesDir, annotation_dir = h.AnnotationDir }),
            },
            real = new
            {
                segments = ctx.Set.SegmentSources.Select(x => new { segment_dir = x.SegmentDir, backgrounds = x.Backgrounds, real_images = x.RealImages, frame_step = x.FrameStep }),
                train = RealCounts(YoloSplit.Train),
                val = RealCounts(YoloSplit.Val),
            },
            placement = ctx.Set.Targets.Where(t => t.PlacesAtSource).Select(t => new { target = t.Name, placement = t.Placement, jitter = t.PlacementJitter }),
            distractors = ctx.Distractors.Select(d => d.Resource.File),
            backgrounds = membership.OrderBy(kv => kv.Key, StringComparer.Ordinal).Select(kv => new
            {
                file = kv.Key,
                group = kv.Value.Group,
                splits = kv.Value.Splits,
                width = kv.Value.Width,
                height = kv.Value.Height,
                uses = uses.TryGetValue(kv.Key, out var n) ? n : 0,
            }),
            warnings = warnings.Select(w => new { code = w.Code.ToString(), subject = w.Subject }),
        };
        File.WriteAllText(Path.Combine(outputDir, ManifestFileName), JsonSerializer.Serialize(manifest, TaskSetStore.JsonOptions));
    }
}
