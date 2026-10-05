using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using DotCore.Common;

namespace DotCore.VocAnnotator;

/// <summary>User settings of the annotator (persisted in voc_annotator_config.json; keys shared with the Python twin keep their names).</summary>
public sealed class AnnotatorSettings
{
    public const string SortByName = "name";
    public const string SortByModified = "modified";
    public const string FilterAll = "all";
    public const string FilterLabeled = "labeled";
    public const string FilterUnlabeled = "unlabeled";
    public const string FilterUnreviewed = "unreviewed";
    public const string AutoLabelMerge = "merge";
    public const string AutoLabelReplace = "replace";
    public const string AutoLabelEmptyOnly = "empty_only";
    public const int MinZoomPercent = 5;
    public const int MaxZoomPercent = 3200;

    public static readonly IReadOnlyList<string> SortModes = new[] { SortByName, SortByModified };
    public static readonly IReadOnlyList<string> FilterModes = new[] { FilterAll, FilterLabeled, FilterUnlabeled, FilterUnreviewed };
    public static readonly IReadOnlyList<string> AutoLabelModes = new[] { AutoLabelMerge, AutoLabelReplace, AutoLabelEmptyOnly };

    [JsonPropertyName("zoom_percent")] public int ZoomPercent { get; set; }
    [JsonPropertyName("last_images_dir")] public string LastImagesDir { get; set; } = "";
    [JsonPropertyName("last_save_dir")] public string LastSaveDir { get; set; } = "";
    [JsonPropertyName("auto_save")] public bool AutoSave { get; set; }
    [JsonPropertyName("write_voc_xml")] public bool WriteVocXml { get; set; }
    [JsonPropertyName("write_yolo_txt")] public bool WriteYoloTxt { get; set; }
    [JsonPropertyName("show_labels")] public bool ShowLabels { get; set; }
    [JsonPropertyName("show_crosshair")] public bool ShowCrosshair { get; set; }
    [JsonPropertyName("fill_opacity")] public double FillOpacity { get; set; }
    [JsonPropertyName("line_width")] public double LineWidth { get; set; }
    [JsonPropertyName("min_box_size")] public int MinBoxSize { get; set; }
    [JsonPropertyName("image_sort")] public string ImageSort { get; set; } = SortByName;
    [JsonPropertyName("image_filter")] public string ImageFilter { get; set; } = FilterAll;
    [JsonPropertyName("fit_on_open")] public bool FitOnOpen { get; set; }
    [JsonPropertyName("copy_previous_when_empty")] public bool CopyPreviousWhenEmpty { get; set; }
    [JsonPropertyName("auto_label_model_path")] public string AutoLabelModelPath { get; set; } = "";
    [JsonPropertyName("auto_label_confidence")] public double AutoLabelConfidence { get; set; }
    [JsonPropertyName("auto_label_iou")] public double AutoLabelIou { get; set; }
    [JsonPropertyName("auto_label_mode")] public string AutoLabelMode { get; set; } = AutoLabelMerge;
    [JsonPropertyName("auto_label_add_classes")] public bool AutoLabelAddClasses { get; set; }
    [JsonPropertyName("auto_label_on_open")] public bool AutoLabelOnOpen { get; set; }

    public AnnotatorSettings Clone() => (AnnotatorSettings)MemberwiseClone();

    /// <summary>Clamp numeric values and replace unknown enum strings by their first allowed value.</summary>
    public AnnotatorSettings Normalized()
    {
        var s = Clone();
        s.ZoomPercent = Math.Clamp(s.ZoomPercent, MinZoomPercent, MaxZoomPercent);
        s.FillOpacity = Math.Clamp(s.FillOpacity, 0, 1);
        s.LineWidth = Math.Clamp(s.LineWidth, 0.5, 10);
        s.MinBoxSize = Math.Clamp(s.MinBoxSize, 1, 256);
        s.AutoLabelConfidence = Math.Clamp(s.AutoLabelConfidence, 0.01, 1);
        s.AutoLabelIou = Math.Clamp(s.AutoLabelIou, 0.01, 1);
        s.ImageSort = SortModes.Contains(s.ImageSort) ? s.ImageSort : SortModes[0];
        s.ImageFilter = FilterModes.Contains(s.ImageFilter) ? s.ImageFilter : FilterModes[0];
        s.AutoLabelMode = AutoLabelModes.Contains(s.AutoLabelMode) ? s.AutoLabelMode : AutoLabelModes[0];
        return s;
    }
}

/// <summary>
/// voc_annotator_config.json under the user config dir: defaults from the embedded voc_annotator_default_config.json are merged
/// for missing keys on every load; unknown keys are kept on save. Logic 1:1 with pycore pyutils voc_annotator config (same file and keys).
/// </summary>
public static class VocAnnotatorConfig
{
    public const string ConfigFileName = "voc_annotator_config.json";
    public const string ConfigDirEnvVar = "CORE_NODE_CONFIG_DIR";
    private const string DefaultConfigResourceName = "DotCore.VocAnnotator.voc_annotator_default_config.json";

    private static readonly object Lock = new();
    private static readonly JsonSerializerOptions WriteOptions = new()
    {
        WriteIndented = true,
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    public static string ConfigPath => Path.Combine(GetConfigDir(), ConfigFileName);

    public static AnnotatorSettings Load()
    {
        lock (Lock)
        {
            var defaults = LoadDefaults();
            var root = defaults.DeepClone().AsObject();
            foreach (var (key, value) in ReadFile())
                root[key] = value?.DeepClone();
            try
            {
                return (root.Deserialize<AnnotatorSettings>() ?? new AnnotatorSettings()).Normalized();
            }
            catch (JsonException)
            {
                return (defaults.Deserialize<AnnotatorSettings>() ?? new AnnotatorSettings()).Normalized();
            }
        }
    }

    public static void Save(AnnotatorSettings settings)
    {
        lock (Lock)
        {
            var root = ReadFile();
            if (JsonSerializer.SerializeToNode(settings.Normalized()) is JsonObject values)
                foreach (var (key, value) in values)
                    root[key] = value?.DeepClone();
            try
            {
                Directory.CreateDirectory(GetConfigDir());
                File.WriteAllText(ConfigPath, root.ToJsonString(WriteOptions));
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                DotCore.Foundations.ColorPrinter.Yellow($"[VocAnnotator] Failed to save settings: {ex.Message}");
            }
        }
    }

    /// <summary>Last images dir when it still exists.</summary>
    public static string? GetLastImagesDir() => ExistingDir(Load().LastImagesDir);

    /// <summary>Last annotation (save) dir when it still exists.</summary>
    public static string? GetLastSaveDir() => ExistingDir(Load().LastSaveDir);

    private static string? ExistingDir(string? dir) => !string.IsNullOrWhiteSpace(dir) && Directory.Exists(dir) ? Path.GetFullPath(dir) : null;

    private static JsonObject LoadDefaults()
    {
        using var stream = typeof(VocAnnotatorConfig).Assembly.GetManifestResourceStream(DefaultConfigResourceName)
            ?? throw new InvalidOperationException(DefaultConfigResourceName);
        return JsonNode.Parse(stream) as JsonObject ?? new JsonObject();
    }

    private static JsonObject ReadFile()
    {
        try
        {
            return File.Exists(ConfigPath) && JsonNode.Parse(File.ReadAllText(ConfigPath)) is JsonObject obj ? obj : new JsonObject();
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException)
        {
            return new JsonObject();
        }
    }

    private static string GetConfigDir()
    {
        var env = Environment.GetEnvironmentVariable(ConfigDirEnvVar);
        if (!string.IsNullOrWhiteSpace(env) && Directory.Exists(env))
            return Path.GetFullPath(env);
        return AppPaths.GetUserDataDirectory(null);
    }
}
