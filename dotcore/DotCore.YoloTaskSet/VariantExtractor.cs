// PY-REF: none (DOT-only)
using System.Globalization;
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

    /// <summary>Flood fill from the crop border within a colour tolerance becomes transparent (flat UI backgrounds, small icons).</summary>
    ColorKey,
}

public sealed record VideoInfo(int FrameCount, double Fps, int Width, int Height);

/// <summary>Alpha state of a variant; Border* is the mean colour of the outermost pixel ring, UniformBorder when every border pixel is within tolerance of it.</summary>
public sealed record VariantAlphaInfo(bool HasTransparency, bool UniformBorder, byte BorderB, byte BorderG, byte BorderR);

/// <summary>Extracts variants ("1.1", "1.2", ...) from large images or video frames.</summary>
public static partial class VariantExtractor
{
    private const int GrabCutIterations = 5;
    private const double GrabCutMarginFraction = 0.1;
    private const int GrabCutMinMargin = 8;
    private const int CleanupKernelSize = 3;
    private const double CutoutFeatherSigma = 1.0;
    private const char SourceRefRegionMarker = '@';
    private const string SourceRefFrameMarker = "#frame=";
    private const int ColorKeyFloodFlags = (int)FloodFillFlags.Link4 | (int)FloodFillFlags.FixedRange | (int)FloodFillFlags.MaskOnly | (byte.MaxValue << 8);

    public static bool IsVideo(string path) => TaskSetStore.IsSupportedVideo(path);

    public static VideoInfo? GetVideoInfo(string videoPath)
    {
        using var reader = new VideoFrameReader(videoPath, 1);
        return reader.IsVideo ? reader.Info : null;
    }

    /// <summary>Image: the decoded image; video: frame frameIndex. PNG bytes, or null when unreadable.</summary>
    public static byte[]? LoadFramePng(string sourcePath, int frameIndex)
    {
        using var reader = new VideoFrameReader(sourcePath, 1);
        return reader.ReadPng(frameIndex);
    }

    /// <summary>BGRA PNG of the variant cut from the region (clamped to the image), or null when nothing remains. Prefer the Mat overload with a VideoFrameReader for repeated cuts.</summary>
    public static byte[]? Cut(string sourcePath, int frameIndex, VariantRegion region, VariantCutout mode, VariantCutOptions? options = null)
    {
        using var reader = new VideoFrameReader(sourcePath, 1);
        using var frame = reader.ReadBgra(frameIndex);
        return frame == null ? null : Cut(frame, region, mode, options);
    }

    /// <summary>Same as the path overload on an already decoded 8-bit frame (gray, BGR or BGRA; not modified).</summary>
    public static byte[]? Cut(Mat frame, VariantRegion region, VariantCutout mode, VariantCutOptions? options = null)
    {
        using var cut = CutMat(frame, region, mode, options);
        return cut == null ? null : TaskSetImageIo.EncodePng(cut);
    }

    /// <summary>BGRA cutout Mat (caller disposes), or null when the region is outside the frame. GrabCut / ColorKey fall back to the opaque crop when they find no foreground.</summary>
    public static Mat? CutMat(Mat frame, VariantRegion region, VariantCutout mode, VariantCutOptions? options = null)
    {
        options ??= new VariantCutOptions();
        using var bgra = ToBgra(frame);
        if (bgra == null) return null;
        var rect = ToRect(region) & new Rect(0, 0, bgra.Width, bgra.Height);
        if (rect.Width <= 0 || rect.Height <= 0) return null;
        var hints = options.Hints is { IsEmpty: false } h ? h : null;
        var cut = mode switch
        {
            VariantCutout.GrabCut => GrabCutCutout(bgra, rect, hints),
            VariantCutout.ColorKey => ColorKeyCutout(bgra, rect,
                Math.Clamp(options.ColorKeyTolerance, VariantCutOptions.MinColorKeyTolerance, VariantCutOptions.MaxColorKeyTolerance), options.ColorKeyHoles, hints),
            _ => null,
        };
        return cut ?? OpaqueCrop(bgra, rect);
    }

    /// <summary>OriginalPath of an extracted variant: "path@x,y,w,h" for images, "path#frame=N@x,y,w,h" for videos.</summary>
    public static string FormatSourceRef(string sourcePath, int? frameIndex, VariantRegion region)
    {
        var r = string.Create(CultureInfo.InvariantCulture, $"{SourceRefRegionMarker}{region.X},{region.Y},{region.Width},{region.Height}");
        return frameIndex is { } f ? string.Create(CultureInfo.InvariantCulture, $"{sourcePath}{SourceRefFrameMarker}{f}{r}") : sourcePath + r;
    }

    /// <summary>Inverse of FormatSourceRef (the path itself may contain '@' or '#').</summary>
    public static bool TryParseSourceRef(string? originalPath, out string sourcePath, out int? frameIndex, out VariantRegion region)
    {
        sourcePath = "";
        frameIndex = null;
        region = default;
        if (string.IsNullOrEmpty(originalPath)) return false;
        int at = originalPath.LastIndexOf(SourceRefRegionMarker);
        if (at <= 0) return false;
        var parts = originalPath[(at + 1)..].Split(',');
        var values = new int[4];
        if (parts.Length != 4) return false;
        for (int i = 0; i < 4; i++)
            if (!int.TryParse(parts[i], NumberStyles.Integer, CultureInfo.InvariantCulture, out values[i])) return false;
        var head = originalPath[..at];
        int hash = head.LastIndexOf(SourceRefFrameMarker, StringComparison.Ordinal);
        if (hash > 0 && int.TryParse(head.AsSpan(hash + SourceRefFrameMarker.Length), NumberStyles.Integer, CultureInfo.InvariantCulture, out var frame))
        {
            frameIndex = frame;
            head = head[..hash];
        }
        sourcePath = head;
        region = new VariantRegion(values[0], values[1], values[2], values[3]);
        return true;
    }

    public static bool HasTransparency(Mat bgra)
    {
        if (bgra.Channels() != 4 || bgra.Empty()) return false;
        using var alpha = new Mat();
        Cv2.ExtractChannel(bgra, alpha, 3);
        Cv2.MinMaxLoc(alpha, out double min, out _);
        return min < byte.MaxValue;
    }

    /// <summary>Alpha / border state of a decoded variant (for the VariantWithoutAlpha check and border-colour matching).</summary>
    public static VariantAlphaInfo InspectAlpha(Mat image, int tolerance = VariantCutOptions.DefaultColorKeyTolerance)
    {
        using var bgra = ToBgra(image) ?? throw new ArgumentException("Unsupported image", nameof(image));
        using var bgr = new Mat();
        Cv2.CvtColor(bgra, bgr, ColorConversionCodes.BGRA2BGR);
        var border = BorderPixels(bgr);
        double b = border.Average(p => p.Item0), g = border.Average(p => p.Item1), r = border.Average(p => p.Item2);
        bool uniform = border.All(p => Math.Abs(p.Item0 - b) <= tolerance && Math.Abs(p.Item1 - g) <= tolerance && Math.Abs(p.Item2 - r) <= tolerance);
        return new VariantAlphaInfo(HasTransparency(bgra), uniform, ToByte(b), ToByte(g), ToByte(r));
    }

    /// <summary>InspectAlpha of an image file; null when unreadable.</summary>
    public static VariantAlphaInfo? InspectAlpha(string imagePath, int tolerance = VariantCutOptions.DefaultColorKeyTolerance)
    {
        using var bgra = TaskSetImageIo.ReadBgra(imagePath);
        return bgra == null ? null : InspectAlpha(bgra, tolerance);
    }

    internal static Rect ToRect(VariantRegion r) => new(r.X, r.Y, r.Width, r.Height);

    internal static VariantRegion ToRegion(Rect r) => new(r.X, r.Y, r.Width, r.Height);

    /// <summary>8-bit BGRA copy of a gray / BGR / BGRA frame, or null for other formats.</summary>
    internal static Mat? ToBgra(Mat frame)
    {
        if (frame.Empty() || frame.Depth() != MatType.CV_8U) return null;
        var bgra = new Mat();
        switch (frame.Channels())
        {
            case 1: Cv2.CvtColor(frame, bgra, ColorConversionCodes.GRAY2BGRA); break;
            case 3: Cv2.CvtColor(frame, bgra, ColorConversionCodes.BGR2BGRA); break;
            case 4: frame.CopyTo(bgra); break;
            default:
                bgra.Dispose();
                return null;
        }
        return bgra;
    }

    private static byte ToByte(double v) => (byte)Math.Clamp((int)Math.Round(v), 0, byte.MaxValue);

    private static List<Vec3b> BorderPixels(Mat bgr)
    {
        var pixels = new List<Vec3b>();
        int w = bgr.Width, h = bgr.Height;
        for (int x = 0; x < w; x++)
        {
            pixels.Add(bgr.At<Vec3b>(0, x));
            if (h > 1) pixels.Add(bgr.At<Vec3b>(h - 1, x));
        }
        for (int y = 1; y < h - 1; y++)
        {
            pixels.Add(bgr.At<Vec3b>(y, 0));
            if (w > 1) pixels.Add(bgr.At<Vec3b>(y, w - 1));
        }
        return pixels;
    }

    private static Mat OpaqueCrop(Mat bgra, Rect rect)
    {
        var crop = new Mat(bgra, rect).Clone();
        using var opaque = new Mat(crop.Size(), MatType.CV_8UC1, Scalar.All(byte.MaxValue));
        Cv2.InsertChannel(opaque, crop, 3);
        return crop;
    }

    /// <summary>Hint mask for the work rect: GrabCut class per pixel (FGD / BGD) where the user forced it, 255 elsewhere.</summary>
    private static Mat? HintClasses(VariantMaskHints? hints, Rect work)
    {
        if (hints == null) return null;
        var classes = new Mat(work.Size, MatType.CV_8UC1, Scalar.All(byte.MaxValue));
        if (hints.Mask is { } mask && !mask.Empty())
        {
            var inMask = work & new Rect(0, 0, mask.Width, mask.Height);
            if (inMask.Width > 0 && inMask.Height > 0)
            {
                using var src = new Mat(mask, inMask);
                using var dst = new Mat(classes, new Rect(inMask.X - work.X, inMask.Y - work.Y, inMask.Width, inMask.Height));
                using var isBg = new Mat();
                using var isFg = new Mat();
                Cv2.Compare(src, new Scalar(VariantMaskHints.MaskBackground), isBg, CmpType.EQ);
                Cv2.Compare(src, new Scalar(VariantMaskHints.MaskForeground), isFg, CmpType.EQ);
                dst.SetTo(new Scalar((int)GrabCutClasses.BGD), isBg);
                dst.SetTo(new Scalar((int)GrabCutClasses.FGD), isFg);
            }
        }
        foreach (var stroke in hints.Strokes)
        {
            if (stroke.Points.Count == 0) continue;
            var value = new Scalar((int)(stroke.Kind == VariantStrokeKind.Foreground ? GrabCutClasses.FGD : GrabCutClasses.BGD));
            int thickness = Math.Max(1, stroke.Thickness);
            var points = stroke.Points.Select(p => new Point(p.X - work.X, p.Y - work.Y)).ToList();
            if (points.Count == 1) Cv2.Circle(classes, points[0], Math.Max(1, thickness / 2), value, -1);
            else Cv2.Polylines(classes, new[] { points }, false, value, thickness, LineTypes.Link8);
        }
        return classes;
    }

    /// <summary>Forces hinted pixels in a binary (0/255) alpha of the work rect.</summary>
    private static void ApplyHints(Mat alpha, Mat hintClasses)
    {
        using var fg = new Mat();
        using var bg = new Mat();
        Cv2.Compare(hintClasses, new Scalar((int)GrabCutClasses.FGD), fg, CmpType.EQ);
        Cv2.Compare(hintClasses, new Scalar((int)GrabCutClasses.BGD), bg, CmpType.EQ);
        alpha.SetTo(Scalar.All(byte.MaxValue), fg);
        alpha.SetTo(Scalar.All(0), bg);
    }

    /// <summary>
    /// Border flood fill (fixed range per seed) marks background; no morphology or component filtering so thin strokes and
    /// disconnected icon parts survive. With holes, enclosed pixels within tolerance of the mean keyed colour are keyed too.
    /// Already transparent source pixels stay transparent.
    /// </summary>
    private static Mat? ColorKeyCutout(Mat bgra, Rect rect, int tolerance, bool holes, VariantMaskHints? hints)
    {
        using var cropBgra = new Mat(bgra, rect);
        using var bgr = new Mat();
        Cv2.CvtColor(cropBgra, bgr, ColorConversionCodes.BGRA2BGR);
        int w = rect.Width, h = rect.Height;
        using var flood = new Mat(h + 2, w + 2, MatType.CV_8UC1, Scalar.All(0));
        var diff = Scalar.All(tolerance);
        void Seed(int x, int y)
        {
            if (flood.At<byte>(y + 1, x + 1) != 0) return;
            Cv2.FloodFill(bgr, flood, new Point(x, y), Scalar.All(0), out _, diff, diff, (FloodFillFlags)ColorKeyFloodFlags);
        }
        for (int x = 0; x < w; x++)
        {
            Seed(x, 0);
            Seed(x, h - 1);
        }
        for (int y = 0; y < h; y++)
        {
            Seed(0, y);
            Seed(w - 1, y);
        }

        using var alpha = new Mat();
        using (var background = new Mat(flood, new Rect(1, 1, w, h)))
        {
            if (holes && Cv2.CountNonZero(background) > 0)
            {
                var key = Cv2.Mean(bgr, background);
                using var similar = new Mat();
                Cv2.InRange(bgr, new Scalar(key.Val0 - tolerance, key.Val1 - tolerance, key.Val2 - tolerance),
                    new Scalar(key.Val0 + tolerance, key.Val1 + tolerance, key.Val2 + tolerance), similar);
                Cv2.BitwiseOr(background, similar, background);
            }
            Cv2.BitwiseNot(background, alpha);
        }
        using (var hintClasses = HintClasses(hints, rect))
            if (hintClasses != null) ApplyHints(alpha, hintClasses);
        return ComposeCutout(cropBgra, alpha);
    }

    /// <summary>
    /// GrabCut initialized with the rect inset by 1 px (so a whole-image rect still has background samples), run on the rect
    /// plus a margin of surrounding context; with hints the mask is seeded from the user strokes (InitWithMask).
    /// Null when segmentation fails or finds no foreground.
    /// </summary>
    private static Mat? GrabCutCutout(Mat bgra, Rect rect, VariantMaskHints? hints)
    {
        if (rect.Width <= 2 || rect.Height <= 2) return null;
        int margin = Math.Max(GrabCutMinMargin, (int)(Math.Max(rect.Width, rect.Height) * GrabCutMarginFraction));
        var work = new Rect(rect.X - margin, rect.Y - margin, rect.Width + 2 * margin, rect.Height + 2 * margin) & new Rect(0, 0, bgra.Width, bgra.Height);
        var inner = new Rect(rect.X - work.X + 1, rect.Y - work.Y + 1, rect.Width - 2, rect.Height - 2);

        using var workBgra = new Mat(bgra, work);
        using var workBgr = new Mat();
        Cv2.CvtColor(workBgra, workBgr, ColorConversionCodes.BGRA2BGR);
        using var gcMask = new Mat(work.Size, MatType.CV_8UC1, new Scalar((int)GrabCutClasses.BGD));
        using var bgdModel = new Mat();
        using var fgdModel = new Mat();
        using var hintClasses = HintClasses(hints, work);
        try
        {
            if (hintClasses == null)
            {
                Cv2.GrabCut(workBgr, gcMask, inner, bgdModel, fgdModel, GrabCutIterations, GrabCutModes.InitWithRect);
            }
            else
            {
                using (var innerMask = new Mat(gcMask, inner)) innerMask.SetTo(new Scalar((int)GrabCutClasses.PR_FGD));
                using var forced = new Mat();
                Cv2.Compare(hintClasses, new Scalar(byte.MaxValue), forced, CmpType.NE);
                hintClasses.CopyTo(gcMask, forced);
                Cv2.GrabCut(workBgr, gcMask, inner, bgdModel, fgdModel, GrabCutIterations, GrabCutModes.InitWithMask);
            }
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
        using (var userFg = new Mat())
        {
            if (hintClasses != null) Cv2.Compare(hintClasses, new Scalar((int)GrabCutClasses.FGD), userFg, CmpType.EQ);
            if (!KeepMainComponents(alpha, hintClasses != null ? userFg : null)) return null;
        }
        if (hintClasses != null) ApplyHints(alpha, hintClasses);
        VariantAugmenter.Feather(alpha, CutoutFeatherSigma);
        return ComposeCutout(workBgra, alpha);
    }

    /// <summary>Source BGRA with alpha = min(mask, source alpha), cropped to the tight bounds of the result; null when empty.</summary>
    private static Mat? ComposeCutout(Mat sourceBgra, Mat alpha)
    {
        using (var sourceAlpha = new Mat())
        {
            Cv2.ExtractChannel(sourceBgra, sourceAlpha, 3);
            Cv2.Min(alpha, sourceAlpha, alpha);
        }
        var tight = Cv2.BoundingRect(alpha);
        if (tight.Width <= 0 || tight.Height <= 0) return null;
        var channels = Cv2.Split(sourceBgra);
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

    /// <summary>Keeps the largest component plus every component touching a user foreground pixel; false when nothing remains.</summary>
    private static bool KeepMainComponents(Mat binary, Mat? userForeground)
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
        var keep = new HashSet<int> { best };
        if (userForeground != null && Cv2.CountNonZero(userForeground) > 0)
        {
            for (int y = 0; y < labels.Rows; y++)
                for (int x = 0; x < labels.Cols; x++)
                    if (userForeground.At<byte>(y, x) != 0 && labels.At<int>(y, x) is var l && l > 0) keep.Add(l);
        }
        using var result = new Mat(binary.Size(), MatType.CV_8UC1, Scalar.All(0));
        foreach (var label in keep)
        {
            using var component = new Mat();
            Cv2.Compare(labels, new Scalar(label), component, CmpType.EQ);
            result.SetTo(Scalar.All(byte.MaxValue), component);
        }
        result.CopyTo(binary);
        return true;
    }
}
