namespace DotCore.Common;

/// <summary>
/// Shared status display symbols for UI (e.g. bottom bar found/not-found). Used by DotCore.D3Check and other dotapps.
/// Unicode symbols (BMP) for compatibility with XAML and console; no surrogate-pair emoji.
/// </summary>
public static class StatusDisplaySymbols
{
    /// <summary>Check mark when item found (U+2713).</summary>
    public const string Found = "\u2713";

    /// <summary>Circle when item not found (U+25CB).</summary>
    public const string NotFound = "\u25CB";
}
