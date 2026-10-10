// PY-REF: none (DOT-only)
using DotCore.Common.Navigation;
using OpenCvSharp;

namespace DotCore.MinimapNav;

/// <summary>
/// Occupancy grid built from one minimap frame: walkable mask (HSV union, opening, obstacle inflation) downsampled to cells.
/// Coordinates are local to the map image passed to <see cref="FromImage"/>.
/// </summary>
public sealed class WalkableGrid
{
    private readonly bool[] _free;

    private WalkableGrid(int width, int height, int cellPixels, bool[] free)
    {
        Width = width;
        Height = height;
        CellPixels = cellPixels;
        _free = free;
    }

    public int Width { get; }
    public int Height { get; }
    public int CellPixels { get; }

    public bool IsFree(int x, int y) => x >= 0 && y >= 0 && x < Width && y < Height && _free[y * Width + x];

    public GridCellState State(int x, int y) => IsFree(x, y) ? GridCellState.Free : GridCellState.Blocked;

    public GridPoint ToCell(Point pixel) =>
        new(Math.Clamp(pixel.X / CellPixels, 0, Width - 1), Math.Clamp(pixel.Y / CellPixels, 0, Height - 1));

    public Point ToPixel(GridPoint cell) => new(cell.X * CellPixels + CellPixels / 2, cell.Y * CellPixels + CellPixels / 2);

    /// <summary>Mark the cells within a Chebyshev radius of <paramref name="center"/> free.</summary>
    public void ForceFree(GridPoint center, int radius)
    {
        for (int y = center.Y - radius; y <= center.Y + radius; y++)
            for (int x = center.X - radius; x <= center.X + radius; x++)
                if (x >= 0 && y >= 0 && x < Width && y < Height) _free[y * Width + x] = true;
    }

    /// <summary>Nearest free cell within <paramref name="radius"/> (ring by ring), or null.</summary>
    public GridPoint? NearestFree(GridPoint cell, int radius)
    {
        if (IsFree(cell.X, cell.Y)) return cell;
        for (int r = 1; r <= radius; r++)
        {
            GridPoint? best = null;
            double bestDistance = double.PositiveInfinity;
            for (int y = cell.Y - r; y <= cell.Y + r; y++)
            {
                for (int x = cell.X - r; x <= cell.X + r; x++)
                {
                    if (Math.Max(Math.Abs(x - cell.X), Math.Abs(y - cell.Y)) != r || !IsFree(x, y)) continue;
                    var candidate = new GridPoint(x, y);
                    double d = candidate.DistanceTo(cell);
                    if (d >= bestDistance) continue;
                    best = candidate;
                    bestDistance = d;
                }
            }
            if (best != null) return best;
        }
        return null;
    }

    /// <summary>Walkable mask of a map image (0/255). Caller disposes.</summary>
    public static Mat WalkableMask(Mat mapBgr, MinimapNavOptions options)
    {
        using var hsv = new Mat();
        Cv2.CvtColor(mapBgr, hsv, ColorConversionCodes.BGR2HSV);
        var mask = new Mat(mapBgr.Rows, mapBgr.Cols, MatType.CV_8UC1, Scalar.All(0));
        using var part = new Mat();
        foreach (var range in options.WalkableHsv)
        {
            Cv2.InRange(hsv, range.Low, range.High, part);
            Cv2.BitwiseOr(mask, part, mask);
        }
        if (options.OpenKernel > 1)
        {
            using var kernel = Cv2.GetStructuringElement(MorphShapes.Rect, new Size(options.OpenKernel, options.OpenKernel));
            Cv2.MorphologyEx(mask, mask, MorphTypes.Open, kernel);
        }
        if (options.ObstacleInflatePixels > 0)
        {
            int k = options.ObstacleInflatePixels * 2 + 1;
            using var kernel = Cv2.GetStructuringElement(MorphShapes.Ellipse, new Size(k, k));
            Cv2.Erode(mask, mask, kernel);
        }
        return mask;
    }

    /// <summary>Grid of a map image: a cell is free when its walkable pixel fraction reaches CellFreeRatio.</summary>
    public static WalkableGrid FromImage(Mat mapBgr, MinimapNavOptions options)
    {
        using var mask = WalkableMask(mapBgr, options);
        return FromMask(mask, options.CellPixels, options.CellFreeRatio);
    }

    /// <summary>Grid of a 0/255 walkable mask.</summary>
    public static WalkableGrid FromMask(Mat mask, int cellPixels, double freeRatio)
    {
        int cell = Math.Max(1, cellPixels);
        int width = Math.Max(1, mask.Cols / cell), height = Math.Max(1, mask.Rows / cell);
        using var small = new Mat();
        Cv2.Resize(mask, small, new Size(width, height), interpolation: InterpolationFlags.Area);
        small.GetArray(out byte[] values);
        var free = new bool[width * height];
        double threshold = freeRatio * 255.0;
        for (int i = 0; i < free.Length; i++) free[i] = values[i] >= threshold;
        return new WalkableGrid(width, height, cell, free);
    }
}
