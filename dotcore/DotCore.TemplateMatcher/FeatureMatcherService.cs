using DotCore.Foundations;
using DotCore.Utils.ImagePreprocess;
using OpenCvSharp;
using OpenCvSharp.Features2D;

namespace DotCore.TemplateMatcher;

/// <summary>
/// Feature-based template location (SIFT/ORB/AKAZE + Lowe ratio test + RANSAC homography).
/// 1:1 Python pycore/pyutils/image_tools/image_matcher.py ImageMatcher._match_with_features (detector selection from _match_single_template_impl).
/// Stateless; detectors are created per call like Python.
/// </summary>
public static class FeatureMatcherService
{
    private const int KnnK = 2;

    /// <summary>
    /// Locate the template in the target by feature matching. Success=false when no descriptors, too few good matches
    /// (less than <paramref name="minInliers"/>) or homography fails.
    /// </summary>
    /// <param name="target">Target image (BGR, BGRA or gray).</param>
    /// <param name="template">Template image (BGR, BGRA or gray).</param>
    /// <param name="method">SIFT, ORB or AKAZE.</param>
    /// <param name="templateName">Name for logs and result.</param>
    /// <param name="ratioThresh">Lowe ratio threshold (good if m.distance &lt; ratio * n.distance).</param>
    /// <param name="minInliers">Minimum good matches.</param>
    /// <param name="nFeatures">Max features for SIFT/ORB.</param>
    /// <param name="ransacThreshold">RANSAC reprojection threshold (px).</param>
    /// <param name="silent">Suppress debug logs.</param>
    public static TemplateMatchResult Match(
        Mat target,
        Mat template,
        TemplateMatchMethod method,
        string templateName,
        double ratioThresh = TemplateMatcherConstants.DefaultRatioThresh,
        int minInliers = TemplateMatcherConstants.DefaultMinInliers,
        int nFeatures = TemplateMatcherConstants.DefaultNFeatures,
        double ransacThreshold = TemplateMatcherConstants.DefaultRansacThreshold,
        bool silent = false)
    {
        if (!method.IsFeatureMethod())
            throw new ArgumentException($"Not a feature matching method: {method.ToName()}", nameof(method));
        var fail = new TemplateMatchResult { Success = false, TemplateName = templateName, MatchThreshold = ratioThresh, Method = method };
        if (target == null || template == null || target.Empty() || template.Empty()) return fail;

        using Feature2D detector = method switch
        {
            TemplateMatchMethod.Sift => SIFT.Create(nFeatures),
            TemplateMatchMethod.Akaze => AKAZE.Create(),
            _ => ORB.Create(nFeatures)
        };
        using var matcher = new BFMatcher(method == TemplateMatchMethod.Sift ? NormTypes.L2 : NormTypes.Hamming, crossCheck: false);
        if (!silent) ColorPrinter.Blue($"[ImageMatcher] Using {method.ToName()} feature detector");

        using var grayTarget = ImageConvert.ToGray(target);
        using var grayTemplate = ImageConvert.ToGray(template);
        using var desTemplate = new Mat();
        using var desTarget = new Mat();
        detector.DetectAndCompute(grayTemplate, null, out KeyPoint[] kpTemplate, desTemplate);
        detector.DetectAndCompute(grayTarget, null, out KeyPoint[] kpTarget, desTarget);
        if (!silent)
        {
            ColorPrinter.Debug($"[DEBUG] {templateName}: Found {kpTemplate.Length} keypoints in template");
            ColorPrinter.Debug($"[DEBUG] {templateName}: Found {kpTarget.Length} keypoints in target");
        }
        if (desTemplate.Empty() || desTarget.Empty())
        {
            if (!silent) ColorPrinter.Yellow($"[DEBUG] {templateName}: No descriptors found");
            return fail;
        }

        DMatch[][] matches;
        try
        {
            matches = matcher.KnnMatch(desTemplate, desTarget, KnnK);
            if (!silent) ColorPrinter.Debug($"[DEBUG] {templateName}: knnMatch returned {matches.Length} match pairs");
        }
        catch (OpenCVException)
        {
            if (!silent) ColorPrinter.Red($"[DEBUG] {templateName}: knnMatch failed");
            return fail;
        }

        var good = new List<DMatch>();
        foreach (var pair in matches)
        {
            if (pair.Length == KnnK && pair[0].Distance < ratioThresh * pair[1].Distance)
                good.Add(pair[0]);
        }
        if (!silent)
            ColorPrinter.Debug($"[DEBUG] {templateName}: {good.Count} good matches after ratio test (ratio_thresh={ratioThresh:F3}, min required: {minInliers})");
        if (good.Count < minInliers)
        {
            if (!silent) ColorPrinter.Yellow($"[DEBUG] {templateName}: Not enough good matches");
            return fail with { NumMatches = good.Count };
        }

        var srcPts = good.Select(m => new Point2d(kpTemplate[m.QueryIdx].Pt.X, kpTemplate[m.QueryIdx].Pt.Y));
        var dstPts = good.Select(m => new Point2d(kpTarget[m.TrainIdx].Pt.X, kpTarget[m.TrainIdx].Pt.Y));
        using var homography = Cv2.FindHomography(srcPts, dstPts, HomographyMethods.Ransac, ransacThreshold);
        if (homography.Empty())
        {
            if (!silent) ColorPrinter.Red($"[DEBUG] {templateName}: Homography estimation failed");
            return fail with { NumMatches = good.Count };
        }
        if (!silent) ColorPrinter.Green($"[DEBUG] {templateName}: Homography found successfully!");

        int w = grayTemplate.Cols, h = grayTemplate.Rows;
        var polygon = Cv2.PerspectiveTransform(new[] { new Point2f(0, 0), new Point2f(w, 0), new Point2f(w, h), new Point2f(0, h) }, homography);
        var center = new Point2f(polygon.Average(p => p.X), polygon.Average(p => p.Y));
        int minX = (int)Math.Floor(polygon.Min(p => p.X)), minY = (int)Math.Floor(polygon.Min(p => p.Y));
        int maxX = (int)Math.Ceiling(polygon.Max(p => p.X)), maxY = (int)Math.Ceiling(polygon.Max(p => p.Y));
        return new TemplateMatchResult
        {
            Success = true,
            X = minX,
            Y = minY,
            Width = maxX - minX,
            Height = maxY - minY,
            TemplateName = templateName,
            Center = center,
            Polygon = polygon,
            NumMatches = good.Count,
            MatchThreshold = ratioThresh,
            Method = method
        };
    }
}
