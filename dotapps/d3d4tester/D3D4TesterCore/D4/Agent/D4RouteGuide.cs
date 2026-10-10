// PY-REF: none (DOT-only)
using DotCore.MinimapNav;
using DotCore.MinimapPath;
using DotCore.Utils.ImageColor;
using OpenCvSharp;

namespace DotApps.d3d4tester.Core.D4.Agent;

/// <summary>Pinned route of one frame: the recognized route, the A* path toward the lookahead waypoint (empty when not planned)
/// and the unit minimap direction to walk (null when no route is pinned).</summary>
public sealed record D4RouteStatus(MinimapRouteResult Route, IReadOnlyList<Point> PlannedPath, Point2d? Direction)
{
    public bool Planned => PlannedPath.Count > 1;
}

/// <summary>
/// Follows the route the game draws after a map pin: recognizes the dotted route (<see cref="D4MinimapRouteDetector"/>), plans an
/// A* path on the current minimap's walkable area (<see cref="MinimapPathPlanner"/>) to the lookahead waypoint, and falls back to
/// the straight direction when the walkable area does not connect. Walkable colors are the agent's (shared with the tracker).
/// </summary>
public sealed class D4RouteGuide
{
    private readonly MinimapNavOptions _nav;

    public D4RouteGuide(D4AgentSettings settings) => _nav = NavOptions(settings, D4AgentConstants.RouteObstacleInflatePixels);

    /// <summary>Walkable-area options from the agent settings (grey low-saturation floor between the value limits).</summary>
    public static MinimapNavOptions NavOptions(D4AgentSettings s, int obstacleInflatePixels) => new()
    {
        WalkableHsv = new[]
        {
            new HsvRange(0, 180, 0, ToByte(s.WalkableSaturationMax), ToByte(s.WalkableValueMin), ToByte(s.WalkableValueMax)),
        },
        OpenKernel = D4AgentConstants.WalkableOpenKernel,
        ObstacleInflatePixels = obstacleInflatePixels,
        CellPixels = D4AgentConstants.RouteCellPixels,
        GoalSnapRadiusCells = D4AgentConstants.RouteGoalSnapCells,
        HeadingWaypointIndex = D4AgentConstants.RouteLookaheadWaypoint,
    };

    public D4RouteStatus Update(D4Frame frame)
    {
        var route = D4MinimapRouteDetector.Instance.Recognize(frame.Image, frame.Scale(D4StandardCoords.Minimap));
        if (!route.HasRoute || route.Player is not { } player || route.MapRect is not { } map)
            return new D4RouteStatus(route, Array.Empty<Point>(), null);

        var target = route.Waypoints[Math.Min(D4AgentConstants.RouteLookaheadWaypoint, route.Waypoints.Count - 1)];
        var plan = MinimapPathPlanner.Plan(frame.Image, map, player, target, _nav);
        var next = plan.HasRoute && plan.Waypoints.Count > 1 ? plan.Waypoints[1] : target;
        return new D4RouteStatus(route, plan.HasRoute ? plan.OrderedPath : Array.Empty<Point>(), Normalize(next.X - player.X, next.Y - player.Y));
    }

    private static byte ToByte(int value) => (byte)Math.Clamp(value, 0, 255);

    private static Point2d? Normalize(double x, double y)
    {
        double length = Math.Sqrt(x * x + y * y);
        return length < 1 ? null : new Point2d(x / length, y / length);
    }
}
