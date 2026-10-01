namespace DotCore.UITheme;

/// <summary>
/// Default theme font definitions (Fluent 2 type ramp, compact density), mirroring Themes/Tokens.xaml.
/// </summary>
public static class ThemeFonts
{
    private static readonly Dictionary<string, ThemeFontInfo> Fonts = new(StringComparer.Ordinal)
    {
        { ThemeFontKeys.Title, new ThemeFontInfo("Segoe UI Variable Display", 20, true) },
        { ThemeFontKeys.Subtitle, new ThemeFontInfo("Segoe UI Variable Display", 16, true) },
        { ThemeFontKeys.Heading, new ThemeFontInfo("Segoe UI Variable Text", 14, true) },
        { ThemeFontKeys.Subheading, new ThemeFontInfo("Segoe UI Variable Text", 12, true) },
        { ThemeFontKeys.Body, new ThemeFontInfo("Segoe UI Variable Text", 12, false) },
        { ThemeFontKeys.Button, new ThemeFontInfo("Segoe UI Variable Text", 12, false) },
        { ThemeFontKeys.Code, new ThemeFontInfo("Cascadia Mono", 11, false) },
    };

    private static readonly ThemeFontInfo DefaultFont = new("Segoe UI", 12, false);

    /// <summary>
    /// Gets font info for the given key, or default (Segoe UI 12) if not found.
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
