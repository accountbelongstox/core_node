// PY-REF: none (DOT-only)
using OpenCvSharp;

namespace DotCore.MinimapPath;

/// <summary>
/// Solid route line recognition: HSV line mask, gap closing, small-component removal, Zhang-Suen skeleton, then the longest
/// skeleton branch from the pixel nearest the player (geodesic BFS) as the ordered route, simplified to waypoints with heading.
/// </summary>
public static class RouteLineExtractor
{
    private static readonly (int Dx, int Dy)[] Eight = { (1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1) };

    /// <summary>Recognize the route line inside a map area (image coordinates, no label/compass strips).</summary>
    public static MinimapRouteResult Recognize(Mat bgr, Rect mapRect, RouteLineOptions options)
    {
        if (bgr == null || bgr.Empty()) return MinimapRouteResult.Fail(null, MinimapRouteRecognizer.ErrorNoImage);
        var map = mapRect & new Rect(0, 0, bgr.Width, bgr.Height);
        if (map.Width <= 0 || map.Height <= 0) return MinimapRouteResult.Fail(null, MinimapRouteRecognizer.ErrorEmptyMapArea);

        using var mapImage = new Mat(bgr, map);
        using var mask = LineMask(mapImage, options);
        using var skeleton = SkeletonThinning.Thin(mask);
        var player = new Point((int)(map.Width * options.PlayerAnchorXRatio), (int)(map.Height * options.PlayerAnchorYRatio));
        var traced = TraceLongestBranch(skeleton, player);
        if (traced.Count < 2 || PathLength(traced) < options.MinRouteLengthRatio * map.Width) traced = new List<Point>();

        var waypoints = RoutePathTracer.Simplify(traced, options.SimplifyRatio);
        var heading = RoutePathTracer.Heading(waypoints, player, options.HeadingWaypointIndex);
        var offset = map.Location;
        return new MinimapRouteResult(
            map,
            player + offset,
            Array.Empty<Point>(),
            traced.Select(p => p + offset).ToArray(),
            waypoints.Select(p => p + offset).ToArray(),
            heading,
            DateTime.Now);
    }

    /// <summary>Binary mask of the route line with components below the minimum area removed. Caller disposes.</summary>
    public static Mat LineMask(Mat mapBgr, RouteLineOptions options)
    {
        using var hsv = new Mat();
        Cv2.CvtColor(mapBgr, hsv, ColorConversionCodes.BGR2HSV);
        var mask = new Mat();
        Cv2.InRange(hsv, options.LineHsv.Low, options.LineHsv.High, mask);
        if (options.CloseKernel > 1)
        {
            using var kernel = Cv2.GetStructuringElement(MorphShapes.Ellipse, new Size(options.CloseKernel, options.CloseKernel));
            Cv2.MorphologyEx(mask, mask, MorphTypes.Close, kernel);
        }

        double minArea = mapBgr.Width * (double)mapBgr.Height * options.MinComponentAreaRatio;
        using var labels = new Mat();
        using var stats = new Mat();
        using var centroids = new Mat();
        int n = Cv2.ConnectedComponentsWithStats(mask, labels, stats, centroids, PixelConnectivity.Connectivity8);
        for (int i = 1; i < n; i++)
        {
            if (stats.At<int>(i, (int)ConnectedComponentsTypes.Area) >= minArea) continue;
            using var small = new Mat();
            Cv2.InRange(labels, new Scalar(i), new Scalar(i), small);
            mask.SetTo(Scalar.All(0), small);
        }
        return mask;
    }

    /// <summary>Ordered skeleton pixels from the one nearest <paramref name="start"/> to the geodesically farthest one.</summary>
    public static List<Point> TraceLongestBranch(Mat skeleton, Point start)
    {
        int w = skeleton.Cols, h = skeleton.Rows;
        using var copy = skeleton.Clone();
        copy.GetArray(out byte[] px);

        int origin = -1;
        double best = double.PositiveInfinity;
        for (int i = 0; i < px.Length; i++)
        {
            if (px[i] == 0) continue;
            double d = RouteDotExtractor.Distance(new Point(i % w, i / w), start);
            if (d < best)
            {
                best = d;
                origin = i;
            }
        }
        if (origin < 0) return new List<Point>();

        var parent = new int[px.Length];
        Array.Fill(parent, -2);
        parent[origin] = -1;
        var queue = new Queue<int>();
        queue.Enqueue(origin);
        int last = origin;
        while (queue.Count > 0)
        {
            int c = queue.Dequeue();
            last = c;
            int cx = c % w, cy = c / w;
            foreach (var (dx, dy) in Eight)
            {
                int nx = cx + dx, ny = cy + dy;
                if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                int n = ny * w + nx;
                if (px[n] == 0 || parent[n] != -2) continue;
                parent[n] = c;
                queue.Enqueue(n);
            }
        }

        var path = new List<Point>();
        for (int i = last; i >= 0; i = parent[i]) path.Add(new Point(i % w, i / w));
        path.Reverse();
        return path;
    }

    private static double PathLength(IReadOnlyList<Point> path)
    {
        double total = 0;
        for (int i = 0; i < path.Count - 1; i++) total += RouteDotExtractor.Distance(path[i], path[i + 1]);
        return total;
    }
}
