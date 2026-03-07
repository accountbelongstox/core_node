using OpenCvSharp;

namespace DotCore.Utils.ImageColor;

/// <summary>
/// Color space and range filtering. RGB to HSV; InRange mask. No reference to ImageContours/Morphology/Preprocess/Ocr.
/// Ref: Color detection with OpenCV (HSV, masking) — BUTTON_RECOGNITION_DESIGN.md §2.
/// </summary>
public static class ImageColorService
{
    /// <summary>Build binary mask: pixels in HSV range become 255, others 0. Input BGR.</summary>
    /// <param name="bgr">Input image (BGR, 8UC3).</param>
    /// <param name="range">HSV range (H 0–180, S/V 0–255).</param>
    /// <returns>Binary mask (8UC1); caller must Dispose. Empty on failure.</returns>
    public static Mat InRangeMask(Mat bgr, HsvRange range)
    {
        if (bgr == null || bgr.Empty()) return new Mat();
        try
        {
            using var hsv = new Mat();
            Cv2.CvtColor(bgr, hsv, ColorConversionCodes.BGR2HSV);
            var mask = new Mat();
            Cv2.InRange(hsv, range.Low, range.High, mask);
            return mask;
        }
        catch
        {
            return new Mat();
        }
    }

    /// <summary>Common blue button HSV range (OpenCV H 0–180). Approximate for “standard” blue.</summary>
    public static HsvRange BlueButtonHsv() => new(100, 130, 80, 255, 80, 255);

    /// <summary>Common green button HSV range.</summary>
    public static HsvRange GreenButtonHsv() => new(35, 85, 50, 255, 50, 255);

    /// <summary>Common red button HSV range (wraps H: red at 0 and 180). Use two InRange and bitwise-or for full red.</summary>
    public static (HsvRange Low, HsvRange High) RedButtonHsvSplit() =>
        (new HsvRange(0, 10, 80, 255, 80, 255), new HsvRange(170, 180, 80, 255, 80, 255));
}
