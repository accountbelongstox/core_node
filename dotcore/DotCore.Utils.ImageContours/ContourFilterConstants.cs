namespace DotCore.Utils.ImageContours;

/// <summary>
/// Constants for contour filter options. No magic literals in public API defaults; use these names.
/// </summary>
public static class ContourFilterConstants
{
    /// <summary>Default minimum contour area in pixels (button-like shapes).</summary>
    public const int DefaultMinArea = 100;

    /// <summary>Default maximum contour area in pixels; 0 means no cap.</summary>
    public const int DefaultMaxArea = 0;

    /// <summary>Default minimum aspect ratio (width/height).</summary>
    public const double DefaultMinAspectRatio = 0.2;

    /// <summary>Default maximum aspect ratio (width/height).</summary>
    public const double DefaultMaxAspectRatio = 5.0;
}
