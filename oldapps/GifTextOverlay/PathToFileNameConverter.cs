using System.Globalization;
using System.IO;
using System.Windows.Data;

namespace GifTextOverlay;

public sealed class PathToFileNameConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        var path = value as string;
        return string.IsNullOrEmpty(path) ? "" : Path.GetFileName(path);
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        => throw new NotImplementedException();
}
