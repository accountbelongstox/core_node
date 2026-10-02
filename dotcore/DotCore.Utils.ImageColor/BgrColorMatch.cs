// PY-REF: pyapps/d3-check/d4utils/d4_black_screen_detector.py
// PY-REF: pyapps/d3-check/d4utils/d4_team_health_detector.py
// PY-REF: pyapps/d3-check/d4utils/d4_red_portal_detector.py
using DotCore.Foundations;
using OpenCvSharp;

namespace DotCore.Utils.ImageColor;

/// <summary>Brightness statistics (per-pixel channel mean). 1:1 Python get_brightness_stats dict.</summary>
public readonly record struct BrightnessStats(double Mean, double Min, double Max, double Std);

/// <summary>
/// BGR color-range matching with tolerance and black-region detection.
/// 1:1 Python pyapps/d3-check/d4utils/d4_black_screen_detector.py (is_black_screen, get_brightness_stats),
/// d4_team_health_detector.py (absolute per-channel tolerance) and d4_red_portal_detector.py (_calculate_color_range ratio tolerance, OR mask).
/// </summary>
public static class BgrColorMatch
{
    /// <summary>Max channel value counted as black (10% of 255).</summary>
    public const int BlackThreshold = 25;

    /// <summary>Minimum black pixel ratio for a black region.</summary>
    public const double BlackPixelRatio = 0.95;

    private const string BlackLogPrefix = "[D4BlackScreenDetector]";

    /// <summary>Bounds color ± tolerance per channel, clamped to 0..255.</summary>
    public static (Scalar Lower, Scalar Upper) RangeAbsolute(Scalar bgr, int tolerance) =>
        (new Scalar(Clamp(bgr.Val0 - tolerance), Clamp(bgr.Val1 - tolerance), Clamp(bgr.Val2 - tolerance)),
         new Scalar(Clamp(bgr.Val0 + tolerance), Clamp(bgr.Val1 + tolerance), Clamp(bgr.Val2 + tolerance)));

    /// <summary>Bounds color * (1 ± ratio) per channel, truncated and clamped. 1:1 _calculate_color_range.</summary>
    public static (Scalar Lower, Scalar Upper) RangeRatio(Scalar bgr, double ratio) =>
        (new Scalar(Clamp((int)(bgr.Val0 * (1 - ratio))), Clamp((int)(bgr.Val1 * (1 - ratio))), Clamp((int)(bgr.Val2 * (1 - ratio)))),
         new Scalar(Clamp((int)(bgr.Val0 * (1 + ratio))), Clamp((int)(bgr.Val1 * (1 + ratio))), Clamp((int)(bgr.Val2 * (1 + ratio)))));

    /// <summary>True if one BGR pixel is within ±tolerance of the target on every channel. 1:1 _pixel_matches_color.</summary>
    public static bool PixelMatches(Vec3b pixel, Scalar target, int tolerance) =>
        Math.Abs(pixel.Item0 - target.Val0) <= tolerance &&
        Math.Abs(pixel.Item1 - target.Val1) <= tolerance &&
        Math.Abs(pixel.Item2 - target.Val2) <= tolerance;

    /// <summary>Mask (8UC1, 255 = match) of pixels within ±tolerance of the color. Caller disposes.</summary>
    public static Mat InRangeMask(Mat bgr, Scalar color, int tolerance)
    {
        var (lower, upper) = RangeAbsolute(color, tolerance);
        return InRange(bgr, lower, upper);
    }

    /// <summary>OR mask of pixels within ±tolerance of any color. Caller disposes.</summary>
    public static Mat InRangeAnyMask(Mat bgr, IEnumerable<Scalar> colors, int tolerance) =>
        AnyMask(bgr, colors, c => RangeAbsolute(c, tolerance));

    /// <summary>OR mask of pixels within color * (1 ± ratio) of any color. 1:1 _create_color_mask. Caller disposes.</summary>
    public static Mat InRangeAnyMaskRatio(Mat bgr, IEnumerable<Scalar> colors, double ratio) =>
        AnyMask(bgr, colors, c => RangeRatio(c, ratio));

    /// <summary>Count pixels within ±tolerance of any color.</summary>
    public static int CountMatchingPixels(Mat bgr, IEnumerable<Scalar> colors, int tolerance)
    {
        using var mask = InRangeAnyMask(bgr, colors, tolerance);
        return mask.Empty() ? 0 : Cv2.CountNonZero(mask);
    }

    /// <summary>Per-row count of pixels within ±tolerance of any color (length = rows). Supports row-scan detectors.</summary>
    public static int[] CountMatchingPixelsPerRow(Mat bgr, IEnumerable<Scalar> colors, int tolerance)
    {
        using var mask = InRangeAnyMask(bgr, colors, tolerance);
        if (mask.Empty()) return Array.Empty<int>();
        var counts = new int[mask.Rows];
        for (int y = 0; y < mask.Rows; y++)
        {
            using var row = mask.Row(y);
            counts[y] = Cv2.CountNonZero(row);
        }
        return counts;
    }

    /// <summary>
    /// True when at least <paramref name="blackRatio"/> of pixels have every channel &lt;= threshold. Gray or color input.
    /// 1:1 is_black_screen (logs the ratio when black; invalid input logs and returns false).
    /// </summary>
    public static bool IsMostlyBlack(Mat image, int threshold = BlackThreshold, double blackRatio = BlackPixelRatio)
    {
        if (image == null || image.Empty())
        {
            ColorPrinter.Yellow($"{BlackLogPrefix} Invalid image provided");
            return false;
        }
        int channels = image.Channels();
        if (channels is not (1 or 3 or 4))
        {
            ColorPrinter.Yellow($"{BlackLogPrefix} Unexpected image shape: {image.Rows}x{image.Cols}x{channels}");
            return false;
        }
        var upper = new Scalar(threshold, threshold, threshold, threshold);
        using var mask = new Mat();
        Cv2.InRange(image, new Scalar(0, 0, 0, 0), upper, mask);
        double ratio = Cv2.CountNonZero(mask) / (double)(image.Rows * image.Cols);
        bool isBlack = ratio >= blackRatio;
        if (isBlack)
            ColorPrinter.Blue($"{BlackLogPrefix} Black screen detected: {ratio * 100:F1}% black pixels");
        return isBlack;
    }

    /// <summary>Mean/min/max/std of per-pixel brightness (channel mean for color). 1:1 get_brightness_stats.</summary>
    public static BrightnessStats GetBrightnessStats(Mat image)
    {
        using var brightness = new Mat();
        if (image.Channels() == 1)
        {
            image.ConvertTo(brightness, MatType.CV_64F);
        }
        else
        {
            using var asDouble = new Mat();
            image.ConvertTo(asDouble, MatType.CV_64FC(image.Channels()));
            using var flat = asDouble.Reshape(1, image.Rows * image.Cols);
            using var mean = new Mat();
            Cv2.Reduce(flat, mean, ReduceDimension.Column, ReduceTypes.Avg, MatType.CV_64F);
            mean.CopyTo(brightness);
        }
        Cv2.MeanStdDev(brightness, out var m, out var s);
        Cv2.MinMaxLoc(brightness, out double min, out double max);
        return new BrightnessStats(m.Val0, min, max, s.Val0);
    }

    private static Mat AnyMask(Mat bgr, IEnumerable<Scalar> colors, Func<Scalar, (Scalar Lower, Scalar Upper)> range)
    {
        if (bgr == null || bgr.Empty()) return new Mat();
        using var src = bgr.Channels() == 4 ? bgr.CvtColor(ColorConversionCodes.BGRA2BGR) : bgr.Clone();
        var combined = new Mat(src.Rows, src.Cols, MatType.CV_8UC1, Scalar.All(0));
        foreach (var c in colors)
        {
            var (lower, upper) = range(c);
            using var mask = new Mat();
            Cv2.InRange(src, lower, upper, mask);
            Cv2.BitwiseOr(combined, mask, combined);
        }
        return combined;
    }

    private static Mat InRange(Mat bgr, Scalar lower, Scalar upper)
    {
        if (bgr == null || bgr.Empty()) return new Mat();
        using var src = bgr.Channels() == 4 ? bgr.CvtColor(ColorConversionCodes.BGRA2BGR) : bgr.Clone();
        var mask = new Mat();
        Cv2.InRange(src, lower, upper, mask);
        return mask;
    }

    private static int Clamp(double v) => (int)Math.Clamp(v, 0, 255);
}
