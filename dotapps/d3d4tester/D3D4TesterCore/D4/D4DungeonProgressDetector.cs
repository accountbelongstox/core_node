// PY-REF: none (DOT-only; Python reserved the "Dungeon Progress" region but never produced a value)
using DotCore.Utils.ImagePreprocess;
using OpenCvSharp;

namespace DotApps.d3d4tester.Core.D4;

/// <summary>
/// Dungeon progress from the "Dungeon Progress" bar region: a column counts as filled when its mean brightness (HSV V) passes the threshold;
/// progress = rightmost filled column / bar width. No filled column (bar not shown outside dungeons) -> null.
/// </summary>
public static class D4DungeonProgressDetector
{
    private const double FilledColumnMinValue = 90.0;
    private const int MinFilledColumns = 2;

    /// <summary>Progress text "NN%" or null.</summary>
    public static string? Detect(Mat frameBgr, bool isWindowed)
    {
        if (frameBgr == null || frameBgr.Empty()) return null;
        var size = (frameBgr.Width, frameBgr.Height);
        var start = D4StandardCoords.Scale(D4StandardCoords.DungeonProgress.Start, size, isWindowed);
        var end = D4StandardCoords.Scale(D4StandardCoords.DungeonProgress.End, size, isWindowed);
        int x1 = Math.Clamp(start.X, 0, frameBgr.Width), y1 = Math.Clamp(start.Y, 0, frameBgr.Height);
        int x2 = Math.Clamp(end.X, 0, frameBgr.Width), y2 = Math.Clamp(end.Y, 0, frameBgr.Height);
        if (x2 - x1 < MinFilledColumns || y2 <= y1) return null;

        using var view = new Mat(frameBgr, new Rect(x1, y1, x2 - x1, y2 - y1));
        using var region = ImageConvert.ToBgr(view);
        using var hsv = new Mat();
        Cv2.CvtColor(region, hsv, ColorConversionCodes.BGR2HSV);
        using var value = hsv.ExtractChannel(2);
        using var columnMeans = new Mat();
        Cv2.Reduce(value, columnMeans, ReduceDimension.Row, ReduceTypes.Avg, MatType.CV_64F);

        int width = columnMeans.Cols, filled = 0, rightmost = -1;
        for (int x = 0; x < width; x++)
        {
            if (columnMeans.At<double>(0, x) < FilledColumnMinValue) continue;
            filled++;
            rightmost = x;
        }
        if (filled < MinFilledColumns) return null;
        int percent = (int)Math.Round((rightmost + 1) * 100.0 / width);
        return $"{Math.Clamp(percent, 0, 100)}%";
    }
}
