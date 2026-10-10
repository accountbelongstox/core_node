// PY-REF: none (DOT-only)
using OpenCvSharp;

namespace DotCore.YoloTaskSet;

/// <summary>
/// Per-object augmentation of a variant (YOLO_TASKSET_SYNTHESIS_DESIGN.md §4 augmentation table).
/// Geometry runs on premultiplied float BGRA so transparent borders never bleed dark fringes into the object.
/// </summary>
public static class VariantAugmenter
{
    private const int MinBlurKernel = 3;
    private const float AlphaEpsilon = 1e-4f;
    private const double AlphaVisibleThreshold = 0.5 / 255.0;
    private const double ContrastPivot = 128.0;
    private const double ByteMax = 255.0;
    private const double FeatherSigmaSpan = 3.0;
    // Pixel-exact UI icons up to this side are upscaled with Nearest (Linear blurs them).
    private const int SmallIconSide = 64;
    // Paste feather sigma at most this fraction of the object's short side; blur is skipped below MinBlurObjectSide.
    private const double FeatherPerSide = 0.04;
    private const int MinBlurObjectSide = 24;
    // A variant whose partially transparent pixels exceed this share of its visible pixels already has soft edges.
    private const double SoftAlphaShare = 0.05;

    /// <summary>
    /// Returns the augmented object cropped to its tight mask bounds: 8-bit BGRA (alpha = feathered mask) and the 8-bit mask.
    /// extraScale multiplies the random scale (e.g. relative sizing). The caller disposes both Mats.
    /// </summary>
    public static (Mat Bgra, Mat Mask) Apply(Mat bgra, AugmentationProfile p, double extraScale, Random rng) =>
        Apply(bgra, p, extraScale, rng, fixedScale: false);

    /// <summary>fixedScale: extraScale is the final size factor and the profile scale range is ignored (DPI steps).</summary>
    public static (Mat Bgra, Mat Mask) Apply(Mat bgra, AugmentationProfile p, double extraScale, Random rng, bool fixedScale)
    {
        p = p.Normalized();
        bool flip = p.FlipHorizontal && rng.NextDouble() < 0.5;
        double profileScale = Uniform(rng, p.ScaleMin, p.ScaleMax);
        double scale = (fixedScale ? 1 : profileScale) * (extraScale > 0 ? extraScale : 1);
        double stretch = Uniform(rng, p.StretchMin, p.StretchMax);
        double left = 1 + rng.NextDouble() * p.LeftStretchMax;
        double right = 1 + rng.NextDouble() * p.RightStretchMax;
        double angle = Uniform(rng, -p.RotationMaxDegrees, p.RotationMaxDegrees);
        double contrast = 1 + Uniform(rng, -p.ContrastMax, p.ContrastMax);
        double brightness = Uniform(rng, -p.BrightnessMax, p.BrightnessMax) * ByteMax;
        int blurKernel = 0;
        if (p.BlurMaxKernel >= MinBlurKernel && rng.NextDouble() < p.BlurProbability)
            blurKernel = MinBlurKernel + 2 * rng.Next((p.BlurMaxKernel - MinBlurKernel) / 2 + 1);

        bool nearestUpscale = Math.Max(bgra.Width, bgra.Height) <= SmallIconSide;
        bool softAlpha = HasSoftAlpha(bgra);
        var current = ToPremultipliedFloat(bgra);
        try
        {
            if (flip) Cv2.Flip(current, current, FlipMode.Y);
            Replace(ref current, Resize(current, scale * stretch, scale, nearestUpscale));
            if (left > 1 || right > 1) Replace(ref current, OneSidedPerspective(current, left, right));
            if (angle != 0) Replace(ref current, RotateExpanded(current, angle));
            Replace(ref current, CropToAlpha(current));
            int shortSide = Math.Min(current.Width, current.Height);
            if (shortSide < MinBlurObjectSide) blurKernel = 0;
            double feather = softAlpha ? 0 : Math.Min(p.EdgeFeather, FeatherPerSide * shortSide);
            return ToStraightBgra(current, contrast, brightness, blurKernel, feather);
        }
        finally
        {
            current.Dispose();
        }
    }

    /// <summary>Scene color cast in place (8-bit BGR): per-channel gains in [1 - cast, 1 + cast], rescaled to mean gain 1.</summary>
    public static void ApplyColorCast(Mat bgr, double cast, Random rng)
    {
        if (cast <= 0) return;
        double b = 1 + Uniform(rng, -cast, cast), g = 1 + Uniform(rng, -cast, cast), r = 1 + Uniform(rng, -cast, cast);
        double mean = (b + g + r) / 3;
        Cv2.Multiply(bgr, new Scalar(b / mean, g / mean, r / mean), bgr);
    }

    private static double Uniform(Random rng, double min, double max) => max <= min ? min : min + rng.NextDouble() * (max - min);

    private static void Replace(ref Mat current, Mat next)
    {
        if (ReferenceEquals(current, next)) return;
        current.Dispose();
        current = next;
    }

    /// <summary>CV_32FC4: B, G, R premultiplied (0..255 * a), A in 0..1.</summary>
    private static Mat ToPremultipliedFloat(Mat src)
    {
        using var bgra8 = new Mat();
        if (src.Channels() == 4) src.CopyTo(bgra8);
        else Cv2.CvtColor(src, bgra8, src.Channels() == 1 ? ColorConversionCodes.GRAY2BGRA : ColorConversionCodes.BGR2BGRA);
        using var f = new Mat();
        bgra8.ConvertTo(f, MatType.CV_32FC4);
        var ch = Cv2.Split(f);
        try
        {
            ch[3].ConvertTo(ch[3], MatType.CV_32F, 1.0 / ByteMax);
            for (int i = 0; i < 3; i++) Cv2.Multiply(ch[i], ch[3], ch[i]);
            var result = new Mat();
            Cv2.Merge(ch, result);
            return result;
        }
        finally
        {
            foreach (var c in ch) c.Dispose();
        }
    }

    /// <summary>True when partially transparent pixels make up a noticeable share of the visible ones (cutout already feathered).</summary>
    internal static bool HasSoftAlpha(Mat bgra)
    {
        if (bgra.Channels() != 4) return false;
        using var alpha = new Mat();
        Cv2.ExtractChannel(bgra, alpha, 3);
        using var visible = new Mat();
        using var opaque = new Mat();
        Cv2.Threshold(alpha, visible, 0, byte.MaxValue, ThresholdTypes.Binary);
        Cv2.Threshold(alpha, opaque, byte.MaxValue - 1, byte.MaxValue, ThresholdTypes.Binary);
        int nVisible = Cv2.CountNonZero(visible);
        int nPartial = nVisible - Cv2.CountNonZero(opaque);
        return nVisible > 0 && nPartial > SoftAlphaShare * nVisible;
    }

    private static Mat Resize(Mat src, double fx, double fy, bool nearestUpscale)
    {
        var size = new Size(Math.Max(1, (int)Math.Round(src.Width * fx)), Math.Max(1, (int)Math.Round(src.Height * fy)));
        if (size == src.Size()) return src;
        var dst = new Mat();
        var interpolation = (long)size.Width * size.Height < (long)src.Width * src.Height ? InterpolationFlags.Area
            : nearestUpscale ? InterpolationFlags.Nearest : InterpolationFlags.Linear;
        Cv2.Resize(src, dst, size, 0, 0, interpolation);
        return dst;
    }

    /// <summary>Left / right edge heights multiplied by the given factors (vertically centered), width kept, canvas grown.</summary>
    private static Mat OneSidedPerspective(Mat src, double left, double right)
    {
        float w = src.Width, h = src.Height;
        int newH = (int)Math.Ceiling(h * Math.Max(left, right));
        float leftTop = (float)((newH - h * left) / 2), rightTop = (float)((newH - h * right) / 2);
        var from = new[] { new Point2f(0, 0), new Point2f(w, 0), new Point2f(w, h), new Point2f(0, h) };
        var to = new[]
        {
            new Point2f(0, leftTop), new Point2f(w, rightTop),
            new Point2f(w, rightTop + (float)(h * right)), new Point2f(0, leftTop + (float)(h * left)),
        };
        using var m = Cv2.GetPerspectiveTransform(from, to);
        var dst = new Mat();
        Cv2.WarpPerspective(src, dst, m, new Size(src.Width, newH), InterpolationFlags.Linear, BorderTypes.Constant, Scalar.All(0));
        return dst;
    }

    private static Mat RotateExpanded(Mat src, double angle)
    {
        double rad = angle * Math.PI / 180.0;
        double cos = Math.Abs(Math.Cos(rad)), sin = Math.Abs(Math.Sin(rad));
        int newW = (int)Math.Ceiling(src.Width * cos + src.Height * sin);
        int newH = (int)Math.Ceiling(src.Width * sin + src.Height * cos);
        var center = new Point2f(src.Width / 2f, src.Height / 2f);
        using var m = Cv2.GetRotationMatrix2D(center, angle, 1.0);
        m.Set(0, 2, m.Get<double>(0, 2) + newW / 2.0 - center.X);
        m.Set(1, 2, m.Get<double>(1, 2) + newH / 2.0 - center.Y);
        var dst = new Mat();
        Cv2.WarpAffine(src, dst, m, new Size(newW, newH), InterpolationFlags.Linear, BorderTypes.Constant, Scalar.All(0));
        return dst;
    }

    private static Mat CropToAlpha(Mat src)
    {
        using var alpha = new Mat();
        Cv2.ExtractChannel(src, alpha, 3);
        using var visible = new Mat();
        Cv2.Threshold(alpha, visible, AlphaVisibleThreshold, ByteMax, ThresholdTypes.Binary);
        using var visible8 = new Mat();
        visible.ConvertTo(visible8, MatType.CV_8U);
        var rect = Cv2.BoundingRect(visible8);
        if (rect.Width <= 0 || rect.Height <= 0 || rect.Size == src.Size()) return src;
        return new Mat(src, rect).Clone();
    }

    private static (Mat Bgra, Mat Mask) ToStraightBgra(Mat premul, double contrast, double brightness, int blurKernel, double feather)
    {
        var ch = Cv2.Split(premul);
        var disposables = new List<Mat>(ch);
        try
        {
            var a = ch[3];
            double offset = ContrastPivot * (1 - contrast) + brightness;
            for (int i = 0; i < 3; i++) Cv2.AddWeighted(ch[i], contrast, a, offset, 0, ch[i]);

            var divisor = new Mat();
            disposables.Add(divisor);
            if (blurKernel > 0)
            {
                var k = new Size(blurKernel, blurKernel);
                for (int i = 0; i < 3; i++) Cv2.GaussianBlur(ch[i], ch[i], k, 0);
                Cv2.GaussianBlur(a, divisor, k, 0);
            }
            else
            {
                a.CopyTo(divisor);
            }
            Cv2.Max(divisor, AlphaEpsilon, divisor);

            var bgr8 = new Mat[3];
            for (int i = 0; i < 3; i++)
            {
                Cv2.Divide(ch[i], divisor, ch[i]);
                bgr8[i] = new Mat();
                disposables.Add(bgr8[i]);
                ch[i].ConvertTo(bgr8[i], MatType.CV_8U);
            }
            var mask = new Mat();
            a.ConvertTo(mask, MatType.CV_8U, ByteMax);
            if (feather > 0) Feather(mask, feather);

            var bgra = new Mat();
            Cv2.Merge(new[] { bgr8[0], bgr8[1], bgr8[2], mask }, bgra);
            return (bgra, mask);
        }
        finally
        {
            foreach (var d in disposables) d.Dispose();
        }
    }

    /// <summary>Gaussian-softened mask edges, never above the original mask (no halo outside the object).</summary>
    internal static void Feather(Mat mask, double sigma)
    {
        int pad = (int)Math.Ceiling(sigma * FeatherSigmaSpan);
        using var padded = new Mat();
        Cv2.CopyMakeBorder(mask, padded, pad, pad, pad, pad, BorderTypes.Constant, Scalar.All(0));
        Cv2.GaussianBlur(padded, padded, new Size(0, 0), sigma);
        using var blurred = new Mat(padded, new Rect(pad, pad, mask.Width, mask.Height));
        Cv2.Min(mask, blurred, mask);
    }
}
