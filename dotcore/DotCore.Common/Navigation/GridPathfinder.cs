// PY-REF: none (DOT-only)
using System;
using System.Collections.Generic;

namespace DotCore.Common.Navigation;

/// <summary>Cell of a 2D grid (column X, row Y).</summary>
public readonly record struct GridPoint(int X, int Y)
{
    public double DistanceTo(GridPoint other) => Math.Sqrt((double)(X - other.X) * (X - other.X) + (double)(Y - other.Y) * (Y - other.Y));
}

/// <summary>State of an occupancy grid cell: never observed, walkable, or not walkable.</summary>
public enum GridCellState : byte
{
    Unknown = 0,
    Free = 1,
    Blocked = 2,
}

/// <summary>
/// A* on an 8-connected grid (octile heuristic, diagonal steps only when both side cells are walkable, so paths never cut corners).
/// </summary>
public static class GridPathfinder
{
    private const double StraightCost = 1.0;
    private static readonly double DiagonalCost = Math.Sqrt(2.0);
    private static readonly (int Dx, int Dy)[] Neighbours =
    {
        (1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1),
    };

    /// <summary>Cells from start to goal (both included); null when unreachable, out of bounds or maxExpanded cells were searched.</summary>
    public static IReadOnlyList<GridPoint>? FindPath(int width, int height, Func<int, int, bool> walkable, GridPoint start, GridPoint goal,
        int maxExpanded = 200_000)
    {
        if (!InBounds(width, height, start) || !InBounds(width, height, goal)) return null;
        if (start == goal) return new[] { start };
        if (!walkable(goal.X, goal.Y)) return null;

        int count = width * height;
        var gScore = new double[count];
        var cameFrom = new int[count];
        var closed = new bool[count];
        Array.Fill(gScore, double.PositiveInfinity);
        Array.Fill(cameFrom, -1);
        int startIndex = start.Y * width + start.X;
        int goalIndex = goal.Y * width + goal.X;
        gScore[startIndex] = 0;
        var open = new PriorityQueue<int, double>();
        open.Enqueue(startIndex, Heuristic(start, goal));
        int expanded = 0;

        while (open.TryDequeue(out int current, out _))
        {
            if (closed[current]) continue;
            if (current == goalIndex) return Reconstruct(cameFrom, current, width);
            closed[current] = true;
            if (++expanded > maxExpanded) return null;
            int cx = current % width, cy = current / width;
            foreach (var (dx, dy) in Neighbours)
            {
                int nx = cx + dx, ny = cy + dy;
                if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                int next = ny * width + nx;
                if (closed[next] || !walkable(nx, ny)) continue;
                bool diagonal = dx != 0 && dy != 0;
                if (diagonal && (!walkable(cx + dx, cy) || !walkable(cx, cy + dy))) continue;
                double tentative = gScore[current] + (diagonal ? DiagonalCost : StraightCost);
                if (tentative >= gScore[next]) continue;
                gScore[next] = tentative;
                cameFrom[next] = current;
                open.Enqueue(next, tentative + Heuristic(new GridPoint(nx, ny), goal));
            }
        }
        return null;
    }

    public static bool InBounds(int width, int height, GridPoint p) => p.X >= 0 && p.Y >= 0 && p.X < width && p.Y < height;

    private static double Heuristic(GridPoint a, GridPoint b)
    {
        int dx = Math.Abs(a.X - b.X), dy = Math.Abs(a.Y - b.Y);
        return StraightCost * (dx + dy) + (DiagonalCost - 2 * StraightCost) * Math.Min(dx, dy);
    }

    private static IReadOnlyList<GridPoint> Reconstruct(int[] cameFrom, int current, int width)
    {
        var path = new List<GridPoint>();
        for (int i = current; i >= 0; i = cameFrom[i]) path.Add(new GridPoint(i % width, i / width));
        path.Reverse();
        return path;
    }
}
