using System.Diagnostics.CodeAnalysis;

namespace DotCore.Utils;

/// <summary>
/// String utilities. Thin helpers used across dotcore and dotapps.
/// </summary>
public static class StringUtil
{
    /// <summary>
    /// Returns true if the string is null or whitespace.
    /// </summary>
    public static bool IsNullOrWhiteSpace([NotNullWhen(false)] string? value) => string.IsNullOrWhiteSpace(value);

    /// <summary>
    /// Returns the value if not null or whitespace; otherwise returns the default value.
    /// </summary>
    public static string Coalesce(string? value, string defaultValue)
    {
        return string.IsNullOrWhiteSpace(value) ? defaultValue : value;
    }
}
