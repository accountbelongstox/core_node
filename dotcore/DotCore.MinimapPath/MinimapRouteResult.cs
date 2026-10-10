// PY-REF: scripts/analysis/d4_minimap_path.py
using OpenCvSharp;

namespace DotCore.MinimapPath;

/// <summary>
/// Route recognized on a minimap; all points are in source image coordinates.
/// Heading: degrees from the player toward the route, 0 = east, 90 = north (image y up); null with fewer than 2 waypoints.
/// </summary>
public sealed record MinimapRouteResult(
    Rect? MapRect,
    Point? Player,
    IReadOnlyList<Point> Dots,
    IReadOnlyList<Point> OrderedPath,
    IReadOnlyList<Point> Waypoints,
    double? HeadingDegrees,
    DateTime DetectionTimestamp,
    string? Error = null,
    string? DebugImagePath = null)
{
    public bool Success => Error == null;

    public bool HasRoute => Waypoints.Count > 0;

    public static MinimapRouteResult Fail(Rect? mapRect, string error) =>
        new(mapRect, null, Array.Empty<Point>(), Array.Empty<Point>(), Array.Empty<Point>(), null, DateTime.Now, error);
}
