// PY-REF: none (DOT-only)
using DotCore.Foundations;
using OpenCvSharp;

namespace DotCore.YoloTaskSet;

/// <summary>Region of a source image / video frame in pixels.</summary>
public readonly record struct VariantRegion(int X, int Y, int Width, int Height);

public enum VariantCutout
{
    /// <summary>Opaque rectangular crop.</summary>
    Rectangle,

    /// <summary>Foreground segmented with GrabCut inside the region; background becomes transparent.</summary>
    GrabCut,
}

public sealed record VideoInfo(int FrameCount, double Fps, int Width, int Height);

/// <summary>Extracts variants ("1.1", "1.2", ...) from large images or video frames.</summary>
public static class VariantExtractor
{
    private const int GrabCutIterations = 5;
    private const double GrabCutMarginFraction = 0.1;
    private const int GrabCutMinMargin = 8;
    private const int CleanupKernelSize = 3;
    private const double CutoutFeatherSigma = 1.0;

    public static bool IsVideo(string path) => TaskSetStore.IsSupportedVideo(path);

    public static VideoInfo? GetVideoInfo(string videoPath)
    {
        try
        {
            using var capture = new VideoCapture(videoPath);
            if (!capture.IsOpened()) return null;
            return new VideoInfo(Math.Max(0, capture.FrameCount), capture.Fps, capture.FrameWidth, capture.FrameHeight);
        }
        catch (Exception ex) when (ex is OpenCVException or OpenCvSharpException)
        {
            return null;
        }
    }

    /// <summary>Image: the decoded image; video: frame frameIndex. PNG bytes, or null when unreadable.</summary>
    public static byte[]? LoadFramePng(string sourcePath, int frameIndex)
    {
        using var frame = LoadBgra(sourcePath, frameIndex);
        return frame == null ? null : TaskSetImageIo.EncodePng(frame);
    }

    /// <summary>BGRA PNG of the variant cut from the region (clamped to the image), or null when nothing remains.</summary>
    public static byte[]? Cut(string sourcePath, int frameIndex, VariantRegion region, VariantCutout mode)
    {
        using var frame = LoadBgra(sourcePath, frameIndex);
        if (frame == null) return null;
        var rect = new Rect(region.X, region.Y, region.Width, region.Height) & new Rect(0, 0, frame.Width, frame.Height);
        if (rect.Width <= 0 || rect.Height <= 0) return null;
        using var cut = (mode == VariantCutout.GrabCut ? GrabCutCutout(frame, rect) : null) ?? OpaqueCrop(frame, rect);
        return TaskSetImageIo.EncodePng(cut);
    }

    private static Mat? LoadBgra(string sourcePath, int frameIndex)
    {
        if (!IsVideo(sourcePath)) return TaskSetImageIo.ReadBgra(sourcePath);
        using var bgr = ReadVideoFrame(sourcePath, Math.Max(0, frameIndex));
        if (bgr == null) return null;
        var bgra = new Mat();
        Cv2.CvtColor(bgr, bgra, ColorConversionCodes.BGR2BGRA);
        return bgra;
    }

    /// <summary>Seek by frame position; falls back to sequential decoding when the backend seeks inexactly.</summary>
    private static Mat? ReadVideoFrame(string videoPath, int frameIndex)
    {
        try
        {
            using (var capture = new VideoCapture(videoPath))
            {
                if (!capture.IsOpened()) return null;
                var frame = new Mat();
                if (capture.Set(VideoCaptureProperties.PosFrames, frameIndex) && capture.Read(frame) && !frame.Empty()
                    && (int)Math.Round(capture.Get(VideoCaptureProperties.PosFrames)) == frameIndex + 1)
                    return frame;
                frame.Dispose();
            }
            using (var capture = new VideoCapture(videoPath))
            {
                for (int i = 0; i < frameIndex; i++)
                    if (!capture.Grab()) return null;
                var frame = new Mat();
                if (capture.Read(frame) && !frame.Empty()) return frame;
                frame.Dispose();
                return null;
            }
        }
        catch (Exception ex) when (ex is OpenCVException or OpenCvSharpException)
        {
            ColorPrinter.Yellow($"[YoloTaskSet] cannot read frame {frameIndex} of {videoPath}: {ex.Message}");
            return null;
        }
    }

    private static Mat OpaqueCrop(Mat bgra, Rect rect)
    {
        var crop = new Mat(bgra, rect).Clone();
        using var opaque = new Mat(crop.Size(), MatType.CV_8UC1, Scalar.All(byte.MaxValue));
        Cv2.InsertChannel(opaque, crop, 3);
        return crop;
    }

    /// <summary>
    /// GrabCut initialized with the rect inset by 1 px (so a whole-image rect still has background samples), run on the rect
    /// plus a margin of surrounding context. Null when segmentation fails or finds no foreground.
    /// </summary>
    private static Mat? GrabCutCutout(Mat bgra, Rect rect)
    {
        if (rect.Width <= 2 || rect.Height <= 2) return null;
        int margin = Math.Max(GrabCutMinMargin, (int)(Math.Max(rect.Width, rect.Height) * GrabCutMarginFraction));
        var work = new Rect(rect.X - margin, rect.Y - margin, rect.Width + 2 * margin, rect.Height + 2 * margin) & new Rect(0, 0, bgra.Width, bgra.Height);
        var inner = new Rect(rect.X - work.X + 1, rect.Y - work.Y + 1, rect.Width - 2, rect.Height - 2);

        using var workBgra = new Mat(bgra, work);
        using var workBgr = new Mat();
        Cv2.CvtColor(workBgra, workBgr, ColorConversionCodes.BGRA2BGR);
        using var gcMask = new Mat();
        using var bgdModel = new Mat();
        using var fgdModel = new Mat();
        try
        {
            Cv2.GrabCut(workBgr, gcMask, inner, bgdModel, fgdModel, GrabCutIterations, GrabCutModes.InitWithRect);
        }
        catch (Exception ex) when (ex is OpenCVException or OpenCvSharpException)
        {
            ColorPrinter.Yellow($"[YoloTaskSet] GrabCut failed, using rectangle crop: {ex.Message}");
            return null;
        }

        using var fg = new Mat();
        using var probableFg = new Mat();
        Cv2.Compare(gcMask, new Scalar((int)GrabCutClasses.FGD), fg, CmpType.EQ);
        Cv2.Compare(gcMask, new Scalar((int)GrabCutClasses.PR_FGD), probableFg, CmpType.EQ);
        using var alpha = new Mat();
        Cv2.BitwiseOr(fg, probableFg, alpha);
        using (var kernel = Cv2.GetStructuringElement(MorphShapes.Ellipse, new Size(CleanupKernelSize, CleanupKernelSize)))
        {
            Cv2.MorphologyEx(alpha, alpha, MorphTypes.Open, kernel);
            Cv2.MorphologyEx(alpha, alpha, MorphTypes.Close, kernel);
        }
        if (!KeepLargestComponent(alpha)) return null;
        VariantAugmenter.Feather(alpha, CutoutFeatherSigma);
        using (var sourceAlpha = new Mat())
        {
            Cv2.ExtractChannel(workBgra, sourceAlpha, 3);
            Cv2.Min(alpha, sourceAlpha, alpha);
        }

        var tight = Cv2.BoundingRect(alpha);
        if (tight.Width <= 0 || tight.Height <= 0) return null;
        var channels = Cv2.Split(workBgra);
        try
        {
            channels[3].Dispose();
            channels[3] = alpha.Clone();
            using var merged = new Mat();
            Cv2.Merge(channels, merged);
            return new Mat(merged, tight).Clone();
        }
        finally
        {
            foreach (var c in channels) c.Dispose();
        }
    }

    private static bool KeepLargestComponent(Mat binary)
    {
        using var labels = new Mat();
        using var stats = new Mat();
        using var centroids = new Mat();
        int count = Cv2.ConnectedComponentsWithStats(binary, labels, stats, centroids, PixelConnectivity.Connectivity8, MatType.CV_32S);
        int best = 0, bestArea = 0;
        for (int label = 1; label < count; label++)
        {
            int area = stats.Get<int>(label, (int)ConnectedComponentsTypes.Area);
            if (area > bestArea) (best, bestArea) = (label, area);
        }
        if (best == 0) return false;
        Cv2.Compare(labels, new Scalar(best), binary, CmpType.EQ);
        return true;
    }
}
