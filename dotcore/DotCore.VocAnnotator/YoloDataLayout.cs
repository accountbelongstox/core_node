namespace DotCore.VocAnnotator;

/// <summary>
/// Canonical filesystem layout for recorded YOLO data: {root}/{client_type}/{project_name}/{segment_id}/(record|frames|images|labels).
/// Project subdirs starting with ReservedPrefix are not segments: _datasets (assembled train/val/test sets) and _runs (training runs).
/// 1:1 Python pycore/pyutils/voc_annotator/yolo_data_layout.py.
/// </summary>
public static class YoloDataLayout
{
    public const string RecordSubdir = "record";
    public const string FramesSubdir = "frames";
    public const string ImagesSubdir = "images";
    public const string LabelsSubdir = "labels";
    public const string ReservedPrefix = "_";
    public const string DatasetsSubdir = ReservedPrefix + "datasets";
    public const string RunsSubdir = ReservedPrefix + "runs";
    public const string RootEnvVar = "YOLO_DATA_ROOT";
    public const string DefaultRoot = @"D:\programing\yolo_data";

    private static string? _rootOverride;

    /// <summary>Absolute data root: override (app config) when set, else env YOLO_DATA_ROOT, else DefaultRoot.</summary>
    public static string Root
    {
        get
        {
            var root = !string.IsNullOrWhiteSpace(_rootOverride)
                ? _rootOverride
                : Environment.GetEnvironmentVariable(RootEnvVar);
            return Path.GetFullPath(string.IsNullOrWhiteSpace(root) ? DefaultRoot : root.Trim());
        }
    }

    /// <summary>Set or clear (null/empty) the root override.</summary>
    public static void SetRootOverride(string? root) => _rootOverride = string.IsNullOrWhiteSpace(root) ? null : root.Trim();

    public static string GetProjectPath(string clientType, string projectName) => RootJoin(clientType, projectName);

    public static string GetSegmentPath(string clientType, string projectName, string segmentId) => RootJoin(clientType, projectName, segmentId);

    public static string GetRecordDir(string clientType, string projectName, string segmentId) => Path.Combine(RootJoin(clientType, projectName, segmentId), RecordSubdir);

    /// <summary>True for project subdirs that are not segments (reserved prefix).</summary>
    public static bool IsReservedName(string? name) => !string.IsNullOrEmpty(name) && name.StartsWith(ReservedPrefix, StringComparison.Ordinal);

    public static string GetDatasetsDir(string projectPath) => Path.Combine(projectPath, DatasetsSubdir);

    public static string GetRunsDir(string projectPath) => Path.Combine(projectPath, RunsSubdir);

    /// <summary>Create record/, frames/, images/, labels/ under the segment. Returns segment path.</summary>
    public static string EnsureSegmentDirs3(string clientType, string projectName, string segmentId)
    {
        var segmentPath = RootJoin(clientType, projectName, segmentId);
        foreach (var sub in new[] { RecordSubdir, FramesSubdir, ImagesSubdir, LabelsSubdir })
            Directory.CreateDirectory(Path.Combine(segmentPath, sub));
        return segmentPath;
    }

    /// <summary>(client_type, project_name) when path is at least two levels under Root; else (null, null).</summary>
    public static (string? ClientType, string? ProjectName) ParseProjectPathToClientProject(string? projectPath)
    {
        if (string.IsNullOrWhiteSpace(projectPath)) return (null, null);
        var root = TrimSeparators(Root);
        var resolved = TrimSeparators(Path.GetFullPath(projectPath));
        if (!IsUnder(resolved, root)) return (null, null);
        var parts = Path.GetRelativePath(root, resolved)
            .Split(new[] { Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar }, StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length < 2 || parts[0] == ".") return (null, null);
        return (parts[0], parts[1]);
    }

    public static bool IsUnder(string path, string root)
    {
        var comparison = OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;
        var p = TrimSeparators(Path.GetFullPath(path));
        var r = TrimSeparators(Path.GetFullPath(root));
        return string.Equals(p, r, comparison) || p.StartsWith(r + Path.DirectorySeparatorChar, comparison);
    }

    public static string TrimSeparators(string path) => path.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);

    private static string RootJoin(params string[] parts)
    {
        var path = Root;
        foreach (var part in parts)
            path = Path.Combine(path, SafeComponent(part));
        return Path.GetFullPath(path);
    }

    private static string SafeComponent(string? value)
    {
        var component = (value ?? "").Trim();
        if (component.Length == 0 || component == "." || component == ".." || Path.GetFileName(component) != component)
            throw new ArgumentException("Invalid YOLO path component: " + value);
        return component;
    }
}
