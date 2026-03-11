using OpenCvSharp;
using DotCore.Utils.ImageColor;
using DotCore.Utils.ImageContours;
using DotCore.Utils.ImageMorphology;
using DotCore.Utils.ImagePreprocess;
using DotCore.Utils.Ocr;

namespace DotCore.ButtonRecognizer;

/// <summary>
/// Aggregate: orchestrates ImageColor, ImageContours, ImageMorphology, ImagePreprocess, and Utils.Ocr to implement pipelines 1–3.
/// Ref: dotcore/docs/BUTTON_RECOGNITION_DESIGN.md.
/// </summary>
public sealed class ButtonRecognizerService
{
    /// <summary>Pipeline 1: Color filter (HSV InRange) → mask → FindContours → filter by area/aspect. Returns candidate rects. Returns empty list if input is null/empty or mask is empty.</summary>
    public static IReadOnlyList<Rect> DetectByColor(Mat input, HsvRange range, ContourFilterOptions? contourOptions = null)
    {
        if (input == null || input.Empty()) return Array.Empty<Rect>();
        using var mask = ImageColorService.InRangeMask(input, range);
        if (mask.Empty()) return Array.Empty<Rect>();
        return ImageContoursService.FindContoursAndFilter(mask, contourOptions);
    }

    /// <summary>Pipeline 2: Canny + morphology → binary → FindContours. Returns candidate rects (text regions). Returns empty list if input is null/empty or binary result is empty.</summary>
    public static IReadOnlyList<Rect> DetectTextRegions(Mat input, MorphologyOptions? morphologyOptions = null, ContourFilterOptions? contourOptions = null)
    {
        if (input == null || input.Empty()) return Array.Empty<Rect>();
        using var binary = ImageMorphologyService.CannyAndMorphology(input, morphologyOptions);
        if (binary.Empty()) return Array.Empty<Rect>();
        return ImageContoursService.FindContoursAndFilter(binary, contourOptions);
    }

    /// <summary>Pipeline 3: For each candidate rect, crop → preprocess (grayscale+Otsu) → save temp → OCR → match expected text. Returns rects that match any expected string. Returns empty list if input/candidates/expectedTexts are null or empty, or ocrEngine is null or not initialized. Per-candidate OCR or file failures are skipped; partial results may be returned.</summary>
    /// <param name="input">Source image (BGR).</param>
    /// <param name="candidates">Candidate rectangles from pipeline 1 or 2.</param>
    /// <param name="expectedTexts">OCR text must contain at least one of these (ordinal ignore case).</param>
    /// <param name="ocrEngine">Initialized OCR engine; if null or not initialized, returns empty.</param>
    /// <param name="tempDir">Directory for temporary crop images; null = Path.GetTempPath().</param>
    public static IReadOnlyList<Rect> VerifyByOcr(Mat input, IReadOnlyList<Rect> candidates, IReadOnlyList<string> expectedTexts, IOcrEngine? ocrEngine, string? tempDir = null)
    {
        var result = new List<Rect>();
        if (input == null || input.Empty() || candidates == null || candidates.Count == 0 ||
            expectedTexts == null || expectedTexts.Count == 0 || ocrEngine == null || !ocrEngine.IsInitialized)
            return result;
        tempDir ??= Path.GetTempPath();
        try
        {
            Directory.CreateDirectory(tempDir);
            foreach (var rect in candidates)
            {
                if (rect.Width <= 0 || rect.Height <= 0) continue;
                try
                {
                    using var roi = new Mat(input, rect);
                    using var preprocessed = ImagePreprocessService.GrayscaleAndOtsu(roi);
                    if (preprocessed.Empty()) continue;
                    string tempPath = Path.Combine(tempDir, $"{ButtonRecognizerConstants.OcrTempFilePrefix}{Guid.NewGuid():N}.{ButtonRecognizerConstants.OcrTempFileExtension}");
                    Cv2.ImWrite(tempPath, preprocessed);
                    try
                    {
                        var ocrResult = ocrEngine.Ocr(tempPath, null);
                        var text = ocrResult?.Text ?? "";
                        foreach (var expected in expectedTexts)
                        {
                            if (text.Contains(expected, StringComparison.OrdinalIgnoreCase))
                            {
                                result.Add(rect);
                                break;
                            }
                        }
                    }
                    finally
                    {
                        if (File.Exists(tempPath)) File.Delete(tempPath);
                    }
                }
                catch
                {
                    // skip this candidate
                }
            }
        }
        catch
        {
            // return what we have
        }
        return result;
    }

    /// <summary>Pipeline 1 + optional pipeline 3: Detect by color, optionally verify by OCR. Returns list of ButtonCandidate with Rect and optional OcrText.</summary>
    public static IReadOnlyList<ButtonCandidate> DetectButtons(Mat input, HsvRange range, ContourFilterOptions? contourOptions = null, IReadOnlyList<string>? expectedTexts = null, IOcrEngine? ocrEngine = null, string? tempDir = null)
    {
        var rects = DetectByColor(input, range, contourOptions);
        if (rects.Count == 0) return Array.Empty<ButtonCandidate>();
        if (expectedTexts == null || expectedTexts.Count == 0 || ocrEngine == null || !ocrEngine.IsInitialized)
            return rects.Select(r => new ButtonCandidate { Rect = r }).ToList();
        var verified = new HashSet<Rect>(VerifyByOcr(input, rects, expectedTexts, ocrEngine, tempDir));
        return rects.Select(r => new ButtonCandidate { Rect = r, OcrText = verified.Contains(r) ? ButtonRecognizerConstants.OcrMatchedPlaceholder : null }).ToList();
    }
}
