// PY-REF: none (DOT-only)
using DotCore.Common.Navigation;
using DotCore.MinimapPath;
using OpenCvSharp;

namespace DotCore.MinimapNav;

/// <summary>
/// Plans a route on one minimap frame when the game draws none: walkable grid (<see cref="WalkableGrid"/>), A* via
/// <see cref="GridPathfinder"/> from the player to the target (snapped to the nearest free cell), then simplified waypoints and heading.
/// For multi-frame exploration use <see cref="FrontierExplorer"/> over an accumulated grid.
/// </summary>
public static class MinimapPathPlanner
{
    public const string ErrorNoImage = "No image";
    public const string ErrorEmptyMapArea = "Empty minimap area";
    public const string ErrorGoalBlocked = "No free cell near the target";
    public const string ErrorUnreachable = "Target unreachable";

    /// <summary>Plan from <paramref name="player"/> to <paramref name="target"/> (image coordinates) inside the map area.</summary>
    public static MinimapRouteResult Plan(Mat bgr, Rect mapRect, Point player, Point target, MinimapNavOptions options)
    {
        if (bgr == null || bgr.Empty()) return MinimapRouteResult.Fail(null, ErrorNoImage);
        var map = mapRect & new Rect(0, 0, bgr.Width, bgr.Height);
        if (map.Width <= 0 || map.Height <= 0) return MinimapRouteResult.Fail(null, ErrorEmptyMapArea);

        using var mapImage = new Mat(bgr, map);
        var grid = WalkableGrid.FromImage(mapImage, options);
        return Plan(grid, map, player, target, options);
    }

    /// <summary>Plan on a prepared grid whose pixel origin is <paramref name="map"/>.Location.</summary>
    public static MinimapRouteResult Plan(WalkableGrid grid, Rect map, Point player, Point target, MinimapNavOptions options)
    {
        var offset = map.Location;
        var playerLocal = player - offset;
        var start = grid.ToCell(playerLocal);
        grid.ForceFree(start, options.PlayerFreeRadiusCells);
        if (grid.NearestFree(grid.ToCell(target - offset), options.GoalSnapRadiusCells) is not { } goal)
            return MinimapRouteResult.Fail(map, ErrorGoalBlocked);

        var cells = GridPathfinder.FindPath(grid.Width, grid.Height, grid.IsFree, start, goal);
        if (cells == null) return MinimapRouteResult.Fail(map, ErrorUnreachable);

        var path = cells.Select(grid.ToPixel).ToList();
        var waypoints = RoutePathTracer.Simplify(path, options.SimplifyRatio);
        var heading = RoutePathTracer.Heading(waypoints, playerLocal, options.HeadingWaypointIndex);
        return new MinimapRouteResult(
            map,
            player,
            Array.Empty<Point>(),
            path.Select(p => p + offset).ToArray(),
            waypoints.Select(p => p + offset).ToArray(),
            heading,
            DateTime.Now);
    }
}
