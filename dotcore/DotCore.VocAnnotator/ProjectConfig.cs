using System.Text.Json;

namespace DotCore.VocAnnotator;

/// <summary>
/// Project-level annotator config: project_name, classes, class_colors. Saved at config_path; shared across segments.
/// Logic 1:1 with pycore pyutils voc_annotator project_config.
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
        public Dictionary<string, List<int>> ClassColors { get; set; } = new();
    }

    public static ProjectConfigData LoadProjectConfig(string? configPath)
    {
        var out_ = new ProjectConfigData();
        if (string.IsNullOrWhiteSpace(configPath) || !File.Exists(configPath))
            return out_;
        try
        {
            var json = File.ReadAllText(configPath);
            var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (root.TryGetProperty(ConfigKeyProjectName, out var nameEl))
                out_.ProjectName = nameEl.GetString() ?? "";
            if (root.TryGetProperty(ConfigKeyClasses, out var classesEl) && classesEl.ValueKind == JsonValueKind.Array)
            {
                out_.Classes = new List<string>();
                foreach (var e in classesEl.EnumerateArray())
                {
                    var s = e.GetString();
                    if (!string.IsNullOrEmpty(s)) out_.Classes.Add(s);
                }
            }
            if (root.TryGetProperty(ConfigKeyClassColors, out var colorsEl) && colorsEl.ValueKind == JsonValueKind.Object)
            {
                foreach (var prop in colorsEl.EnumerateObject())
                {
                    if (prop.Value.ValueKind == JsonValueKind.Array)
                    {
                        var list = new List<int>();
                        foreach (var e in prop.Value.EnumerateArray())
                            if (e.TryGetInt32(out var n)) list.Add(n);
                        if (list.Count >= 3)
                            out_.ClassColors[prop.Name] = list;
                    }
                }
            }
        }
        catch { /* ignore */ }
        return out_;
    }

    public static bool SaveProjectConfig(string? configPath, string projectName, IReadOnlyList<string> classes, IReadOnlyDictionary<string, IReadOnlyList<int>>? classColors = null)
    {
        if (string.IsNullOrWhiteSpace(configPath)) return false;
        try
        {
            var obj = PatchData.LoadConfig(configPath);
            obj[ConfigKeyProjectName] = projectName ?? "";
            obj[ConfigKeyClasses] = new System.Text.Json.Nodes.JsonArray(classes.Select(c => (System.Text.Json.Nodes.JsonNode?)c).ToArray());
            if (classColors != null)
            {
                var colors = new System.Text.Json.Nodes.JsonObject();
                foreach (var kv in classColors)
                    if (kv.Value.Count >= 3)
                        colors[kv.Key] = new System.Text.Json.Nodes.JsonArray(kv.Value.Select(v => (System.Text.Json.Nodes.JsonNode?)v).ToArray());
                obj[ConfigKeyClassColors] = colors;
            }
            PatchData.SaveConfig(configPath, obj);
            return true;
        }
        catch
        {
            return false;
        }
    }

    public static IReadOnlyList<string> GetClassesFromConfig(string? configPath)
    {
        return LoadProjectConfig(configPath).Classes;
    }

    /// <summary>Tries project_config.json then annotator_config.json under projectDir (Python compat). Returns classes from first found.</summary>
    public static IReadOnlyList<string> GetClassesFromProjectDir(string? projectDir)
    {
        if (string.IsNullOrWhiteSpace(projectDir) || !Directory.Exists(projectDir))
            return Array.Empty<string>();
        var configPath = GetProjectConfigPath(projectDir);
        var data = File.Exists(configPath) ? LoadProjectConfig(configPath) : new ProjectConfigData();
        return data.Classes.Count > 0 ? data.Classes : new List<string> { DefaultClassName };
    }

    /// <summary>Config file read by GetClassesFromProjectDir: project_config.json when present, else annotator_config.json.</summary>
    public static string GetProjectConfigPath(string projectDir)
    {
        var projectConfig = Path.Combine(projectDir, ProjectConfigFileName);
        return File.Exists(projectConfig) ? projectConfig : Path.Combine(projectDir, AnnotatorConfigFileName);
    }

    /// <summary>
    /// Appends className to the project's class list (persisted) when missing, so labels typed in the annotator reach
    /// training (VOC->YOLO drops boxes whose class is not listed). Returns the resulting class list.
    /// </summary>
    public static IReadOnlyList<string> EnsureClassInProjectDir(string? projectDir, string className)
    {
        var classes = GetClassesFromProjectDir(projectDir);
        var name = className?.Trim() ?? "";
        if (name.Length == 0 || string.IsNullOrWhiteSpace(projectDir) || classes.Contains(name, StringComparer.Ordinal))
            return classes;
        var configPath = GetProjectConfigPath(projectDir);
        var data = LoadProjectConfig(configPath);
        var projectName = data.ProjectName.Length > 0 ? data.ProjectName : Path.GetFileName(Path.TrimEndingDirectorySeparator(Path.GetFullPath(projectDir)));
        var updated = classes.Append(name).ToList();
        return SaveProjectConfig(configPath, projectName, updated) ? updated : classes;
    }
}
