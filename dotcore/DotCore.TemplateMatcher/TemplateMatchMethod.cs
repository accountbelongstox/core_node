using OpenCvSharp;

namespace DotCore.TemplateMatcher;

/// <summary>Matching method: OpenCV TM_* template matching or SIFT/ORB/AKAZE feature matching. 1:1 Python ImageMatcher detection_method names.</summary>
public enum TemplateMatchMethod
{
    TmCCoeff,
    TmCCoeffNormed,
    TmCCorr,
    TmCCorrNormed,
    TmSqDiff,
    TmSqDiffNormed,
    Sift,
    Orb,
    Akaze
}

/// <summary>Name/OpenCV mapping for <see cref="TemplateMatchMethod"/>. Names match the Python config strings ("TM_CCOEFF_NORMED", "ORB", ...).</summary>
public static class TemplateMatchMethods
{
    private static readonly Dictionary<string, TemplateMatchMethod> ByName = new(StringComparer.OrdinalIgnoreCase)
    {
        ["TM_CCOEFF"] = TemplateMatchMethod.TmCCoeff,
        ["TM_CCOEFF_NORMED"] = TemplateMatchMethod.TmCCoeffNormed,
        ["TM_CCORR"] = TemplateMatchMethod.TmCCorr,
        ["TM_CCORR_NORMED"] = TemplateMatchMethod.TmCCorrNormed,
        ["TM_SQDIFF"] = TemplateMatchMethod.TmSqDiff,
        ["TM_SQDIFF_NORMED"] = TemplateMatchMethod.TmSqDiffNormed,
        ["SIFT"] = TemplateMatchMethod.Sift,
        ["ORB"] = TemplateMatchMethod.Orb,
        ["AKAZE"] = TemplateMatchMethod.Akaze,
    };

    /// <summary>All supported names (feature methods first). 1:1 Python error message list.</summary>
    public static readonly IReadOnlyList<string> SupportedNames = new[]
    {
        "SIFT", "ORB", "AKAZE", "TM_CCOEFF", "TM_CCOEFF_NORMED", "TM_CCORR", "TM_CCORR_NORMED", "TM_SQDIFF", "TM_SQDIFF_NORMED"
    };

    /// <summary>Parse a config name (case-insensitive). Unknown names throw (1:1 Python ValueError, no fallback).</summary>
    public static TemplateMatchMethod Parse(string name)
    {
        if (name != null && ByName.TryGetValue(name.Trim(), out var m)) return m;
        throw new ArgumentException($"Unknown matching method: {name}. Supported methods are: {string.Join(", ", SupportedNames)}", nameof(name));
    }

    /// <summary>Try-parse a config name (case-insensitive).</summary>
    public static bool TryParse(string? name, out TemplateMatchMethod method)
    {
        method = TemplateMatchMethod.Orb;
        return name != null && ByName.TryGetValue(name.Trim(), out method);
    }

    /// <summary>Config/display name ("TM_CCOEFF_NORMED", "ORB", ...).</summary>
    public static string ToName(this TemplateMatchMethod method) => method switch
    {
        TemplateMatchMethod.TmCCoeff => "TM_CCOEFF",
        TemplateMatchMethod.TmCCoeffNormed => "TM_CCOEFF_NORMED",
        TemplateMatchMethod.TmCCorr => "TM_CCORR",
        TemplateMatchMethod.TmCCorrNormed => "TM_CCORR_NORMED",
        TemplateMatchMethod.TmSqDiff => "TM_SQDIFF",
        TemplateMatchMethod.TmSqDiffNormed => "TM_SQDIFF_NORMED",
        TemplateMatchMethod.Sift => "SIFT",
        TemplateMatchMethod.Akaze => "AKAZE",
        _ => "ORB"
    };

    /// <summary>True for SIFT/ORB/AKAZE.</summary>
    public static bool IsFeatureMethod(this TemplateMatchMethod method) =>
        method is TemplateMatchMethod.Sift or TemplateMatchMethod.Orb or TemplateMatchMethod.Akaze;

    /// <summary>True for TM_SQDIFF / TM_SQDIFF_NORMED (lower is better; score = 1 - min).</summary>
    public static bool IsSqDiff(this TemplateMatchMethod method) =>
        method is TemplateMatchMethod.TmSqDiff or TemplateMatchMethod.TmSqDiffNormed;

    /// <summary>OpenCV template mode for a TM_* method; throws for feature methods.</summary>
    public static TemplateMatchModes ToOpenCv(this TemplateMatchMethod method) => method switch
    {
        TemplateMatchMethod.TmCCoeff => TemplateMatchModes.CCoeff,
        TemplateMatchMethod.TmCCoeffNormed => TemplateMatchModes.CCoeffNormed,
        TemplateMatchMethod.TmCCorr => TemplateMatchModes.CCorr,
        TemplateMatchMethod.TmCCorrNormed => TemplateMatchModes.CCorrNormed,
        TemplateMatchMethod.TmSqDiff => TemplateMatchModes.SqDiff,
        TemplateMatchMethod.TmSqDiffNormed => TemplateMatchModes.SqDiffNormed,
        _ => throw new ArgumentOutOfRangeException(nameof(method), method, null)
    };
}
