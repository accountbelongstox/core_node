// PY-REF: scripts/analysis/d4_minimap_path.py
using OpenCvSharp;

namespace DotCore.MinimapPath;

/// <summary>
/// Minimap route recognition: locate the minimap, extract outlined route dots, keep dot chains, order them from the player,
/// simplify to waypoints and compute the heading. Game-agnostic; games pass their <see cref="MinimapRouteOptions"/>.
/// 1:1 Python scripts/analysis/d4_minimap_path.py main.
/// </summary>
public static class MinimapRouteRecognizer
{
    public const string ErrorNoImage = "No image";
    public const string ErrorMinimapNotFound = "Minimap not found";
    public const string ErrorEmptyMapArea = "Empty minimap area";

    /// <summary>Find the minimap in <paramref name="bgr"/> (falls back to <paramref name="fallbackRect"/>) and recognize its route.</summary>
    public static MinimapRouteResult RecognizeAuto(Mat bgr, MinimapRouteOptions options, Rect? fallbackRect = null)
    {
        if (bgr == null || bgr.Empty()) return MinimapRouteResult.Fail(null, ErrorNoImage);
        var rect = MinimapRoiFinder.Find(bgr, options) ?? fallbackRect;
        return rect is { } r ? Recognize(bgr, r, options) : MinimapRouteResult.Fail(null, ErrorMinimapNotFound);
    }

    /// <summary>Recognize the route inside a known minimap rect (image coordinates, label and compass strips included).</summary>
    public static MinimapRouteResult Recognize(Mat bgr, Rect minimapRect, MinimapRouteOptions options)
    {
        if (bgr == null || bgr.Empty()) return MinimapRouteResult.Fail(null, ErrorNoImage);
        if (MinimapRoiFinder.MapArea(minimapRect, bgr.Size(), options) is not { } map)
            return MinimapRouteResult.Fail(null, ErrorEmptyMapArea);

        using var mapImage = new Mat(bgr, map);
        var dots = RouteDotExtractor.KeepRouteChains(RouteDotExtractor.ExtractDots(mapImage, options), map.Width, options);
        var playerLocal = new Point((int)(map.Width * options.PlayerAnchorXRatio), (int)(map.Height * options.PlayerAnchorYRatio));
        var ordered = RoutePathTracer.ChainDots(dots, playerLocal);
        var waypoints = RoutePathTracer.Simplify(ordered, options.SimplifyRatio);
        var heading = RoutePathTracer.Heading(waypoints, playerLocal, options.HeadingWaypointIndex);

        var offset = map.Location;
        return new MinimapRouteResult(
            map,
            playerLocal + offset,
            dots.Select(p => p + offset).ToArray(),
            ordered.Select(p => p + offset).ToArray(),
            waypoints.Select(p => p + offset).ToArray(),
            heading,
            DateTime.Now);
    }
}
