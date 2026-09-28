namespace DotCore.Utils.ImageContours;

/// <summary>Options for filtering contours by area and aspect ratio (button-like shapes).</summary>
public sealed class ContourFilterOptions
{
    /// <summary>Minimum area in pixels. Default <see cref="ContourFilterConstants.DefaultMinArea"/>.</summary>
    public int MinArea { get; set; } = ContourFilterConstants.DefaultMinArea;

    /// <summary>Maximum area in pixels; 0 = no cap. Default <see cref="ContourFilterConstants.DefaultMaxArea"/>.</summary>
    public int MaxArea { get; set; } = ContourFilterConstants.DefaultMaxArea;

    /// <summary>Minimum aspect ratio (width/height). Default <see cref="ContourFilterConstants.DefaultMinAspectRatio"/>.</summary>
    public double MinAspectRatio { get; set; } = ContourFilterConstants.DefaultMinAspectRatio;

    /// <summary>Maximum aspect ratio (width/height). Default <see cref="ContourFilterConstants.DefaultMaxAspectRatio"/>.</summary>
    public double MaxAspectRatio { get; set; } = ContourFilterConstants.DefaultMaxAspectRatio;
}
