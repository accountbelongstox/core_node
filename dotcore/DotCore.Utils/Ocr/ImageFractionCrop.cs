// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/d3u_common/game_window_region.py
using System.Drawing;
using System.Runtime.Versioning;
using OpenCvSharp;

namespace DotCore.Utils.Ocr;

/// <summary>
/// Crop an image by fractions of its size (e.g. middle 30% width / upper half = 0.35, 0, 0.65, 0.5) for OCR or detection.
/// Pixel bounds are truncated like Python int(). Returns null for null/empty input or an empty region.
/// 1:1 Python dotapps/d3d4tester/reference/py_d3check/d3utils/d3u_common/game_window_region.py (crop_game_window_middle30_upper_half), generalized.
/// </summary>
[SupportedOSPlatform("windows")]
public static class ImageFractionCrop
{
    /// <summary>Pixel rectangle for the fractions; null if width/height invalid or region empty.</summary>
    public static Rectangle? ToRect(int width, int height, double leftFrac, double topFrac, double rightFrac, double bottomFrac)
    {
        if (width <= 0 || height <= 0) return null;
        int left = Math.Clamp((int)(leftFrac * width), 0, width);
        int right = Math.Clamp((int)(rightFrac * width), 0, width);
        int top = Math.Clamp((int)(topFrac * height), 0, height);
        int bottom = Math.Clamp((int)(bottomFrac * height), 0, height);
        if (left >= right || top >= bottom) return null;
        return Rectangle.FromLTRB(left, top, right, bottom);
    }

    /// <summary>Cropped copy of the bitmap; caller disposes.</summary>
    public static Bitmap? Crop(Bitmap? image, double leftFrac, double topFrac, double rightFrac, double bottomFrac)
    {
        if (image == null) return null;
        try
        {
            var rect = ToRect(image.Width, image.Height, leftFrac, topFrac, rightFrac, bottomFrac);
            return rect == null ? null : image.Clone(rect.Value, image.PixelFormat);
        }
        catch
        {
            return null;
        }
    }

    /// <summary>Cropped copy of the Mat; caller disposes.</summary>
    public static Mat? Crop(Mat? image, double leftFrac, double topFrac, double rightFrac, double bottomFrac)
    {
        if (image == null || image.Empty()) return null;
        try
        {
            var rect = ToRect(image.Width, image.Height, leftFrac, topFrac, rightFrac, bottomFrac);
            if (rect == null) return null;
            var r = rect.Value;
            using var roi = new Mat(image, new Rect(r.X, r.Y, r.Width, r.Height));
            return roi.Clone();
        }
        catch
        {
            return null;
        }
    }
}
