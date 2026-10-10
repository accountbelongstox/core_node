// PY-REF: none (DOT-only)
using System.Text.Json;
using DotCore.Foundations;
using DotCore.VocAnnotator;

namespace DotCore.YoloTaskSet;

/// <summary>Serialized as "variants" / "scenes" / "common" / "distractors".</summary>
public enum TaskResourcePool
{
    Variants,
    Scenes,
    Common,
    Distractors,
}

public enum ImportOutcome
{
    Added,
    Unsupported,
    Failed,
    Cancelled,
}

/// <summary>Why a file was not added (map to i18n in the UI; Detail of ImportFileResult is the raw library message for logs).</summary>
public enum ImportFailure
{
    None,
    NotFound,
    Unreadable,
    AccessDenied,
    IoError,
}

public sealed record ImportFileResult(string SourcePath, ImportOutcome Outcome, ImportFailure Failure = ImportFailure.None,
    TaskResource? Resource = null, string? Detail = null);

/// <summary>One subfolder of a folder-tree import; Exists = a target with this name exists and is merged into.</summary>
public sealed record FolderTreeTargetPlan(string Name, string SourceDir, bool Exists, IReadOnlyList<string> Variants, IReadOnlyList<string> Scenes);

/// <summary>Ignored = files the import would skip (unsupported types, loose files in the root).</summary>
public sealed record FolderTreePlan(string RootDir, IReadOnlyList<FolderTreeTargetPlan> Targets, IReadOnlyList<string> Common, IReadOnlyList<string> Ignored,
    IReadOnlyList<string> Distractors)
{
    public int NewTargets => Targets.Count(t => !t.Exists);
    public int FileCount => Targets.Sum(t => t.Variants.Count + t.Scenes.Count) + Common.Count + Distractors.Count;
}

/// <summary>Files is empty for a dry run.</summary>
public sealed record FolderTreeImportResult(FolderTreePlan Plan, bool DryRun, int TargetsCreated, IReadOnlyList<ImportFileResult> Files);

public sealed record TargetCopyResult(IReadOnlyList<TaskTarget> Targets, int TargetsCreated, IReadOnlyList<ImportFileResult> Files);

/// <summary>Failures are per image (unreadable image / annotation) or per box (empty cut, Detail = label). Duplicates = near-duplicate crops skipped.</summary>
public sealed record AnnotationImportResult(int Images, int Boxes, int Added, IReadOnlyList<string> CreatedTargets, IReadOnlyList<ImportFileResult> Failures,
    int Duplicates = 0);

/// <summary>
/// Annotated boxes to variants: every FrameStep-th image; a crop closer than MinHashDistance dHash bits to a kept crop of the same label
/// is skipped (0 = keep all); at most MaxPerLabel crops per label, sampled evenly (0 = no cap); boxes with a side below MinSide are skipped.
/// </summary>
public sealed record AnnotationVariantOptions(int FrameStep = 1, int MinHashDistance = 0, int MaxPerLabel = 0, int MinSide = 0);

public sealed partial class TaskSetStore
{
    /// <summary>Readability from the image header (no full decode); falls back to a decode when the header format is unknown.</summary>
    public static bool IsReadableImage(string path)
    {
        if (!File.Exists(path)) return false;
        if (ImageHeaderReader.ReadSize(path) is { Width: > 0, Height: > 0 }) return true;
        using var mat = TaskSetImageIo.ReadBgra(path);
        return mat != null;
    }

    /// <summary>
    /// Adds files (directories are expanded recursively) to one pool with a single save. Bad files are reported, not thrown;
    /// on cancel the files added so far are saved and the rest are reported as Cancelled.
    /// </summary>
    public IReadOnlyList<ImportFileResult> AddMany(TaskSet set, TaskTarget? target, TaskResourcePool pool, IEnumerable<string> paths,
        IProgress<WorkProgress>? progress = null, CancellationToken ct = default)
    {
        if (PoolNeedsTarget(pool) && target == null) throw new ArgumentNullException(nameof(target));
        var files = ExpandPaths(paths);
        var results = AddManyCore(set, files.Select(f => (target, pool, f)).ToList(), progress, ct);
        if (results.Any(r => r.Outcome == ImportOutcome.Added)) Save(set);
        return results;
    }

    /// <summary>
    /// Scans rootDir: each subfolder = target (its images recursively = variants, its scenes/ = scenes); root common/ = common resources,
    /// root distractors/ = distractors.
    /// </summary>
    public FolderTreePlan PlanFolderTree(TaskSet set, string rootDir)
    {
        var root = Path.GetFullPath(rootDir);
        if (!Directory.Exists(root)) throw new DirectoryNotFoundException(root);
        var targets = new List<FolderTreeTargetPlan>();
        var common = new List<string>();
        var distractors = new List<string>();
        var ignored = new List<string>();
        ignored.AddRange(SortedFiles(root, recursive: false));
        foreach (var dir in Directory.EnumerateDirectories(root).OrderBy(Path.GetFileName, StringComparer.Ordinal))
        {
            var name = Path.GetFileName(dir);
            if (YoloDataLayout.IsReservedName(name)) continue;
            if (name.Equals(CommonSubdir, StringComparison.OrdinalIgnoreCase))
            {
                foreach (var f in SortedFiles(dir, recursive: true))
                    (IsSupportedFor(TaskResourcePool.Common, f) ? common : ignored).Add(f);
                continue;
            }
            if (name.Equals(DistractorsSubdir, StringComparison.OrdinalIgnoreCase))
            {
                foreach (var f in SortedFiles(dir, recursive: true))
                    (IsSupportedFor(TaskResourcePool.Distractors, f) ? distractors : ignored).Add(f);
                continue;
            }
            var variants = new List<string>();
            var scenes = new List<string>();
            foreach (var f in SortedFiles(dir, recursive: true))
            {
                bool inScenes = IsUnderSubdir(dir, f, ScenesSubdir);
                (IsSupportedImage(f) ? inScenes ? scenes : variants : ignored).Add(f);
            }
            if (variants.Count == 0 && scenes.Count == 0) continue;
            bool exists = set.Targets.Any(t => t.Name.Trim().Equals(name.Trim(), StringComparison.OrdinalIgnoreCase));
            targets.Add(new FolderTreeTargetPlan(name.Trim(), dir, exists, variants, scenes));
        }
        return new FolderTreePlan(root, targets, common, ignored, distractors);
    }

    /// <summary>PlanFolderTree, then (unless dryRun) creates missing targets and imports every planned file with a single save.</summary>
    public FolderTreeImportResult ImportFolderTree(TaskSet set, string rootDir, bool dryRun, IProgress<WorkProgress>? progress = null, CancellationToken ct = default)
    {
        var plan = PlanFolderTree(set, rootDir);
        if (dryRun) return new FolderTreeImportResult(plan, true, plan.NewTargets, Array.Empty<ImportFileResult>());
        int created = 0;
        var jobs = new List<(TaskTarget?, TaskResourcePool, string)>();
        foreach (var t in plan.Targets)
        {
            var target = FindTargetByName(set, t.Name);
            if (target == null)
            {
                target = AddTargetCore(set, t.Name);
                created++;
            }
            jobs.AddRange(t.Variants.Select(f => ((TaskTarget?)target, TaskResourcePool.Variants, f)));
            jobs.AddRange(t.Scenes.Select(f => ((TaskTarget?)target, TaskResourcePool.Scenes, f)));
        }
        jobs.AddRange(plan.Common.Select(f => ((TaskTarget?)null, TaskResourcePool.Common, f)));
        jobs.AddRange(plan.Distractors.Select(f => ((TaskTarget?)null, TaskResourcePool.Distractors, f)));
        var results = AddManyCore(set, jobs, progress, ct);
        if (created > 0 || results.Any(r => r.Outcome == ImportOutcome.Added)) Save(set);
        return new FolderTreeImportResult(plan, false, created, results);
    }

    /// <summary>
    /// Copies targets (variants, scenes, augmentation override, images per target) from another task set; a target whose name
    /// exists in toSet is merged into (its own settings kept). Single save of toSet.
    /// </summary>
    public TargetCopyResult CopyTargets(TaskSet fromSet, IEnumerable<string> targetIds, TaskSet toSet)
    {
        if (fromSet.Id == toSet.Id) throw new ArgumentException("Source and destination task set are the same: " + toSet.Id, nameof(toSet));
        var fromDir = GetDir(fromSet.Id);
        var ids = targetIds.ToHashSet(StringComparer.Ordinal);
        var copied = new List<TaskTarget>();
        var files = new List<ImportFileResult>();
        int created = 0;
        foreach (var source in fromSet.Targets.Where(t => ids.Contains(t.Id)))
        {
            var dest = FindTargetByName(toSet, source.Name);
            if (dest == null)
            {
                dest = AddTargetCore(toSet, source.Name);
                dest.Augmentation = source.Augmentation == null ? null : CloneJson(source.Augmentation);
                dest.ImagesPerTarget = source.ImagesPerTarget;
                created++;
            }
            foreach (var (r, pool) in source.Variants.Select(r => (r, TaskResourcePool.Variants)).Concat(source.Scenes.Select(r => (r, TaskResourcePool.Scenes))))
            {
                var path = ResolveResourcePath(fromDir, r);
                files.Add(TryAdd(path, () =>
                {
                    var subdir = pool == TaskResourcePool.Variants ? VariantsSubdir : ScenesSubdir;
                    var stored = Store(toSet, r.Kind, Path.GetFileName(path), r.OriginalPath.Length > 0 ? r.OriginalPath : path,
                        p => File.Copy(path, p), TargetsSubdir, dest.Id, subdir);
                    var resource = CloneJson(r);
                    (resource.Id, resource.File, resource.OriginalPath) = (stored.Id, stored.File, stored.OriginalPath);
                    if (pool == TaskResourcePool.Variants)
                    {
                        resource.Label = NextVariantLabel(toSet, dest);
                        dest.Variants.Add(resource);
                    }
                    else
                    {
                        dest.Scenes.Add(resource);
                    }
                    return resource;
                }));
            }
            copied.Add(dest);
        }
        if (copied.Count > 0) Save(toSet);
        return new TargetCopyResult(copied, created, files);
    }

    /// <summary>
    /// Every annotated box (JSON or VOC, non-difficult) of the images in imagesDir becomes a variant of the target with the box label
    /// (created when missing); classFilter limits the labels (case-insensitive). Single save.
    /// </summary>
    public AnnotationImportResult AddVariantsFromAnnotations(TaskSet set, string imagesDir, string annotationDir, IReadOnlyCollection<string>? classFilter,
        VariantCutout cutout, VariantCutOptions? cutOptions = null, IProgress<WorkProgress>? progress = null, CancellationToken ct = default,
        AnnotationVariantOptions? variantOptions = null)
    {
        var o = variantOptions ?? new AnnotationVariantOptions();
        var filter = classFilter is { Count: > 0 } ? new HashSet<string>(classFilter.Select(c => c.Trim()), StringComparer.OrdinalIgnoreCase) : null;
        var all = AnnotationIo.ListImages(imagesDir);
        int step = Math.Max(1, o.FrameStep);
        var images = all.Where((_, i) => i % step == 0).ToList();
        var failures = new List<ImportFileResult>();
        var createdTargets = new List<string>();
        var crops = new Dictionary<string, List<(string Image, VariantRegion Region, byte[] Png, ulong? Hash, (int, int) Size)>>(StringComparer.OrdinalIgnoreCase);
        int boxes = 0, done = 0;
        foreach (var image in images)
        {
            ct.ThrowIfCancellationRequested();
            progress?.Report(new WorkProgress(done++, images.Count, image));
            var annotation = AnnotationIo.Load(image, annotationDir);
            var wanted = annotation?.Boxes.Where(b => !b.Difficult && b.Label.Trim().Length > 0 && (filter == null || filter.Contains(b.Label.Trim()))
                && Math.Min(b.Width, b.Height) >= o.MinSide).ToList();
            if (wanted == null || wanted.Count == 0) continue;
            using var frame = TaskSetImageIo.ReadBgra(image);
            if (frame == null)
            {
                failures.Add(new ImportFileResult(image, ImportOutcome.Failed, ImportFailure.Unreadable));
                continue;
            }
            foreach (var box in wanted)
            {
                boxes++;
                var label = box.Label.Trim();
                var rounded = box.RoundToPixels();
                var region = new VariantRegion((int)rounded.XMin, (int)rounded.YMin, (int)(rounded.XMax - rounded.XMin), (int)(rounded.YMax - rounded.YMin));
                var png = VariantExtractor.Cut(frame, region, cutout, cutOptions);
                if (png == null)
                {
                    failures.Add(new ImportFileResult(image, ImportOutcome.Failed, ImportFailure.Unreadable, Detail: label));
                    continue;
                }
                if (!crops.TryGetValue(label, out var list)) crops[label] = list = new();
                list.Add((image, region, png, o.MinHashDistance > 0 ? VariantExtractor.PerceptualHash(png) : null, (frame.Width, frame.Height)));
            }
        }
        int added = 0, duplicates = 0;
        foreach (var (label, list) in crops)
        {
            var kept = o.MinHashDistance > 0 && list.All(c => c.Hash != null)
                ? VariantExtractor.Dedupe(list.Select(c => c.Hash!.Value).ToList(), o.MinHashDistance).Select(i => list[i]).ToList()
                : list;
            duplicates += list.Count - kept.Count;
            if (o.MaxPerLabel > 0 && kept.Count > o.MaxPerLabel)
                kept = Enumerable.Range(0, o.MaxPerLabel).Select(i => kept[(int)((long)i * kept.Count / o.MaxPerLabel)]).ToList();
            var target = FindTargetByName(set, label);
            if (target == null)
            {
                target = AddTargetCore(set, label);
                createdTargets.Add(target.Name);
            }
            foreach (var c in kept)
            {
                AddVariantPngCore(set, target, c.Png, VariantExtractor.FormatSourceRef(c.Image, null, c.Region),
                    Path.GetFileNameWithoutExtension(c.Image) + "_" + label, c.Size);
                added++;
            }
        }
        progress?.Report(new WorkProgress(done, images.Count));
        if (added > 0 || createdTargets.Count > 0) Save(set);
        return new AnnotationImportResult(images.Count, boxes, added, createdTargets, failures, duplicates);
    }

    private List<ImportFileResult> AddManyCore(TaskSet set, IReadOnlyList<(TaskTarget? Target, TaskResourcePool Pool, string Path)> jobs,
        IProgress<WorkProgress>? progress, CancellationToken ct)
    {
        var results = new List<ImportFileResult>(jobs.Count);
        for (int i = 0; i < jobs.Count; i++)
        {
            var (target, pool, path) = jobs[i];
            if (ct.IsCancellationRequested)
            {
                results.Add(new ImportFileResult(path, ImportOutcome.Cancelled));
                continue;
            }
            progress?.Report(new WorkProgress(i, jobs.Count, path));
            if (!IsSupportedFor(pool, path))
            {
                results.Add(new ImportFileResult(path, ImportOutcome.Unsupported));
                continue;
            }
            if (!File.Exists(path))
            {
                results.Add(new ImportFileResult(path, ImportOutcome.Failed, ImportFailure.NotFound));
                continue;
            }
            bool readable = IsSupportedImage(path) ? IsReadableImage(path) : VariantExtractor.GetVideoInfo(path) != null;
            if (!readable)
            {
                results.Add(new ImportFileResult(path, ImportOutcome.Failed, ImportFailure.Unreadable));
                continue;
            }
            results.Add(TryAdd(path, () => AddCore(set, target, pool, path)));
        }
        progress?.Report(new WorkProgress(jobs.Count, jobs.Count));
        return results;
    }

    private static ImportFileResult TryAdd(string path, Func<TaskResource> add)
    {
        try
        {
            return new ImportFileResult(path, ImportOutcome.Added, Resource: add());
        }
        catch (Exception ex) when (ex is FileNotFoundException or DirectoryNotFoundException)
        {
            return new ImportFileResult(path, ImportOutcome.Failed, ImportFailure.NotFound, Detail: ex.Message);
        }
        catch (UnauthorizedAccessException ex)
        {
            return new ImportFileResult(path, ImportOutcome.Failed, ImportFailure.AccessDenied, Detail: ex.Message);
        }
        catch (IOException ex)
        {
            ColorPrinter.Yellow($"[YoloTaskSet] cannot import {path}: {ex.Message}");
            return new ImportFileResult(path, ImportOutcome.Failed, ImportFailure.IoError, Detail: ex.Message);
        }
    }

    private static TaskTarget? FindTargetByName(TaskSet set, string name) =>
        set.Targets.FirstOrDefault(t => t.Name.Trim().Equals(name.Trim(), StringComparison.OrdinalIgnoreCase));

    private static List<string> ExpandPaths(IEnumerable<string> paths)
    {
        var files = new List<string>();
        foreach (var p in paths)
        {
            if (string.IsNullOrWhiteSpace(p)) continue;
            var full = Path.GetFullPath(p);
            if (Directory.Exists(full)) files.AddRange(SortedFiles(full, recursive: true));
            else files.Add(full);
        }
        return files;
    }

    private static IEnumerable<string> SortedFiles(string dir, bool recursive)
    {
        try
        {
            return Directory.EnumerateFiles(dir, "*", recursive ? SearchOption.AllDirectories : SearchOption.TopDirectoryOnly)
                .Where(f => !YoloDataLayout.IsReservedName(Path.GetFileName(f)))
                .OrderBy(f => f, StringComparer.Ordinal).ToList();
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            ColorPrinter.Yellow($"[YoloTaskSet] cannot list {dir}: {ex.Message}");
            return Array.Empty<string>();
        }
    }

    private static bool IsUnderSubdir(string baseDir, string file, string subdir)
    {
        var rel = Path.GetRelativePath(baseDir, file);
        var first = rel.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)[0];
        return rel != first && first.Equals(subdir, StringComparison.OrdinalIgnoreCase);
    }
}
