// PY-REF: scripts/analysis/d4_minimap_path.py
using DotCore.Utils.ImageColor;

namespace DotCore.MinimapPath;

/// <summary>
/// Tuning of the minimap route recognizer; ratios scale with the minimap size. Games define one instance with their values.
/// 1:1 Python scripts/analysis/d4_minimap_path.py module constants.
/// </summary>
public sealed class MinimapRouteOptions
{
    /// <summary>HSV range of route dot cores (bright, low saturation).</summary>
    public required HsvRange DotHsv { get; init; }

    /// <summary>HSV range of the minimap background used to locate the minimap.</summary>
    public required HsvRange BackgroundHsv { get; init; }

    /// <summary>Dot component area bounds as fractions of the minimap area (min is at least <see cref="DotAreaMinPixels"/>).</summary>
    public required double DotAreaMinRatio { get; init; }
    public required double DotAreaMaxRatio { get; init; }
    public double DotAreaMinPixels { get; init; } = 3.0;

    /// <summary>Maximum bounding-box aspect ratio of a dot (drops text strokes).</summary>
    public double DotMaxAspect { get; init; } = 2.0;

    /// <summary>Minimum mean V of the dot minus mean V of its outline ring.</summary>
    public required double DotOutlineContrast { get; init; }

    /// <summary>Square kernel size used to grow the outline ring around a dot.</summary>
    public required int DotRingKernel { get; init; }

    /// <summary>Top (label bar) and bottom (compass/UI) strips of the minimap rect that are not map.</summary>
    public required double TopStripRatio { get; init; }
    public required double BottomStripRatio { get; init; }

    /// <summary>Nearest-neighbor spacing band of route dots, as fractions of the map width.</summary>
    public required double NearestMinRatio { get; init; }
    public required double NearestMaxRatio { get; init; }

    /// <summary>Link distance that groups dots into one chain, as a fraction of the map width.</summary>
    public required double LinkRatio { get; init; }

    /// <summary>Minimum dots of a chain fragment that counts as route.</summary>
    public required int MinChainDots { get; init; }

    /// <summary>Douglas-Peucker epsilon as a fraction of the path length (at least 1 px).</summary>
    public required double SimplifyRatio { get; init; }

    /// <summary>Player anchor inside the map area as fractions of its size (center for player-centered minimaps).</summary>
    public double PlayerAnchorXRatio { get; init; } = 0.5;
    public double PlayerAnchorYRatio { get; init; } = 0.5;

    /// <summary>Waypoint index (clamped) the heading points to from the player.</summary>
    public int HeadingWaypointIndex { get; init; } = 2;

    /// <summary>Area of the image searched for the minimap, as fractions (left, top, right, bottom).</summary>
    public required (double Left, double Top, double Right, double Bottom) RoiSearchArea { get; init; }

    /// <summary>Closing kernel size that merges the minimap background into one blob.</summary>
    public required int RoiCloseKernel { get; init; }

    /// <summary>Minimum minimap rect area as a fraction of the whole image.</summary>
    public required double RoiMinAreaRatio { get; init; }
}
