using System.Globalization;
using System.Windows;
using System.Windows.Data;

namespace DotApps.d3check.Converters;

/// <summary>
/// Converts bool to Visibility inverted: true -> Collapsed, false -> Visible.
/// </summary>
public sealed class InverseBoolToVisibilityConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        if (value is bool b)
            return b ? Visibility.Collapsed : Visibility.Visible;
        return Visibility.Visible;
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
    {
        if (value is Visibility v)
            return v != Visibility.Visible;
        return true;
    }
}
