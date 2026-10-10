// PY-REF: none (DOT-only)
using System;
using System.Collections.Generic;
using System.Linq;

namespace DotCore.Common.Navigation;

/// <summary>A frontier cluster: its size, centroid and the member cell nearest to the reference point (the cell to walk to).</summary>
public sealed record GridFrontier(GridPoint Target, GridPoint Centroid, int Size, double Distance);

/// <summary>
/// Frontier-based exploration: free cells that touch a never-observed cell (4-neighbourhood), grouped by 8-connectivity.
/// Clusters below minSize are noise; the result is ordered by distance from the reference point (nearest first).
/// </summary>
public static class FrontierExplorer
{
    private static readonly (int Dx, int Dy)[] Four = { (1, 0), (-1, 0), (0, 1), (0, -1) };
    private static readonly (int Dx, int Dy)[] Eight = { (1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1) };

    public static IReadOnlyList<GridFrontier> Find(int width, int height, Func<int, int, GridCellState> cell, GridPoint from, int minSize = 3,
        Func<GridPoint, bool>? exclude = null)
    {
        var isFrontier = new bool[width * height];
        for (int y = 0; y < height; y++)
        {
            for (int x = 0; x < width; x++)
            {
                if (cell(x, y) != GridCellState.Free) continue;
                foreach (var (dx, dy) in Four)
                {
                    int nx = x + dx, ny = y + dy;
                    if (nx < 0 || ny < 0 || nx >= width || ny >= height || cell(nx, ny) != GridCellState.Unknown) continue;
                    isFrontier[y * width + x] = true;
                    break;
                }
            }
        }

        var visited = new bool[width * height];
        var result = new List<GridFrontier>();
        var stack = new Stack<int>();
        for (int i = 0; i < isFrontier.Length; i++)
        {
            if (!isFrontier[i] || visited[i]) continue;
            var members = new List<GridPoint>();
            visited[i] = true;
            stack.Push(i);
            while (stack.Count > 0)
            {
                int c = stack.Pop();
                int cx = c % width, cy = c / width;
                members.Add(new GridPoint(cx, cy));
                foreach (var (dx, dy) in Eight)
                {
                    int nx = cx + dx, ny = cy + dy;
                    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                    int n = ny * width + nx;
                    if (!isFrontier[n] || visited[n]) continue;
                    visited[n] = true;
                    stack.Push(n);
                }
            }
            if (members.Count < minSize) continue;
            var nearest = members.MinBy(m => m.DistanceTo(from));
            if (exclude != null && exclude(nearest)) continue;
            var centroid = new GridPoint((int)Math.Round(members.Average(m => m.X)), (int)Math.Round(members.Average(m => m.Y)));
            result.Add(new GridFrontier(nearest, centroid, members.Count, nearest.DistanceTo(from)));
        }
        return result.OrderBy(f => f.Distance).ToList();
    }
}
