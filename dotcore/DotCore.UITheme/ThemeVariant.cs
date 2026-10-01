namespace DotCore.UITheme;

/// <summary>Application color theme variant.</summary>
public enum ThemeVariant
{
    Dark,
    Light,
}

/// <summary>Config string values for <see cref="ThemeVariant"/> ("dark" / "light").</summary>
public static class ThemeVariantNames
{
    public const string Dark = "dark";
    public const string Light = "light";

    /// <summary>Parses a config value; unknown or empty values return <paramref name="fallback"/>.</summary>
    public static ThemeVariant Parse(string? value, ThemeVariant fallback = ThemeVariant.Dark)
    {
        if (string.Equals(value, Dark, StringComparison.OrdinalIgnoreCase)) return ThemeVariant.Dark;
        if (string.Equals(value, Light, StringComparison.OrdinalIgnoreCase)) return ThemeVariant.Light;
        return fallback;
    }

    public static string ToName(ThemeVariant mode) => mode == ThemeVariant.Light ? Light : Dark;
}
