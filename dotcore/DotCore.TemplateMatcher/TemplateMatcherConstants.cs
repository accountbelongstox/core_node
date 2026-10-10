// PY-REF: dotapps/d3d4tester/reference/py_d3check/share/scaled_template_matcher_base.py
namespace DotCore.TemplateMatcher;

/// <summary>
/// Constants for template matching. No magic literals in public API defaults; use these names.
/// </summary>
public static class TemplateMatcherConstants
{
    /// <summary>Default match threshold for TM_CCOEFF_NORMED (typically 0.8). Used when threshold is not specified.</summary>
    public const double DefaultMatchThreshold = 0.8;

    /// <summary>ImageMatcher defaults. 1:1 Python ImageMatcher.__init__.</summary>
    public const double DefaultRatioThresh = 0.75;
    public const int DefaultMinInliers = 8;
    public const int DefaultNFeatures = 5000;
    public const double DefaultRansacThreshold = 5.0;

    /// <summary>Scaled-matcher feature defaults. 1:1 Python image_matcher_registry.get_image_matcher_for_method.</summary>
    public const double ScaledRatioThresh = 0.80;
    public const int ScaledMinInliers = 4;
    public const int ScaledNFeatures = 10000;

    /// <summary>Default method name when a template config has none. 1:1 cfg.get("match_method", "ORB").</summary>
    public const string DefaultMatchMethodName = "ORB";

    /// <summary>Scale treated as 1.0 (no resize) when |scale - 1| is below this.</summary>
    public const double ScaleEpsilon = 0.001;

    /// <summary>Decimals of scale factors used in the scaled-template cache key.</summary>
    public const int ScaleCacheDecimals = 4;

    /// <summary>Left region ratio for bag_opened_indicator (left 30% = blacksmith). 1:1 LEFT_REGION_RATIO.</summary>
    public const double LeftRegionRatio = 0.3;

    /// <summary>Text schematic grid size. 1:1 format_match_schematic defaults.</summary>
    public const int SchematicGridCols = 40;
    public const int SchematicGridRows = 14;

    /// <summary>Timestamp format for debug image filenames (milliseconds).</summary>
    public const string DebugTimestampFormat = "yyyyMMdd_HHmmss_fff";
}
