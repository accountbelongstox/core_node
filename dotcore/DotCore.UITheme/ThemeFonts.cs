namespace DotCore.UITheme;

/// <summary>
/// Default theme font definitions. Minimum 9px; apps map to WPF/WinForms font types.
/// </summary>
public static class ThemeFonts
{
    private static readonly Dictionary<string, ThemeFontInfo> Fonts = new(StringComparer.Ordinal)
    {
        { ThemeFontKeys.Title, new ThemeFontInfo("Arial", 9, true) },
        { ThemeFontKeys.Subtitle, new ThemeFontInfo("Arial", 9, true) },
        { ThemeFontKeys.Heading, new ThemeFontInfo("Arial", 9, true) },
        { ThemeFontKeys.Subheading, new ThemeFontInfo("Arial", 9, true) },
        { ThemeFontKeys.Body, new ThemeFontInfo("Arial", 9, false) },
        { ThemeFontKeys.Button, new ThemeFontInfo("Arial", 9, true) },
        { ThemeFontKeys.Code, new ThemeFontInfo("Consolas", 9, false) },
    };

    private static readonly ThemeFontInfo DefaultFont = new("Arial", 9, false);

    /// <summary>
    /// Gets font info for the given key, or default (Arial 9) if not found.
    /// </summary>
    public static ThemeFontInfo Get(string fontKey)
    {
        return Fonts.TryGetValue(fontKey, out var value) ? value : DefaultFont;
    }

    /// <summary>
    /// Gets all font keys and values.
    /// </summary>
    public static IReadOnlyDictionary<string, ThemeFontInfo> GetAll() => Fonts;
}
