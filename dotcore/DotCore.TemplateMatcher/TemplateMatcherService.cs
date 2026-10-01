using System.Drawing;
using DotCore.Foundations;
using DotCore.Utils.ImagePreprocess;
using OpenCvSharp;
using OpenCvSharp.Extensions;

namespace DotCore.TemplateMatcher;

/// <summary>
/// Template matching (find small image in large image). Aligned with PY match_single_template / ScaledTemplateMatcherBase.
/// Input: source image + template; output: found, position, score. Uses TM_CCOEFF_NORMED.
/// Singleton via GetTemplateMatcher() only; do not instantiate elsewhere (DOT_PROJECT_STANDARDS).
/// </summary>
public sealed class TemplateMatcherService
{
    private static TemplateMatcherService? _instance;
    private static readonly object _instanceLock = new();

    private TemplateMatcherService() { }

    /// <summary>Default match threshold for TM_CCOEFF_NORMED. Same as <see cref="TemplateMatcherConstants.DefaultMatchThreshold"/>.</summary>
    public const double DefaultThreshold = TemplateMatcherConstants.DefaultMatchThreshold;

    /// <summary>Returns the global template matcher singleton (same as PY get_image_matcher).</summary>
    public static TemplateMatcherService GetTemplateMatcher()
    {
        if (_instance != null) return _instance;
        lock (_instanceLock)
        {
            _instance ??= new TemplateMatcherService();
            return _instance;
        }
    }

    /// <summary>Find template in source image; returns best match (single point). Uses TM_CCOEFF_NORMED.</summary>
    /// <param name="sourceImage">Source (large) image.</param>
    /// <param name="templateImage">Template (small) image.</param>
    /// <param name="threshold">Score threshold; match when score &gt;= threshold. Default 0.8.</param>
    /// <param name="templateName">Optional name for result and logging.</param>
    /// <returns>Match result; Success is false when not found or on error.</returns>
    public TemplateMatchResult Match(
        Bitmap sourceImage,
        Bitmap templateImage,
        double threshold = DefaultThreshold,
        string? templateName = null)
    {
        if (sourceImage == null || templateImage == null)
            return Fail(templateName);
        try
        {
            using var src = BitmapConverter.ToMat(sourceImage);
            using var tpl = BitmapConverter.ToMat(templateImage);
            return MatchCore(src, tpl, threshold, templateName);
        }
        catch
        {
            return Fail(templateName);
        }
    }

    /// <summary>Load source and template from file paths and match.</summary>
    public TemplateMatchResult MatchFromFiles(
        string sourceImagePath,
        string templateImagePath,
        double threshold = DefaultThreshold,
        string? templateName = null)
    {
        if (string.IsNullOrWhiteSpace(sourceImagePath) || string.IsNullOrWhiteSpace(templateImagePath) ||
            !File.Exists(sourceImagePath) || !File.Exists(templateImagePath))
            return Fail(templateName);
        try
        {
            using var src = Cv2.ImRead(sourceImagePath);
            using var tpl = Cv2.ImRead(templateImagePath);
            if (src.Empty() || tpl.Empty()) return Fail(templateName);
            return MatchCore(src, tpl, threshold, templateName);
        }
        catch
        {
            return Fail(templateName);
        }
    }

    /// <summary>Match when source is Bitmap and template is a file path.</summary>
    public TemplateMatchResult MatchWithTemplateFile(
        Bitmap sourceImage,
        string templateImagePath,
        double threshold = DefaultThreshold,
        string? templateName = null)
    {
        if (sourceImage == null || string.IsNullOrWhiteSpace(templateImagePath) || !File.Exists(templateImagePath))
            return Fail(templateName);
        try
        {
            using var src = BitmapConverter.ToMat(sourceImage);
            using var tpl = Cv2.ImRead(templateImagePath);
            if (tpl.Empty()) return Fail(templateName);
            return MatchCore(src, tpl, threshold, templateName);
        }
        catch
        {
            return Fail(templateName);
        }
    }

    /// <summary>
    /// Grayscale template matching with any TM_* method and optional alpha mask. 1:1 Python ImageMatcher._match_with_template.
    /// SQDIFF methods score as 1 - min. Returns Success=false (with Score) when below threshold.
    /// </summary>
    /// <param name="target">Target image (BGR, BGRA or gray).</param>
    /// <param name="template">Template image (BGR, BGRA or gray).</param>
    /// <param name="method">TM_* method (feature methods are rejected).</param>
    /// <param name="threshold">Score threshold.</param>
    /// <param name="useAlpha">Use the template alpha channel as mask when it has 4 channels.</param>
    /// <param name="templateName">Name for logs and result.</param>
    /// <param name="silent">Suppress debug logs.</param>
    public TemplateMatchResult MatchWithMethod(
        Mat target,
        Mat template,
        TemplateMatchMethod method,
        double threshold = DefaultThreshold,
        bool useAlpha = false,
        string? templateName = null,
        bool silent = false)
    {
        if (method.IsFeatureMethod())
            throw new ArgumentException($"Not a template matching method: {method.ToName()}", nameof(method));
        if (target == null || template == null || target.Empty() || template.Empty())
            return Fail(templateName);
        Mat? mask = null;
        Mat tplColor = template;
        try
        {
            if (useAlpha && template.Channels() == 4)
            {
                mask = template.ExtractChannel(3);
                tplColor = template.CvtColor(ColorConversionCodes.BGRA2BGR);
                if (!silent) ColorPrinter.Debug($"[DEBUG] {templateName}: Using alpha channel as mask");
            }
            using var grayTarget = ImageConvert.ToGray(target);
            using var grayTemplate = ImageConvert.ToGray(tplColor);
            int h = grayTemplate.Rows, w = grayTemplate.Cols;
            if (grayTarget.Width < w || grayTarget.Height < h)
                return Fail(templateName);
            using var result = new Mat();
            Cv2.MatchTemplate(grayTarget, grayTemplate, result, method.ToOpenCv(), mask ?? (InputArray?)null);
            Cv2.MinMaxLoc(result, out double minVal, out double maxVal, out OpenCvSharp.Point minLoc, out OpenCvSharp.Point maxLoc);
            double matchVal = method.IsSqDiff() ? 1 - minVal : maxVal;
            var best = method.IsSqDiff() ? minLoc : maxLoc;
            if (!silent)
                ColorPrinter.Debug($"[DEBUG] {templateName}: Template matching score: {matchVal:F3} (threshold: {threshold}, method: {method.ToName()})");
            if (matchVal < threshold)
            {
                if (!silent) ColorPrinter.Yellow($"[DEBUG] {templateName}: Template matching score too low");
                return Fail(templateName) with { Score = matchVal, MatchThreshold = threshold, Method = method };
            }
            var center = new Point2f((best.X + best.X + w) / 2f, (best.Y + best.Y + h) / 2f);
            if (!silent) ColorPrinter.Green($"[DEBUG] {templateName}: Template matching found match at ({center.X}, {center.Y})");
            return new TemplateMatchResult
            {
                Success = true,
                X = best.X,
                Y = best.Y,
                Width = w,
                Height = h,
                Score = matchVal,
                TemplateName = templateName,
                Center = center,
                Polygon = new[]
                {
                    new Point2f(best.X, best.Y), new Point2f(best.X + w, best.Y),
                    new Point2f(best.X + w, best.Y + h), new Point2f(best.X, best.Y + h)
                },
                NumMatches = (int)(matchVal * 100),
                MatchThreshold = threshold,
                Method = method
            };
        }
        finally
        {
            mask?.Dispose();
            if (!ReferenceEquals(tplColor, template)) tplColor.Dispose();
        }
    }

    private static TemplateMatchResult MatchCore(Mat source, Mat template, double threshold, string? templateName)
    {
        if (source.Width < template.Width || source.Height < template.Height)
            return Fail(templateName);
        using var result = new Mat();
        Cv2.MatchTemplate(source, template, result, TemplateMatchModes.CCoeffNormed);
        Cv2.MinMaxLoc(result, out _, out double maxVal, out _, out OpenCvSharp.Point maxLoc);
        bool success = maxVal >= threshold;
        return new TemplateMatchResult
        {
            Success = success,
            X = maxLoc.X,
            Y = maxLoc.Y,
            Width = template.Width,
            Height = template.Height,
            Score = maxVal,
            TemplateName = templateName
        };
    }

    private static TemplateMatchResult Fail(string? templateName) => new()
    {
        Success = false,
        X = 0,
        Y = 0,
        Width = 0,
        Height = 0,
        Score = 0,
        TemplateName = templateName
    };
}
