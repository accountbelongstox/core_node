// PY-REF: scripts/analysis/d4_minimap_path.py
using OpenCvSharp;

namespace DotCore.MinimapPath;

/// <summary>
/// Orders route dots into a polyline from the player, simplifies it to waypoints and derives the heading.
/// 1:1 Python scripts/analysis/d4_minimap_path.py chain_dots, simplify and the heading in main.
/// </summary>
public static class RoutePathTracer
{
    /// <summary>Greedy nearest-neighbor ordering starting from the dot closest to <paramref name="start"/>.</summary>
    public static List<Point> ChainDots(IReadOnlyList<Point> centers, Point start)
    {
        var ordered = new List<Point>(centers.Count);
        if (centers.Count == 0) return ordered;
        var remaining = new List<Point>(centers);
        var cur = remaining.MinBy(p => RouteDotExtractor.Distance(p, start));
        while (true)
        {
            ordered.Add(cur);
            remaining.Remove(cur);
            if (remaining.Count == 0) break;
            var from = cur;
            cur = remaining.MinBy(p => RouteDotExtractor.Distance(p, from));
        }
        return ordered;
    }

    /// <summary>Douglas-Peucker on an ordered open polyline; epsilon = max(1, path length * ratio).</summary>
    public static Point[] Simplify(IReadOnlyList<Point> points, double ratio)
    {
        if (points.Count < 3) return points.ToArray();
        double total = 0;
        for (int i = 0; i < points.Count - 1; i++) total += RouteDotExtractor.Distance(points[i], points[i + 1]);
        return Cv2.ApproxPolyDP(points, Math.Max(1.0, total * ratio), false);
    }

    /// <summary>Degrees from the player to waypoint min(index, n-1); 0 = east, 90 = north. Null with fewer than 2 waypoints.</summary>
    public static double? Heading(IReadOnlyList<Point> waypoints, Point player, int index)
    {
        if (waypoints.Count < 2) return null;
        var target = waypoints[Math.Min(index, waypoints.Count - 1)];
        return Math.Atan2(-(target.Y - player.Y), target.X - player.X) * 180.0 / Math.PI;
    }
}
