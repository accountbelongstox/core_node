using System.Text.Json;
using System.Text.Json.Nodes;

namespace DotCore.VocAnnotator;

/// <summary>
/// Patch-image source management stored in annotator_config.json ("patch_sources": [{base_dir, items: [{file, name}]}]).
/// 1:1 Python pycore/pyutils/voc_annotator/patch_data.py.
/// </summary>
public static class PatchData
{
    public const string KeyPatchSources = "patch_sources";
    public const string KeyBaseDir = "base_dir";
    public const string KeyItems = "items";
    public const string KeyFile = "file";
    public const string KeyName = "name";

    public static readonly IReadOnlySet<string> ImageExtensions =
        new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".bmp", ".jpeg", ".jpg", ".png", ".webp" };

    /// <summary>(file name, stem) for each image file in directory, sorted by path.</summary>
    public static List<(string File, string Name)> LoadPatchDir(string? directory)
    {
        if (string.IsNullOrWhiteSpace(directory) || !Directory.Exists(directory))
            return new List<(string, string)>();
        return Directory.EnumerateFiles(directory)
            .OrderBy(p => p, StringComparer.Ordinal)
            .Where(p => ImageExtensions.Contains(Path.GetExtension(p)))
            .Select(p => (Path.GetFileName(p), Path.GetFileNameWithoutExtension(p)))
            .ToList();
    }

    /// <summary>Append a source (replacing one with the same base_dir) and save.</summary>
    public static void AddPatchSource(string configPath, string baseDir, IEnumerable<(string File, string Name)> items)
    {
        var data = LoadConfig(configPath);
        var sources = data[KeyPatchSources] as JsonArray ?? new JsonArray();
        var baseDirAbs = Path.GetFullPath(baseDir);
        var itemsArr = new JsonArray();
        foreach (var (file, name) in items)
        {
            if (string.IsNullOrWhiteSpace(file)) continue;
            itemsArr.Add(new JsonObject { [KeyFile] = file, [KeyName] = name });
        }
        var kept = new JsonArray();
        foreach (var entry in sources)
        {
            if (entry is JsonObject obj && (obj[KeyBaseDir]?.GetValue<string>() ?? "") != baseDirAbs)
                kept.Add(obj.DeepClone());
        }
        kept.Add(new JsonObject { [KeyBaseDir] = baseDirAbs, [KeyItems] = itemsArr });
        data[KeyPatchSources] = kept;
        SaveConfig(configPath, data);
    }

    /// <summary>Last source: (base_dir, items).</summary>
    public static (string BaseDir, List<(string File, string Name)> Items) LoadPatchData(string configPath)
    {
        if (LoadConfig(configPath)[KeyPatchSources] is not JsonArray sources || sources.Count == 0)
            return ("", new List<(string, string)>());
        var source = sources[^1] as JsonObject;
        return (source?[KeyBaseDir]?.GetValue<string>() ?? "", SourceItems(source));
    }

    /// <summary>All sources flattened: (base_dir, file, name).</summary>
    public static List<(string BaseDir, string File, string Name)> GetPatchItemsFlat(string configPath)
    {
        var result = new List<(string, string, string)>();
        if (LoadConfig(configPath)[KeyPatchSources] is not JsonArray sources)
            return result;
        foreach (var entry in sources)
        {
            if (entry is not JsonObject source) continue;
            var baseDir = source[KeyBaseDir]?.GetValue<string>() ?? "";
            result.AddRange(SourceItems(source).Select(i => (baseDir, i.File, i.Name)));
        }
        return result;
    }

    private static List<(string File, string Name)> SourceItems(JsonObject? source)
    {
        var result = new List<(string, string)>();
        if (source?[KeyItems] is not JsonArray items) return result;
        foreach (var item in items)
        {
            if (item is not JsonObject obj) continue;
            var file = obj[KeyFile]?.GetValue<string>();
            if (string.IsNullOrEmpty(file)) continue;
            var name = obj[KeyName]?.GetValue<string>();
            result.Add((file, string.IsNullOrEmpty(name) ? Path.GetFileNameWithoutExtension(file) : name));
        }
        return result;
    }

    internal static JsonObject LoadConfig(string? configPath)
    {
        if (string.IsNullOrWhiteSpace(configPath) || !File.Exists(configPath))
            return new JsonObject();
        try
        {
            return JsonNode.Parse(File.ReadAllText(configPath)) as JsonObject ?? new JsonObject();
        }
        catch (Exception ex) when (ex is IOException or JsonException)
        {
            DotCore.Foundations.ColorPrinter.Yellow($"[VocAnnotator] Failed to read config: path={configPath} error={ex.Message}");
            return new JsonObject();
        }
    }

    internal static void SaveConfig(string configPath, JsonObject data)
    {
        var dir = Path.GetDirectoryName(configPath);
        if (!string.IsNullOrEmpty(dir))
            Directory.CreateDirectory(dir);
        var json = data.ToJsonString(new JsonSerializerOptions
        {
            WriteIndented = true,
            Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
        }) + "\n";
        var tmp = configPath + ".tmp";
        File.WriteAllText(tmp, json);
        File.Move(tmp, configPath, true);
    }
}
