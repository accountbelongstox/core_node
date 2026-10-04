// PY-REF: none (DOT-only)
using DotCore.Foundations;
using OpenCvSharp;

namespace DotCore.YoloTaskSet;

/// <summary>Unicode-safe image decode / encode (Cv2.ImRead cannot open non-ASCII paths on Windows).</summary>
internal static class TaskSetImageIo
{
    private const double SixteenToEightBit = 1.0 / 256.0;

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

    /// <summary>8-bit BGR downscaled so the longest side is at most maxSide (aspect kept), or null when unreadable.</summary>
    public static Mat? ReadBgr(string path, int maxSide)
    {
        var bgr = Decode(path, ImreadModes.Color);
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

    public static byte[] EncodeJpeg(Mat image, int quality)
    {
        Cv2.ImEncode(".jpg", image, out var bytes, new ImageEncodingParam(ImwriteFlags.JpegQuality, quality));
        return bytes;
    }

    public static byte[] EncodePng(Mat image)
    {
        Cv2.ImEncode(".png", image, out var bytes);
        return bytes;
    }

    private static Mat? Decode(string path, ImreadModes mode)
    {
        try
        {
            var mat = Cv2.ImDecode(File.ReadAllBytes(path), mode);
            if (!mat.Empty()) return mat;
            mat.Dispose();
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or OpenCVException or OpenCvSharpException)
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
