// PY-REF: none (DOT-only)
using OpenCvSharp;

namespace DotCore.VocAnnotatorUI;

/// <summary>Rasterizes canvas strokes in order into an 8-bit label mask (image pixel coordinates).</summary>
public static class CanvasStrokeRaster
{
    /// <summary>New CV_8UC1 mask of the given size filled with erase, then each stroke painted with its kind's value.</summary>
    public static Mat Render(IEnumerable<CanvasStroke> strokes, int width, int height, byte foreground, byte background, byte erase)
    {
        var mask = new Mat(height, width, MatType.CV_8UC1, Scalar.All(erase));
        foreach (var stroke in strokes)
        {
            if (stroke.Points.Count == 0) continue;
            var value = Scalar.All(stroke.Kind switch
            {
                CanvasStrokeKind.Foreground => foreground,
                CanvasStrokeKind.Background => background,
                _ => erase,
            });
            int radius = Math.Max(1, (int)Math.Round(stroke.Radius));
            var points = stroke.Points.Select(p => new Point((int)Math.Round(p.X), (int)Math.Round(p.Y))).ToList();
            if (points.Count == 1) Cv2.Circle(mask, points[0], radius, value, -1, LineTypes.Link8);
            else Cv2.Polylines(mask, new[] { points }, false, value, radius * 2, LineTypes.Link8);
        }
        return mask;
    }
}
