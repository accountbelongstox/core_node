// PY-REF: none (DOT-only)
using OpenCvSharp;

namespace DotCore.YoloTaskSet;

public enum VariantStrokeKind
{
    Foreground,
    Background,
}

public readonly record struct VariantPoint(int X, int Y);

/// <summary>Brush stroke in source frame pixels; a single point is a dot of the given thickness.</summary>
public sealed record VariantStroke(VariantStrokeKind Kind, IReadOnlyList<VariantPoint> Points, int Thickness);

/// <summary>
/// User corrections for a cutout, in source frame coordinates. Mask (optional, CV_8UC1, frame size, caller owns):
/// MaskBackground / MaskForeground pixels are forced, anything else is left to the algorithm. Strokes are applied after Mask.
/// </summary>
public sealed record VariantMaskHints(IReadOnlyList<VariantStroke> Strokes, Mat? Mask = null)
{
    public const byte MaskUnknown = 0;
    public const byte MaskBackground = 1;
    public const byte MaskForeground = 2;

    public bool IsEmpty => Strokes.Count == 0 && (Mask == null || Mask.Empty());
}

/// <summary>
/// Cutout parameters. ColorKeyTolerance: max per-channel difference (0..255) to the border colour that counts as background.
/// ColorKeyHoles: regions enclosed by the object (e.g. inside a ring) that match the keyed background colour are keyed too.
/// </summary>
public sealed record VariantCutOptions(int ColorKeyTolerance = VariantCutOptions.DefaultColorKeyTolerance, VariantMaskHints? Hints = null, bool ColorKeyHoles = true)
{
    public const int DefaultColorKeyTolerance = 24;
    public const int MinColorKeyTolerance = 0;
    public const int MaxColorKeyTolerance = 255;
}

/// <summary>Progress of a store / extraction batch; Item is the file or frame being processed.</summary>
public sealed record WorkProgress(int Done, int Total, string? Item = null);
