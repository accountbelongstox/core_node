// PY-REF: none (DOT-only)
using System.IO;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using OpenCvSharp;

namespace DotCore.VocAnnotatorUI;

/// <summary>
/// Frozen WPF images from encoded bytes, files or OpenCV Mats; safe off the UI thread.
/// Files are read into memory first (OnLoad), so the source file is never locked.
/// </summary>
public static class BitmapDecode
{
    private const double Dpi = 96;

    /// <summary>Decode encoded image bytes; decodeWidth > 0 decodes downscaled to that pixel width (aspect kept).</summary>
    public static BitmapSource FromBytes(byte[] bytes, int decodeWidth = 0)
    {
        using var stream = new MemoryStream(bytes);
        var bitmap = new BitmapImage();
        bitmap.BeginInit();
        bitmap.CacheOption = BitmapCacheOption.OnLoad;
        bitmap.CreateOptions = BitmapCreateOptions.IgnoreColorProfile;
        if (decodeWidth > 0) bitmap.DecodePixelWidth = decodeWidth;
        bitmap.StreamSource = stream;
        bitmap.EndInit();
        bitmap.Freeze();
        return bitmap;
    }

    /// <summary>Decode an image file, or null when it cannot be read or decoded.</summary>
    public static BitmapSource? TryFromFile(string path, int decodeWidth = 0)
    {
        try
        {
            return FromBytes(File.ReadAllBytes(path), decodeWidth);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or NotSupportedException or ArgumentException
                                       or InvalidOperationException or FormatException)
        {
            return null;
        }
    }

    /// <summary>Copy an 8-bit gray, BGR or BGRA Mat into a frozen bitmap (no encode round trip).</summary>
    public static BitmapSource FromMat(Mat image)
    {
        var format = image.Channels() switch
        {
            1 => PixelFormats.Gray8,
            3 => PixelFormats.Bgr24,
            4 => PixelFormats.Bgra32,
            _ => throw new ArgumentException("Unsupported channel count: " + image.Channels(), nameof(image)),
        };
        if (image.Depth() != MatType.CV_8U) throw new ArgumentException("Only 8-bit images are supported.", nameof(image));
        using var continuous = image.IsContinuous() ? null : image.Clone();
        var source = continuous ?? image;
        int stride = (int)source.Step();
        var bitmap = BitmapSource.Create(source.Width, source.Height, Dpi, Dpi, format, null, source.Data, stride * source.Height, stride);
        bitmap.Freeze();
        return bitmap;
    }
}
