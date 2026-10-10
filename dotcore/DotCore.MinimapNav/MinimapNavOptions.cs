// PY-REF: none (DOT-only)
using DotCore.Utils.ImageColor;

namespace DotCore.MinimapNav;

/// <summary>Tuning of the walkable-area planner; games define one instance with their minimap colors.</summary>
public sealed class MinimapNavOptions
{
    /// <summary>HSV ranges of walkable floor pixels (union).</summary>
    public required IReadOnlyList<HsvRange> WalkableHsv { get; init; }

    /// <summary>Opening kernel that removes speckles from the walkable mask (1 = off).</summary>
    public int OpenKernel { get; init; } = 3;

    /// <summary>Obstacle inflation in pixels so paths keep clear of walls (0 = off).</summary>
    public int ObstacleInflatePixels { get; init; } = 2;

    /// <summary>Grid cell size in minimap pixels.</summary>
    public required int CellPixels { get; init; }

    /// <summary>Minimum walkable pixel fraction for a cell to be free.</summary>
    public double CellFreeRatio { get; init; } = 0.5;

    /// <summary>Search radius in cells for the nearest free cell when the goal cell is blocked.</summary>
    public int GoalSnapRadiusCells { get; init; } = 4;

    /// <summary>Player cell neighbourhood (Chebyshev radius in cells) always treated as free; the player icon covers the floor.</summary>
    public int PlayerFreeRadiusCells { get; init; } = 1;

    /// <summary>Douglas-Peucker epsilon as a fraction of the path length (at least 1 px).</summary>
    public double SimplifyRatio { get; init; } = 0.02;

    /// <summary>Waypoint index (clamped) the heading points to from the player.</summary>
    public int HeadingWaypointIndex { get; init; } = 2;
}
