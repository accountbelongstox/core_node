// PY-REF: none (DOT-only)
using DotCore.Foundations;
using DotCore.VocAnnotator;
using OpenCvSharp;

namespace DotCore.YoloTaskSet;

/// <summary>Unicode-safe image decode / encode (Cv2.ImRead cannot open non-ASCII paths on Windows).</summary>
internal static class TaskSetImageIo
{
    private const double SixteenToEightBit = 1.0 / 256.0;
    private const string JpegExtension = ".jpg";
    private const string PngExtension = ".png";

    // Reduced decodes scale by 1/2, 1/4 or 1/8 while decoding (JPEG DCT scaling), largest first.
    private static readonly (int Factor, ImreadModes Mode)[] ReducedModes =
    {
        (8, ImreadModes.ReducedColor8), (4, ImreadModes.ReducedColor4), (2, ImreadModes.ReducedColor2),
    };

    /// <summary>8-bit BGRA (alpha = object mask; images without alpha get opaque alpha), or null when unreadable.</summary>
    public static Mat? ReadBgra(string path)
    {
        using var raw = Decode(path, ImreadModes.Unchanged);
        if (raw == null) return null;
        using var eight = ToEightBit(raw);
        var bgra = new Mat();
        switch (eight.Channels())
        {
            case 1: Cv2.CvtColor(eight, bgra, ColorConversionCodes.GRAY2BGRA); break;
            case 3: Cv2.CvtColor(eight, bgra, ColorConversionCodes.BGR2BGRA); break;
            case 4: eight.CopyTo(bgra); break;
            default:
                bgra.Dispose();
                return null;
        }
        return bgra;
    }

    /// <summary>8-bit BGR downscaled so the longest side is at most maxSide (aspect kept; 0 = full size), or null when unreadable.</summary>
    public static Mat? ReadBgr(string path, int maxSide)
    {
        var mode = ImreadModes.Color;
        if (maxSide > 0 && ImageHeaderReader.ReadSize(path) is { } size)
        {
            int longest0 = Math.Max(size.Width, size.Height);
            foreach (var (factor, reduced) in ReducedModes)
                if (longest0 / factor >= maxSide)
                {
                    mode = reduced;
                    break;
                }
        }
        var bgr = Decode(path, mode);
        if (bgr == null) return null;
        int longest = Math.Max(bgr.Width, bgr.Height);
        if (maxSide <= 0 || longest <= maxSide) return bgr;
        double f = maxSide / (double)longest;
        var resized = new Mat();
        Cv2.Resize(bgr, resized, new Size(Math.Max(1, (int)Math.Round(bgr.Width * f)), Math.Max(1, (int)Math.Round(bgr.Height * f))),
            0, 0, InterpolationFlags.Area);
        bgr.Dispose();
        return resized;
    }

    /// <summary>Pixel size from the file header, else by decoding; null when unreadable.</summary>
    public static (int Width, int Height)? ReadSize(string path)
    {
        if (!File.Exists(path)) return null;
        if (ImageHeaderReader.ReadSize(path) is { } size) return size;
        using var mat = Decode(path, ImreadModes.Color);
        return mat == null ? null : (mat.Width, mat.Height);
    }

    public static byte[] EncodeJpeg(Mat image, int quality)
    {
        Cv2.ImEncode(JpegExtension, image, out var bytes, new ImageEncodingParam(ImwriteFlags.JpegQuality, quality));
        return bytes;
    }

    public static byte[] EncodePng(Mat image)
    {
        Cv2.ImEncode(PngExtension, image, out var bytes);
        return bytes;
    }

    public static byte[] Encode(Mat image, bool png, int jpegQuality) => png ? EncodePng(image) : EncodeJpeg(image, jpegQuality);

    private static Mat? Decode(string path, ImreadModes mode)
    {
        try
        {
            var mat = Cv2.ImDecode(File.ReadAllBytes(path), mode);
            if (!mat.Empty()) return mat;
            mat.Dispose();
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or OpenCVException or OpenCvSharpException or OutOfMemoryException)
        {
            ColorPrinter.Gray($"[YoloTaskSet] cannot decode {path}: {ex.Message}");
        }
        return null;
    }

    private static Mat ToEightBit(Mat src)
    {
        var dst = new Mat();
        switch (src.Depth())
        {
            case MatType.CV_8U: src.CopyTo(dst); break;
            case MatType.CV_16U: src.ConvertTo(dst, MatType.MakeType(MatType.CV_8U, src.Channels()), SixteenToEightBit); break;
            case MatType.CV_32F:
            case MatType.CV_64F: src.ConvertTo(dst, MatType.MakeType(MatType.CV_8U, src.Channels()), 255.0); break;
            default: src.ConvertTo(dst, MatType.MakeType(MatType.CV_8U, src.Channels())); break;
        }
        return dst;
    }
}
