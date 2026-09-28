using OpenCvSharp;

namespace DotCore.Utils.ImagePreprocess;

/// <summary>
/// Preprocessing for OCR only: grayscale, binarization (e.g. Otsu). No OCR call; no reference to ImageColor/Contours/Morphology/Ocr.
/// Ref: BUTTON_RECOGNITION_DESIGN.md §3, §6.4.
/// </summary>
public static class ImagePreprocessService
{
    /// <summary>Convert to grayscale. Input BGR or already gray.</summary>
    /// <param name="input">BGR or grayscale image.</param>
    /// <returns>Grayscale Mat; caller must Dispose. Empty on failure.</returns>
    public static Mat ToGrayscale(Mat input)
    {
        if (input == null || input.Empty()) return new Mat();
        try
        {
            if (input.Channels() == 1) return input.Clone();
            var gray = new Mat();
            Cv2.CvtColor(input, gray, ColorConversionCodes.BGR2GRAY);
            return gray;
        }
        catch
        {
            return new Mat();
        }
    }

    /// <summary>Binarize with Otsu threshold. Suitable for OCR input.</summary>
    /// <param name="gray">Grayscale image (8UC1).</param>
    /// <returns>Binary Mat (0 or 255); caller must Dispose. Empty on failure.</returns>
    public static Mat BinarizeOtsu(Mat gray)
    {
        if (gray == null || gray.Empty()) return new Mat();
        try
        {
            var binary = new Mat();
            Cv2.Threshold(gray, binary, 0, 255, ThresholdTypes.Otsu | ThresholdTypes.Binary);
            return binary;
        }
        catch
        {
            return new Mat();
        }
    }

    /// <summary>Grayscale then Otsu binarization. Convenience for OCR pipeline.</summary>
    public static Mat GrayscaleAndOtsu(Mat input)
    {
        using var gray = ToGrayscale(input);
        if (gray.Empty()) return new Mat();
        return BinarizeOtsu(gray);
    }
}
