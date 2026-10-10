// PY-REF: scripts/analysis/d4_minimap_path.py
using OpenCvSharp;

namespace DotCore.MinimapPath;

/// <summary>
/// Route dot candidates (bright cores with a dark outline ring) and the chain filter that keeps evenly spaced dot chains.
/// 1:1 Python scripts/analysis/d4_minimap_path.py extract_route_dots + keep_route_chains.
/// </summary>
public static class RouteDotExtractor
{
    /// <summary>Centers (map-local) of components passing area, aspect and outline-contrast filters.</summary>
    public static List<Point> ExtractDots(Mat mapBgr, MinimapRouteOptions options)
    {
        var centers = new List<Point>();
        if (mapBgr == null || mapBgr.Empty()) return centers;

        using var hsv = new Mat();
        Cv2.CvtColor(mapBgr, hsv, ColorConversionCodes.BGR2HSV);
        using var mask = new Mat();
        Cv2.InRange(hsv, options.DotHsv.Low, options.DotHsv.High, mask);
        using var value = new Mat();
        Cv2.ExtractChannel(hsv, value, 2);

        double mapArea = mapBgr.Width * (double)mapBgr.Height;
        double areaMin = Math.Max(options.DotAreaMinPixels, mapArea * options.DotAreaMinRatio);
        double areaMax = mapArea * options.DotAreaMaxRatio;
        int pad = options.DotRingKernel / 2;
        var bounds = new Rect(0, 0, mapBgr.Width, mapBgr.Height);
        using var ringKernel = Cv2.GetStructuringElement(MorphShapes.Rect, new Size(options.DotRingKernel, options.DotRingKernel));

        using var labels = new Mat();
        using var stats = new Mat();
        using var centroids = new Mat();
        int n = Cv2.ConnectedComponentsWithStats(mask, labels, stats, centroids, PixelConnectivity.Connectivity8);
        for (int i = 1; i < n; i++)
        {
            int area = stats.At<int>(i, (int)ConnectedComponentsTypes.Area);
            if (area < areaMin || area > areaMax) continue;
            int bw = stats.At<int>(i, (int)ConnectedComponentsTypes.Width);
            int bh = stats.At<int>(i, (int)ConnectedComponentsTypes.Height);
            if (bw == 0 || bh == 0) continue;
            if ((double)Math.Max(bw, bh) / Math.Min(bw, bh) > options.DotMaxAspect) continue;

            int bx = stats.At<int>(i, (int)ConnectedComponentsTypes.Left);
            int by = stats.At<int>(i, (int)ConnectedComponentsTypes.Top);
            var box = new Rect(bx - pad, by - pad, bw + 2 * pad, bh + 2 * pad) & bounds;
            using var labelBox = new Mat(labels, box);
            using var valueBox = new Mat(value, box);
            using var comp = new Mat();
            Cv2.InRange(labelBox, new Scalar(i), new Scalar(i), comp);
            using var ring = new Mat();
            Cv2.Dilate(comp, ring, ringKernel);
            Cv2.Subtract(ring, comp, ring);
            if (Cv2.CountNonZero(ring) == 0) continue;
            double contrast = Cv2.Mean(valueBox, comp).Val0 - Cv2.Mean(valueBox, ring).Val0;
            if (contrast < options.DotOutlineContrast) continue;
            centers.Add(new Point((int)centroids.At<double>(i, 0), (int)centroids.At<double>(i, 1)));
        }
        return centers;
    }

    /// <summary>Keeps dots whose nearest neighbor lies in the spacing band and that form chains of at least MinChainDots.</summary>
    public static List<Point> KeepRouteChains(IReadOnlyList<Point> centers, int mapWidth, MinimapRouteOptions options)
    {
        int count = centers.Count;
        if (count < options.MinChainDots) return new List<Point>();

        var dist = new double[count, count];
        var inBand = new bool[count];
        for (int i = 0; i < count; i++)
        {
            double nearest = double.PositiveInfinity;
            for (int j = 0; j < count; j++)
            {
                dist[i, j] = i == j ? double.PositiveInfinity : Distance(centers[i], centers[j]);
                nearest = Math.Min(nearest, dist[i, j]);
            }
            inBand[i] = nearest >= options.NearestMinRatio * mapWidth && nearest <= options.NearestMaxRatio * mapWidth;
        }

        var parent = Enumerable.Range(0, count).ToArray();
        int Find(int i)
        {
            while (parent[i] != i)
            {
                parent[i] = parent[parent[i]];
                i = parent[i];
            }
            return i;
        }

        double link = options.LinkRatio * mapWidth;
        for (int i = 0; i < count; i++)
        {
            if (!inBand[i]) continue;
            for (int j = i + 1; j < count; j++)
            {
                if (!inBand[j] || dist[i, j] > link) continue;
                int pi = Find(i), pj = Find(j);
                if (pi != pj) parent[pi] = pj;
            }
        }

        var groups = new Dictionary<int, List<int>>();
        for (int i = 0; i < count; i++)
        {
            if (!inBand[i]) continue;
            int root = Find(i);
            if (!groups.TryGetValue(root, out var members)) groups[root] = members = new List<int>();
            members.Add(i);
        }
        return groups.Values.Where(g => g.Count >= options.MinChainDots).SelectMany(g => g).Select(i => centers[i]).ToList();
    }

    internal static double Distance(Point a, Point b) => Math.Sqrt((double)(a.X - b.X) * (a.X - b.X) + (double)(a.Y - b.Y) * (a.Y - b.Y));
}
