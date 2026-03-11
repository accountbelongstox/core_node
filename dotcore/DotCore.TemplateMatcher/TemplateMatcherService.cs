using System.Drawing;
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
