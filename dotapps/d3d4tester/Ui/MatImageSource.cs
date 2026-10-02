using System.IO;
using System.Windows.Media.Imaging;
using OpenCvSharp;

namespace DotApps.d3d4tester.Ui;

/// <summary>OpenCV Mat (BGR/BGRA/gray) to a frozen WPF image source; safe to build off the UI thread.</summary>
public static class MatImageSource
{
    private const string EncodeExtension = ".bmp";

    public static BitmapSource ToBitmapSource(Mat image)
    {
        Cv2.ImEncode(EncodeExtension, image, out var bytes);
        using var stream = new MemoryStream(bytes);
        var bitmap = new BitmapImage();
        bitmap.BeginInit();
        bitmap.CacheOption = BitmapCacheOption.OnLoad;
        bitmap.StreamSource = stream;
        bitmap.EndInit();
        bitmap.Freeze();
        return bitmap;
    }
}
