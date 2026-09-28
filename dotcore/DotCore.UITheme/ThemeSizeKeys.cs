namespace DotCore.UITheme;

/// <summary>
/// Semantic size key constants (padding, border, etc.). Aligned with Python theme SIZES.
/// </summary>
public static class ThemeSizeKeys
{
    public const string PaddingSmall = "padding_small";
    public const string PaddingMedium = "padding_medium";
    public const string PaddingLarge = "padding_large";
    public const string BorderWidth = "border_width";
    public const string ButtonWidth = "button_width";
    public const string InputWidth = "input_width";
    /// <summary>Minimum window width (e.g. main app window). UI cannot be resized smaller than this.</summary>
    public const string WindowMinWidth = "window_min_width";
    /// <summary>Minimum window height (e.g. main app window). UI cannot be resized smaller than this.</summary>
    public const string WindowMinHeight = "window_min_height";
}
