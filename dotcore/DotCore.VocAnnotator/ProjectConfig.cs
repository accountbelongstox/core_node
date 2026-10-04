using System.Text.Json.Nodes;

namespace DotCore.VocAnnotator;

/// <summary>
/// Project-level annotator config shared by every segment: project_name, ordered classes (index = YOLO class id) and class_colors.
/// Stored in project_config.json when present, else annotator_config.json (other keys such as patch_sources are preserved).
/// Logic 1:1 with pycore pyutils voc_annotator project_config; class rename/remove additionally rewrite the project's annotations.
/// </summary>
public static class ProjectConfig
{
    public const string ConfigKeyProjectName = "project_name";
    public const string ConfigKeyClasses = "classes";
    public const string ConfigKeyClassColors = "class_colors";
    public const string AnnotatorConfigFileName = "annotator_config.json";
    public const string ProjectConfigFileName = "project_config.json";
    public const string DefaultClassName = "object";

    public sealed class ProjectConfigData
    {
        public string ProjectName { get; set; } = "";
        public List<string> Classes { get; set; } = new();
        public Dictionary<string, List<int>> ClassColors { get; set; } = new(StringComparer.Ordinal);
    }

    /// <summary>Config file of a project dir: project_config.json when present, else annotator_config.json.</summary>
    public static string GetProjectConfigPath(string projectDir)
    {
        var projectConfig = Path.Combine(projectDir, ProjectConfigFileName);
        return File.Exists(projectConfig) ? projectConfig : Path.Combine(projectDir, AnnotatorConfigFileName);
    }

    public static ProjectConfigData LoadProjectConfig(string? configPath)
    {
        var data = new ProjectConfigData();
        var root = PatchData.LoadConfig(configPath);
        data.ProjectName = Str(root[ConfigKeyProjectName]);
        if (root[ConfigKeyClasses] is JsonArray classes)
            data.Classes = classes.Select(Str).Where(c => c.Length > 0).Distinct(StringComparer.Ordinal).ToList();
        if (root[ConfigKeyClassColors] is JsonObject colors)
        {
            foreach (var (name, value) in colors)
            {
                if (value is not JsonArray rgb) continue;
                var list = rgb.Select(n => n is JsonValue v && v.TryGetValue<int>(out var i) ? i : -1).Where(i => i >= 0).ToList();
                if (list.Count >= 3) data.ClassColors[name] = list.Take(3).ToList();
            }
        }
        return data;
    }

    /// <summary>Write project_name, classes and class_colors (when given) into configPath, keeping other keys.</summary>
    public static bool SaveProjectConfig(string? configPath, string projectName, IReadOnlyList<string> classes, IReadOnlyDictionary<string, List<int>>? classColors = null)
    {
        if (string.IsNullOrWhiteSpace(configPath)) return false;
        try
        {
            var root = PatchData.LoadConfig(configPath);
            root[ConfigKeyProjectName] = projectName ?? "";
            root[ConfigKeyClasses] = new JsonArray(classes.Select(c => (JsonNode?)c).ToArray());
            if (classColors != null)
            {
                var colors = new JsonObject();
                foreach (var (name, rgb) in classColors.Where(kv => classes.Contains(kv.Key, StringComparer.Ordinal) && kv.Value.Count >= 3))
                    colors[name] = new JsonArray(rgb.Take(3).Select(v => (JsonNode?)v).ToArray());
                root[ConfigKeyClassColors] = colors;
            }
            PatchData.SaveConfig(configPath, root);
            return true;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            return false;
        }
    }

    /// <summary>Project config of a dir; classes fall back to [DefaultClassName], project name to the dir name.</summary>
    public static ProjectConfigData LoadFromProjectDir(string? projectDir)
    {
        if (string.IsNullOrWhiteSpace(projectDir) || !Directory.Exists(projectDir))
            return new ProjectConfigData { Classes = new List<string> { DefaultClassName } };
        var data = LoadProjectConfig(GetProjectConfigPath(projectDir));
        if (data.Classes.Count == 0) data.Classes.Add(DefaultClassName);
        if (data.ProjectName.Length == 0) data.ProjectName = DirName(projectDir);
        return data;
    }

    public static bool SaveToProjectDir(string projectDir, ProjectConfigData data) =>
        Directory.Exists(projectDir) && SaveProjectConfig(GetProjectConfigPath(projectDir), data.ProjectName, data.Classes, data.ClassColors);

    public static IReadOnlyList<string> GetClassesFromConfig(string? configPath) => LoadProjectConfig(configPath).Classes;

    /// <summary>Ordered classes of a project dir ([DefaultClassName] when none); empty when the dir does not exist.</summary>
    public static IReadOnlyList<string> GetClassesFromProjectDir(string? projectDir) =>
        string.IsNullOrWhiteSpace(projectDir) || !Directory.Exists(projectDir) ? Array.Empty<string>() : LoadFromProjectDir(projectDir).Classes;

    /// <summary>Appends className when missing (persisted) so labels typed while annotating reach training. Returns the class list.</summary>
    public static IReadOnlyList<string> EnsureClassInProjectDir(string? projectDir, string className)
    {
        var name = className?.Trim() ?? "";
        var data = LoadFromProjectDir(projectDir);
        if (name.Length == 0 || string.IsNullOrWhiteSpace(projectDir) || !Directory.Exists(projectDir) || data.Classes.Contains(name, StringComparer.Ordinal))
            return data.Classes;
        data.Classes.Add(name);
        return SaveToProjectDir(projectDir, data) ? data.Classes : LoadFromProjectDir(projectDir).Classes;
    }

    /// <summary>Rename a class in the config and in every annotation under the project. Returns boxes relabeled, or -1 when invalid.</summary>
    public static int RenameClass(string projectDir, string oldName, string newName)
    {
        newName = newName.Trim();
        var data = LoadFromProjectDir(projectDir);
        int idx = data.Classes.IndexOf(oldName);
        if (idx < 0 || newName.Length == 0 || data.Classes.Contains(newName, StringComparer.Ordinal)) return -1;
        data.Classes[idx] = newName;
        if (data.ClassColors.Remove(oldName, out var color)) data.ClassColors[newName] = color;
        if (!SaveToProjectDir(projectDir, data)) return -1;
        return AnnotationIo.ReplaceLabel(projectDir, oldName, newName, recursive: true);
    }

    /// <summary>Remove a class from the config and its boxes from every annotation under the project. Returns boxes removed, or -1.</summary>
    public static int RemoveClass(string projectDir, string name)
    {
        var data = LoadFromProjectDir(projectDir);
        if (!data.Classes.Remove(name)) return -1;
        if (data.Classes.Count == 0) data.Classes.Add(DefaultClassName);
        data.ClassColors.Remove(name);
        if (!SaveToProjectDir(projectDir, data)) return -1;
        return AnnotationIo.ReplaceLabel(projectDir, name, null, recursive: true);
    }

    private static string Str(JsonNode? node) => node is JsonValue v && v.TryGetValue<string>(out var s) ? s.Trim() : "";

    private static string DirName(string dir) => Path.GetFileName(Path.TrimEndingDirectorySeparator(Path.GetFullPath(dir)));
}
