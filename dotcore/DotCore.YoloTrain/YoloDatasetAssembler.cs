// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/yolo_dataset_from_annotations.py
// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/yolo_train_flow.py
// PY-REF: pycore/pyutils/ultralytics/dataset.py
using System.Text.Json;
using DotCore.VocAnnotator;

namespace DotCore.YoloTrain;

/// <summary>Planned dataset: entries per split plus statistics for preview and training advice.</summary>
public sealed class YoloDatasetPlan : IYoloDatasetStats
{
    public required IReadOnlyList<string> Classes { get; init; }
    public required YoloDatasetSplit Split { get; init; }
    public required IReadOnlyList<YoloDatasetSource> Sources { get; init; }
    public required IReadOnlyList<YoloDatasetEntry> Entries { get; init; }
    public int SourceImages { get; init; }
    public int UnannotatedImages { get; init; }
    public int BackgroundAvailable { get; init; }
    public int DifficultSkipped { get; init; }
    public required IReadOnlyDictionary<string, int> UnknownLabels { get; init; }
    public long SourceBytes { get; init; }
    public int MaxWidth { get; init; }
    public int MaxHeight { get; init; }

    public int LabeledImages => Entries.Count(e => !e.IsBackground);

    public int TotalImages => Entries.Count;

    /// <summary>Unreviewed model pseudo-labeled images in the plan (train only).</summary>
    public int PseudoLabeledImages => Entries.Count(e => e.IsPseudoLabel);

    /// <summary>Unreviewed pseudo-labeled images left out (option off, or no box).</summary>
    public int UnreviewedSkipped { get; init; }

    public int ValImages => Summary(YoloSplit.Val).Images;

    /// <summary>True when whole sources were assigned to splits (YoloDatasetSplit.GroupBySource with at least 2 sources).</summary>
    public bool GroupedBySource { get; init; }

    /// <summary>Split of each source assigned as a whole; sources split per image (single-source classes) are absent.</summary>
    public IReadOnlyDictionary<string, YoloSplit> SourceSplits { get; init; } = new Dictionary<string, YoloSplit>();

    public int BackgroundImages => Entries.Count(e => e.IsBackground);

    /// <summary>Evaluation dataset: every image in val, train empty (PlanEvaluation).</summary>
    public bool IsEvaluation { get; init; }

    public bool CanBuild => LabeledImages > 0 && (IsEvaluation || Summary(YoloSplit.Train).Images > 0) && Summary(YoloSplit.Val).Images > 0;

    public YoloSplitSummary Summary(YoloSplit split)
    {
        var entries = Entries.Where(e => e.Split == split).ToList();
        return new YoloSplitSummary(entries.Count, entries.Count(e => e.IsBackground), CountInstances(entries, Classes));
    }

    public IReadOnlyDictionary<string, int> ClassInstances => CountInstances(Entries, Classes);

    internal static IReadOnlyDictionary<string, int> CountInstances(IEnumerable<YoloDatasetEntry> entries, IReadOnlyList<string> classes)
    {
        var counts = classes.ToDictionary(c => c, _ => 0, StringComparer.Ordinal);
        foreach (var box in entries.SelectMany(e => e.Annotation.Boxes))
            if (counts.ContainsKey(box.Label)) counts[box.Label]++;
        return counts;
    }
}

public sealed record YoloDatasetBuildResult(string DatasetDir, string DataYamlPath, YoloDatasetPlan Plan);

/// <summary>
/// Turns annotated image folders into an Ultralytics dataset (images/{train,val,test}, labels/{...}, data.yaml, dataset_manifest.json).
/// Replaces Python flow5_prepare_training_dir (which trained and validated on the same images) and generate_yolo_dataset.
/// </summary>
public static class YoloDatasetAssembler
{
    public const string ManifestFileName = "dataset_manifest.json";
    private const string BackgroundGroup = "\u0000background";

    private sealed record Collected(
        List<(string Path, ImageAnnotation Ann, string Source)> Labeled,
        List<(string Path, ImageAnnotation Ann, string Source)> Background,
        List<(string Path, ImageAnnotation Ann, string Source)> Pseudo,
        Dictionary<string, int> Unknown,
        int SourceImages, int Unannotated, int DifficultSkipped, int UnreviewedSkipped, long Bytes, int MaxW, int MaxH);

    public static YoloDatasetPlan Plan(IReadOnlyList<YoloDatasetSource> sources, IReadOnlyList<string> classes, YoloDatasetSplit split, CancellationToken ct = default)
    {
        if (!split.IsValid) throw new ArgumentException("Invalid split percentages", nameof(split));
        var c = Collect(sources, classes, split.SkipDifficult, split.IncludeUnreviewedPseudoLabels, ct);
        var labeled = c.Labeled;
        var background = c.Background;

        var rng = new Random(split.Seed);
        var usedBackground = new List<(string Path, ImageAnnotation Ann, string Source)>();
        if (split.IncludeBackground && labeled.Count > 0 && background.Count > 0)
        {
            int cap = (int)Math.Floor(labeled.Count * split.BackgroundMaxPercent / (double)(YoloDatasetSplit.PercentTotal - split.BackgroundMaxPercent));
            usedBackground = (split.Shuffle ? Shuffled(background, rng) : background).Take(cap).ToList();
        }

        var entries = new List<YoloDatasetEntry>();
        var sourceSplits = new Dictionary<string, YoloSplit>(StringComparer.Ordinal);
        bool grouped = split.GroupBySource && labeled.Select(l => l.Source).Distinct(StringComparer.Ordinal).Count() >= 2;
        if (grouped)
        {
            sourceSplits = AssignSources(labeled, split, rng);
            foreach (var l in labeled.Where(l => sourceSplits.ContainsKey(l.Source)).OrderBy(l => l.Source, StringComparer.Ordinal).ThenBy(l => l.Path, StringComparer.Ordinal))
                entries.Add(new YoloDatasetEntry(l.Path, l.Ann, l.Source, sourceSplits[l.Source], false));
            labeled = labeled.Where(l => !sourceSplits.ContainsKey(l.Source)).ToList();
        }

        var instanceTotals = classes.ToDictionary(x => x, _ => 0, StringComparer.Ordinal);
        foreach (var b in labeled.SelectMany(l => l.Ann.Boxes)) instanceTotals[b.Label]++;
        string GroupKey(ImageAnnotation ann) => split.Stratify
            ? ann.Boxes.Select(b => b.Label).Distinct().OrderBy(l => instanceTotals[l]).ThenBy(l => l, StringComparer.Ordinal).First()
            : "";

        var groups = labeled.GroupBy(l => GroupKey(l.Ann))
            .Select(g => (Key: g.Key, Items: g.ToList()))
            .Append((Key: BackgroundGroup, Items: usedBackground))
            .OrderBy(g => g.Key, StringComparer.Ordinal);

        foreach (var (key, items) in groups)
        {
            var ordered = items.OrderBy(i => i.Source, StringComparer.Ordinal).ThenBy(i => i.Path, StringComparer.Ordinal).ToList();
            if (split.Shuffle) ordered = Shuffled(ordered, rng);
            int n = ordered.Count;
            int nVal = (int)Math.Round(n * split.ValPercent / (double)YoloDatasetSplit.PercentTotal, MidpointRounding.AwayFromZero);
            int nTest = (int)Math.Round(n * split.TestPercent / (double)YoloDatasetSplit.PercentTotal, MidpointRounding.AwayFromZero);
            nTest = Math.Min(nTest, n - nVal);
            for (int i = 0; i < n; i++)
            {
                var s = i < nVal ? YoloSplit.Val : i < nVal + nTest ? YoloSplit.Test : YoloSplit.Train;
                entries.Add(new YoloDatasetEntry(ordered[i].Path, ordered[i].Ann, ordered[i].Source, s, key == BackgroundGroup));
            }
        }
        EnsureSplitNotEmpty(entries, YoloSplit.Val, minLabeled: 2);
        if (split.TestPercent > 0) EnsureSplitNotEmpty(entries, YoloSplit.Test, minLabeled: 3);
        entries.AddRange(c.Pseudo.OrderBy(p => p.Source, StringComparer.Ordinal).ThenBy(p => p.Path, StringComparer.Ordinal)
            .Select(p => new YoloDatasetEntry(p.Path, p.Ann, p.Source, YoloSplit.Train, false)));

        return new YoloDatasetPlan
        {
            Classes = classes.ToList(),
            Split = split,
            Sources = sources.ToList(),
            Entries = entries,
            SourceImages = c.SourceImages,
            UnannotatedImages = c.Unannotated,
            BackgroundAvailable = background.Count,
            DifficultSkipped = c.DifficultSkipped,
            UnknownLabels = c.Unknown,
            SourceBytes = c.Bytes,
            MaxWidth = c.MaxW,
            MaxHeight = c.MaxH,
            GroupedBySource = grouped,
            SourceSplits = sourceSplits,
            UnreviewedSkipped = c.UnreviewedSkipped,
        };
    }

    /// <summary>Evaluation dataset of real annotated images: every annotated image (labeled and background) goes to val.</summary>
    public static YoloDatasetPlan PlanEvaluation(IReadOnlyList<YoloDatasetSource> sources, IReadOnlyList<string> classes, CancellationToken ct = default)
    {
        var split = new YoloDatasetSplit { TrainPercent = 0, ValPercent = YoloDatasetSplit.PercentTotal, Shuffle = false, GroupBySource = false };
        var c = Collect(sources, classes, split.SkipDifficult, false, ct);
        var entries = c.Labeled.Select(l => new YoloDatasetEntry(l.Path, l.Ann, l.Source, YoloSplit.Val, false))
            .Concat(c.Background.Select(b => new YoloDatasetEntry(b.Path, b.Ann, b.Source, YoloSplit.Val, true)))
            .ToList();
        return new YoloDatasetPlan
        {
            Classes = classes.ToList(),
            Split = split,
            Sources = sources.ToList(),
            Entries = entries,
            SourceImages = c.SourceImages,
            UnannotatedImages = c.Unannotated,
            BackgroundAvailable = c.Background.Count,
            DifficultSkipped = c.DifficultSkipped,
            UnknownLabels = c.Unknown,
            SourceBytes = c.Bytes,
            MaxWidth = c.MaxW,
            MaxHeight = c.MaxH,
            IsEvaluation = true,
            UnreviewedSkipped = c.UnreviewedSkipped,
        };
    }

    /// <summary>
    /// Whole-source split: sources holding a class no other source has stay per image (absent from the result); the others start in
    /// train and move to val (then test) greedily, preferring sources that add classes the split lacks, while every class keeps a
    /// train source, until the split reaches its share of images.
    /// </summary>
    private static Dictionary<string, YoloSplit> AssignSources(List<(string Path, ImageAnnotation Ann, string Source)> labeled, YoloDatasetSplit split, Random rng)
    {
        var bySource = labeled.GroupBy(l => l.Source, StringComparer.Ordinal)
            .Select(g => new SourceStats(g.Key, g.Count(), g.SelectMany(l => l.Ann.Boxes.Select(b => b.Label)).ToHashSet(StringComparer.Ordinal)))
            .OrderBy(s => s.Name, StringComparer.Ordinal).ToList();
        var sourcesPerClass = bySource.SelectMany(s => s.Classes).GroupBy(x => x, StringComparer.Ordinal).ToDictionary(g => g.Key, g => g.Count(), StringComparer.Ordinal);
        var whole = bySource.Where(s => s.Classes.All(cls => sourcesPerClass[cls] >= 2)).ToList();
        if (split.Shuffle) whole = Shuffled(whole, rng);
        var result = whole.ToDictionary(s => s.Name, _ => YoloSplit.Train, StringComparer.Ordinal);
        if (whole.Count < 2) return result;

        var trainSources = new Dictionary<string, int>(sourcesPerClass, StringComparer.Ordinal);
        int total = whole.Sum(s => s.Images);
        foreach (var (target, percent) in new[] { (YoloSplit.Val, split.ValPercent), (YoloSplit.Test, split.TestPercent) })
        {
            if (percent <= 0) continue;
            int want = Math.Max(1, (int)Math.Round(total * percent / (double)YoloDatasetSplit.PercentTotal, MidpointRounding.AwayFromZero));
            int assigned = 0;
            var covered = new HashSet<string>(StringComparer.Ordinal);
            while (assigned < want)
            {
                var pick = whole
                    .Select((s, order) => (s, order))
                    .Where(x => result[x.s.Name] == YoloSplit.Train && x.s.Classes.All(cls => trainSources[cls] >= 2)
                        && (assigned == 0 || assigned + x.s.Images <= want + want / 2))
                    .OrderByDescending(x => x.s.Classes.Count(cls => !covered.Contains(cls))).ThenBy(x => x.order)
                    .Select(x => x.s).FirstOrDefault();
                if (pick == null) break;
                result[pick.Name] = target;
                assigned += pick.Images;
                foreach (var cls in pick.Classes)
                {
                    covered.Add(cls);
                    trainSources[cls]--;
                }
            }
            // Coverage beats the share cap: a class absent from the split has no metric there.
            while (true)
            {
                var extra = whole
                    .Where(s => result[s.Name] == YoloSplit.Train && s.Classes.All(cls => trainSources[cls] >= 2) && s.Classes.Any(cls => !covered.Contains(cls)))
                    .OrderBy(s => s.Images).FirstOrDefault();
                if (extra == null) break;
                result[extra.Name] = target;
                foreach (var cls in extra.Classes)
                {
                    covered.Add(cls);
                    trainSources[cls]--;
                }
            }
        }
        return result;
    }

    private sealed record SourceStats(string Name, int Images, HashSet<string> Classes);

    private static Collected Collect(IReadOnlyList<YoloDatasetSource> sources, IReadOnlyList<string> classes, bool skipDifficultBoxes, bool includePseudo,
        CancellationToken ct)
    {
        var classSet = new HashSet<string>(classes, StringComparer.Ordinal);
        var unknown = new Dictionary<string, int>(StringComparer.Ordinal);
        var labeled = new List<(string Path, ImageAnnotation Ann, string Source)>();
        var background = new List<(string Path, ImageAnnotation Ann, string Source)>();
        var pseudo = new List<(string Path, ImageAnnotation Ann, string Source)>();
        int sourceImages = 0, unannotated = 0, difficultSkipped = 0, unreviewedSkipped = 0, maxW = 0, maxH = 0;
        long bytes = 0;

        foreach (var source in sources)
        {
            foreach (var image in AnnotationIo.ListImages(source.ImagesDir))
            {
                ct.ThrowIfCancellationRequested();
                sourceImages++;
                var ann = AnnotationIo.Load(image, source.AnnotationDir);
                if (ann == null) { unannotated++; continue; }
                if (!ann.Reviewed && (!includePseudo || ann.Boxes.Count == 0)) { unreviewedSkipped++; continue; }
                var (w, h) = ann.Width > 0 && ann.Height > 0 ? (ann.Width, ann.Height) : ImageHeaderReader.ReadSize(image) ?? (0, 0);
                if (w <= 0 || h <= 0) { unannotated++; continue; }
                var kept = new List<AnnotationBox>();
                foreach (var box in ann.Boxes)
                {
                    if (!classSet.Contains(box.Label))
                    {
                        unknown[box.Label] = unknown.TryGetValue(box.Label, out var n) ? n + 1 : 1;
                        continue;
                    }
                    if (skipDifficultBoxes && box.Difficult) { difficultSkipped++; continue; }
                    var clamped = box.ClampTo(w, h);
                    if (clamped.Width > 0 && clamped.Height > 0) kept.Add(clamped);
                }
                bytes += SafeLength(image);
                maxW = Math.Max(maxW, w);
                maxH = Math.Max(maxH, h);
                if (!ann.Reviewed && kept.Count == 0) { unreviewedSkipped++; continue; }
                var filtered = new ImageAnnotation(image, w, h, kept) { Source = ann.Source, Reviewed = ann.Reviewed };
                (!ann.Reviewed ? pseudo : kept.Count > 0 ? labeled : background).Add((image, filtered, source.Name));
            }
        }

        return new Collected(labeled, background, pseudo, unknown, sourceImages, unannotated, difficultSkipped, unreviewedSkipped, bytes, maxW, maxH);
    }

    /// <summary>Write the planned dataset into datasetDir (must be new or empty).</summary>
    public static YoloDatasetBuildResult Build(YoloDatasetPlan plan, string datasetDir, IProgress<(int Done, int Total)>? progress = null, CancellationToken ct = default)
    {
        if (!plan.CanBuild) throw new InvalidOperationException("Dataset plan has no train or val images");
        if (Directory.Exists(datasetDir) && Directory.EnumerateFileSystemEntries(datasetDir).Any())
            throw new IOException("Dataset dir is not empty: " + datasetDir);
        bool hasTest = plan.Entries.Any(e => e.Split == YoloSplit.Test);
        foreach (var split in Enum.GetValues<YoloSplit>().Where(s => s != YoloSplit.Test || hasTest))
        {
            Directory.CreateDirectory(Path.Combine(datasetDir, YoloDataYaml.SplitImagesDir(split)));
            Directory.CreateDirectory(Path.Combine(datasetDir, YoloDataYaml.SplitLabelsDir(split)));
        }
        var usedNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        int done = 0;
        foreach (var e in plan.Entries)
        {
            ct.ThrowIfCancellationRequested();
            var stem = UniqueStem(SafeName(e.SourceName) + "_" + SafeName(Path.GetFileNameWithoutExtension(e.ImagePath)), usedNames);
            File.Copy(e.ImagePath, Path.Combine(datasetDir, YoloDataYaml.SplitImagesDir(e.Split), stem + Path.GetExtension(e.ImagePath).ToLowerInvariant()));
            var lines = AnnotationIo.FormatYoloLines(e.Annotation, plan.Classes, skipDifficult: plan.Split.SkipDifficult);
            File.WriteAllText(Path.Combine(datasetDir, YoloDataYaml.SplitLabelsDir(e.Split), stem + AnnotationIo.YoloTxtExtension),
                lines.Count == 0 ? "" : string.Join("\n", lines) + "\n");
            progress?.Report((++done, plan.Entries.Count));
        }
        var yaml = YoloDataYaml.Write(datasetDir, plan.Classes, hasTest);
        WriteManifest(plan, datasetDir);
        return new YoloDatasetBuildResult(datasetDir, yaml, plan);
    }

    private static void EnsureSplitNotEmpty(List<YoloDatasetEntry> entries, YoloSplit split, int minLabeled)
    {
        if (entries.Any(e => e.Split == split) || entries.Count(e => !e.IsBackground) < minLabeled) return;
        int idx = entries.FindLastIndex(e => e.Split == YoloSplit.Train && !e.IsBackground);
        if (idx >= 0) entries[idx] = entries[idx] with { Split = split };
    }

    private static void WriteManifest(YoloDatasetPlan plan, string datasetDir)
    {
        var manifest = new
        {
            created_utc = DateTime.UtcNow.ToString("o"),
            classes = plan.Classes,
            split = new
            {
                train_percent = plan.Split.TrainPercent,
                val_percent = plan.Split.ValPercent,
                test_percent = plan.Split.TestPercent,
                seed = plan.Split.Seed,
                shuffle = plan.Split.Shuffle,
                stratify = plan.Split.Stratify,
                include_background = plan.Split.IncludeBackground,
                background_max_percent = plan.Split.BackgroundMaxPercent,
                skip_difficult = plan.Split.SkipDifficult,
                group_by_source = plan.Split.GroupBySource,
                include_unreviewed_pseudo_labels = plan.Split.IncludeUnreviewedPseudoLabels,
            },
            grouped_by_source = plan.GroupedBySource,
            source_splits = plan.SourceSplits.ToDictionary(kv => kv.Key, kv => YoloDataYaml.SplitName(kv.Value)),
            evaluation = plan.IsEvaluation,
            pseudo_labeled_images = plan.PseudoLabeledImages,
            unreviewed_skipped = plan.UnreviewedSkipped,
            sources = plan.Sources.Select(s => new { name = s.Name, images_dir = s.ImagesDir, annotation_dir = s.AnnotationDir }),
            counts = Enum.GetValues<YoloSplit>().ToDictionary(YoloDataYaml.SplitName, s =>
            {
                var sum = plan.Summary(s);
                return new { images = sum.Images, background = sum.Background, instances = sum.Instances };
            }),
            source_images = plan.SourceImages,
            unannotated_images = plan.UnannotatedImages,
            unknown_labels = plan.UnknownLabels,
            difficult_skipped = plan.DifficultSkipped,
            items = plan.Entries.Select(e => new { source = e.SourceName, image = e.ImagePath, split = YoloDataYaml.SplitName(e.Split), background = e.IsBackground, pseudo_label = e.IsPseudoLabel }),
        };
        File.WriteAllText(Path.Combine(datasetDir, ManifestFileName), JsonSerializer.Serialize(manifest, new JsonSerializerOptions
        {
            WriteIndented = true,
            Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        }));
    }

    private static List<T> Shuffled<T>(IReadOnlyList<T> items, Random rng)
    {
        var list = items.ToList();
        for (int i = list.Count - 1; i > 0; i--)
        {
            int j = rng.Next(i + 1);
            (list[i], list[j]) = (list[j], list[i]);
        }
        return list;
    }

    private static string SafeName(string value)
    {
        var invalid = Path.GetInvalidFileNameChars();
        var chars = value.Select(c => invalid.Contains(c) || char.IsWhiteSpace(c) ? '_' : c).ToArray();
        return chars.Length == 0 ? "_" : new string(chars);
    }

    private static string UniqueStem(string stem, HashSet<string> used)
    {
        var candidate = stem;
        for (int i = 2; !used.Add(candidate); i++) candidate = stem + "_" + i;
        return candidate;
    }

    private static long SafeLength(string path)
    {
        try { return new FileInfo(path).Length; }
        catch (IOException) { return 0; }
    }
}
