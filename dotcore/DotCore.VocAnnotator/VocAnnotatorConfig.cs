using System.Text.Json;
using DotCore.Common;

namespace DotCore.VocAnnotator;

/// <summary>
/// VOC Annotator config: zoom percent and last-used paths. Persisted to JSON under user config dir.
/// Logic 1:1 with pycore pyutils voc_annotator config.
/// </summary>
public static class VocAnnotatorConfig
{
    public const string ConfigFileName = "voc_annotator_config.json";
    public const int DefaultZoomPercent = 100;
    public const int MinZoomPercent = 25;
    public const int MaxZoomPercent = 400;
    public const int ZoomStepPercent = 25;

    private static string GetConfigDir()
    {
        var env = Environment.GetEnvironmentVariable("CORE_NODE_CONFIG_DIR");
        if (!string.IsNullOrWhiteSpace(env) && Directory.Exists(env))
            return Path.GetFullPath(env);
        var dir = AppPaths.GetUserDataDirectory(null);
        if (!Directory.Exists(dir))
        {
            try { Directory.CreateDirectory(dir); }
            catch { /* ignore */ }
        }
        return dir;
    }

    private static string GetConfigPath() => Path.Combine(GetConfigDir(), ConfigFileName);

    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };

    public static Dictionary<string, object?> LoadConfig()
    {
        var path = GetConfigPath();
        if (string.IsNullOrEmpty(path) || !File.Exists(path))
            return new Dictionary<string, object?>();
        try
        {
            var json = File.ReadAllText(path);
            var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            var dict = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
            foreach (var prop in root.EnumerateObject())
            {
                dict[prop.Name] = prop.Value.ValueKind switch
                {
                    JsonValueKind.Number => prop.Value.TryGetInt32(out var i) ? i : prop.Value.GetDouble(),
                    JsonValueKind.String => prop.Value.GetString(),
                    JsonValueKind.True => true,
                    JsonValueKind.False => false,
                    _ => prop.Value.GetRawText()
                };
            }
            return dict;
        }
        catch
        {
            return new Dictionary<string, object?>();
        }
    }

    public static void SaveConfig(Dictionary<string, object?> config)
    {
        var path = GetConfigPath();
        try
        {
            var dir = Path.GetDirectoryName(path);
            if (!string.IsNullOrEmpty(dir))
                Directory.CreateDirectory(dir);
            var json = JsonSerializer.Serialize(config, JsonOptions);
            File.WriteAllText(path, json);
        }
        catch { /* ignore */ }
    }

    public static int GetZoomPercent()
    {
        var cfg = LoadConfig();
        if (cfg.TryGetValue("zoom_percent", out var v) && v != null)
        {
            if (v is int p)
                return Math.Clamp(p, MinZoomPercent, MaxZoomPercent);
            if (v is long l)
                return Math.Clamp((int)l, MinZoomPercent, MaxZoomPercent);
        }
        return DefaultZoomPercent;
    }

    public static void SetZoomPercent(int percent)
    {
        percent = Math.Clamp(percent, MinZoomPercent, MaxZoomPercent);
        var cfg = LoadConfig();
        cfg["zoom_percent"] = percent;
        SaveConfig(cfg);
    }

    public static string? GetLastImagesDir()
    {
        var cfg = LoadConfig();
        if (cfg.TryGetValue("last_images_dir", out var v) && v is string p && !string.IsNullOrWhiteSpace(p) && Directory.Exists(p))
            return Path.GetFullPath(p);
        return null;
    }

    public static void SetLastImagesDir(string path)
    {
        if (string.IsNullOrWhiteSpace(path) || !Directory.Exists(path)) return;
        var cfg = LoadConfig();
        cfg["last_images_dir"] = Path.GetFullPath(path);
        SaveConfig(cfg);
    }

    public static string? GetLastSaveDir()
    {
        var cfg = LoadConfig();
        if (cfg.TryGetValue("last_save_dir", out var v) && v is string p && !string.IsNullOrWhiteSpace(p) && Directory.Exists(p))
            return Path.GetFullPath(p);
        return null;
    }

    public static void SetLastSaveDir(string path)
    {
        if (string.IsNullOrWhiteSpace(path) || !Directory.Exists(path)) return;
        var cfg = LoadConfig();
        cfg["last_save_dir"] = Path.GetFullPath(path);
        SaveConfig(cfg);
    }
}
