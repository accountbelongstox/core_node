using System.Windows;
using System.Windows.Media;

namespace DotCore.UITheme;

/// <summary>
/// Attached properties consumed by the shared control templates in Themes/AppStyles.xaml
/// (state brushes per style variant, corner radius, icon glyph, placeholder text).
/// </summary>
public static class ControlAssist
{
    public static readonly DependencyProperty HoverBackgroundProperty = DependencyProperty.RegisterAttached(
        "HoverBackground", typeof(Brush), typeof(ControlAssist), new FrameworkPropertyMetadata(null));

    public static readonly DependencyProperty PressedBackgroundProperty = DependencyProperty.RegisterAttached(
        "PressedBackground", typeof(Brush), typeof(ControlAssist), new FrameworkPropertyMetadata(null));

    public static readonly DependencyProperty CornerRadiusProperty = DependencyProperty.RegisterAttached(
        "CornerRadius", typeof(CornerRadius), typeof(ControlAssist), new FrameworkPropertyMetadata(new CornerRadius(4)));

    public static readonly DependencyProperty IconProperty = DependencyProperty.RegisterAttached(
        "Icon", typeof(string), typeof(ControlAssist), new FrameworkPropertyMetadata(null));

    public static readonly DependencyProperty PlaceholderProperty = DependencyProperty.RegisterAttached(
        "Placeholder", typeof(string), typeof(ControlAssist), new FrameworkPropertyMetadata(null));

    public static Brush? GetHoverBackground(DependencyObject d) => (Brush?)d.GetValue(HoverBackgroundProperty);
    public static void SetHoverBackground(DependencyObject d, Brush? value) => d.SetValue(HoverBackgroundProperty, value);

    public static Brush? GetPressedBackground(DependencyObject d) => (Brush?)d.GetValue(PressedBackgroundProperty);
    public static void SetPressedBackground(DependencyObject d, Brush? value) => d.SetValue(PressedBackgroundProperty, value);

    public static CornerRadius GetCornerRadius(DependencyObject d) => (CornerRadius)d.GetValue(CornerRadiusProperty);
    public static void SetCornerRadius(DependencyObject d, CornerRadius value) => d.SetValue(CornerRadiusProperty, value);

    public static string? GetIcon(DependencyObject d) => (string?)d.GetValue(IconProperty);
    public static void SetIcon(DependencyObject d, string? value) => d.SetValue(IconProperty, value);

    public static string? GetPlaceholder(DependencyObject d) => (string?)d.GetValue(PlaceholderProperty);
    public static void SetPlaceholder(DependencyObject d, string? value) => d.SetValue(PlaceholderProperty, value);
}
