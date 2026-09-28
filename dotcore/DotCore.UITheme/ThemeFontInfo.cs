namespace DotCore.UITheme;

/// <summary>
/// Font definition: family, size, bold. No UI framework types.
/// </summary>
public readonly struct ThemeFontInfo
{
    public string Family { get; }
    public int Size { get; }
    public bool Bold { get; }

    public ThemeFontInfo(string family, int size, bool bold = false)
    {
        Family = family;
        Size = size;
        Bold = bold;
    }
}
