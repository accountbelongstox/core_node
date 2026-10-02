// PY-REF: pyapps/d3-check/d4utils/d4_window_region_detector.py
// PY-REF: pyapps/d3-check/controller/d4func/image_annotator.py
using DotCore.Foundations;
using DotCore.Utils.ImagePreprocess;
using OpenCvSharp;

namespace DotApps.d3d4tester.Core.D4;

/// <summary>
/// Scales the D4 standard regions/points to the actual window and draws coordinate annotations.
/// 1:1 Python pyapps/d3-check/d4utils/d4_window_region_detector.py (detect_regions, update_interface_data, annotation)
/// and controller/d4func/image_annotator.py (full annotation of all regions, points and the progress line).
/// Fixes Python bug: image_annotator used its own ad-hoc scaling (+31 px fullscreen); it now uses the unified D4 scaler.
/// </summary>
public sealed class D4WindowRegionDetector
{
    private const string LogPrefix = "[D4WindowRegionDetector]";
    private const string AnnotatorLogPrefix = "[ImageAnnotator]";
    private const int PointRadius = 8;
    private const int CrosshairSize = 20;
    private const int LineThickness = 3;

    private static readonly Scalar White = new(255, 255, 255);
    private static readonly Scalar Black = new(0, 0, 0);

    private static readonly Lazy<D4WindowRegionDetector> LazyInstance = new(() => new D4WindowRegionDetector());

    private D4WindowRegionDetector()
    {
        ColorPrinter.Green($"{LogPrefix} Initialized");
    }

    public static D4WindowRegionDetector Instance => LazyInstance.Value;

    /// <summary>Scale the 13 detection regions and 9 points; in debug mode annotate and save d4_annotated_&lt;ts&gt;.png. 1:1 detect_regions.</summary>
    public D4WindowRegionResult DetectRegions((int Width, int Height) gameWindowSize, bool isWindowed, Mat? screenshot, bool debug)
    {
        var regions = new Dictionary<string, D4RegionInfo>(StringComparer.Ordinal);
        foreach (var r in D4StandardCoords.DetectionRegions)
            regions[r.Name] = ScaleRegion(r, gameWindowSize, isWindowed);
        var points = new Dictionary<string, D4PointInfo>(StringComparer.Ordinal);
        foreach (var p in D4StandardCoords.DetectionPoints)
            points[p.Name] = new D4PointInfo(p.Name, p.Coord, D4StandardCoords.Scale(p.Coord, gameWindowSize, isWindowed));

        string? annotatedPath = null;
        if (debug && screenshot != null && !screenshot.Empty())
        {
            using var annotated = AnnotateDetected(screenshot, regions.Values, points.Values);
            annotatedPath = D4ImageCrop.Save(annotated, D4ImageCrop.TimestampedPath(D4Constants.AnnotatedDir, D4Constants.AnnotatedImagePrefix), LogPrefix);
        }
        return new D4WindowRegionResult(gameWindowSize, isWindowed, regions, points, annotatedPath);
    }

    /// <summary>Store the detection result in the shared data (region crops are kept separately). 1:1 update_interface_data.</summary>
    public bool UpdateInterfaceData(D4InterfaceData data, D4WindowRegionResult? result)
    {
        if (result == null)
        {
            ColorPrinter.Yellow($"{LogPrefix} No detection result to update");
            return false;
        }
        data.GameWindowSize = result.GameWindowSize;
        data.DetectedRegions = result.Regions;
        data.DetectedPoints = result.Points;
        data.RegionDetectionTimestamp = DateTime.Now;
        if (result.AnnotatedPath != null)
            data.LastAnnotatedScreenshotPath = result.AnnotatedPath;
        return true;
    }

    /// <summary>Scale one standard region to a D4RegionInfo.</summary>
    public static D4RegionInfo ScaleRegion(D4StdRegion region, (int Width, int Height) gameWindowSize, bool isWindowed)
    {
        var s = D4StandardCoords.Scale(region.Start, gameWindowSize, isWindowed);
        var e = D4StandardCoords.Scale(region.End, gameWindowSize, isWindowed);
        return new D4RegionInfo(region.Name, region.Start, region.End, s, e, e.X - s.X, e.Y - s.Y, ((s.X + e.X) / 2, (s.Y + e.Y) / 2));
    }

    /// <summary>Detected regions (red rect + index + corner coords) and points (blue dot, crosshair, label). Caller disposes. 1:1 _annotate_screenshot_with_coordinates.</summary>
    public static Mat AnnotateDetected(Mat screenshot, IEnumerable<D4RegionInfo> regions, IEnumerable<D4PointInfo> points)
    {
        var image = ImageConvert.ToBgr(screenshot);
        var red = ImageAnnotate.GetAnnotationColor("red", new Scalar(0, 0, 255));
        var blue = ImageAnnotate.GetAnnotationColor("blue", new Scalar(255, 0, 0));
        int index = 1;
        foreach (var r in regions)
        {
            var s = ToPoint(r.ScaledStart);
            var e = ToPoint(r.ScaledEnd);
            ImageAnnotate.DrawRectangle(image, s, e, red, 2, r.Name);
            ImageAnnotate.DrawText(image, index.ToString(), new Point(s.X + 5, s.Y + 20), White, 0.6, 2, red);
            ImageAnnotate.DrawText(image, $"({s.X},{s.Y})", new Point(s.X + 5, s.Y + 45), White, 0.4, 1, Black);
            ImageAnnotate.DrawText(image, $"({e.X},{e.Y})", new Point(e.X - 80, e.Y - 10), White, 0.4, 1, Black);
            index++;
        }
        index = 1;
        foreach (var p in points)
        {
            var c = ToPoint(p.ScaledCoord);
            DrawPoint(image, c, blue);
            ImageAnnotate.DrawText(image, index.ToString(), new Point(c.X - 5, c.Y + 5), Black, 0.5, 2);
            ImageAnnotate.DrawText(image, $"{p.Name} ({c.X},{c.Y})", new Point(c.X + 15, c.Y - 10), White, 0.4, 1, blue);
            index++;
        }
        return image;
    }

    /// <summary>All 20 regions, the progress line and 10 points with per-item colors. Caller disposes. 1:1 ImageAnnotator.annotate_screenshot_with_coordinates.</summary>
    public static Mat AnnotateAll(Mat screenshot, (int Width, int Height) gameWindowSize, bool isWindowed)
    {
        ColorPrinter.Blue($"{AnnotatorLogPrefix} Annotating screenshot with D4 coordinates...");
        var image = ImageConvert.ToBgr(screenshot);
        foreach (var (region, colorName) in D4StandardCoords.AnnotationRegions)
        {
            var s = D4StandardCoords.Scale(region.Start, gameWindowSize, isWindowed);
            var e = D4StandardCoords.Scale(region.End, gameWindowSize, isWindowed);
            ColorPrinter.Green($"{AnnotatorLogPrefix} {region.Name}: Std({region.X1},{region.Y1})-({region.X2},{region.Y2}) -> Actual({s.X},{s.Y})-({e.X},{e.Y})");
            ImageAnnotate.DrawRectangle(image, ToPoint(s), ToPoint(e), ImageAnnotate.GetAnnotationColor(colorName), 2, region.Name);
        }
        foreach (var (line, colorName) in D4StandardCoords.AnnotationLines)
        {
            var s = D4StandardCoords.Scale(line.Start, gameWindowSize, isWindowed);
            var e = D4StandardCoords.Scale(line.End, gameWindowSize, isWindowed);
            var color = ImageAnnotate.GetAnnotationColor(colorName);
            ImageAnnotate.DrawLine(image, ToPoint(s), ToPoint(e), color, LineThickness);
            ImageAnnotate.DrawText(image, line.Name, new Point((s.X + e.X) / 2, (s.Y + e.Y) / 2 - 10), White, 0.4, 1, color);
        }
        foreach (var (point, colorName) in D4StandardCoords.AnnotationPoints)
        {
            var c = D4StandardCoords.Scale(point.Coord, gameWindowSize, isWindowed);
            var color = ImageAnnotate.GetAnnotationColor(colorName);
            ColorPrinter.Green($"{AnnotatorLogPrefix} {point.Name}: Std({point.X},{point.Y}) -> Actual({c.X},{c.Y})");
            DrawPoint(image, ToPoint(c), color);
            ImageAnnotate.DrawText(image, $"{point.Name} ({c.X},{c.Y})", new Point(c.X + 15, c.Y - 10), White, 0.4, 1, color);
        }
        ColorPrinter.Green($"{AnnotatorLogPrefix} Screenshot annotation completed");
        return image;
    }

    private static void DrawPoint(Mat image, Point c, Scalar color)
    {
        ImageAnnotate.DrawCircle(image, c, PointRadius, color, filled: true);
        ImageAnnotate.DrawLine(image, new Point(c.X - CrosshairSize, c.Y), new Point(c.X + CrosshairSize, c.Y), White, 2);
        ImageAnnotate.DrawLine(image, new Point(c.X, c.Y - CrosshairSize), new Point(c.X, c.Y + CrosshairSize), White, 2);
    }

    private static Point ToPoint((int X, int Y) p) => new(p.X, p.Y);
}
