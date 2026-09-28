namespace DotCore.UITheme;

/// <summary>
/// Central theme facade. Provides semantic color, font, and size lookup by key.
/// No WPF or WinForms types; apps apply these values to their UI framework (e.g. WPF resources).
/// See pyapps/d3-check/docs/DOT_D3CHECK_UI_LIBRARY.md and ui/theme/theme.py.
/// </summary>
public static class UITheme
{
    /// <summary>
    /// Gets the hex color string for the given key.
    /// </summary>
    public static string GetColor(string colorKey) => ThemeColors.Get(colorKey);

    /// <summary>
    /// Gets font info for the given key.
    /// </summary>
    public static ThemeFontInfo GetFont(string fontKey) => ThemeFonts.Get(fontKey);

    /// <summary>
    /// Gets the size value (pixels) for the given key.
    /// </summary>
    public static int GetSize(string sizeKey) => ThemeSizes.Get(sizeKey);
}
