using OpenCvSharp;

namespace DotCore.Utils.ImageContours;

/// <summary>
/// Contour detection and rectangle filtering. FindContours, bounding rect, filter by area/aspect. No reference to ImageColor/Morphology/Preprocess/Ocr.
/// Ref: BUTTON_RECOGNITION_DESIGN.md §2–3.
/// </summary>
public static class ImageContoursService
{
    /// <summary>Find contours on binary (or grayscale) image and return filtered bounding rectangles.</summary>
    /// <param name="binaryOrGray">Binary or grayscale image (8UC1).</param>
    /// <param name="options">Filter by area and aspect ratio; null uses defaults.</param>
    /// <returns>List of bounding rects (button-like candidates).</returns>
    public static List<Rect> FindContoursAndFilter(Mat binaryOrGray, ContourFilterOptions? options = null)
    {
        var opts = options ?? new ContourFilterOptions();
        var result = new List<Rect>();
        if (binaryOrGray == null || binaryOrGray.Empty()) return result;
        try
        {
            Cv2.FindContours(binaryOrGray, out var contours, out _, RetrievalModes.External, ContourApproximationModes.ApproxSimple);
            foreach (var contour in contours)
            {
                var area = Cv2.ContourArea(contour);
                if (area < opts.MinArea) continue;
                if (opts.MaxArea > 0 && area > opts.MaxArea) continue;
                var rect = Cv2.BoundingRect(contour);
                if (rect.Height <= 0) continue;
                double ratio = (double)rect.Width / rect.Height;
                if (ratio < opts.MinAspectRatio || ratio > opts.MaxAspectRatio) continue;
                result.Add(rect);
            }
        }
        catch
        {
            // return empty
        }
        return result;
    }
}
