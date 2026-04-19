namespace DotCore.TemplateMatcher;

/// <summary>
/// Single template match result. Aligned with PY match_result (success, center, score).
/// </summary>
public sealed class TemplateMatchResult
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

    /// <summary>Center X (for click); CenterX = X + Width/2.</summary>
    public int CenterX => X + (Width >> 1);

    /// <summary>Center Y (for click); CenterY = Y + Height/2.</summary>
    public int CenterY => Y + (Height >> 1);

    /// <summary>Match score (e.g. [0,1] for TM_CCOEFF_NORMED; higher = more similar).</summary>
    public double Score { get; init; }

    /// <summary>Template name if provided by caller (for logging/debug).</summary>
    public string? TemplateName { get; init; }
}
