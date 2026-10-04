// PY-REF: none (DOT-only)
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using DotCore.Foundations;
using DotCore.VocAnnotator;

namespace DotCore.YoloTaskSet;

/// <summary>
/// Task sets on disk: {root}/{id}/taskset.json plus imported resources (YOLO_TASKSET_SYNTHESIS_DESIGN.md §3).
/// Every mutating method saves taskset.json.
/// </summary>
public sealed class TaskSetStore
{
    public const string TaskSetFileName = "taskset.json";
    public const string TaskSetsSubdir = YoloDataLayout.ReservedPrefix + "tasksets";
    public const string TargetsSubdir = "targets";
    public const string VariantsSubdir = "variants";
    public const string ScenesSubdir = "scenes";
    public const string CommonSubdir = "common";
    public const string CacheSubdir = YoloDataLayout.ReservedPrefix + "cache";
    public const string FramesSubdir = "frames";
    public const string DatasetsSubdir = YoloDataLayout.DatasetsSubdir;
    public const string RunsSubdir = YoloDataLayout.RunsSubdir;

    private const int IdLength = 8;
    private const string TempSuffix = ".tmp";
    private const string PngExtension = ".png";

    // OpenCV 4.10 (OpenCvSharp4.Windows) has no GIF decoder.
    public static readonly IReadOnlySet<string> ImageExtensions =
        new HashSet<string>(AnnotationIo.ImageExtensions.Where(e => !e.Equals(".gif", StringComparison.OrdinalIgnoreCase)), StringComparer.OrdinalIgnoreCase);

    public static readonly IReadOnlySet<string> VideoExtensions =
        new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".mp4", ".avi", ".mkv", ".mov", ".wmv", ".webm", ".m4v", ".flv", ".mpg", ".mpeg" };

    internal static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) },
    };

    public TaskSetStore(string rootDir)
    {
        RootDir = Path.GetFullPath(rootDir);
    }

    public static string DefaultRoot => Path.Combine(YoloDataLayout.Root, TaskSetsSubdir);

    public string RootDir { get; }

    public static bool IsSupportedImage(string path) => ImageExtensions.Contains(Path.GetExtension(path));

    public static bool IsSupportedVideo(string path) => VideoExtensions.Contains(Path.GetExtension(path));

    /// <summary>Absolute path of a resource inside a task set dir.</summary>
    public static string ResolveResourcePath(string taskSetDir, TaskResource resource) =>
        Path.GetFullPath(Path.Combine(taskSetDir, resource.File.Replace('/', Path.DirectorySeparatorChar)));

    /// <summary>Extracted-frame cache dir of a video resource.</summary>
    public static string FrameCacheDir(string taskSetDir, string resourceId) => Path.Combine(taskSetDir, CacheSubdir, FramesSubdir, resourceId);

    public IReadOnlyList<TaskSet> List()
    {
        if (!Directory.Exists(RootDir)) return Array.Empty<TaskSet>();
        var sets = new List<TaskSet>();
        foreach (var dir in Directory.EnumerateDirectories(RootDir))
        {
            var id = Path.GetFileName(dir);
            if (!File.Exists(Path.Combine(dir, TaskSetFileName))) continue;
            var set = Load(id);
            if (set != null) sets.Add(set);
        }
        return sets.OrderBy(s => s.Name, StringComparer.CurrentCultureIgnoreCase).ThenBy(s => s.Id, StringComparer.Ordinal).ToList();
    }

    public TaskSet? Load(string id)
    {
        var path = Path.Combine(GetDir(id), TaskSetFileName);
        if (!File.Exists(path)) return null;
        TaskSet? set;
        try
        {
            set = JsonSerializer.Deserialize<TaskSet>(File.ReadAllText(path), JsonOptions);
        }
        catch (Exception ex) when (ex is JsonException or IOException or UnauthorizedAccessException or NotSupportedException)
        {
            ColorPrinter.Yellow($"[YoloTaskSet] cannot read {path}: {ex.Message}");
            return null;
        }
        if (set == null) return null;
        set.Id = id;
        Normalize(set);
        return set;
    }

    public TaskSet Create(string name)
    {
        Directory.CreateDirectory(RootDir);
        var now = DateTime.UtcNow;
        var set = new TaskSet
        {
            Id = NewUniqueId(id => Directory.Exists(Path.Combine(RootDir, id))),
            Name = name.Trim(),
            CreatedUtc = now,
            UpdatedUtc = now,
        };
        Save(set);
        return set;
    }

    public void Save(TaskSet set)
    {
        Normalize(set);
        set.UpdatedUtc = DateTime.UtcNow;
        if (set.CreatedUtc == default) set.CreatedUtc = set.UpdatedUtc;
        var dir = GetDir(set.Id);
        Directory.CreateDirectory(dir);
        var path = Path.Combine(dir, TaskSetFileName);
        var tmp = path + TempSuffix;
        File.WriteAllText(tmp, JsonSerializer.Serialize(set, JsonOptions));
        File.Move(tmp, path, overwrite: true);
    }

    public void Delete(string id)
    {
        var dir = GetDir(id);
        if (Directory.Exists(dir)) Directory.Delete(dir, recursive: true);
    }

    /// <summary>Copies the task set with its resources; caches, generated datasets and runs are not copied.</summary>
    public TaskSet Duplicate(string id, string newName)
    {
        var source = Load(id) ?? throw new DirectoryNotFoundException("Task set not found: " + id);
        var newId = NewUniqueId(x => Directory.Exists(Path.Combine(RootDir, x)));
        var sourceDir = GetDir(id);
        var targetDir = GetDir(newId);
        CopyDirectory(sourceDir, targetDir, skipReservedTopLevel: true);
        var copy = JsonSerializer.Deserialize<TaskSet>(JsonSerializer.Serialize(source, JsonOptions), JsonOptions)!;
        copy.Id = newId;
        copy.Name = newName.Trim();
        copy.CreatedUtc = DateTime.UtcNow;
        Save(copy);
        return copy;
    }

    public string GetDir(string id)
    {
        if (string.IsNullOrWhiteSpace(id) || id.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0 || id is "." or "..")
            throw new ArgumentException("Invalid task set id: " + id, nameof(id));
        return Path.Combine(RootDir, id);
    }

    public string ResourcePath(TaskSet set, TaskResource resource) => ResolveResourcePath(GetDir(set.Id), resource);

    public TaskTarget AddTarget(TaskSet set, string name)
    {
        var target = new TaskTarget
        {
            Id = NewUniqueId(id => set.Targets.Any(t => t.Id.Equals(id, StringComparison.OrdinalIgnoreCase))),
            Name = name.Trim(),
        };
        set.Targets.Add(target);
        Save(set);
        return target;
    }

    public void RemoveTarget(TaskSet set, string targetId)
    {
        var target = set.Targets.FirstOrDefault(t => t.Id == targetId);
        if (target == null) return;
        set.Targets.Remove(target);
        Save(set);
        DeleteDirQuietly(Path.Combine(GetDir(set.Id), TargetsSubdir, target.Id));
    }

    public void MoveTarget(TaskSet set, string targetId, int delta)
    {
        int index = set.Targets.FindIndex(t => t.Id == targetId);
        if (index < 0 || delta == 0) return;
        int newIndex = Math.Clamp(index + delta, 0, set.Targets.Count - 1);
        if (newIndex == index) return;
        var target = set.Targets[index];
        set.Targets.RemoveAt(index);
        set.Targets.Insert(newIndex, target);
        Save(set);
    }

    public TaskResource AddVariant(TaskSet set, TaskTarget target, string sourcePath)
    {
        RequireImage(sourcePath);
        var resource = Import(set, sourcePath, TaskResourceKind.Image, TargetsSubdir, target.Id, VariantsSubdir);
        resource.Label = NextVariantLabel(set, target);
        target.Variants.Add(resource);
        Save(set);
        return resource;
    }

    /// <summary>Stores an extracted variant (VariantExtractor.Cut output) as PNG; originalPath records its source, e.g. "clip.mp4#frame=120@x,y,w,h".</summary>
    public TaskResource AddVariantFromPng(TaskSet set, TaskTarget target, byte[] png, string originalPath, string nameHint)
    {
        if (png == null || png.Length == 0) throw new ArgumentException("Empty PNG", nameof(png));
        var stem = SanitizeFileName(string.IsNullOrWhiteSpace(nameHint) ? VariantsSubdir : nameHint);
        if (IsSupportedImage(stem) || IsSupportedVideo(stem)) stem = Path.GetFileNameWithoutExtension(stem);
        var resource = Store(set, TaskResourceKind.Image, stem + PngExtension, originalPath ?? "",
            path => File.WriteAllBytes(path, png), TargetsSubdir, target.Id, VariantsSubdir);
        resource.Label = NextVariantLabel(set, target);
        target.Variants.Add(resource);
        Save(set);
        return resource;
    }

    public TaskResource AddScene(TaskSet set, TaskTarget target, string sourcePath)
    {
        RequireImage(sourcePath);
        var resource = Import(set, sourcePath, TaskResourceKind.Image, TargetsSubdir, target.Id, ScenesSubdir);
        target.Scenes.Add(resource);
        Save(set);
        return resource;
    }

    public TaskResource AddCommon(TaskSet set, string sourcePath)
    {
        TaskResourceKind kind = IsSupportedImage(sourcePath) ? TaskResourceKind.Image
            : IsSupportedVideo(sourcePath) ? TaskResourceKind.Video
            : throw new ArgumentException("Unsupported resource type: " + sourcePath, nameof(sourcePath));
        var resource = Import(set, sourcePath, kind, CommonSubdir);
        set.CommonResources.Add(resource);
        Save(set);
        return resource;
    }

    public void RemoveResource(TaskSet set, TaskResource resource)
    {
        bool removed = set.CommonResources.Remove(resource);
        foreach (var target in set.Targets)
            removed |= target.Variants.Remove(resource) | target.Scenes.Remove(resource);
        if (!removed) return;
        Save(set);
        var dir = GetDir(set.Id);
        try
        {
            var path = ResolveResourcePath(dir, resource);
            if (path.StartsWith(dir, StringComparison.OrdinalIgnoreCase) && File.Exists(path)) File.Delete(path);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            ColorPrinter.Yellow($"[YoloTaskSet] cannot delete {resource.File}: {ex.Message}");
        }
        DeleteDirQuietly(FrameCacheDir(dir, resource.Id));
    }

    private TaskResource Import(TaskSet set, string sourcePath, TaskResourceKind kind, params string[] relativeDir)
    {
        var source = Path.GetFullPath(sourcePath);
        if (!File.Exists(source)) throw new FileNotFoundException("Resource not found", source);
        return Store(set, kind, Path.GetFileName(source), source, path => File.Copy(source, path), relativeDir);
    }

    private TaskResource Store(TaskSet set, TaskResourceKind kind, string fileName, string originalPath, Action<string> write, params string[] relativeDir)
    {
        var absDir = Path.Combine(GetDir(set.Id), Path.Combine(relativeDir));
        Directory.CreateDirectory(absDir);
        var unique = UniqueFileName(absDir, SanitizeFileName(fileName));
        write(Path.Combine(absDir, unique));
        return new TaskResource
        {
            Id = NewUniqueId(id => AllResources(set).Any(r => r.Id.Equals(id, StringComparison.OrdinalIgnoreCase))),
            Kind = kind,
            File = string.Join("/", relativeDir) + "/" + unique,
            OriginalPath = originalPath,
        };
    }

    private static string NextVariantLabel(TaskSet set, TaskTarget target)
    {
        var prefix = (set.Targets.IndexOf(target) + 1).ToString(System.Globalization.CultureInfo.InvariantCulture) + ".";
        int max = target.Variants.Count;
        foreach (var v in target.Variants)
            if (v.Label.StartsWith(prefix, StringComparison.Ordinal) && int.TryParse(v.Label.AsSpan(prefix.Length), out var n))
                max = Math.Max(max, n);
        return prefix + (max + 1).ToString(System.Globalization.CultureInfo.InvariantCulture);
    }

    private static void RequireImage(string path)
    {
        if (!IsSupportedImage(path)) throw new ArgumentException("Unsupported image type: " + path, nameof(path));
    }

    internal static IEnumerable<TaskResource> AllResources(TaskSet set) =>
        set.CommonResources.Concat(set.Targets.SelectMany(t => t.Variants.Concat(t.Scenes)));

    private static void Normalize(TaskSet set)
    {
        set.Name ??= "";
        set.Description ??= "";
        set.Targets ??= new List<TaskTarget>();
        set.Targets.RemoveAll(t => t == null);
        set.CommonResources ??= new List<TaskResource>();
        set.CommonResources.RemoveAll(r => r == null);
        set.Augmentation ??= new AugmentationProfile();
        set.Synthesis ??= new SynthesisSettings();
        set.Synthesis.ScaleMode ??= SynthesisSettings.ScaleModeNative;
        foreach (var t in set.Targets)
        {
            t.Id ??= "";
            t.Name ??= "";
            t.Variants ??= new List<TaskResource>();
            t.Variants.RemoveAll(r => r == null);
            t.Scenes ??= new List<TaskResource>();
            t.Scenes.RemoveAll(r => r == null);
            if (t.Augmentation is { IsEmpty: true }) t.Augmentation = null;
        }
        foreach (var r in AllResources(set))
        {
            r.Id ??= "";
            r.File ??= "";
            r.OriginalPath ??= "";
            r.Label ??= "";
        }
    }

    private static string NewUniqueId(Func<string, bool> exists)
    {
        string id;
        do id = Guid.NewGuid().ToString("N")[..IdLength];
        while (exists(id));
        return id;
    }

    private static string SanitizeFileName(string name)
    {
        var invalid = Path.GetInvalidFileNameChars();
        var chars = name.Trim().Select(c => invalid.Contains(c) || char.IsWhiteSpace(c) ? '_' : c).ToArray();
        var result = new string(chars).Trim('.');
        return string.IsNullOrEmpty(Path.GetFileNameWithoutExtension(result)) ? "file" + Path.GetExtension(result) : result;
    }

    private static string UniqueFileName(string dir, string fileName)
    {
        var stem = Path.GetFileNameWithoutExtension(fileName);
        var ext = Path.GetExtension(fileName);
        var candidate = fileName;
        for (int i = 2; File.Exists(Path.Combine(dir, candidate)); i++) candidate = stem + "_" + i + ext;
        return candidate;
    }

    private static void CopyDirectory(string sourceDir, string targetDir, bool skipReservedTopLevel)
    {
        Directory.CreateDirectory(targetDir);
        foreach (var file in Directory.EnumerateFiles(sourceDir))
            File.Copy(file, Path.Combine(targetDir, Path.GetFileName(file)));
        foreach (var dir in Directory.EnumerateDirectories(sourceDir))
        {
            var name = Path.GetFileName(dir);
            if (skipReservedTopLevel && YoloDataLayout.IsReservedName(name)) continue;
            CopyDirectory(dir, Path.Combine(targetDir, name), skipReservedTopLevel: false);
        }
    }

    private static void DeleteDirQuietly(string dir)
    {
        try
        {
            if (Directory.Exists(dir)) Directory.Delete(dir, recursive: true);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            ColorPrinter.Yellow($"[YoloTaskSet] cannot delete {dir}: {ex.Message}");
        }
    }
}
