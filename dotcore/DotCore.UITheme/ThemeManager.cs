using System.Windows;

namespace DotCore.UITheme;

/// <summary>
/// Runtime theme switching: replaces the palette dictionary in Application.Resources (brushes referenced with
/// DynamicResource update live) and refreshes the DWM frame of every open window.
/// Apps may register their own palette dictionaries (which merge Colors.Dark/Light.xaml plus app overrides).
/// </summary>
public static class ThemeManager
{
    private const string DarkPaletteUri = "pack://application:,,,/DotCore.UITheme;component/Themes/Colors.Dark.xaml";
    private const string LightPaletteUri = "pack://application:,,,/DotCore.UITheme;component/Themes/Colors.Light.xaml";
    private const string AppThemeUriTail = "Themes/AppTheme.xaml";

    private static Uri _darkUri = new(DarkPaletteUri, UriKind.Absolute);
    private static Uri _lightUri = new(LightPaletteUri, UriKind.Absolute);
    private static ResourceDictionary? _activePalette;

    /// <summary>Currently applied theme (Dark until <see cref="Apply"/> is called).</summary>
    public static ThemeVariant CurrentVariant { get; private set; } = ThemeVariant.Dark;

    /// <summary>Raised on the UI thread after a theme was applied.</summary>
    public static event EventHandler<ThemeVariant>? ThemeChanged;

    /// <summary>Registers the palette dictionaries to swap. Call before the first <see cref="Apply"/>.</summary>
    public static void Configure(Uri darkPalette, Uri lightPalette)
    {
        _darkUri = darkPalette;
        _lightUri = lightPalette;
    }

    /// <summary>Applies the theme to Application.Current resources and all open windows.</summary>
    public static void Apply(ThemeVariant mode)
    {
        var app = Application.Current;
        if (app == null) return;
        var merged = app.Resources.MergedDictionaries;
        var palette = new ResourceDictionary { Source = mode == ThemeVariant.Light ? _lightUri : _darkUri };
        var index = FindPaletteIndex(merged);
        if (index >= 0)
            merged[index] = palette;
        else
            merged.Insert(FindInsertIndex(merged), palette);
        _activePalette = palette;
        CurrentVariant = mode;

        foreach (Window window in app.Windows)
            WindowBackdrop.SetDarkMode(window, mode == ThemeVariant.Dark);
        ThemeChanged?.Invoke(null, mode);
    }

    /// <summary>Switches between Dark and Light and returns the new mode.</summary>
    public static ThemeVariant Toggle()
    {
        var next = CurrentVariant == ThemeVariant.Dark ? ThemeVariant.Light : ThemeVariant.Dark;
        Apply(next);
        return next;
    }

    private static int FindPaletteIndex(IList<ResourceDictionary> merged)
    {
        if (_activePalette != null)
        {
            var current = merged.IndexOf(_activePalette);
            if (current >= 0) return current;
        }
        for (var i = merged.Count - 1; i >= 0; i--)
        {
            var source = merged[i].Source;
            if (source != null && (IsSameResource(source, _darkUri) || IsSameResource(source, _lightUri)))
                return i;
        }
        return -1;
    }

    private static int FindInsertIndex(IList<ResourceDictionary> merged)
    {
        for (var i = 0; i < merged.Count; i++)
        {
            var source = merged[i].Source;
            if (source != null && source.OriginalString.EndsWith(AppThemeUriTail, StringComparison.OrdinalIgnoreCase))
                return i + 1;
        }
        return merged.Count;
    }

    private static bool IsSameResource(Uri a, Uri b) =>
        string.Equals(ComponentPath(a), ComponentPath(b), StringComparison.OrdinalIgnoreCase);

    private static string ComponentPath(Uri uri)
    {
        var text = uri.OriginalString;
        var marker = text.IndexOf(";component/", StringComparison.OrdinalIgnoreCase);
        if (marker < 0) return text.TrimStart('/');
        var start = text.LastIndexOf('/', marker) + 1;
        return text[start..];
    }
}
