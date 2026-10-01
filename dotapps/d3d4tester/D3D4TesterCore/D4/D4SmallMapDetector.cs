using DotCore.Foundations;
using DotCore.TemplateMatcher;
using DotCore.Utils.ImagePreprocess;
using OpenCvSharp;

namespace DotApps.d3d4tester.Core.D4;

/// <summary>
/// Town vs dungeon from the minimap: SIFT match of template d4_small_map (threshold 0.6) inside the Minimap crop.
/// 1:1 Python pyapps/d3-check/d4utils/d4_small_map_detector.py + d4_scaled_template_matcher.py (via DotCore ScaledTemplateMatcher).
/// Fixes Python bug: the matcher read a non-existent minimap_region_image (always Dungeon); the Minimap is now cropped from the current frame.
/// Fixes Python bug: template scale came from the D3 global scale; it now uses the D4 window size vs 1763x1126.
/// Fixes Python bug: detection replaced detected_regions; the result is stored in D4InterfaceData.SmallMap only.
/// </summary>
public sealed class D4SmallMapDetector
{
    private const string LogPrefix = "[D4SmallMapDetector]";
    private const string MatcherLogPrefix = "[D4ScaledTemplateMatcher]";

    private static readonly Scalar FoundColor = new(0, 255, 0);
    private static readonly Scalar NotFoundColor = new(0, 0, 255);
    private static readonly Scalar TextColor = new(255, 255, 255);

    private static readonly Lazy<D4SmallMapDetector> LazyInstance = new(() =>
    {
        var d = new D4SmallMapDetector();
        ColorPrinter.Green("[Global] Small map detector initialized");
        return d;
    });

    private readonly ScaledTemplateMatcher _matcher;
    private (double ScaleX, double ScaleY) _scale = (1.0, 1.0);

    private D4SmallMapDetector()
    {
        TemplatePath = Path.Combine(D3TemplatePaths.GetTemplateDir(), D4Constants.SmallMapTemplateSubDir, D4Constants.SmallMapTemplateFile);
        _matcher = new ScaledTemplateMatcher(
            D4Constants.StandardWidth, D4Constants.StandardHeight,
            () => _scale,
            GetTemplateConfig,
            logPrefix: MatcherLogPrefix);
        ColorPrinter.Blue($"{LogPrefix} Initialized");
        ColorPrinter.Blue($"{LogPrefix} Template: {TemplatePath}");
        ColorPrinter.Blue($"{LogPrefix} Threshold: {D4Constants.SmallMapThreshold}");
        ColorPrinter.Blue($"{LogPrefix} Method: {D4Constants.SmallMapMatchMethod.ToName()}");
    }

    public static D4SmallMapDetector Instance => LazyInstance.Value;

    /// <summary>Absolute path of the d4_small_map template.</summary>
    public string TemplatePath { get; }

    /// <summary>D4 template config table (D4_TEMPLATE_CONFIGS); null when unknown.</summary>
    public TemplateMatchConfig? GetTemplateConfig(string templateName) =>
        templateName == D4Constants.SmallMapTemplateName
            ? new TemplateMatchConfig
            {
                Path = TemplatePath,
                Threshold = D4Constants.SmallMapThreshold,
                UseAlpha = false,
                MatchMethod = D4Constants.SmallMapMatchMethod,
            }
            : null;

    /// <summary>Detect town/dungeon in the current frame and store the result. 1:1 detect_small_map.</summary>
    public D4SmallMapResult DetectSmallMap(D4InterfaceData data, Mat gameWindowBgr, bool debug)
    {
        if (gameWindowBgr == null || gameWindowBgr.Empty())
        {
            ColorPrinter.Yellow($"{LogPrefix} No screenshot data available");
            return Result(false, 0.0, null, "No screenshot data");
        }
        var size = (gameWindowBgr.Width, gameWindowBgr.Height);
        bool windowed = data.IsWindowedMode();
        var start = D4StandardCoords.Scale(D4StandardCoords.Minimap.Start, size, windowed);
        var end = D4StandardCoords.Scale(D4StandardCoords.Minimap.End, size, windowed);
        using var minimap = D4ImageCrop.CropClamped(gameWindowBgr, start, end);
        if (minimap == null)
        {
            ColorPrinter.Yellow($"{LogPrefix} Extracted minimap region is empty");
            return Result(false, 0.0, null, "Failed to extract minimap region");
        }

        _scale = D4StandardCoords.GetScale(size, windowed);
        var match = _matcher.MatchTemplateInRegion(
            D4Constants.SmallMapTemplateName, minimap, D4Constants.SmallMapRegionName, D4Constants.RegionSourceFullImage,
            debug ? D4Constants.AnnotatedDir : null);
        double confidence = match.FirstMatch?.Score ?? 0.0;
        bool found = match.TotalMatches > 0 && confidence >= D4Constants.SmallMapThreshold;
        if (match.Error != null)
            ColorPrinter.Gray($"{LogPrefix} Match error: {match.Error}");
        var result = Result(found, confidence, match.RegionSource, null);

        data.SmallMap = result;
        data.SmallMapDetectionTimestamp = result.DetectionTimestamp;
        if (debug)
        {
            var path = SaveDebugImage(minimap, result, found);
            if (path != null)
            {
                data.LastSmallMapDebugPath = path;
                result = result with { DebugImagePath = path };
                data.SmallMap = result;
            }
        }
        ColorPrinter.Green($"{LogPrefix} Detection result: {result.LocationType} (confidence: {confidence:F3})");
        return result;
    }

    private static D4SmallMapResult Result(bool isInTown, double confidence, string? regionSource, string? error) =>
        new(isInTown, isInTown ? D4LocationType.Town : D4LocationType.Dungeon, confidence, D4Constants.SmallMapThreshold,
            DateTime.Now, regionSource, error);

    /// <summary>Annotated minimap + raw minimap. 1:1 _save_debug_image.</summary>
    private string? SaveDebugImage(Mat minimap, D4SmallMapResult result, bool found)
    {
        using var debugImage = ImageConvert.ToBgr(minimap);
        var status = found ? FoundColor : NotFoundColor;
        Cv2.PutText(debugImage, $"Small Map: {result.LocationType}", new Point(10, 30), HersheyFonts.HersheySimplex, 0.7, status, 2);
        Cv2.PutText(debugImage, $"Confidence: {result.Confidence:F3}", new Point(10, 60), HersheyFonts.HersheySimplex, 0.6, TextColor, 1);
        Cv2.PutText(debugImage, $"Threshold: {result.Threshold}", new Point(10, 90), HersheyFonts.HersheySimplex, 0.6, TextColor, 1);
        Cv2.PutText(debugImage, found ? "FOUND" : "NOT FOUND", new Point(10, 120), HersheyFonts.HersheySimplex, 0.6, status, 2);
        Cv2.PutText(debugImage, $"Template: {Path.GetFileName(TemplatePath)}", new Point(10, 150), HersheyFonts.HersheySimplex, 0.5, TextColor, 1);
        Cv2.Rectangle(debugImage, new Point(0, 0), new Point(debugImage.Width - 1, debugImage.Height - 1), status, 2);
        var ts = DateTime.Now.ToString(D4Constants.TimestampFormat);
        var path = D4ImageCrop.Save(debugImage, D4ImageCrop.TimestampedPath(D4Constants.AnnotatedDir, D4Constants.SmallMapDebugPrefix, ts), LogPrefix);
        if (path != null) ColorPrinter.Green($"{LogPrefix} Debug image saved: {path}");
        var rawPath = D4ImageCrop.Save(minimap, D4ImageCrop.TimestampedPath(D4Constants.AnnotatedDir, D4Constants.MinimapRegionPrefix, ts), LogPrefix);
        if (rawPath != null) ColorPrinter.Blue($"{LogPrefix} Raw minimap region saved: {rawPath}");
        return path;
    }
}
