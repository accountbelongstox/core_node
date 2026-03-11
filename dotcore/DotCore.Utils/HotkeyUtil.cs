namespace DotCore.Utils;

/// <summary>
/// Hotkey string normalization. Logic 1:1 with Python hotkey_registry.normalize_hotkey_canonical.
/// Canonical form: lowercase, no spaces, '+' between modifier and key for config and comparison.
/// </summary>
public static class HotkeyUtil
{
    /// <summary>
    /// Normalizes hotkey string to canonical form (lowercase, no spaces; empty returns "").
    /// Used for config storage and comparison. Logic 1:1 with Python normalize_hotkey_canonical.
    /// </summary>
    public static string NormalizeCanonical(string? hotkey)
    {
        if (string.IsNullOrWhiteSpace(hotkey)) return "";
        return hotkey.Trim().ToLowerInvariant().Replace(" ", "", StringComparison.Ordinal);
    }
}
