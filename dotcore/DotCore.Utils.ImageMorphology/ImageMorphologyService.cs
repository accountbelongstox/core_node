using OpenCvSharp;

namespace DotCore.Utils.ImageMorphology;

/// <summary>
/// Edge detection and morphology for text-region candidates. Canny, Dilation, Erosion. No reference to ImageColor/Contours/Preprocess/Ocr.
/// Ref: BUTTON_RECOGNITION_DESIGN.md §2–3 (Canny + Dilation, MSER optional).
/// </summary>
public static class ImageMorphologyService
{
    /// <summary>Run Canny edge then optional Dilation (and Erosion). Returns binary Mat for downstream contours.</summary>
    /// <param name="input">Grayscale or BGR image; BGR is converted to grayscale internally.</param>
    /// <param name="options">Canny and kernel sizes; null uses defaults.</param>
    /// <returns>Binary Mat; caller must Dispose. Empty on failure.</returns>
    public static Mat CannyAndMorphology(Mat input, MorphologyOptions? options = null)
    {
        var opts = options ?? new MorphologyOptions();
        if (input == null || input.Empty()) return new Mat();
        try
        {
            Mat gray = input.Channels() == 3 ? new Mat() : input.Clone();
            if (input.Channels() == 3)
            {
                Cv2.CvtColor(input, gray, ColorConversionCodes.BGR2GRAY);
            }
            using var canny = new Mat();
            Cv2.Canny(gray, canny, opts.CannyThreshold1, opts.CannyThreshold2);
            if (input.Channels() == 3) gray.Dispose();
            Mat result;
            if (opts.DilationKernelSize > 0)
            {
                var kernel = Cv2.GetStructuringElement(MorphShapes.Rect, new OpenCvSharp.Size(opts.DilationKernelSize, opts.DilationKernelSize));
                result = new Mat();
                Cv2.Dilate(canny, result, kernel);
                if (opts.ErosionKernelSize > 0)
                {
                    var k2 = Cv2.GetStructuringElement(MorphShapes.Rect, new OpenCvSharp.Size(opts.ErosionKernelSize, opts.ErosionKernelSize));
                    using var eroded = new Mat();
                    Cv2.Erode(result, eroded, k2);
                    result.Dispose();
                    result = eroded.Clone();
                }
            }
            else
            {
                result = canny.Clone();
            }
            return result;
        }
        catch
        {
            return new Mat();
        }
    }
}
