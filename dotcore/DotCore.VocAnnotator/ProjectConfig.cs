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
            var dir = Path.GetDirectoryName(configPath);
            if (!string.IsNullOrEmpty(dir))
                Directory.CreateDirectory(dir);
            var obj = new Dictionary<string, object?>
            {
                [ConfigKeyProjectName] = projectName ?? "",
                [ConfigKeyClasses] = classes.ToList()
            };
            if (classColors != null)
            {
                var colors = new Dictionary<string, List<int>>();
                foreach (var kv in classColors)
                    if (kv.Value.Count >= 3)
                        colors[kv.Key] = kv.Value.ToList();
                obj[ConfigKeyClassColors] = colors;
            }
            var json = JsonSerializer.Serialize(obj, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(configPath, json);
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
        var p1 = Path.Combine(projectDir, "project_config.json");
        var p2 = Path.Combine(projectDir, "annotator_config.json");
        var data = File.Exists(p1) ? LoadProjectConfig(p1) : (File.Exists(p2) ? LoadProjectConfig(p2) : new ProjectConfigData());
        return data.Classes.Count > 0 ? data.Classes : new List<string> { "object" };
    }
}
