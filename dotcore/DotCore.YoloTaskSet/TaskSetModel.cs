// PY-REF: none (DOT-only)
using System.Text.Json.Serialization;

namespace DotCore.YoloTaskSet;

/// <summary>Serialized as "image" / "video" (TaskSetStore uses a camelCase JsonStringEnumConverter).</summary>
public enum TaskResourceKind
{
    Image,
    Video,
}

/// <summary>A file imported into the task set (path relative to the task set dir).</summary>
public sealed class TaskResource
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("kind")] public TaskResourceKind Kind { get; set; }
    [JsonPropertyName("file")] public string File { get; set; } = "";
    [JsonPropertyName("original_path")] public string OriginalPath { get; set; } = "";

    /// <summary>Display label such as "1.1" for variants.</summary>
    [JsonPropertyName("label")] public string Label { get; set; } = "";
}

/// <summary>Per-object augmentation (task-set global). See YOLO_TASKSET_SYNTHESIS_DESIGN.md §4.</summary>
public sealed class AugmentationProfile
{
    [JsonPropertyName("scale_min")] public double ScaleMin { get; set; } = 0.7;
    [JsonPropertyName("scale_max")] public double ScaleMax { get; set; } = 1.3;
    [JsonPropertyName("stretch_min")] public double StretchMin { get; set; } = 0.9;
    [JsonPropertyName("stretch_max")] public double StretchMax { get; set; } = 1.1;
    [JsonPropertyName("rotation_max_degrees")] public double RotationMaxDegrees { get; set; } = 8;
    [JsonPropertyName("left_stretch_max")] public double LeftStretchMax { get; set; } = 0.15;
    [JsonPropertyName("right_stretch_max")] public double RightStretchMax { get; set; }
    [JsonPropertyName("flip_horizontal")] public bool FlipHorizontal { get; set; }
    [JsonPropertyName("brightness_max")] public double BrightnessMax { get; set; } = 0.15;
    [JsonPropertyName("contrast_max")] public double ContrastMax { get; set; } = 0.15;
    [JsonPropertyName("blur_probability")] public double BlurProbability { get; set; } = 0.15;
    [JsonPropertyName("blur_max_kernel")] public int BlurMaxKernel { get; set; } = 3;
    [JsonPropertyName("edge_feather")] public double EdgeFeather { get; set; } = 1.0;

    public AugmentationProfile Clone() => (AugmentationProfile)MemberwiseClone();

    /// <summary>Global values with every non-null override field applied.</summary>
    public AugmentationProfile Resolve(AugmentationOverride? o)
    {
        var p = Clone();
        if (o == null) return p.Normalized();
        p.ScaleMin = o.ScaleMin ?? p.ScaleMin;
        p.ScaleMax = o.ScaleMax ?? p.ScaleMax;
        p.StretchMin = o.StretchMin ?? p.StretchMin;
        p.StretchMax = o.StretchMax ?? p.StretchMax;
        p.RotationMaxDegrees = o.RotationMaxDegrees ?? p.RotationMaxDegrees;
        p.LeftStretchMax = o.LeftStretchMax ?? p.LeftStretchMax;
        p.RightStretchMax = o.RightStretchMax ?? p.RightStretchMax;
        p.FlipHorizontal = o.FlipHorizontal ?? p.FlipHorizontal;
        p.BrightnessMax = o.BrightnessMax ?? p.BrightnessMax;
        p.ContrastMax = o.ContrastMax ?? p.ContrastMax;
        p.BlurProbability = o.BlurProbability ?? p.BlurProbability;
        p.BlurMaxKernel = o.BlurMaxKernel ?? p.BlurMaxKernel;
        p.EdgeFeather = o.EdgeFeather ?? p.EdgeFeather;
        return p.Normalized();
    }

    /// <summary>Ranges ordered and clamped to sane bounds.</summary>
    public AugmentationProfile Normalized()
    {
        var p = Clone();
        p.ScaleMin = Math.Clamp(p.ScaleMin, 0.05, 20);
        p.ScaleMax = Math.Clamp(Math.Max(p.ScaleMax, p.ScaleMin), 0.05, 20);
        p.StretchMin = Math.Clamp(p.StretchMin, 0.2, 5);
        p.StretchMax = Math.Clamp(Math.Max(p.StretchMax, p.StretchMin), 0.2, 5);
        p.RotationMaxDegrees = Math.Clamp(p.RotationMaxDegrees, 0, 180);
        p.LeftStretchMax = Math.Clamp(p.LeftStretchMax, 0, 2);
        p.RightStretchMax = Math.Clamp(p.RightStretchMax, 0, 2);
        p.BrightnessMax = Math.Clamp(p.BrightnessMax, 0, 1);
        p.ContrastMax = Math.Clamp(p.ContrastMax, 0, 1);
        p.BlurProbability = Math.Clamp(p.BlurProbability, 0, 1);
        p.BlurMaxKernel = Math.Clamp(p.BlurMaxKernel | 1, 1, 31);
        p.EdgeFeather = Math.Clamp(p.EdgeFeather, 0, 20);
        return p;
    }
}

/// <summary>Per-target augmentation override; a null field inherits the task-set global value.</summary>
public sealed class AugmentationOverride
{
    [JsonPropertyName("scale_min")] public double? ScaleMin { get; set; }
    [JsonPropertyName("scale_max")] public double? ScaleMax { get; set; }
    [JsonPropertyName("stretch_min")] public double? StretchMin { get; set; }
    [JsonPropertyName("stretch_max")] public double? StretchMax { get; set; }
    [JsonPropertyName("rotation_max_degrees")] public double? RotationMaxDegrees { get; set; }
    [JsonPropertyName("left_stretch_max")] public double? LeftStretchMax { get; set; }
    [JsonPropertyName("right_stretch_max")] public double? RightStretchMax { get; set; }
    [JsonPropertyName("flip_horizontal")] public bool? FlipHorizontal { get; set; }
    [JsonPropertyName("brightness_max")] public double? BrightnessMax { get; set; }
    [JsonPropertyName("contrast_max")] public double? ContrastMax { get; set; }
    [JsonPropertyName("blur_probability")] public double? BlurProbability { get; set; }
    [JsonPropertyName("blur_max_kernel")] public int? BlurMaxKernel { get; set; }
    [JsonPropertyName("edge_feather")] public double? EdgeFeather { get; set; }

    [JsonIgnore]
    public bool IsEmpty =>
        ScaleMin == null && ScaleMax == null && StretchMin == null && StretchMax == null && RotationMaxDegrees == null
        && LeftStretchMax == null && RightStretchMax == null && FlipHorizontal == null && BrightnessMax == null
        && ContrastMax == null && BlurProbability == null && BlurMaxKernel == null && EdgeFeather == null;
}

/// <summary>Dataset synthesis settings of a task set. See YOLO_TASKSET_SYNTHESIS_DESIGN.md §4.</summary>
public sealed class SynthesisSettings
{
    public const string ScaleModeNative = "native";
    public const string ScaleModeRelative = "relative";
    public static readonly IReadOnlyList<string> ScaleModes = new[] { ScaleModeNative, ScaleModeRelative };

    [JsonPropertyName("images_per_target")] public int ImagesPerTarget { get; set; } = 200;
    [JsonPropertyName("val_percent")] public int ValPercent { get; set; } = 20;
    [JsonPropertyName("seed")] public int Seed { get; set; } = 42;
    [JsonPropertyName("min_objects_per_image")] public int MinObjectsPerImage { get; set; } = 1;
    [JsonPropertyName("max_objects_per_image")] public int MaxObjectsPerImage { get; set; } = 3;
    [JsonPropertyName("cross_target_probability")] public double CrossTargetProbability { get; set; } = 0.3;
    [JsonPropertyName("negative_percent")] public int NegativePercent { get; set; } = 8;
    [JsonPropertyName("max_overlap_iou")] public double MaxOverlapIou { get; set; } = 0.3;
    [JsonPropertyName("min_visible_fraction")] public double MinVisibleFraction { get; set; } = 0.75;
    [JsonPropertyName("scale_mode")] public string ScaleMode { get; set; } = ScaleModeNative;
    [JsonPropertyName("relative_min")] public double RelativeMin { get; set; } = 0.05;
    [JsonPropertyName("relative_max")] public double RelativeMax { get; set; } = 0.25;
    [JsonPropertyName("output_max_side")] public int OutputMaxSide { get; set; } = 1280;
    [JsonPropertyName("jpeg_quality")] public int JpegQuality { get; set; } = 92;
    [JsonPropertyName("video_frame_interval")] public int VideoFrameInterval { get; set; } = 30;
    [JsonPropertyName("video_max_frames")] public int VideoMaxFrames { get; set; } = 300;

    public SynthesisSettings Clone() => (SynthesisSettings)MemberwiseClone();

    public SynthesisSettings Normalized()
    {
        var s = Clone();
        s.ImagesPerTarget = Math.Clamp(s.ImagesPerTarget, 1, 100_000);
        s.ValPercent = Math.Clamp(s.ValPercent, 1, 90);
        s.MinObjectsPerImage = Math.Clamp(s.MinObjectsPerImage, 1, 50);
        s.MaxObjectsPerImage = Math.Clamp(Math.Max(s.MaxObjectsPerImage, s.MinObjectsPerImage), 1, 50);
        s.CrossTargetProbability = Math.Clamp(s.CrossTargetProbability, 0, 1);
        s.NegativePercent = Math.Clamp(s.NegativePercent, 0, 90);
        s.MaxOverlapIou = Math.Clamp(s.MaxOverlapIou, 0, 1);
        s.MinVisibleFraction = Math.Clamp(s.MinVisibleFraction, 0.1, 1);
        s.ScaleMode = ScaleModes.Contains(s.ScaleMode) ? s.ScaleMode : ScaleModeNative;
        s.RelativeMin = Math.Clamp(s.RelativeMin, 0.005, 1);
        s.RelativeMax = Math.Clamp(Math.Max(s.RelativeMax, s.RelativeMin), 0.005, 1);
        s.OutputMaxSide = Math.Clamp(s.OutputMaxSide, 64, 8192);
        s.JpegQuality = Math.Clamp(s.JpegQuality, 30, 100);
        s.VideoFrameInterval = Math.Clamp(s.VideoFrameInterval, 1, 100_000);
        s.VideoMaxFrames = Math.Clamp(s.VideoMaxFrames, 1, 100_000);
        return s;
    }
}

/// <summary>One detection class of a task set ("1", "2", ...): variants ("1.1", "1.2", ...), own scenes, optional overrides.</summary>
public sealed class TaskTarget
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("name")] public string Name { get; set; } = "";
    [JsonPropertyName("variants")] public List<TaskResource> Variants { get; set; } = new();
    [JsonPropertyName("scenes")] public List<TaskResource> Scenes { get; set; } = new();
    [JsonPropertyName("augmentation")] public AugmentationOverride? Augmentation { get; set; }
    [JsonPropertyName("images_per_target")] public int? ImagesPerTarget { get; set; }
}

/// <summary>Task set (任务集): targets, common resources, global augmentation and synthesis settings.</summary>
public sealed class TaskSet
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("name")] public string Name { get; set; } = "";
    [JsonPropertyName("description")] public string Description { get; set; } = "";
    [JsonPropertyName("created_utc")] public DateTime CreatedUtc { get; set; }
    [JsonPropertyName("updated_utc")] public DateTime UpdatedUtc { get; set; }
    [JsonPropertyName("targets")] public List<TaskTarget> Targets { get; set; } = new();
    [JsonPropertyName("common_resources")] public List<TaskResource> CommonResources { get; set; } = new();
    [JsonPropertyName("augmentation")] public AugmentationProfile Augmentation { get; set; } = new();
    [JsonPropertyName("synthesis")] public SynthesisSettings Synthesis { get; set; } = new();

    /// <summary>YOLO class names (target order = class id).</summary>
    [JsonIgnore]
    public IReadOnlyList<string> ClassNames => Targets.Select(t => t.Name).ToList();
}

public enum TaskSetIssueCode
{
    NoTargets,
    EmptyTargetName,
    DuplicateTargetName,
    NoVariants,
    NoBackgrounds,
    UnreadableResource,
    NoCommonResources,
    FewBackgrounds,
    SingleBackgroundShared,
}

/// <summary>Validation finding; Subject is the target name or resource file. Errors block generation.</summary>
public sealed record TaskSetIssue(TaskSetIssueCode Code, string Subject, bool IsError);

public sealed record SynthesisProgress(int Done, int Total);

public sealed record SynthesisResult(
    string DatasetDir,
    string DataYamlPath,
    IReadOnlyList<string> Classes,
    int TrainImages,
    int ValImages,
    int NegativeImages,
    IReadOnlyDictionary<string, int> Instances,
    IReadOnlyList<TaskSetIssue> Warnings);

public sealed record PreviewBox(string Label, double XMin, double YMin, double XMax, double YMax);

/// <summary>One rendered synthetic sample (PNG bytes) with its label boxes.</summary>
public sealed record PreviewResult(byte[] Png, IReadOnlyList<PreviewBox> Boxes);
