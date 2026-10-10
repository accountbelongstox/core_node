// PY-REF: none (DOT-only)
using DotCore.Utils.ImageColor;

namespace DotCore.MinimapPath;

/// <summary>Tuning of <see cref="RouteLineExtractor"/> for minimaps that draw the route as a solid colored line.</summary>
public sealed class RouteLineOptions
{
    /// <summary>HSV range of the route line pixels.</summary>
    public required HsvRange LineHsv { get; init; }

    /// <summary>Closing kernel size that bridges small gaps in the line before thinning.</summary>
    public int CloseKernel { get; init; } = 3;

    /// <summary>Line components smaller than this fraction of the map area are noise.</summary>
    public required double MinComponentAreaRatio { get; init; }

    /// <summary>Traced route shorter than this fraction of the map width means no route.</summary>
    public required double MinRouteLengthRatio { get; init; }

    /// <summary>Douglas-Peucker epsilon as a fraction of the path length (at least 1 px).</summary>
    public required double SimplifyRatio { get; init; }

    /// <summary>Player anchor inside the map area as fractions of its size.</summary>
    public double PlayerAnchorXRatio { get; init; } = 0.5;
    public double PlayerAnchorYRatio { get; init; } = 0.5;

    /// <summary>Waypoint index (clamped) the heading points to from the player.</summary>
    public int HeadingWaypointIndex { get; init; } = 2;
}
