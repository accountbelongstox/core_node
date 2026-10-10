// PY-REF: none (DOT-only)
using System.Globalization;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.I18n;
using DotCore.YoloTaskSet;

namespace DotApps.d3d4tester.ViewModels;

/// <summary>NumberList: comma separated invariant numbers (List&lt;double&gt;); OptionalInt: empty text = null.</summary>
public enum TaskSetFieldKind { Double, Int, Bool, Choice, NumberList, OptionalInt }

/// <summary>One augmentation field: global profile accessors plus the per-target override accessors.</summary>
public sealed record TaskSetAugField(
    string LabelKey,
    TaskSetFieldKind Kind,
    Func<AugmentationProfile, object> Get,
    Action<AugmentationProfile, object> Set,
    Func<AugmentationOverride, object?> GetOverride,
    Action<AugmentationOverride, object?> SetOverride);

/// <summary>One synthesis setting; Choice fields list their stored values and the i18n key of each value's display text.</summary>
public sealed record TaskSetSynField(
    string LabelKey,
    TaskSetFieldKind Kind,
    Func<SynthesisSettings, object> Get,
    Action<SynthesisSettings, object> Set,
    IReadOnlyList<(string Value, string TextKey)>? Choices = null,
    bool AffectsVideoEstimate = false);

/// <summary>Editor tables and value parsing/formatting of the task-set manager (invariant culture numbers, i18n booleans).</summary>
public static class TaskSetFields
{
    public static readonly IReadOnlyList<TaskSetAugField> Augmentation = new TaskSetAugField[]
    {
        new(I18nKeys.YoloTaskSetAugScaleMin, TaskSetFieldKind.Double, p => p.ScaleMin, (p, v) => p.ScaleMin = (double)v, o => o.ScaleMin, (o, v) => o.ScaleMin = (double?)v),
        new(I18nKeys.YoloTaskSetAugScaleMax, TaskSetFieldKind.Double, p => p.ScaleMax, (p, v) => p.ScaleMax = (double)v, o => o.ScaleMax, (o, v) => o.ScaleMax = (double?)v),
        new(I18nKeys.YoloTaskSetAugStretchMin, TaskSetFieldKind.Double, p => p.StretchMin, (p, v) => p.StretchMin = (double)v, o => o.StretchMin, (o, v) => o.StretchMin = (double?)v),
        new(I18nKeys.YoloTaskSetAugStretchMax, TaskSetFieldKind.Double, p => p.StretchMax, (p, v) => p.StretchMax = (double)v, o => o.StretchMax, (o, v) => o.StretchMax = (double?)v),
        new(I18nKeys.YoloTaskSetAugRotationMaxDegrees, TaskSetFieldKind.Double, p => p.RotationMaxDegrees, (p, v) => p.RotationMaxDegrees = (double)v, o => o.RotationMaxDegrees, (o, v) => o.RotationMaxDegrees = (double?)v),
        new(I18nKeys.YoloTaskSetAugLeftStretchMax, TaskSetFieldKind.Double, p => p.LeftStretchMax, (p, v) => p.LeftStretchMax = (double)v, o => o.LeftStretchMax, (o, v) => o.LeftStretchMax = (double?)v),
        new(I18nKeys.YoloTaskSetAugRightStretchMax, TaskSetFieldKind.Double, p => p.RightStretchMax, (p, v) => p.RightStretchMax = (double)v, o => o.RightStretchMax, (o, v) => o.RightStretchMax = (double?)v),
        new(I18nKeys.YoloTaskSetAugFlipHorizontal, TaskSetFieldKind.Bool, p => p.FlipHorizontal, (p, v) => p.FlipHorizontal = (bool)v, o => o.FlipHorizontal, (o, v) => o.FlipHorizontal = (bool?)v),
        new(I18nKeys.YoloTaskSetAugBrightnessMax, TaskSetFieldKind.Double, p => p.BrightnessMax, (p, v) => p.BrightnessMax = (double)v, o => o.BrightnessMax, (o, v) => o.BrightnessMax = (double?)v),
        new(I18nKeys.YoloTaskSetAugContrastMax, TaskSetFieldKind.Double, p => p.ContrastMax, (p, v) => p.ContrastMax = (double)v, o => o.ContrastMax, (o, v) => o.ContrastMax = (double?)v),
        new(I18nKeys.YoloTaskSetAugBlurProbability, TaskSetFieldKind.Double, p => p.BlurProbability, (p, v) => p.BlurProbability = (double)v, o => o.BlurProbability, (o, v) => o.BlurProbability = (double?)v),
        new(I18nKeys.YoloTaskSetAugBlurMaxKernel, TaskSetFieldKind.Int, p => p.BlurMaxKernel, (p, v) => p.BlurMaxKernel = (int)v, o => o.BlurMaxKernel, (o, v) => o.BlurMaxKernel = (int?)v),
        new(I18nKeys.YoloTaskSetAugEdgeFeather, TaskSetFieldKind.Double, p => p.EdgeFeather, (p, v) => p.EdgeFeather = (double)v, o => o.EdgeFeather, (o, v) => o.EdgeFeather = (double?)v),
    };

    public static readonly IReadOnlyList<TaskSetSynField> Synthesis = new TaskSetSynField[]
    {
        new(I18nKeys.YoloTaskSetSynImagesPerTarget, TaskSetFieldKind.Int, s => s.ImagesPerTarget, (s, v) => s.ImagesPerTarget = (int)v),
        new(I18nKeys.YoloTaskSetSynValPercent, TaskSetFieldKind.Int, s => s.ValPercent, (s, v) => s.ValPercent = (int)v),
        new(I18nKeys.YoloTaskSetSynSeed, TaskSetFieldKind.Int, s => s.Seed, (s, v) => s.Seed = (int)v),
        new(I18nKeys.YoloTaskSetSynMinObjects, TaskSetFieldKind.Int, s => s.MinObjectsPerImage, (s, v) => s.MinObjectsPerImage = (int)v),
        new(I18nKeys.YoloTaskSetSynMaxObjects, TaskSetFieldKind.Int, s => s.MaxObjectsPerImage, (s, v) => s.MaxObjectsPerImage = (int)v),
        new(I18nKeys.YoloTaskSetSynCrossTargetProbability, TaskSetFieldKind.Double, s => s.CrossTargetProbability, (s, v) => s.CrossTargetProbability = (double)v),
        new(I18nKeys.YoloTaskSetSynNegativePercent, TaskSetFieldKind.Int, s => s.NegativePercent, (s, v) => s.NegativePercent = (int)v),
        new(I18nKeys.YoloTaskSetSynMaxOverlapIou, TaskSetFieldKind.Double, s => s.MaxOverlapIou, (s, v) => s.MaxOverlapIou = (double)v),
        new(I18nKeys.YoloTaskSetSynMinVisibleFraction, TaskSetFieldKind.Double, s => s.MinVisibleFraction, (s, v) => s.MinVisibleFraction = (double)v),
        new(I18nKeys.YoloTaskSetSynScaleMode, TaskSetFieldKind.Choice, s => s.ScaleMode, (s, v) => s.ScaleMode = (string)v,
            new[] { (SynthesisSettings.ScaleModeNative, I18nKeys.YoloTaskSetScaleModeNative), (SynthesisSettings.ScaleModeRelative, I18nKeys.YoloTaskSetScaleModeRelative) }),
        new(I18nKeys.YoloTaskSetSynRelativeMin, TaskSetFieldKind.Double, s => s.RelativeMin, (s, v) => s.RelativeMin = (double)v),
        new(I18nKeys.YoloTaskSetSynRelativeMax, TaskSetFieldKind.Double, s => s.RelativeMax, (s, v) => s.RelativeMax = (double)v),
        new(I18nKeys.YoloTaskSetSynRelativeSizing, TaskSetFieldKind.Choice, s => s.RelativeSizing, (s, v) => s.RelativeSizing = (string)v,
            new[] { (SynthesisSettings.RelativeSizingRange, I18nKeys.YoloTaskSetRelativeSizingRange), (SynthesisSettings.RelativeSizingSource, I18nKeys.YoloTaskSetRelativeSizingSource) }),
        new(I18nKeys.YoloTaskSetSynOutputMaxSide, TaskSetFieldKind.Int, s => s.OutputMaxSide, (s, v) => s.OutputMaxSide = (int)v),
        new(I18nKeys.YoloTaskSetSynJpegQuality, TaskSetFieldKind.Int, s => s.JpegQuality, (s, v) => s.JpegQuality = (int)v),
        new(I18nKeys.YoloTaskSetSynVideoFrameInterval, TaskSetFieldKind.Int, s => s.VideoFrameInterval, (s, v) => s.VideoFrameInterval = (int)v, AffectsVideoEstimate: true),
        new(I18nKeys.YoloTaskSetSynVideoMaxFrames, TaskSetFieldKind.Int, s => s.VideoMaxFrames, (s, v) => s.VideoMaxFrames = (int)v, AffectsVideoEstimate: true),
        new(I18nKeys.YoloTaskSetSynNativeWindowWidth, TaskSetFieldKind.Int, s => s.NativeWindowWidth, (s, v) => s.NativeWindowWidth = (int)v),
        new(I18nKeys.YoloTaskSetSynNativeWindowHeight, TaskSetFieldKind.Int, s => s.NativeWindowHeight, (s, v) => s.NativeWindowHeight = (int)v),
        new(I18nKeys.YoloTaskSetSynDpiSteps, TaskSetFieldKind.NumberList, s => s.DpiSteps, (s, v) => s.DpiSteps = (List<double>)v),
        new(I18nKeys.YoloTaskSetSynScaleJitter, TaskSetFieldKind.Double, s => s.ScaleJitter, (s, v) => s.ScaleJitter = (double)v),
        new(I18nKeys.YoloTaskSetSynInRegionProbability, TaskSetFieldKind.Double, s => s.InRegionProbability, (s, v) => s.InRegionProbability = (double)v),
        new(I18nKeys.YoloTaskSetSynDistractorProbability, TaskSetFieldKind.Double, s => s.DistractorProbability, (s, v) => s.DistractorProbability = (double)v),
        new(I18nKeys.YoloTaskSetSynMaxDistractors, TaskSetFieldKind.Int, s => s.MaxDistractorsPerImage, (s, v) => s.MaxDistractorsPerImage = (int)v),
        new(I18nKeys.YoloTaskSetSynOutputFormat, TaskSetFieldKind.Choice, s => s.OutputFormat, (s, v) => s.OutputFormat = (string)v,
            new[] { (SynthesisSettings.OutputFormatPng, I18nKeys.YoloTaskSetOutputPng), (SynthesisSettings.OutputFormatJpg, I18nKeys.YoloTaskSetOutputJpg) }),
        new(I18nKeys.YoloTaskSetSynJpegQualityMin, TaskSetFieldKind.OptionalInt, s => (object?)s.JpegQualityMin ?? "", (s, v) => s.JpegQualityMin = v as int?),
        new(I18nKeys.YoloTaskSetSynMaxResourceMegapixels, TaskSetFieldKind.Double, s => s.MaxResourcePixels / PixelsPerMegapixel,
            (s, v) => s.MaxResourcePixels = (long)Math.Round((double)v * PixelsPerMegapixel)),
        new(I18nKeys.YoloTaskSetSynBackgroundCacheSize, TaskSetFieldKind.Int, s => s.BackgroundCacheSize, (s, v) => s.BackgroundCacheSize = (int)v),
        new(I18nKeys.YoloTaskSetSynContaminationCheck, TaskSetFieldKind.Bool, s => s.ContaminationCheck, (s, v) => s.ContaminationCheck = (bool)v),
        new(I18nKeys.YoloTaskSetSynContaminationThreshold, TaskSetFieldKind.Double, s => s.ContaminationThreshold, (s, v) => s.ContaminationThreshold = (double)v),
        new(I18nKeys.YoloTaskSetSynContaminationVideoFrames, TaskSetFieldKind.Int, s => s.ContaminationVideoFrames, (s, v) => s.ContaminationVideoFrames = (int)v),
        new(I18nKeys.YoloTaskSetSynHoldoutSplit, TaskSetFieldKind.Choice, s => s.HoldoutSplit, (s, v) => s.HoldoutSplit = (string)v,
            new[] { (SynthesisSettings.HoldoutSplitVal, I18nKeys.YoloTaskSetHoldoutVal), (SynthesisSettings.HoldoutSplitTest, I18nKeys.YoloTaskSetHoldoutTest) }),
        new(I18nKeys.YoloTaskSetSynSegmentBlockFrames, TaskSetFieldKind.Int, s => s.SegmentBlockFrames, (s, v) => s.SegmentBlockFrames = (int)v),
    };

    /// <summary>Target placements (TargetPlacement.All) and their i18n keys.</summary>
    public static readonly IReadOnlyList<(string Value, string TextKey)> Placements = new[]
    {
        (TargetPlacement.Anywhere, I18nKeys.YoloTaskSetPlacementAnywhere),
        (TargetPlacement.Source, I18nKeys.YoloTaskSetPlacementSource),
    };

    /// <summary>Inference ROI hint anchors (InferenceRoiHint.Anchors plus "none" = no hint) and their i18n keys.</summary>
    public static readonly IReadOnlyList<(string? Value, string TextKey)> RoiAnchors = new (string?, string)[]
    {
        (null, I18nKeys.YoloTaskSetRoiNone),
        (InferenceRoiHint.AnchorBottom, I18nKeys.YoloTaskSetRoiBottom),
        (InferenceRoiHint.AnchorTop, I18nKeys.YoloTaskSetRoiTop),
        (InferenceRoiHint.AnchorLeft, I18nKeys.YoloTaskSetRoiLeft),
        (InferenceRoiHint.AnchorRight, I18nKeys.YoloTaskSetRoiRight),
        (InferenceRoiHint.AnchorRect, I18nKeys.YoloTaskSetRoiRectAnchor),
    };

    private const double PixelsPerMegapixel = 1_000_000;

    public static object? Parse(TaskSetFieldKind kind, string? text)
    {
        var s = (text ?? "").Trim();
        return kind switch
        {
            TaskSetFieldKind.Double => double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out var d) && double.IsFinite(d) ? d : null,
            TaskSetFieldKind.Int => int.TryParse(s, NumberStyles.Integer, CultureInfo.InvariantCulture, out var i) ? i : null,
            TaskSetFieldKind.NumberList => ParseNumberList(s),
            TaskSetFieldKind.OptionalInt => s.Length == 0 ? OptionalNone : int.TryParse(s, NumberStyles.Integer, CultureInfo.InvariantCulture, out var oi) ? oi : null,
            _ => null,
        };
    }

    /// <summary>Parsed "no value" of an OptionalInt field (Parse returns null only for invalid input).</summary>
    public static readonly object OptionalNone = "";

    /// <summary>"x,y,w,h" in pixels; null when invalid or empty.</summary>
    public static PixelRect? ParseRect(string? text)
    {
        if (ParseNumberList(text) is not { Count: 4 } v || v[2] <= 0 || v[3] <= 0) return null;
        return new PixelRect { X = (int)v[0], Y = (int)v[1], Width = (int)v[2], Height = (int)v[3] };
    }

    public static string FormatRect(PixelRect? rect) =>
        rect == null ? "" : string.Join(", ", new[] { rect.X, rect.Y, rect.Width, rect.Height }.Select(n => n.ToString(CultureInfo.InvariantCulture)));

    public static string Format(object? value) => value switch
    {
        null => "",
        double d => d.ToString("0.####", CultureInfo.InvariantCulture),
        int i => i.ToString(CultureInfo.InvariantCulture),
        bool b => D3D4TesterI18n.Provider.GetUiText(b ? I18nKeys.YoloTaskSetValueOn : I18nKeys.YoloTaskSetValueOff),
        IEnumerable<double> list => string.Join(", ", list.Select(x => x.ToString("0.###", CultureInfo.InvariantCulture))),
        _ => value.ToString() ?? "",
    };

    /// <summary>Comma / space separated invariant numbers; null when any token is not a finite number.</summary>
    public static List<double>? ParseNumberList(string? text)
    {
        var result = new List<double>();
        foreach (var token in (text ?? "").Split(new[] { ',', ';', ' ' }, StringSplitOptions.RemoveEmptyEntries))
        {
            if (!double.TryParse(token, NumberStyles.Float, CultureInfo.InvariantCulture, out var d) || !double.IsFinite(d)) return null;
            result.Add(d);
        }
        return result;
    }
}
