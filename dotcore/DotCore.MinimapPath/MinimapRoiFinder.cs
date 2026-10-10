// PY-REF: scripts/analysis/d4_minimap_path.py
using OpenCvSharp;

namespace DotCore.MinimapPath;

/// <summary>
/// Locates the minimap as the largest background-colored blob inside the search area.
/// 1:1 Python scripts/analysis/d4_minimap_path.py find_minimap_roi (search area configurable instead of the fixed top-right quadrant).
/// </summary>
public static class MinimapRoiFinder
{
    /// <summary>Minimap rect in image coordinates, or null when no large enough blob exists.</summary>
    public static Rect? Find(Mat bgr, MinimapRouteOptions options)
    {
        if (bgr == null || bgr.Empty()) return null;
        int w = bgr.Width, h = bgr.Height;
        var area = options.RoiSearchArea;
        int x1 = Math.Clamp((int)(w * area.Left), 0, w);
        int y1 = Math.Clamp((int)(h * area.Top), 0, h);
        int x2 = Math.Clamp((int)(w * area.Right), x1, w);
        int y2 = Math.Clamp((int)(h * area.Bottom), y1, h);
        if (x2 <= x1 || y2 <= y1) return null;

        using var search = new Mat(bgr, new Rect(x1, y1, x2 - x1, y2 - y1));
        using var hsv = new Mat();
        Cv2.CvtColor(search, hsv, ColorConversionCodes.BGR2HSV);
        using var mask = new Mat();
        Cv2.InRange(hsv, options.BackgroundHsv.Low, options.BackgroundHsv.High, mask);
        using var kernel = Cv2.GetStructuringElement(MorphShapes.Rect, new Size(options.RoiCloseKernel, options.RoiCloseKernel));
        Cv2.MorphologyEx(mask, mask, MorphTypes.Close, kernel);
        Cv2.FindContours(mask, out var contours, out _, RetrievalModes.External, ContourApproximationModes.ApproxSimple);
        if (contours.Length == 0) return null;

        var biggest = contours.MaxBy(c => Cv2.ContourArea(c))!;
        var rect = Cv2.BoundingRect(biggest);
        if (rect.Width * rect.Height < w * h * options.RoiMinAreaRatio) return null;
        return new Rect(rect.X + x1, rect.Y + y1, rect.Width, rect.Height);
    }

    /// <summary>Map area of a minimap rect: drops the top label strip and bottom compass strip, clamped to the image.</summary>
    public static Rect? MapArea(Rect minimapRect, Size imageSize, MinimapRouteOptions options)
    {
        int y = minimapRect.Y + (int)(minimapRect.Height * options.TopStripRatio);
        int h = (int)(minimapRect.Height * (1 - options.TopStripRatio - options.BottomStripRatio));
        var map = new Rect(minimapRect.X, y, minimapRect.Width, h) & new Rect(0, 0, imageSize.Width, imageSize.Height);
        return map.Width > 0 && map.Height > 0 ? map : null;
    }
}
