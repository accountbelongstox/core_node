// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/image_matcher_registry.py
// PY-REF: dotapps/d3d4tester/reference/py_d3check/share/scaled_template_matcher_base.py
using System.Collections.Concurrent;
using DotCore.Foundations;
using DotCore.Utils.ImagePreprocess;
using OpenCvSharp;

namespace DotCore.TemplateMatcher;

/// <summary>ImageMatcher settings. 1:1 Python ImageMatcher.__init__ arguments.</summary>
public sealed record ImageMatcherOptions
{
    public double RatioThresh { get; init; } = TemplateMatcherConstants.DefaultRatioThresh;
    public int MinInliers { get; init; } = TemplateMatcherConstants.DefaultMinInliers;
    public int NFeatures { get; init; } = TemplateMatcherConstants.DefaultNFeatures;
    public double RansacThreshold { get; init; } = TemplateMatcherConstants.DefaultRansacThreshold;

    /// <summary>Standard resolution for template auto-scaling; null = no auto-scale.</summary>
    public int? StandardWidth { get; init; }
    public int? StandardHeight { get; init; }
}

/// <summary>Result of <see cref="ImageMatcher.MatchMultipleTemplates"/>. 1:1 Python dict (target_image, matches, output_image_path, total_matches).</summary>
public sealed record MultiTemplateMatchResult(string TargetImage, IReadOnlyList<TemplateMatchResult> Matches, string? OutputImagePath)
{
    public int TotalMatches => Matches.Count;
}

/// <summary>
/// Template locator with auto-scaling (target vs standard resolution) and method dispatch (TM_* or SIFT/ORB/AKAZE).
/// 1:1 Python pycore/pyutils/image_tools/image_matcher.py ImageMatcher. Obtain shared instances via <see cref="ImageMatcherRegistry"/>.
/// Fixes Python bug: use_alpha=None read a missing self.support_alpha attribute; null now means no alpha.
/// </summary>
public sealed class ImageMatcher
{
    private static readonly Scalar PolygonColor = new(0, 0, 255);
    private static readonly Scalar CenterColor = new(255, 0, 0);
    private static readonly Scalar LabelColor = new(0, 255, 0);
    private const string LogPrefix = "[ImageMatcher]";
    private const string OutputFilePrefix = "matched_";
    private const string OutputTimestampFormat = "yyyyMMdd_HHmmss";

    /// <summary>Settings for this matcher.</summary>
    public ImageMatcherOptions Options { get; }

    public ImageMatcher(ImageMatcherOptions? options = null)
    {
        Options = options ?? new ImageMatcherOptions();
        ColorPrinter.Blue($"{LogPrefix} Feature ratio threshold: {Options.RatioThresh}");
        ColorPrinter.Blue($"{LogPrefix} Minimum inliers: {Options.MinInliers}");
        ColorPrinter.Blue($"{LogPrefix} Max features: {Options.NFeatures}");
        ColorPrinter.Blue($"{LogPrefix} RANSAC threshold: {Options.RansacThreshold}px");
        if (Options.StandardWidth.HasValue && Options.StandardHeight.HasValue)
            ColorPrinter.Blue($"{LogPrefix} Standard resolution: {Options.StandardWidth}x{Options.StandardHeight}");
    }

    /// <summary>Scale factors target / standard (1.0 when no standard resolution). 1:1 _calculate_auto_scale.</summary>
    public (double ScaleX, double ScaleY) CalculateAutoScale(Mat target, bool silent = false)
    {
        if (Options.StandardWidth is not int sw || Options.StandardHeight is not int sh)
        {
            if (!silent) ColorPrinter.Debug($"{LogPrefix} Auto-scale: Using target size as standard ({target.Width}x{target.Height})");
            return (1.0, 1.0);
        }
        double scaleX = target.Width / (double)sw;
        double scaleY = target.Height / (double)sh;
        if (!silent)
        {
            ColorPrinter.Debug($"{LogPrefix} Auto-scale: Target {target.Width}x{target.Height} vs Standard {sw}x{sh}");
            ColorPrinter.Debug($"{LogPrefix} Auto-scale: scale_x={scaleX:F4}, scale_y={scaleY:F4}");
        }
        return (scaleX, scaleY);
    }

    /// <summary>
    /// Match one template in the target. 1:1 match_single_template: auto-scale template, then feature matching
    /// (threshold = ratio, default <see cref="ImageMatcherOptions.RatioThresh"/>) or TM matching (threshold default 0.8).
    /// </summary>
    /// <param name="autoScale">False skips the standard-resolution auto-scale (for templates already scaled to a crop).</param>
    public TemplateMatchResult MatchSingleTemplate(
        Mat target,
        Mat template,
        string templateName = "template",
        double? customThreshold = null,
        bool? useAlpha = null,
        TemplateMatchMethod detectionMethod = TemplateMatchMethod.Orb,
        bool silent = false,
        bool autoScale = true)
    {
        var (scaleX, scaleY) = autoScale ? CalculateAutoScale(target, silent) : (1.0, 1.0);
        Mat scaled = template;
        try
        {
            if (scaleX != 1.0 || scaleY != 1.0)
            {
                int sw = (int)(template.Width * scaleX);
                int sh = (int)(template.Height * scaleY);
                if (!silent) ColorPrinter.Debug($"{LogPrefix} Auto-scaling template from {template.Width}x{template.Height} to {sw}x{sh}");
                if (sw <= 0 || sh <= 0)
                    return new TemplateMatchResult { Success = false, TemplateName = templateName, Method = detectionMethod, AutoScaleX = scaleX, AutoScaleY = scaleY };
                scaled = template.Resize(new OpenCvSharp.Size(sw, sh), 0, 0, InterpolationFlags.Linear);
            }

            TemplateMatchResult result;
            double threshold;
            if (detectionMethod.IsFeatureMethod())
            {
                threshold = customThreshold ?? Options.RatioThresh;
                if (!silent) ColorPrinter.Debug($"{LogPrefix} Using {detectionMethod.ToName()} feature matching with threshold {threshold}");
                result = FeatureMatcherService.Match(target, scaled, detectionMethod, templateName, threshold,
                    Options.MinInliers, Options.NFeatures, Options.RansacThreshold, silent);
            }
            else
            {
                threshold = customThreshold ?? TemplateMatcherConstants.DefaultMatchThreshold;
                if (!silent) ColorPrinter.Debug($"{LogPrefix} Using {detectionMethod.ToName()} template matching with threshold {threshold}");
                result = TemplateMatcherService.GetTemplateMatcher().MatchWithMethod(target, scaled, detectionMethod, threshold, useAlpha ?? false, templateName, silent);
            }
            return result with { AutoScaleX = scaleX, AutoScaleY = scaleY, MatchThreshold = threshold, Method = detectionMethod };
        }
        finally
        {
            if (!ReferenceEquals(scaled, template)) scaled.Dispose();
        }
    }

    /// <summary>
    /// Match several template files in one target file and optionally save an annotated image. 1:1 match_multiple_templates
    /// (default ORB; per-template threshold/alpha from <paramref name="templateConfigs"/> keyed by file stem).
    /// </summary>
    public MultiTemplateMatchResult MatchMultipleTemplates(
        string targetImagePath,
        IEnumerable<string> templatePaths,
        string? outputDir = null,
        string? outputFilename = null,
        IReadOnlyDictionary<string, TemplateMatchConfig>? templateConfigs = null)
    {
        using var target = ImageConvert.NormalizeToBgr(targetImagePath);
        using var output = target.Clone();
        var matches = new List<TemplateMatchResult>();
        var paths = templatePaths.ToList();
        for (int idx = 0; idx < paths.Count; idx++)
        {
            var templateName = Path.GetFileNameWithoutExtension(paths[idx]);
            ColorPrinter.Blue($"[DEBUG] Processing template {idx + 1}/{paths.Count}: {templateName}");
            TemplateMatchConfig? cfg = null;
            templateConfigs?.TryGetValue(templateName, out cfg);
            bool useAlpha = cfg?.UseAlpha ?? false;
            using var template = ImageConvert.LoadMat(paths[idx], useAlpha ? ImreadModes.Unchanged : ImreadModes.Color);
            if (template.Empty())
            {
                ColorPrinter.Red($"[WARN] Failed to load template: {paths[idx]}");
                continue;
            }
            ColorPrinter.Debug($"[DEBUG] Template loaded: {templateName}, size: {template.Height}x{template.Width}x{template.Channels()}");
            ColorPrinter.Debug($"[DEBUG] Attempting to match template: {templateName}");
            if (cfg != null) ColorPrinter.Debug($"[DEBUG] Using custom threshold {cfg.Threshold} for {templateName}");
            var result = MatchSingleTemplate(target, template, templateName, cfg?.Threshold, useAlpha);
            if (!result.Success) continue;
            ColorPrinter.Green($"[DEBUG] Match found for {templateName}!");
            matches.Add(result);
            DrawMatch(output, result);
        }

        string? outputPath = null;
        if (!string.IsNullOrEmpty(outputDir))
        {
            var name = outputFilename ?? $"{OutputFilePrefix}{DateTime.Now.ToString(OutputTimestampFormat)}.png";
            outputPath = Path.Combine(outputDir, name);
            if (!ImageConvert.SaveMat(output, outputPath))
            {
                ColorPrinter.Red($"[ERROR] Failed to save output image: {outputPath}");
                outputPath = null;
            }
        }
        return new MultiTemplateMatchResult(targetImagePath, matches, outputPath);
    }

    /// <summary>Draw successful matches (red polygon, blue center, green label) and save. 1:1 draw_match_visualization.</summary>
    public static void DrawMatchVisualization(Mat target, IEnumerable<TemplateMatchResult> matchResults, string outputPath)
    {
        using var output = target.Clone();
        foreach (var m in matchResults)
        {
            if (m.Success) DrawMatch(output, m);
        }
        ImageConvert.SaveMat(output, outputPath);
    }

    private static void DrawMatch(Mat image, TemplateMatchResult m)
    {
        if (m.Polygon == null || m.Polygon.Count == 0) return;
        var poly = m.Polygon.Select(p => new OpenCvSharp.Point((int)p.X, (int)p.Y)).ToArray();
        Cv2.Polylines(image, new[] { poly }, true, PolygonColor, 3);
        Cv2.Circle(image, new OpenCvSharp.Point(m.CenterX, m.CenterY), 8, CenterColor, -1);
        Cv2.PutText(image, m.TemplateName ?? "", new OpenCvSharp.Point(poly[0].X, poly[0].Y - 10), HersheyFonts.HersheySimplex, 0.6, LabelColor, 2);
    }
}

/// <summary>
/// Shared ImageMatcher instances. 1:1 Python dotapps/d3d4tester/reference/py_d3check/d3utils/image_matcher_registry.py
/// (default singleton, per standard resolution, per (method, resolution)).
/// </summary>
public static class ImageMatcherRegistry
{
    private static readonly Lazy<ImageMatcher> Default = new(() => new ImageMatcher());
    private static readonly ConcurrentDictionary<(int, int), ImageMatcher> ByResolution = new();
    private static readonly ConcurrentDictionary<(TemplateMatchMethod, int?, int?), ImageMatcher> ByMethod = new();

    /// <summary>Default matcher (no auto-scale). 1:1 get_image_matcher.</summary>
    public static ImageMatcher GetDefault() => Default.Value;

    /// <summary>Matcher cached by standard resolution. 1:1 get_image_matcher_for_resolution.</summary>
    public static ImageMatcher GetForResolution(int standardWidth, int standardHeight) =>
        ByResolution.GetOrAdd((standardWidth, standardHeight),
            k => new ImageMatcher(new ImageMatcherOptions { StandardWidth = k.Item1, StandardHeight = k.Item2 }));

    /// <summary>Matcher cached by (method, standard resolution); options apply on first creation only. 1:1 get_image_matcher_for_method.</summary>
    public static ImageMatcher GetForMethod(
        TemplateMatchMethod method,
        int? standardWidth,
        int? standardHeight,
        double ratioThresh = TemplateMatcherConstants.ScaledRatioThresh,
        int minInliers = TemplateMatcherConstants.ScaledMinInliers,
        int nFeatures = TemplateMatcherConstants.ScaledNFeatures) =>
        ByMethod.GetOrAdd((method, standardWidth, standardHeight), _ => new ImageMatcher(new ImageMatcherOptions
        {
            RatioThresh = ratioThresh,
            MinInliers = minInliers,
            NFeatures = nFeatures,
            StandardWidth = standardWidth,
            StandardHeight = standardHeight
        }));
}
