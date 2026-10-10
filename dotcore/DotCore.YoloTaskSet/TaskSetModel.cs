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

    /// <summary>Display scale (DPI factor) the resource was captured at: 1.0 = 100 %, 1.5 = 150 %. Variants and backgrounds.</summary>
    [JsonPropertyName("pixel_scale")] public double PixelScale { get; set; } = 1.0;

    /// <summary>Variants only: used for val images only (variants without the flag then serve train only).</summary>
    [JsonPropertyName("val_only")] public bool ValOnly { get; set; }

    /// <summary>Backgrounds only: placement regions in the resource's native pixels (e.g. the taskbar band).</summary>
    [JsonPropertyName("regions")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<PlacementRegion>? Regions { get; set; }

    /// <summary>
    /// Backgrounds: objects already present in the resource (a class name = real positive label, else masked out).
    /// Variants: labeled parts in variant pixels (compound variant, e.g. an NPC window with its panel, tabs and buttons); when set,
    /// these are the variant's labels instead of its tight mask box, and it is pasted without rotation or one-sided stretch.
    /// </summary>
    [JsonPropertyName("boxes")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<ResourceBox>? Boxes { get; set; }

    /// <summary>Variants only: size of the image / video frame the variant was cut from (0 = unknown); source-relative sizing and placement.</summary>
    [JsonPropertyName("source_width")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public int SourceWidth { get; set; }

    [JsonPropertyName("source_height")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public int SourceHeight { get; set; }

    [JsonIgnore]
    public double EffectivePixelScale => PixelScale > 0 && double.IsFinite(PixelScale) ? Math.Clamp(PixelScale, 0.1, 10) : 1.0;

    [JsonIgnore]
    public bool HasSourceSize => SourceWidth > 0 && SourceHeight > 0;

    /// <summary>Variant with labeled parts (see Boxes).</summary>
    [JsonIgnore]
    public bool IsCompound => Boxes is { Count: > 0 };
}

/// <summary>
/// Recorded segment shared with the task set in place ({segment}/frames + their JSON / VOC annotations, nothing copied).
/// Annotated frames serve as backgrounds whose boxes are real positives (difficult boxes masked out) and / or are written
/// as real labeled images; both uses split by the same frame blocks so a block never feeds train and val.
/// </summary>
public sealed class SegmentSource
{
    /// <summary>Absolute, or relative to the YOLO data root.</summary>
    [JsonPropertyName("segment_dir")] public string SegmentDir { get; set; } = "";

    [JsonPropertyName("backgrounds")] public bool Backgrounds { get; set; } = true;

    [JsonPropertyName("real_images")] public bool RealImages { get; set; } = true;

    /// <summary>Every n-th annotated frame is used (consecutive recorded frames are near duplicates).</summary>
    [JsonPropertyName("frame_step")] public int FrameStep { get; set; } = 1;

    [JsonIgnore] public int EffectiveFrameStep => Math.Clamp(FrameStep, 1, 1000);
}

/// <summary>Where the objects of a target are pasted.</summary>
public static class TargetPlacement
{
    /// <summary>Random position (default).</summary>
    public const string Anywhere = "anywhere";

    /// <summary>The position the variant was cut from, scaled to the background (fixed UI panels, buttons, text areas).</summary>
    public const string Source = "source";

    public static readonly IReadOnlyList<string> All = new[] { Anywhere, Source };
}

/// <summary>Axis-aligned rectangle in a resource's native pixels.</summary>
public class PixelRect
{
    [JsonPropertyName("x")] public int X { get; set; }
    [JsonPropertyName("y")] public int Y { get; set; }
    [JsonPropertyName("width")] public int Width { get; set; }
    [JsonPropertyName("height")] public int Height { get; set; }

    [JsonIgnore] public bool IsEmpty => Width <= 0 || Height <= 0;

    /// <summary>Intersection with (0, 0, width, height); null when empty.</summary>
    public PixelRect? ClampTo(int width, int height)
    {
        int x0 = Math.Clamp(X, 0, width), y0 = Math.Clamp(Y, 0, height);
        int x1 = Math.Clamp(X + Width, 0, width), y1 = Math.Clamp(Y + Height, 0, height);
        return x1 > x0 && y1 > y0 ? new PixelRect { X = x0, Y = y0, Width = x1 - x0, Height = y1 - y0 } : null;
    }
}

/// <summary>Placement region of a background; snap pitch &gt; 0 aligns object positions to a slot grid starting at the region origin.</summary>
public sealed class PlacementRegion : PixelRect
{
    [JsonPropertyName("snap_pitch_x")] public int SnapPitchX { get; set; }
    [JsonPropertyName("snap_pitch_y")] public int SnapPitchY { get; set; }
}

/// <summary>Object already present in a background resource (video: applies to every frame).</summary>
public sealed class ResourceBox : PixelRect
{
    /// <summary>Target name (YOLO class) for a real positive; ignored when Mask is true.</summary>
    [JsonPropertyName("label")] public string Label { get; set; } = "";

    /// <summary>True: the region is inpainted away instead of labeled.</summary>
    [JsonPropertyName("mask")] public bool Mask { get; set; }
}

/// <summary>Real annotated images (JSON shapes or VOC XML) written as the held-out evaluation split.</summary>
public sealed class HoldoutSource
{
    /// <summary>Absolute, or relative to the task set dir.</summary>
    [JsonPropertyName("images_dir")] public string ImagesDir { get; set; } = "";

    /// <summary>Empty = same as ImagesDir.</summary>
    [JsonPropertyName("annotation_dir")] public string AnnotationDir { get; set; } = "";
}

/// <summary>Where the model is expected to look at inference time (YOLO_TASKSET_SYNTHESIS_DESIGN.md §11).</summary>
public sealed class InferenceRoiHint
{
    public const string AnchorBottom = "bottom";
    public const string AnchorTop = "top";
    public const string AnchorLeft = "left";
    public const string AnchorRight = "right";
    public const string AnchorRect = "rect";
    public static readonly IReadOnlyList<string> Anchors = new[] { AnchorBottom, AnchorTop, AnchorLeft, AnchorRight, AnchorRect };

    /// <summary>Band along a screen edge ("bottom" + BandPixels 48 = the taskbar) or a fixed "rect".</summary>
    [JsonPropertyName("anchor")] public string Anchor { get; set; } = AnchorBottom;
    [JsonPropertyName("band_pixels")] public int BandPixels { get; set; } = 48;
    [JsonPropertyName("rect")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public PixelRect? Rect { get; set; }

    /// <summary>ROI in a frame of the given size, or null when the hint does not intersect it.</summary>
    public PixelRect? Resolve(int width, int height)
    {
        int band = Math.Max(1, BandPixels);
        var r = Anchor switch
        {
            AnchorTop => new PixelRect { X = 0, Y = 0, Width = width, Height = band },
            AnchorLeft => new PixelRect { X = 0, Y = 0, Width = band, Height = height },
            AnchorRight => new PixelRect { X = width - band, Y = 0, Width = band, Height = height },
            AnchorRect => Rect,
            _ => new PixelRect { X = 0, Y = height - band, Width = width, Height = band },
        };
        return r?.ClampTo(width, height);
    }
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
    public const string OutputFormatPng = "png";
    public const string OutputFormatJpg = "jpg";
    public static readonly IReadOnlyList<string> OutputFormats = new[] { OutputFormatPng, OutputFormatJpg };
    public const string HoldoutSplitVal = "val";
    public const string HoldoutSplitTest = "test";
    public static readonly IReadOnlyList<string> HoldoutSplits = new[] { HoldoutSplitVal, HoldoutSplitTest };
    public const string RelativeSizingRange = "range";
    public const string RelativeSizingSource = "source";
    public static readonly IReadOnlyList<string> RelativeSizings = new[] { RelativeSizingRange, RelativeSizingSource };

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

    /// <summary>Native mode: output window cut from the full-resolution background (smaller backgrounds are used whole).</summary>
    [JsonPropertyName("native_window_width")] public int NativeWindowWidth { get; set; } = 640;
    [JsonPropertyName("native_window_height")] public int NativeWindowHeight { get; set; } = 640;

    /// <summary>
    /// Native mode with DPI modelling: object size = background pixel_scale / variant pixel_scale × step × U(1 ± scale_jitter),
    /// replacing the profile scale range. Empty = profile scale range × the pixel-scale ratio.
    /// </summary>
    [JsonPropertyName("dpi_steps")] public List<double> DpiSteps { get; set; } = new();
    [JsonPropertyName("scale_jitter")] public double ScaleJitter { get; set; } = 0.05;

    [JsonPropertyName("in_region_probability")] public double InRegionProbability { get; set; } = 0.8;
    [JsonPropertyName("distractor_probability")] public double DistractorProbability { get; set; } = 0.3;
    [JsonPropertyName("max_distractors_per_image")] public int MaxDistractorsPerImage { get; set; } = 2;

    [JsonPropertyName("output_format")] public string OutputFormat { get; set; } = OutputFormatPng;

    /// <summary>JPEG output: quality drawn from [jpeg_quality_min, jpeg_quality]; null = fixed jpeg_quality.</summary>
    [JsonPropertyName("jpeg_quality_min")] public int? JpegQualityMin { get; set; }

    /// <summary>Larger images are skipped with ResourceTooLarge.</summary>
    [JsonPropertyName("max_resource_pixels")] public long MaxResourcePixels { get; set; } = 50_000_000;
    [JsonPropertyName("background_cache_size")] public int BackgroundCacheSize { get; set; } = 8;

    /// <summary>Template-match variants over backgrounds in Validate (BackgroundContainsTarget).</summary>
    [JsonPropertyName("contamination_check")] public bool ContaminationCheck { get; set; } = true;
    [JsonPropertyName("contamination_threshold")] public double ContaminationThreshold { get; set; } = 0.92;
    [JsonPropertyName("contamination_video_frames")] public int ContaminationVideoFrames { get; set; } = 8;

    [JsonPropertyName("holdout_split")] public string HoldoutSplit { get; set; } = HoldoutSplitVal;

    /// <summary>
    /// Relative mode: "range" = object size from relative_min..relative_max; "source" = the size the variant had in its source frame,
    /// scaled by background / source short side (fallback range when the source size is unknown).
    /// </summary>
    [JsonPropertyName("relative_sizing")] public string RelativeSizing { get; set; } = RelativeSizingRange;

    /// <summary>Consecutive segment frames per split group (real images and segment backgrounds).</summary>
    [JsonPropertyName("segment_block_frames")] public int SegmentBlockFrames { get; set; } = 30;

    [JsonIgnore] public bool IsNative => ScaleMode == ScaleModeNative;
    [JsonIgnore] public bool SizesFromSource => !IsNative && RelativeSizing == RelativeSizingSource;
    [JsonIgnore] public bool UsesDpiSteps => IsNative && DpiSteps.Count > 0;
    [JsonIgnore] public bool IsPng => OutputFormat == OutputFormatPng;
    [JsonIgnore] public string OutputExtension => "." + OutputFormat;

    public SynthesisSettings Clone()
    {
        var s = (SynthesisSettings)MemberwiseClone();
        s.DpiSteps = DpiSteps?.ToList() ?? new List<double>();
        return s;
    }

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
        s.NativeWindowWidth = Math.Clamp(s.NativeWindowWidth, 32, 8192);
        s.NativeWindowHeight = Math.Clamp(s.NativeWindowHeight, 32, 8192);
        s.DpiSteps = (s.DpiSteps ?? new List<double>()).Where(d => d > 0 && double.IsFinite(d)).Select(d => Math.Clamp(d, 0.1, 10))
            .Distinct().OrderBy(d => d).ToList();
        s.ScaleJitter = Math.Clamp(s.ScaleJitter, 0, 0.5);
        s.InRegionProbability = Math.Clamp(s.InRegionProbability, 0, 1);
        s.DistractorProbability = Math.Clamp(s.DistractorProbability, 0, 1);
        s.MaxDistractorsPerImage = Math.Clamp(s.MaxDistractorsPerImage, 0, 50);
        s.OutputFormat = OutputFormats.Contains(s.OutputFormat) ? s.OutputFormat : OutputFormatPng;
        s.JpegQualityMin = s.JpegQualityMin is { } q ? Math.Clamp(q, 30, s.JpegQuality) : null;
        s.MaxResourcePixels = Math.Clamp(s.MaxResourcePixels, 1_000_000, 1_000_000_000);
        s.BackgroundCacheSize = Math.Clamp(s.BackgroundCacheSize, 1, 256);
        s.ContaminationThreshold = Math.Clamp(s.ContaminationThreshold, 0.5, 1);
        s.ContaminationVideoFrames = Math.Clamp(s.ContaminationVideoFrames, 0, 1000);
        s.HoldoutSplit = HoldoutSplits.Contains(s.HoldoutSplit) ? s.HoldoutSplit : HoldoutSplitVal;
        s.RelativeSizing = RelativeSizings.Contains(s.RelativeSizing) ? s.RelativeSizing : RelativeSizingRange;
        s.SegmentBlockFrames = Math.Clamp(s.SegmentBlockFrames, 1, 100_000);
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

    /// <summary>TargetPlacement value; unknown = anywhere.</summary>
    [JsonPropertyName("placement")] public string Placement { get; set; } = TargetPlacement.Anywhere;

    /// <summary>Source placement: random offset as a fraction of the image size.</summary>
    [JsonPropertyName("placement_jitter")] public double PlacementJitter { get; set; } = 0.01;

    [JsonIgnore] public bool PlacesAtSource => Placement == TargetPlacement.Source;
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

    /// <summary>Unlabeled look-alike images (other icons) pasted as distractors (YOLO_TASKSET_SYNTHESIS_DESIGN.md §4.5).</summary>
    [JsonPropertyName("distractors")] public List<TaskResource> Distractors { get; set; } = new();

    [JsonPropertyName("holdout_sources")] public List<HoldoutSource> HoldoutSources { get; set; } = new();

    [JsonPropertyName("segment_sources")] public List<SegmentSource> SegmentSources { get; set; } = new();

    [JsonPropertyName("inference_roi_hint")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public InferenceRoiHint? InferenceRoiHint { get; set; }

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
    /// <summary>Legacy (single backgrounds no longer serve both splits); see NoValBackground.</summary>
    SingleBackgroundShared,
    /// <summary>Subject: target name; no background is left for val (single-item pools stay train-only), its val images are generated as train images.</summary>
    NoValBackground,
    /// <summary>Subject: "{resource}@{x},{y},{w},{h} {score}" (video: "{resource}#{frame}@..."); see FindContamination.</summary>
    BackgroundContainsTarget,
    /// <summary>Subject: resource file; width × height above max_resource_pixels, skipped.</summary>
    ResourceTooLarge,
    /// <summary>Subject: target name; native-mode size jitter above ±10 % creates icon sizes that never occur on screen.</summary>
    NativeScaleJitterLarge,
    /// <summary>Subject: "{resource} {label}"; a resource box label that is no target name is masked out.</summary>
    UnknownBoxLabel,
    /// <summary>Subject: holdout images dir; missing or without annotated images.</summary>
    HoldoutUnreadable,
    /// <summary>Subject: resource file; a placement region lies outside the image.</summary>
    InvalidRegion,
    /// <summary>Subject: variant file; an opaque variant is pasted with its source background square.</summary>
    VariantWithoutAlpha,
    /// <summary>Subject: segment dir; missing or without annotated frames.</summary>
    SegmentUnreadable,
    /// <summary>Subject: target name; source placement without a variant whose source position and size are known (pasted anywhere).</summary>
    PlacementSourceUnknown,
}

/// <summary>Validation issues plus the structured contamination hits behind the BackgroundContainsTarget issues.</summary>
public sealed record TaskSetValidation(IReadOnlyList<TaskSetIssue> Issues, IReadOnlyList<ContaminationHit> Hits);

/// <summary>Validation finding; Subject is the target name or resource file. Errors block generation.</summary>
public sealed record TaskSetIssue(TaskSetIssueCode Code, string Subject, bool IsError);

public sealed record SynthesisProgress(int Done, int Total);

/// <summary>How the dataset was synthesized, for consumers choosing ROI / tiled inference (design §11). Also in the manifest ("inference").</summary>
public sealed record SynthesisInferenceInfo(
    [property: JsonPropertyName("scale_mode")] string ScaleMode,
    [property: JsonPropertyName("window_width")] int WindowWidth,
    [property: JsonPropertyName("window_height")] int WindowHeight,
    [property: JsonPropertyName("background_min_side")] int BackgroundMinSide,
    [property: JsonPropertyName("background_max_side")] int BackgroundMaxSide,
    [property: JsonPropertyName("max_object_side")] int MaxObjectSide,
    [property: JsonPropertyName("min_object_side")] int MinObjectSide,
    [property: JsonPropertyName("tile_overlap")] int TileOverlap,
    [property: JsonPropertyName("roi_hint")] InferenceRoiHint? RoiHint);

public sealed record SynthesisResult(
    string DatasetDir,
    string DataYamlPath,
    IReadOnlyList<string> Classes,
    int TrainImages,
    int ValImages,
    int NegativeImages,
    IReadOnlyDictionary<string, int> Instances,
    IReadOnlyList<TaskSetIssue> Warnings,
    SynthesisInferenceInfo Inference,
    int HoldoutImages,
    int FailedJobs,
    int RealImages = 0);

/// <summary>Planned dataset size (no rendering): advisor input. MaxImageSide is an upper bound without taskSetDir.</summary>
public sealed record TaskSetEstimate(
    IReadOnlyList<string> Classes,
    int TrainImages,
    int ValImages,
    int NegativeImages,
    int HoldoutImages,
    int ImageWidth,
    int ImageHeight,
    int MaxImageSide,
    int MaxObjectSide,
    string ScaleMode,
    int RealTrainImages = 0,
    int RealValImages = 0);

/// <summary>A variant found in a background by template matching (rect in the resource's native pixels; Frame = cached frame file for videos).</summary>
public sealed record ContaminationHit(
    string ResourceId,
    string ResourceFile,
    string? Frame,
    string TargetId,
    string TargetName,
    string VariantId,
    int X,
    int Y,
    int Width,
    int Height,
    double Score);

public sealed record PreviewBox(string Label, double XMin, double YMin, double XMax, double YMax);

/// <summary>One rendered synthetic sample (PNG bytes) with its label boxes.</summary>
public sealed record PreviewResult(byte[] Png, IReadOnlyList<PreviewBox> Boxes);
