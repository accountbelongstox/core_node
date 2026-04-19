namespace GifTextOverlay;

/// <summary>Text position margins as percentages (0-100) of image dimensions. HAlign/VAlign: 0=Start, 1=Center, 2=End.</summary>
public record TextPositionOptions(float LeftPct, float TopPct, float RightPct, float BottomPct, int HAlign, int VAlign);

public record TextPreset(
    string Name,
    string Fill,
    string? Outline,
    int OutlineWidth,
    ShadowDef? Shadow
);

public record ShadowDef(int Dx, int Dy, string Color, int Radius);

/// <summary>Custom effect: fill colors, shadow, outline. Used when preset index is -1.</summary>
public record CustomEffectOptions(
    IReadOnlyList<string> FillColors,
    string? ShadowColor,
    int ShadowDx, int ShadowDy, int ShadowRadius,
    string? OutlineColor,
    int OutlineWidth
);

/// <summary>Single text area: text, effect (preset or custom), position, font, typography.</summary>
public record TextAreaItem(
    string Text,
    int PresetIndex,
    CustomEffectOptions? CustomEffect,
    TextPositionOptions Position,
    string? FontPath,
    bool AutoFontSize,
    int? ManualFontSize,
    float LetterSpacing,
    float FontStretch
);

public static class Presets
{
    public static readonly TextPreset[] All =
    [
        new("classic", "white", "black", 3, null),
        new("drop_shadow", "white", null, 0, new(6, 6, "black", 2)),
        new("neon_glow", "#00FFAA", null, 0, null), // handled specially
        new("comic", "yellow", "black", 5, null),
        new("gold", "#FFD700", "#8B4513", 4, new(3, 3, "black", 1)),
        new("fire", "#FF6B35", "#CC0000", 3, new(5, 5, "#8B0000", 2)),
        new("ice", "#B0E0E6", "#1E90FF", 2, null), // multi-shadow
        new("sticker", "#32CD32", "black", 6, null),
        new("emboss", "#888888", null, 0, null),   // multi-shadow
        new("cyberpunk", "#FF00FF", "#00BFFF", 2, new(4, 4, "#0000FF", 2)),
    ];

    public const int CustomPresetIndex = -1;
}
