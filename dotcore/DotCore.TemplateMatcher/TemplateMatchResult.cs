using OpenCvSharp;

namespace DotCore.TemplateMatcher;

/// <summary>
/// Single template match result. Aligned with PY match_result (success, center, score).
/// </summary>
public sealed record TemplateMatchResult
{
    /// <summary>Whether the match succeeded (score &gt;= threshold).</summary>
    public bool Success { get; init; }

    /// <summary>Match rectangle top-left X (in source image coordinates).</summary>
    public int X { get; init; }

    /// <summary>Match rectangle top-left Y (in source image coordinates).</summary>
    public int Y { get; init; }

    /// <summary>Match rectangle width (same as template).</summary>
    public int Width { get; init; }

    /// <summary>Match rectangle height (same as template).</summary>
    public int Height { get; init; }

    /// <summary>Center X (for click): truncated <see cref="Center"/> when set, else X + Width/2.</summary>
    public int CenterX => Center is { } c ? (int)c.X : X + (Width >> 1);

    /// <summary>Center Y (for click): truncated <see cref="Center"/> when set, else Y + Height/2.</summary>
    public int CenterY => Center is { } c ? (int)c.Y : Y + (Height >> 1);

    /// <summary>Exact match center (feature: polygon mean; TM: rectangle center). 1:1 Python result["center"].</summary>
    public Point2f? Center { get; init; }

    /// <summary>Four corners in source coordinates (TL, TR, BR, BL). 1:1 Python result["polygon"].</summary>
    public IReadOnlyList<Point2f>? Polygon { get; init; }

    /// <summary>Good feature matches, or int(score * 100) for TM methods. 1:1 Python num_matches.</summary>
    public int NumMatches { get; init; }

    /// <summary>Threshold used (ratio threshold for feature methods, score threshold for TM). 1:1 Python match_threshold.</summary>
    public double MatchThreshold { get; init; }

    /// <summary>Auto-scale applied to the template by the matcher (1.0 when none). 1:1 Python auto_scale_x/auto_scale_y.</summary>
    public double AutoScaleX { get; init; } = 1.0;
    public double AutoScaleY { get; init; } = 1.0;

    /// <summary>Method used, or null for the legacy color TM_CCOEFF_NORMED API. 1:1 Python matching_method.</summary>
    public TemplateMatchMethod? Method { get; init; }

    /// <summary>Match score (e.g. [0,1] for TM_CCOEFF_NORMED; higher = more similar).</summary>
    public double Score { get; init; }

    /// <summary>Template name if provided by caller (for logging/debug).</summary>
    public string? TemplateName { get; init; }
}
