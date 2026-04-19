namespace DotCore.UITheme;

/// <summary>
/// Default theme size values (pixels). Scaled to 60% of original design; apps use for layout/spacing.
/// </summary>
public static class ThemeSizes
{
    private static readonly Dictionary<string, int> Sizes = new(StringComparer.Ordinal)
    {
        { ThemeSizeKeys.PaddingSmall, 3 },
        { ThemeSizeKeys.PaddingMedium, 6 },
        { ThemeSizeKeys.PaddingLarge, 9 },
        { ThemeSizeKeys.BorderWidth, 1 },
        { ThemeSizeKeys.ButtonWidth, 5 },
        { ThemeSizeKeys.InputWidth, 6 },
        { ThemeSizeKeys.WindowMinWidth, 670 },
        { ThemeSizeKeys.WindowMinHeight, 400 },
    };

    private const int DefaultSize = 10;

    /// <summary>
    /// Gets the size value (pixels) for the given key, or default if not found.
    /// </summary>
    public static int Get(string sizeKey)
    {
        return Sizes.TryGetValue(sizeKey, out var value) ? value : DefaultSize;
    }

    /// <summary>
    /// Gets all size keys and values.
    /// </summary>
    public static IReadOnlyDictionary<string, int> GetAll() => Sizes;
}
