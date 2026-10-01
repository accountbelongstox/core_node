using System.Drawing;
using System.Drawing.Imaging;
using DotCore.Foundations;
using OpenCvSharp;
using OpenCvSharp.Extensions;

namespace DotCore.Utils.ImagePreprocess;

/// <summary>
/// Image format conversion between Bitmap (PIL counterpart, RGB), OpenCV Mat (BGR/BGRA/gray) and files.
/// 1:1 Python pyapps/d3-check/d3utils/d3u_common/image_conversion.py. File IO decodes bytes, so non-ASCII paths work.
/// All returned Mats/Bitmaps are new objects owned by the caller.
/// </summary>
public static class ImageConvert
{
    private const string LogPrefix = "[ImageConversion]";

    /// <summary>Load an image file as Mat (default BGR). Empty Mat when missing or undecodable.</summary>
    public static Mat LoadMat(string path, ImreadModes mode = ImreadModes.Color)
    {
        if (string.IsNullOrWhiteSpace(path) || !File.Exists(path)) return new Mat();
        try
        {
            return Cv2.ImDecode(File.ReadAllBytes(path), mode);
        }
        catch
        {
            return new Mat();
        }
    }

    /// <summary>Save a Mat to file (format by extension). Creates the directory. Returns false on failure.</summary>
    public static bool SaveMat(Mat image, string path)
    {
        if (image == null || image.Empty() || string.IsNullOrWhiteSpace(path)) return false;
        try
        {
            var dir = Path.GetDirectoryName(path);
            if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
            var ext = Path.GetExtension(path);
            if (string.IsNullOrEmpty(ext)) ext = ".png";
            Cv2.ImEncode(ext, image, out var bytes);
            File.WriteAllBytes(path, bytes);
            return true;
        }
        catch (Exception e)
        {
            ColorPrinter.Red($"{LogPrefix} Error saving image {path}: {e.Message}");
            return false;
        }
    }

    /// <summary>File path to BGR Mat. 1:1 normalize_image_to_bgr(path); throws when loading fails.</summary>
    public static Mat NormalizeToBgr(string path)
    {
        var image = LoadMat(path);
        if (image.Empty())
        {
            image.Dispose();
            var message = $"Could not load image from path: {path}";
            ColorPrinter.Red($"{LogPrefix} Error normalizing image to BGR: {message}");
            throw new ArgumentException(message, nameof(path));
        }
        return image;
    }

    /// <summary>Bitmap to BGR Mat (alpha dropped; gray stays gray). 1:1 normalize_image_to_bgr(PIL).</summary>
    public static Mat NormalizeToBgr(Bitmap image)
    {
        ArgumentNullException.ThrowIfNull(image);
        var mat = BitmapToMat(image);
        if (mat.Channels() != 4) return mat;
        using (mat) return BgraToBgr(mat);
    }

    /// <summary>Mat passthrough copy. 1:1 normalize_image_to_bgr(ndarray).</summary>
    public static Mat NormalizeToBgr(Mat image)
    {
        ArgumentNullException.ThrowIfNull(image);
        return image.Clone();
    }

    /// <summary>File path to 24bpp RGB Bitmap. 1:1 normalize_image_to_rgb_pil(path).</summary>
    public static Bitmap NormalizeToRgbBitmap(string path)
    {
        using var mat = NormalizeToBgr(path);
        return MatToBitmap(mat);
    }

    /// <summary>Bitmap to 24bpp RGB Bitmap. 1:1 normalize_image_to_rgb_pil(PIL) / ensure_rgb_mode.</summary>
    public static Bitmap NormalizeToRgbBitmap(Bitmap image) => EnsureRgb(image);

    /// <summary>BGR/gray Mat to Bitmap. 1:1 normalize_image_to_rgb_pil(ndarray).</summary>
    public static Bitmap NormalizeToRgbBitmap(Mat image) => MatToBitmap(image);

    /// <summary>Return a 24bpp RGB copy of the bitmap (always a new object). 1:1 ensure_rgb_mode.</summary>
    public static Bitmap EnsureRgb(Bitmap image)
    {
        ArgumentNullException.ThrowIfNull(image);
        var rgb = new Bitmap(image.Width, image.Height, PixelFormat.Format24bppRgb);
        using var g = Graphics.FromImage(rgb);
        g.DrawImage(image, 0, 0, image.Width, image.Height);
        return rgb;
    }

    /// <summary>Bitmap to BGR Mat using the first 3 channels; null when the bitmap is null or not color. 1:1 convert_pil_to_bgr.</summary>
    public static Mat? ConvertBitmapToBgr(Bitmap? image)
    {
        if (image == null) return null;
        var mat = BitmapToMat(image);
        if (mat.Channels() < 3)
        {
            mat.Dispose();
            return null;
        }
        if (mat.Channels() == 3) return mat;
        using (mat) return BgraToBgr(mat);
    }

    /// <summary>BGR (or gray) Mat to Bitmap. 1:1 convert_bgr_to_pil.</summary>
    public static Bitmap ConvertBgrToBitmap(Mat imageBgr) => MatToBitmap(imageBgr);

    /// <summary>Bitmap to Mat keeping channels (BGR for 24bpp, BGRA for 32bpp, gray for 8bpp).</summary>
    public static Mat BitmapToMat(Bitmap image)
    {
        ArgumentNullException.ThrowIfNull(image);
        if (image.PixelFormat is PixelFormat.Format24bppRgb or PixelFormat.Format32bppArgb
            or PixelFormat.Format32bppRgb or PixelFormat.Format32bppPArgb or PixelFormat.Format8bppIndexed)
            return BitmapConverter.ToMat(image);
        using var rgb = EnsureRgb(image);
        return BitmapConverter.ToMat(rgb);
    }

    /// <summary>Mat (gray, BGR or BGRA) to Bitmap.</summary>
    public static Bitmap MatToBitmap(Mat image)
    {
        ArgumentNullException.ThrowIfNull(image);
        return BitmapConverter.ToBitmap(image);
    }

    /// <summary>BGRA to BGR; other channel counts return a BGR copy (gray expanded).</summary>
    public static Mat BgraToBgr(Mat image) => ToBgr(image);

    /// <summary>Any of gray/BGR/BGRA to BGR (new Mat).</summary>
    public static Mat ToBgr(Mat image)
    {
        ArgumentNullException.ThrowIfNull(image);
        var dst = new Mat();
        switch (image.Channels())
        {
            case 1: Cv2.CvtColor(image, dst, ColorConversionCodes.GRAY2BGR); break;
            case 4: Cv2.CvtColor(image, dst, ColorConversionCodes.BGRA2BGR); break;
            default: image.CopyTo(dst); break;
        }
        return dst;
    }

    /// <summary>Any of gray/BGR/BGRA to BGRA (new Mat; opaque alpha when added).</summary>
    public static Mat ToBgra(Mat image)
    {
        ArgumentNullException.ThrowIfNull(image);
        var dst = new Mat();
        switch (image.Channels())
        {
            case 1: Cv2.CvtColor(image, dst, ColorConversionCodes.GRAY2BGRA); break;
            case 3: Cv2.CvtColor(image, dst, ColorConversionCodes.BGR2BGRA); break;
            default: image.CopyTo(dst); break;
        }
        return dst;
    }

    /// <summary>Any of gray/BGR/BGRA to single-channel gray (new Mat).</summary>
    public static Mat ToGray(Mat image)
    {
        ArgumentNullException.ThrowIfNull(image);
        var dst = new Mat();
        switch (image.Channels())
        {
            case 3: Cv2.CvtColor(image, dst, ColorConversionCodes.BGR2GRAY); break;
            case 4: Cv2.CvtColor(image, dst, ColorConversionCodes.BGRA2GRAY); break;
            default: image.CopyTo(dst); break;
        }
        return dst;
    }

    /// <summary>RGB(A) Mat (e.g. from a non-OpenCV source) to BGR(A) (new Mat).</summary>
    public static Mat RgbToBgr(Mat image)
    {
        ArgumentNullException.ThrowIfNull(image);
        var dst = new Mat();
        switch (image.Channels())
        {
            case 3: Cv2.CvtColor(image, dst, ColorConversionCodes.RGB2BGR); break;
            case 4: Cv2.CvtColor(image, dst, ColorConversionCodes.RGBA2BGRA); break;
            default: image.CopyTo(dst); break;
        }
        return dst;
    }
}
