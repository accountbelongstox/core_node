// PY-REF: none (DOT-only)
using DotCore.Foundations;
using DotCore.VocAnnotator;

namespace DotCore.YoloTaskSet;

/// <summary>Frame and label counts of one shared segment (TaskSetStore.ScanSegment).</summary>
public sealed record SegmentScan(string SegmentDir, string FramesDir, int Images, int Annotated, int Boxes, IReadOnlyDictionary<string, int> Labels);

/// <summary>Recorded segments shared in place (YOLO_TASKSET_SYNTHESIS_DESIGN.md §12): add / remove / resolve / scan, variants from their boxes.</summary>
public sealed partial class TaskSetStore
{
    /// <summary>Absolute segment dir of a source (relative paths resolve against the YOLO data root).</summary>
    public static string ResolveSegmentDir(SegmentSource source) =>
        Path.GetFullPath(Path.IsPathRooted(source.SegmentDir) ? source.SegmentDir : Path.Combine(YoloDataLayout.Root, source.SegmentDir));

    /// <summary>{segment}/frames when it exists, else the segment dir itself (a plain folder of annotated images).</summary>
    public static string SegmentFramesDir(string segmentDir)
    {
        var frames = Path.Combine(segmentDir, YoloDataLayout.FramesSubdir);
        return Directory.Exists(frames) ? frames : segmentDir;
    }

    /// <summary>Stored form of a segment dir: relative to the YOLO data root when under it (portable across machines), else absolute.</summary>
    public static string StoredSegmentDir(string segmentDir)
    {
        var full = Path.GetFullPath(segmentDir).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        return YoloDataLayout.IsUnder(full, YoloDataLayout.Root) && !PathsEqual(full, YoloDataLayout.Root)
            ? Path.GetRelativePath(YoloDataLayout.Root, full).Replace(Path.DirectorySeparatorChar, '/')
            : full;
    }

    /// <summary>
    /// Segment dirs below dir: dir itself when it holds frames / annotated images, else its direct non-reserved subdirs that do
    /// (a project dir adds all its segments).
    /// </summary>
    public static IReadOnlyList<string> ExpandSegmentDirs(string dir)
    {
        var full = Path.GetFullPath(dir);
        if (!Directory.Exists(full)) return Array.Empty<string>();
        if (LooksLikeSegment(full)) return new[] { full };
        try
        {
            return Directory.EnumerateDirectories(full).Where(d => !YoloDataLayout.IsReservedName(Path.GetFileName(d)) && LooksLikeSegment(d))
                .OrderBy(d => d, StringComparer.Ordinal).ToList();
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            ColorPrinter.Yellow($"[YoloTaskSet] cannot list {full}: {ex.Message}");
            return Array.Empty<string>();
        }
    }

    private static bool LooksLikeSegment(string dir) =>
        Directory.Exists(Path.Combine(dir, YoloDataLayout.FramesSubdir)) || AnnotationIo.ListImages(dir).Count > 0;

    /// <summary>Adds the segments (expanded, see ExpandSegmentDirs) not linked yet; returns the added sources. Single save.</summary>
    public IReadOnlyList<SegmentSource> AddSegmentSources(TaskSet set, IEnumerable<string> dirs)
    {
        var added = new List<SegmentSource>();
        foreach (var segment in dirs.SelectMany(ExpandSegmentDirs))
        {
            if (set.SegmentSources.Any(s => PathsEqual(ResolveSegmentDir(s), segment))) continue;
            var source = new SegmentSource { SegmentDir = StoredSegmentDir(segment) };
            set.SegmentSources.Add(source);
            added.Add(source);
        }
        if (added.Count > 0) Save(set);
        return added;
    }

    public void RemoveSegmentSources(TaskSet set, IEnumerable<SegmentSource> sources)
    {
        var remove = sources.ToHashSet();
        if (set.SegmentSources.RemoveAll(remove.Contains) > 0) Save(set);
    }

    /// <summary>Counts images, annotated images, boxes and boxes per label (difficult boxes excluded) of a segment.</summary>
    public static SegmentScan ScanSegment(SegmentSource source, CancellationToken ct = default)
    {
        var dir = ResolveSegmentDir(source);
        var frames = SegmentFramesDir(dir);
        var labels = new Dictionary<string, int>(StringComparer.Ordinal);
        int images = 0, annotated = 0, boxes = 0;
        if (Directory.Exists(frames))
        {
            var list = AnnotationIo.ListImages(frames);
            images = list.Count;
            for (int i = 0; i < list.Count; i += source.EffectiveFrameStep)
            {
                ct.ThrowIfCancellationRequested();
                if (AnnotationIo.Load(list[i], frames) is not { } a) continue;
                annotated++;
                foreach (var b in a.Boxes.Where(b => !b.Difficult && b.Label.Trim().Length > 0))
                {
                    boxes++;
                    labels[b.Label.Trim()] = labels.TryGetValue(b.Label.Trim(), out var n) ? n + 1 : 1;
                }
            }
        }
        return new SegmentScan(dir, frames, images, annotated, boxes, labels);
    }

    /// <summary>Annotated boxes of every linked segment as variants (see AddVariantsFromAnnotations); one save per segment.</summary>
    public IReadOnlyList<AnnotationImportResult> AddVariantsFromSegments(TaskSet set, IReadOnlyCollection<string>? classFilter, VariantCutout cutout,
        AnnotationVariantOptions options, IProgress<WorkProgress>? progress = null, CancellationToken ct = default)
    {
        var results = new List<AnnotationImportResult>();
        foreach (var source in set.SegmentSources.ToList())
        {
            var frames = SegmentFramesDir(ResolveSegmentDir(source));
            if (!Directory.Exists(frames)) continue;
            results.Add(AddVariantsFromAnnotations(set, frames, frames, classFilter, cutout, null, progress, ct, options));
        }
        return results;
    }

    /// <summary>Size of the image (or video frame) a "path[#frame=N]@x,y,w,h" source reference points at; null when unknown.</summary>
    internal static (int Width, int Height)? SourceSizeOf(string? originalPath)
    {
        if (!VariantExtractor.TryParseSourceRef(originalPath, out var path, out var frame, out _) || !File.Exists(path)) return null;
        try
        {
            if (frame != null || IsSupportedVideo(path))
                return VariantExtractor.GetVideoInfo(path) is { Width: > 0, Height: > 0 } v ? (v.Width, v.Height) : null;
            return ImageHeaderReader.ReadSize(path) is { Width: > 0, Height: > 0 } s ? (s.Width, s.Height) : null;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            return null;
        }
    }

    private static bool PathsEqual(string a, string b) =>
        string.Equals(YoloDataLayout.TrimSeparators(Path.GetFullPath(a)), YoloDataLayout.TrimSeparators(Path.GetFullPath(b)),
            OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal);
}
