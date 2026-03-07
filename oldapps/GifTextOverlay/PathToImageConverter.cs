using System.Globalization;
using System.IO;
using System.Windows.Data;
using System.Windows.Media.Imaging;

namespace GifTextOverlay;

public sealed class PathToImageConverter : IValueConverter
{
    public object? Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        var path = value as string;
        if (string.IsNullOrEmpty(path) || !File.Exists(path)) return null;
        try
        {
            var fullPath = Path.GetFullPath(path!);
            var uriStr = fullPath.StartsWith("file:", StringComparison.OrdinalIgnoreCase)
                ? fullPath
                : "file:///" + fullPath.Replace("\\", "/");
            var bi = new BitmapImage();
            bi.BeginInit();
            bi.UriSource = new Uri(uriStr);
            bi.CacheOption = BitmapCacheOption.OnLoad;
            bi.DecodePixelWidth = 80;
            bi.EndInit();
            bi.Freeze();
            return bi;
        }
        catch
        {
            return null;
        }
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        => throw new NotImplementedException();
}
