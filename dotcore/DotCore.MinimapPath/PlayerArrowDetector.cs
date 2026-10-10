// PY-REF: none (DOT-only)
using DotCore.Utils.ImageColor;
using OpenCvSharp;

namespace DotCore.MinimapPath;

/// <summary>Player arrow on the minimap; points in image coordinates, heading 0 = east, 90 = north.</summary>
public sealed record PlayerArrowResult(Point Center, Point Tip, double HeadingDegrees, double Area);

/// <summary>
/// Player arrow facing: the arrow-colored blob nearest the player anchor within a search radius; the contour point farthest
/// from the blob centroid is the arrow tip.
/// </summary>
public static class PlayerArrowDetector
{
    /// <summary>Detect the arrow inside a map area (image coordinates); null when no blob of at least minArea pixels is near the anchor.</summary>
    public static PlayerArrowResult? Detect(Mat bgr, Rect mapRect, HsvRange arrowHsv, double searchRadiusRatio, double minArea,
        double anchorXRatio = 0.5, double anchorYRatio = 0.5)
    {
        if (bgr == null || bgr.Empty()) return null;
        var map = mapRect & new Rect(0, 0, bgr.Width, bgr.Height);
        if (map.Width <= 0 || map.Height <= 0) return null;

        using var mapImage = new Mat(bgr, map);
        using var mask = ImageColorService.InRangeMask(mapImage, arrowHsv);
        if (mask.Empty()) return null;
        Cv2.FindContours(mask, out var contours, out _, RetrievalModes.External, ContourApproximationModes.ApproxNone);

        var anchor = new Point2d(map.Width * anchorXRatio, map.Height * anchorYRatio);
        double radius = Math.Min(map.Width, map.Height) * searchRadiusRatio;
        Point[]? bestContour = null;
        Point2d bestCenter = default;
        double bestDistance = double.PositiveInfinity, bestArea = 0;
        foreach (var contour in contours)
        {
            var moments = Cv2.Moments(contour);
            if (moments.M00 < minArea) continue;
            var center = new Point2d(moments.M10 / moments.M00, moments.M01 / moments.M00);
            double d = Math.Sqrt((center.X - anchor.X) * (center.X - anchor.X) + (center.Y - anchor.Y) * (center.Y - anchor.Y));
            if (d > radius || d >= bestDistance) continue;
            bestContour = contour;
            bestCenter = center;
            bestDistance = d;
            bestArea = moments.M00;
        }
        if (bestContour == null) return null;

        var tip = bestContour.MaxBy(p => (p.X - bestCenter.X) * (p.X - bestCenter.X) + (p.Y - bestCenter.Y) * (p.Y - bestCenter.Y));
        double heading = Math.Atan2(-(tip.Y - bestCenter.Y), tip.X - bestCenter.X) * 180.0 / Math.PI;
        var offset = map.Location;
        return new PlayerArrowResult(new Point((int)Math.Round(bestCenter.X), (int)Math.Round(bestCenter.Y)) + offset, tip + offset, heading, bestArea);
    }
}
