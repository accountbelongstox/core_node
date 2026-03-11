namespace DotCore.UITheme;

/// <summary>
/// Default theme color values (hex). Framework-agnostic; apps map these to WPF/WinForms resources.
/// </summary>
public static class ThemeColors
{
    private static readonly Dictionary<string, string> Colors = new(StringComparer.Ordinal)
    {
        { ThemeColorKeys.BgPrimary, "#1a1a2e" },
        { ThemeColorKeys.BgSecondary, "#16213e" },
        { ThemeColorKeys.BgTertiary, "#0f3460" },
        { ThemeColorKeys.BgDark, "#0a0a0a" },
        { ThemeColorKeys.BgLight, "#f0f0f0" },
        { ThemeColorKeys.BgHover, "#2a2a3e" },
        { ThemeColorKeys.TextPrimary, "#e0e0e0" },
        { ThemeColorKeys.TextSecondary, "#00d4ff" },
        { ThemeColorKeys.TextTertiary, "#a0a0a0" },
        { ThemeColorKeys.TextDark, "#1a1a1a" },
        { ThemeColorKeys.TextAccent, "#ff6b6b" },
        { ThemeColorKeys.TextSuccess, "#00ff88" },
        { ThemeColorKeys.TextWarning, "#ff9800" },
        { ThemeColorKeys.TextError, "#ff4444" },
        { ThemeColorKeys.StateNormal, "#16213e" },
        { ThemeColorKeys.StateHover, "#0f3460" },
        { ThemeColorKeys.StateActive, "#2196F3" },
        { ThemeColorKeys.StateFocus, "#00d4ff" },
        { ThemeColorKeys.StateDisabled, "#2a2a3e" },
        { ThemeColorKeys.BtnPrimary, "#4CAF50" },
        { ThemeColorKeys.BtnPrimaryHover, "#45a049" },
        { ThemeColorKeys.BtnSecondary, "#f44336" },
        { ThemeColorKeys.BtnSecondaryHover, "#da190b" },
        { ThemeColorKeys.BtnSuccess, "#00ff88" },
        { ThemeColorKeys.BtnDanger, "#ff4444" },
        { ThemeColorKeys.BtnAccent, "#ff9800" },
        { ThemeColorKeys.BtnAccentHover, "#f57c00" },
        { ThemeColorKeys.BtnInfo, "#2196F3" },
        { ThemeColorKeys.BtnInfoHover, "#1976D2" },
        { ThemeColorKeys.InputBg, "#2a2a3e" },
        { ThemeColorKeys.InputText, "#e0e0e0" },
        { ThemeColorKeys.InputBorder, "#00d4ff" },
        { ThemeColorKeys.InputFocus, "#2196F3" },
        { ThemeColorKeys.BorderPrimary, "#00d4ff" },
        { ThemeColorKeys.BorderSecondary, "#ff6b6b" },
        { ThemeColorKeys.BorderSubtle, "#2a2a3e" },
        { ThemeColorKeys.Separator, "#2a2a3e" },
        { ThemeColorKeys.PanelBorder, "#4C566A" },
        { ThemeColorKeys.TabUnselectedBg, "#4C566A" },
        { ThemeColorKeys.TabUnselectedFg, "#ECEFF4" },
        { ThemeColorKeys.TabSelectedBg, "#16213e" },
        { ThemeColorKeys.TabSelectedFg, "#e0e0e0" },
        { ThemeColorKeys.Accent, "#00d4ff" },
        { ThemeColorKeys.AccentBlue, "#2196F3" },
        { ThemeColorKeys.AccentCyan, "#00d4ff" },
        { ThemeColorKeys.AccentRed, "#ff6b6b" },
        { ThemeColorKeys.AccentOrange, "#ff9800" },
        { ThemeColorKeys.AccentGreen, "#00ff88" },
    };

    private const string DefaultColor = "#e0e0e0";

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
