// PY-REF: none (DOT-only)
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using DotCore.Foundations;
using DotCore.VocAnnotator;

namespace DotCore.YoloTaskSet;

/// <summary>One soft delete in {set}/_trash/{token}: either a whole target (TargetName set) or a list of resources.</summary>
public sealed record TrashInfo(string Token, DateTime CreatedUtc, string? TargetName, int Resources);

public sealed partial class TaskSetStore
{
    public const string TrashSubdir = YoloDataLayout.ReservedPrefix + "trash";
    public const string TrashManifestFileName = "trash.json";

    private const string TrashFilesSubdir = "files";
    private const string TrashStampFormat = "yyyyMMdd_HHmmss_fff";

    private sealed class TrashManifest
    {
        [JsonPropertyName("created_utc")] public DateTime CreatedUtc { get; set; }
        [JsonPropertyName("target")] public TaskTarget? Target { get; set; }
        [JsonPropertyName("target_index")] public int TargetIndex { get; set; }
        [JsonPropertyName("resources")] public List<TrashedResource> Resources { get; set; } = new();
    }

    private sealed class TrashedResource
    {
        [JsonPropertyName("resource")] public TaskResource Resource { get; set; } = new();
        [JsonPropertyName("pool")] public TaskResourcePool Pool { get; set; }
        [JsonPropertyName("target_id")] public string? TargetId { get; set; }
        [JsonPropertyName("index")] public int Index { get; set; }
        [JsonPropertyName("trash_file")] public string TrashFile { get; set; } = "";
    }

    public static string TrashDir(string taskSetDir) => Path.Combine(taskSetDir, TrashSubdir);

    /// <summary>Moves the target (entry and its folder) to the trash; returns the undo token, or null when the target does not exist.</summary>
    public string? RemoveTarget(TaskSet set, string targetId)
    {
        int index = set.Targets.FindIndex(t => t.Id == targetId);
        if (index < 0) return null;
        var target = set.Targets[index];
        var dir = GetDir(set.Id);
        var (token, trashDir) = NewTrashDir(dir);
        var manifest = new TrashManifest { CreatedUtc = DateTime.UtcNow, Target = target, TargetIndex = index };
        foreach (var r in target.Variants.Concat(target.Scenes)) DeleteDirQuietly(FrameCacheDir(dir, r.Id));
        var targetDir = Path.Combine(dir, TargetsSubdir, target.Id);
        if (Directory.Exists(targetDir))
        {
            var dest = Path.Combine(trashDir, TargetsSubdir, target.Id);
            Directory.CreateDirectory(Path.GetDirectoryName(dest)!);
            Directory.Move(targetDir, dest);
        }
        WriteTrashManifest(trashDir, manifest);
        set.Targets.RemoveAt(index);
        Save(set);
        return token;
    }

    /// <summary>Moves the resource to the trash; returns the undo token, or null when it is not in the set.</summary>
    public string? RemoveResource(TaskSet set, TaskResource resource) => RemoveResources(set, new[] { resource });

    /// <summary>Moves the resources to one trash entry with a single save; returns the undo token, or null when none was in the set.</summary>
    public string? RemoveResources(TaskSet set, IEnumerable<TaskResource> resources)
    {
        var dir = GetDir(set.Id);
        var located = new List<TrashedResource>();
        foreach (var resource in resources.Distinct())
            if (Locate(set, resource) is { } entry) located.Add(entry);
        if (located.Count == 0) return null;

        var (token, trashDir) = NewTrashDir(dir);
        var filesDir = Path.Combine(trashDir, TrashFilesSubdir);
        Directory.CreateDirectory(filesDir);
        foreach (var entry in located)
        {
            ListOf(set, entry.Pool, entry.TargetId)!.Remove(entry.Resource);
            DeleteDirQuietly(FrameCacheDir(dir, entry.Resource.Id));
            try
            {
                var path = ResolveResourcePath(dir, entry.Resource);
                if (!path.StartsWith(dir, StringComparison.OrdinalIgnoreCase) || !File.Exists(path)) continue;
                var name = UniqueFileName(filesDir, Path.GetFileName(path));
                File.Move(path, Path.Combine(filesDir, name));
                entry.TrashFile = TrashFilesSubdir + "/" + name;
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                ColorPrinter.Yellow($"[YoloTaskSet] cannot move {entry.Resource.File} to trash: {ex.Message}");
            }
        }
        WriteTrashManifest(trashDir, new TrashManifest { CreatedUtc = DateTime.UtcNow, Resources = located });
        Save(set);
        return token;
    }

    /// <summary>
    /// Puts a trash entry back (original positions, files moved back; renamed when the name is taken) and deletes the entry.
    /// False when the token is unknown or some resources could not be restored (their target no longer exists); those stay in the trash.
    /// </summary>
    public bool Restore(TaskSet set, string undoToken)
    {
        var dir = GetDir(set.Id);
        var trashDir = TrashEntryDir(dir, undoToken);
        var manifest = trashDir == null ? null : ReadTrashManifest(trashDir);
        if (trashDir == null || manifest == null) return false;

        if (manifest.Target is { } target)
        {
            if (set.Targets.Any(t => t.Id == target.Id)) return false;
            var source = Path.Combine(trashDir, TargetsSubdir, target.Id);
            var dest = Path.Combine(dir, TargetsSubdir, target.Id);
            if (Directory.Exists(source))
            {
                if (Directory.Exists(dest)) return false;
                Directory.CreateDirectory(Path.GetDirectoryName(dest)!);
                Directory.Move(source, dest);
            }
            set.Targets.Insert(Math.Clamp(manifest.TargetIndex, 0, set.Targets.Count), target);
        }

        var remaining = new List<TrashedResource>();
        foreach (var entry in manifest.Resources.OrderBy(e => e.Index))
        {
            var list = ListOf(set, entry.Pool, entry.TargetId);
            if (list == null)
            {
                remaining.Add(entry);
                continue;
            }
            var resource = entry.Resource;
            if (entry.TrashFile.Length > 0)
            {
                var from = Path.Combine(trashDir, entry.TrashFile.Replace('/', Path.DirectorySeparatorChar));
                var original = ResolveResourcePath(dir, resource);
                var originalDir = Path.GetDirectoryName(original)!;
                Directory.CreateDirectory(originalDir);
                var name = UniqueFileName(originalDir, Path.GetFileName(original));
                if (File.Exists(from)) File.Move(from, Path.Combine(originalDir, name));
                var rel = resource.File.Replace('\\', '/');
                int slash = rel.LastIndexOf('/');
                resource.File = (slash >= 0 ? rel[..(slash + 1)] : "") + name;
            }
            if (AllResources(set).Any(r => r.Id.Equals(resource.Id, StringComparison.OrdinalIgnoreCase)))
                resource.Id = NewUniqueId(id => AllResources(set).Any(r => r.Id.Equals(id, StringComparison.OrdinalIgnoreCase)));
            list.Insert(Math.Clamp(entry.Index, 0, list.Count), resource);
        }
        Save(set);
        if (remaining.Count == 0)
        {
            DeleteDirQuietly(trashDir);
            return true;
        }
        WriteTrashManifest(trashDir, new TrashManifest { CreatedUtc = manifest.CreatedUtc, Resources = remaining });
        return false;
    }

    /// <summary>Trash entries of the set, newest first.</summary>
    public IReadOnlyList<TrashInfo> ListTrash(TaskSet set)
    {
        var root = TrashDir(GetDir(set.Id));
        if (!Directory.Exists(root)) return Array.Empty<TrashInfo>();
        var list = new List<TrashInfo>();
        foreach (var entryDir in Directory.EnumerateDirectories(root).OrderByDescending(Path.GetFileName, StringComparer.Ordinal))
        {
            var manifest = ReadTrashManifest(entryDir);
            if (manifest == null) continue;
            list.Add(new TrashInfo(Path.GetFileName(entryDir), manifest.CreatedUtc, manifest.Target?.Name,
                manifest.Resources.Count + (manifest.Target == null ? 0 : manifest.Target.Variants.Count + manifest.Target.Scenes.Count)));
        }
        return list;
    }

    /// <summary>Permanently deletes all but the keepLatest newest trash entries; returns the number deleted.</summary>
    public int PurgeTrash(TaskSet set, int keepLatest = 0)
    {
        var root = TrashDir(GetDir(set.Id));
        if (!Directory.Exists(root)) return 0;
        int purged = 0;
        foreach (var entryDir in Directory.EnumerateDirectories(root).OrderByDescending(Path.GetFileName, StringComparer.Ordinal).Skip(Math.Max(0, keepLatest)))
        {
            DeleteDirQuietly(entryDir);
            if (!Directory.Exists(entryDir)) purged++;
        }
        return purged;
    }

    private static TrashedResource? Locate(TaskSet set, TaskResource resource)
    {
        int i = set.CommonResources.IndexOf(resource);
        if (i >= 0) return new TrashedResource { Resource = resource, Pool = TaskResourcePool.Common, Index = i };
        if ((i = set.Distractors.IndexOf(resource)) >= 0) return new TrashedResource { Resource = resource, Pool = TaskResourcePool.Distractors, Index = i };
        foreach (var t in set.Targets)
        {
            if ((i = t.Variants.IndexOf(resource)) >= 0) return new TrashedResource { Resource = resource, Pool = TaskResourcePool.Variants, TargetId = t.Id, Index = i };
            if ((i = t.Scenes.IndexOf(resource)) >= 0) return new TrashedResource { Resource = resource, Pool = TaskResourcePool.Scenes, TargetId = t.Id, Index = i };
        }
        return null;
    }

    private static List<TaskResource>? ListOf(TaskSet set, TaskResourcePool pool, string? targetId)
    {
        if (pool == TaskResourcePool.Common) return set.CommonResources;
        if (pool == TaskResourcePool.Distractors) return set.Distractors;
        var target = set.Targets.FirstOrDefault(t => t.Id == targetId);
        return target == null ? null : pool == TaskResourcePool.Variants ? target.Variants : target.Scenes;
    }

    private static (string Token, string Dir) NewTrashDir(string taskSetDir)
    {
        var root = TrashDir(taskSetDir);
        var stamp = DateTime.UtcNow.ToString(TrashStampFormat, CultureInfo.InvariantCulture) + "_";
        var token = stamp + NewUniqueId(id => Directory.Exists(Path.Combine(root, stamp + id)));
        var dir = Path.Combine(root, token);
        Directory.CreateDirectory(dir);
        return (token, dir);
    }

    private static string? TrashEntryDir(string taskSetDir, string token)
    {
        if (string.IsNullOrWhiteSpace(token) || token.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0 || token is "." or "..") return null;
        var dir = Path.Combine(TrashDir(taskSetDir), token);
        return Directory.Exists(dir) ? dir : null;
    }

    private static void WriteTrashManifest(string trashDir, TrashManifest manifest) =>
        File.WriteAllText(Path.Combine(trashDir, TrashManifestFileName), JsonSerializer.Serialize(manifest, JsonOptions));

    private static TrashManifest? ReadTrashManifest(string trashDir)
    {
        var path = Path.Combine(trashDir, TrashManifestFileName);
        try
        {
            return File.Exists(path) ? JsonSerializer.Deserialize<TrashManifest>(File.ReadAllText(path), JsonOptions) : null;
        }
        catch (Exception ex) when (ex is JsonException or IOException or UnauthorizedAccessException or NotSupportedException)
        {
            ColorPrinter.Yellow($"[YoloTaskSet] cannot read {path}: {ex.Message}");
            return null;
        }
    }
}
