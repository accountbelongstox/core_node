// PY-REF: pyapps/d3-check/d3utils/yolo_dataset_from_annotations.py
// PY-REF: pyapps/d3-check/d3utils/yolo_train_flow.py
// PY-REF: pycore/pyutils/ultralytics/dataset.py
using System.Text.Json;
using DotCore.VocAnnotator;

namespace DotCore.YoloTrain;

/// <summary>Planned dataset: entries per split plus statistics for preview and training advice.</summary>
public sealed class YoloDatasetPlan
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

    public int BackgroundImages => Entries.Count(e => e.IsBackground);

    public bool CanBuild => LabeledImages > 0 && Summary(YoloSplit.Train).Images > 0 && Summary(YoloSplit.Val).Images > 0;

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

    public static YoloDatasetPlan Plan(IReadOnlyList<YoloDatasetSource> sources, IReadOnlyList<string> classes, YoloDatasetSplit split, CancellationToken ct = default)
    {
        if (!split.IsValid) throw new ArgumentException("Invalid split percentages", nameof(split));
        var classSet = new HashSet<string>(classes, StringComparer.Ordinal);
        var unknown = new Dictionary<string, int>(StringComparer.Ordinal);
        var labeled = new List<(string Path, ImageAnnotation Ann, string Source)>();
        var background = new List<(string Path, ImageAnnotation Ann, string Source)>();
        int sourceImages = 0, unannotated = 0, difficultSkipped = 0, maxW = 0, maxH = 0;
        long bytes = 0;

        foreach (var source in sources)
        {
            foreach (var image in AnnotationIo.ListImages(source.ImagesDir))
            {
                ct.ThrowIfCancellationRequested();
                sourceImages++;
                var ann = AnnotationIo.Load(image, source.AnnotationDir);
                if (ann == null) { unannotated++; continue; }
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
                    if (split.SkipDifficult && box.Difficult) { difficultSkipped++; continue; }
                    var clamped = box.ClampTo(w, h);
                    if (clamped.Width > 0 && clamped.Height > 0) kept.Add(clamped);
                }
                bytes += SafeLength(image);
                maxW = Math.Max(maxW, w);
                maxH = Math.Max(maxH, h);
                var filtered = new ImageAnnotation(image, w, h, kept);
                (kept.Count > 0 ? labeled : background).Add((image, filtered, source.Name));
            }
        }

        var rng = new Random(split.Seed);
        var usedBackground = new List<(string Path, ImageAnnotation Ann, string Source)>();
        if (split.IncludeBackground && labeled.Count > 0 && background.Count > 0)
        {
            int cap = (int)Math.Floor(labeled.Count * split.BackgroundMaxPercent / (double)(YoloDatasetSplit.PercentTotal - split.BackgroundMaxPercent));
            usedBackground = (split.Shuffle ? Shuffled(background, rng) : background).Take(cap).ToList();
        }

        var instanceTotals = classes.ToDictionary(c => c, _ => 0, StringComparer.Ordinal);
        foreach (var b in labeled.SelectMany(l => l.Ann.Boxes)) instanceTotals[b.Label]++;
        string GroupKey(ImageAnnotation ann) => split.Stratify
            ? ann.Boxes.Select(b => b.Label).Distinct().OrderBy(l => instanceTotals[l]).ThenBy(l => l, StringComparer.Ordinal).First()
            : "";

        var groups = labeled.GroupBy(l => GroupKey(l.Ann))
            .Select(g => (Key: g.Key, Items: g.ToList()))
            .Append((Key: BackgroundGroup, Items: usedBackground))
            .OrderBy(g => g.Key, StringComparer.Ordinal);

        var entries = new List<YoloDatasetEntry>();
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

        return new YoloDatasetPlan
        {
            Classes = classes.ToList(),
            Split = split,
            Sources = sources.ToList(),
            Entries = entries,
            SourceImages = sourceImages,
            UnannotatedImages = unannotated,
            BackgroundAvailable = background.Count,
            DifficultSkipped = difficultSkipped,
            UnknownLabels = unknown,
            SourceBytes = bytes,
            MaxWidth = maxW,
            MaxHeight = maxH,
        };
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
            },
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
            items = plan.Entries.Select(e => new { source = e.SourceName, image = e.ImagePath, split = YoloDataYaml.SplitName(e.Split), background = e.IsBackground }),
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
