using DotCore.Common;

namespace DotApps.d3check.I18n;

/// <summary>
/// Extension methods for II18nProvider. GetUiText(key, fallback) returns localized text or fallback when key is missing.
/// </summary>
public static class I18nExtensions
{
    /// <summary>Gets UI text by key; if the key is not found (provider returns the key itself), returns fallback.</summary>
    public static string GetUiText(this II18nProvider provider, string key, string fallback)
    {
        if (provider == null) return fallback;
        var value = provider.GetUiText(key);
        return (value != null && value != key) ? value : fallback;
    }
}
