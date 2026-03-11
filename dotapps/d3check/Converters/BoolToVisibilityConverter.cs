using System.Globalization;
using System.Windows;
using System.Windows.Data;

namespace DotApps.d3check.Converters;

/// <summary>
/// Converts bool to Visibility: true -> Visible, false -> Collapsed.
/// Per .NET UI spec: Converters/ for data binding (e.g. BoolToVisibility).
/// </summary>
public sealed class BoolToVisibilityConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        if (value is bool b)
            return b ? Visibility.Visible : Visibility.Collapsed;
        return Visibility.Collapsed;
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
    {
        if (value is Visibility v)
            return v == Visibility.Visible;
        return false;
    }
}
