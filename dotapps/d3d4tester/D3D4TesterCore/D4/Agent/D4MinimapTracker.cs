// PY-REF: none (DOT-only)
using DotCore.Common.Navigation;
using DotCore.MinimapNav;
using OpenCvSharp;

namespace DotApps.d3d4tester.Core.D4.Agent;

/// <summary>
/// Map tracking from the hero-centred minimap: odometry by phase correlation of consecutive minimap crops (the map content moves
/// opposite to the hero), and an occupancy grid filled from the walkable mask (grey low-saturation floor between the configured
/// value limits) sampled inside the round minimap. Exploration goes to the nearest reachable frontier (free cell next to a
/// never-seen cell) along an A* path; cells ahead of a stuck hero are marked blocked. One instance per session.
/// </summary>
public sealed class D4MinimapTracker : IDisposable
{
    private const int Size = D4AgentConstants.MapGridSize;
    private const int Cell = D4AgentConstants.MapCellPixels;

    private readonly ushort[] _seen = new ushort[Size * Size];
    private readonly ushort[] _free = new ushort[Size * Size];
    private readonly bool[] _blocked = new bool[Size * Size];
    private readonly List<(GridPoint Cell, DateTime UntilUtc)> _skippedFrontiers = new();
    private readonly D4AgentSettings _settings;
    private readonly MinimapNavOptions _walkable;
    private Mat? _previous;
    private Mat? _window;
    private Mat? _lastMask;
    private Point2d _position;
    private int _minX = Size, _minY = Size, _maxX = -1, _maxY = -1;
    private int _frontierCount;

    public D4MinimapTracker(D4AgentSettings settings)
    {
        _settings = settings;
        _walkable = D4RouteGuide.NavOptions(settings, obstacleInflatePixels: 0);
    }

    public Point2d Position => _position;

    public GridPoint PlayerCell => new((int)Math.Floor(_position.X / Cell) + Size / 2, (int)Math.Floor(_position.Y / Cell) + Size / 2);

    /// <summary>Walkable mask of the last minimap crop (standard size), for calibration images; owned by the tracker.</summary>
    public Mat? LastMask => _lastMask;

    public D4MapStatus Update(D4Frame frame)
    {
        var region = frame.Scale(D4StandardCoords.Minimap);
        if (region.Width <= 0 || region.Height <= 0) return Status(default, false);
        using var crop = new Mat(frame.Image, region);
        using var minimap = new Mat();
        Cv2.Resize(crop, minimap, new Size(D4AgentConstants.MinimapStdWidth, D4AgentConstants.MinimapStdHeight), interpolation: InterpolationFlags.Area);

        var gray = new Mat();
        using (var g8 = new Mat())
        {
            Cv2.CvtColor(minimap, g8, ColorConversionCodes.BGR2GRAY);
            g8.ConvertTo(gray, MatType.CV_32F);
        }
        Point2d step = default;
        bool reliable = false;
        if (_previous != null)
        {
            _window ??= CreateHanning(gray.Size());
            var shift = Cv2.PhaseCorrelate(_previous, gray, _window, out double response);
            double length = Math.Sqrt(shift.X * shift.X + shift.Y * shift.Y);
            if (response >= D4AgentConstants.OdometryMinResponse && length <= D4AgentConstants.OdometryMaxShift)
            {
                step = new Point2d(-shift.X, -shift.Y);
                reliable = true;
            }
        }
        _previous?.Dispose();
        _previous = gray;
        _position = new Point2d(_position.X + step.X, _position.Y + step.Y);

        _lastMask?.Dispose();
        _lastMask = WalkableMask(minimap);
        Integrate(_lastMask);
        return Status(step, reliable);
    }

    /// <summary>Unit direction in minimap pixels toward the next waypoint to the nearest reachable frontier; null when nothing is left.</summary>
    public Point2d? NextExploreDirection()
    {
        var now = DateTime.UtcNow;
        _skippedFrontiers.RemoveAll(s => s.UntilUtc <= now);
        if (_maxX < 0) return null;
        int ox = Math.Max(0, _minX - 1), oy = Math.Max(0, _minY - 1);
        int w = Math.Min(Size - 1, _maxX + 1) - ox + 1, h = Math.Min(Size - 1, _maxY + 1) - oy + 1;
        var player = PlayerCell;
        var local = new GridPoint(player.X - ox, player.Y - oy);
        var frontiers = FrontierExplorer.Find(w, h, (x, y) => State(x + ox, y + oy), local, D4AgentConstants.FrontierMinSize,
            f => _skippedFrontiers.Any(s => s.Cell.DistanceTo(new GridPoint(f.X + ox, f.Y + oy)) <= D4AgentConstants.FrontierMinSize));
        _frontierCount = frontiers.Count;
        foreach (var frontier in frontiers.Take(D4AgentConstants.FrontierCandidates))
        {
            var path = GridPathfinder.FindPath(w, h, (x, y) => (x == local.X && y == local.Y) || State(x + ox, y + oy) == GridCellState.Free,
                local, frontier.Target);
            if (path == null || path.Count < 2) continue;
            var waypoint = path[Math.Min(D4AgentConstants.PathLookaheadCells, path.Count - 1)];
            return Normalize(waypoint.X - local.X, waypoint.Y - local.Y);
        }
        return frontiers.Count > 0 ? Normalize(frontiers[0].Target.X - local.X, frontiers[0].Target.Y - local.Y) : null;
    }

    /// <summary>Stuck while heading this way: block the cells just ahead and skip the frontier in that direction for a while.</summary>
    public void MarkBlocked(Point2d direction)
    {
        var player = PlayerCell;
        for (int d = 1; d <= 2; d++)
        {
            int x = player.X + (int)Math.Round(direction.X * d), y = player.Y + (int)Math.Round(direction.Y * d);
            if (x >= 0 && y >= 0 && x < Size && y < Size) _blocked[y * Size + x] = true;
        }
        var ahead = new GridPoint(player.X + (int)Math.Round(direction.X * D4AgentConstants.PathLookaheadCells),
            player.Y + (int)Math.Round(direction.Y * D4AgentConstants.PathLookaheadCells));
        _skippedFrontiers.Add((ahead, DateTime.UtcNow.AddSeconds(D4AgentConstants.BlacklistSeconds)));
    }

    /// <summary>Minimap direction (pixels) rotated into screen space by the configured minimap rotation.</summary>
    public Point2d ToScreenDirection(Point2d mapDirection)
    {
        double rad = _settings.MinimapRotationDeg * Math.PI / 180.0;
        double cos = Math.Cos(rad), sin = Math.Sin(rad);
        return new Point2d(mapDirection.X * cos - mapDirection.Y * sin, mapDirection.X * sin + mapDirection.Y * cos);
    }

    public void Dispose()
    {
        _previous?.Dispose();
        _window?.Dispose();
        _lastMask?.Dispose();
    }

    private GridCellState State(int x, int y)
    {
        int i = y * Size + x;
        if (_blocked[i]) return GridCellState.Blocked;
        if (_seen[i] < D4AgentConstants.MapMinSeenForState) return GridCellState.Unknown;
        return _free[i] >= _seen[i] * D4AgentConstants.MapFreeVoteRatio ? GridCellState.Free : GridCellState.Blocked;
    }

    private Mat WalkableMask(Mat minimap) => WalkableGrid.WalkableMask(minimap, _walkable);

    /// <summary>Votes one sample per cell inside the round minimap; the hero's own cell neighbourhood always counts as free.</summary>
    private void Integrate(Mat mask)
    {
        int cx = mask.Cols / 2, cy = mask.Rows / 2;
        double radius = Math.Min(mask.Cols, mask.Rows) * D4AgentConstants.MinimapUsableRadiusRatio;
        double r2 = radius * radius;
        var player = PlayerCell;
        for (int py = cy - (int)radius; py <= cy + (int)radius; py += Cell)
        {
            for (int px = cx - (int)radius; px <= cx + (int)radius; px += Cell)
            {
                double dx = px - cx, dy = py - cy;
                if (dx * dx + dy * dy > r2 || px < 0 || py < 0 || px >= mask.Cols || py >= mask.Rows) continue;
                int gx = player.X + (int)Math.Round(dx / Cell), gy = player.Y + (int)Math.Round(dy / Cell);
                if (gx < 0 || gy < 0 || gx >= Size || gy >= Size) continue;
                int i = gy * Size + gx;
                bool own = Math.Abs(gx - player.X) <= 1 && Math.Abs(gy - player.Y) <= 1;
                if (_seen[i] < ushort.MaxValue)
                {
                    _seen[i]++;
                    if (own || mask.At<byte>(py, px) != 0) _free[i]++;
                }
                _minX = Math.Min(_minX, gx);
                _minY = Math.Min(_minY, gy);
                _maxX = Math.Max(_maxX, gx);
                _maxY = Math.Max(_maxY, gy);
            }
        }
    }

    private D4MapStatus Status(Point2d step, bool reliable)
    {
        int free = 0;
        if (_maxX >= 0)
        {
            for (int y = _minY; y <= _maxY; y++)
                for (int x = _minX; x <= _maxX; x++)
                    if (State(x, y) == GridCellState.Free) free++;
        }
        return new D4MapStatus(_position, step, reliable, free, _frontierCount);
    }

    private static Mat CreateHanning(Size size)
    {
        var window = new Mat();
        Cv2.CreateHanningWindow(window, size, MatType.CV_32F);
        return window;
    }

    private static Point2d Normalize(double x, double y)
    {
        double length = Math.Sqrt(x * x + y * y);
        return length <= 0 ? default : new Point2d(x / length, y / length);
    }
}
