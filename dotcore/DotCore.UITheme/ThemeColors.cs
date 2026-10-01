namespace DotCore.UITheme;

/// <summary>
/// Default (dark) Fluent 2 theme color values (hex), mirroring Themes/Colors.Dark.xaml. Framework-agnostic; apps map these to WPF/WinForms resources.
/// </summary>
public static class ThemeColors
{
    private static readonly Dictionary<string, string> Colors = new(StringComparer.Ordinal)
    {
        { ThemeColorKeys.BgPrimary, "#282828" },
        { ThemeColorKeys.BgSecondary, "#2F2F2F" },
        { ThemeColorKeys.BgTertiary, "#353535" },
        { ThemeColorKeys.BgDark, "#1F1F1F" },
        { ThemeColorKeys.BgLight, "#F3F3F3" },
        { ThemeColorKeys.BgHover, "#383838" },
        { ThemeColorKeys.TextPrimary, "#FFFFFF" },
        { ThemeColorKeys.TextSecondary, "#99EBFF" },
        { ThemeColorKeys.TextTertiary, "#9A9A9A" },
        { ThemeColorKeys.TextDark, "#1B1B1B" },
        { ThemeColorKeys.TextAccent, "#99EBFF" },
        { ThemeColorKeys.TextSuccess, "#6CCB5F" },
        { ThemeColorKeys.TextWarning, "#FCE100" },
        { ThemeColorKeys.TextError, "#FF99A4" },
        { ThemeColorKeys.StateNormal, "#3A3A3A" },
        { ThemeColorKeys.StateHover, "#404040" },
        { ThemeColorKeys.StateActive, "#60CDFF" },
        { ThemeColorKeys.StateFocus, "#60CDFF" },
        { ThemeColorKeys.StateDisabled, "#333333" },
        { ThemeColorKeys.BtnPrimary, "#60CDFF" },
        { ThemeColorKeys.BtnPrimaryHover, "#5BBDEA" },
        { ThemeColorKeys.BtnSecondary, "#C42B1C" },
        { ThemeColorKeys.BtnSecondaryHover, "#D13A2B" },
        { ThemeColorKeys.BtnSuccess, "#107C10" },
        { ThemeColorKeys.BtnDanger, "#C42B1C" },
        { ThemeColorKeys.BtnAccent, "#9D5D00" },
        { ThemeColorKeys.BtnAccentHover, "#AD6800" },
        { ThemeColorKeys.BtnInfo, "#0063B1" },
        { ThemeColorKeys.BtnInfoHover, "#0A6FC2" },
        { ThemeColorKeys.InputBg, "#353535" },
        { ThemeColorKeys.InputText, "#FFFFFF" },
        { ThemeColorKeys.InputBorder, "#474747" },
        { ThemeColorKeys.InputFocus, "#60CDFF" },
        { ThemeColorKeys.BorderPrimary, "#60CDFF" },
        { ThemeColorKeys.BorderSecondary, "#FF99A4" },
        { ThemeColorKeys.BorderSubtle, "#454545" },
        { ThemeColorKeys.Separator, "#3A3A3A" },
        { ThemeColorKeys.PanelBorder, "#3D3D3D" },
        { ThemeColorKeys.TabUnselectedBg, "#000000" },
        { ThemeColorKeys.TabUnselectedFg, "#C5C5C5" },
        { ThemeColorKeys.TabSelectedBg, "#FFFFFF" },
        { ThemeColorKeys.TabSelectedFg, "#FFFFFF" },
        { ThemeColorKeys.Accent, "#60CDFF" },
        { ThemeColorKeys.AccentBlue, "#4CC2FF" },
        { ThemeColorKeys.AccentCyan, "#5DD9E8" },
        { ThemeColorKeys.AccentRed, "#FF99A4" },
        { ThemeColorKeys.AccentOrange, "#FFB066" },
        { ThemeColorKeys.AccentGreen, "#6CCB5F" },
    };

    private const string DefaultColor = "#FFFFFF";

    /// <summary>
    /// Gets the hex color string for the given key, or default if not found.
    /// </summary>
    public static string Get(string colorKey)
    {
        return Colors.TryGetValue(colorKey, out var value) ? value : DefaultColor;
    }

    /// <summary>
    /// Gets all color keys and values. For apps that need to build resource dictionaries.
    /// </summary>
    public static IReadOnlyDictionary<string, string> GetAll() => Colors;
}
