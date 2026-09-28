using OpenCvSharp;

namespace DotCore.ButtonRecognizer;

/// <summary>Single button-like candidate: rect plus optional color label and OCR text. Ref: BUTTON_RECOGNITION_DESIGN.md §7.</summary>
public sealed class ButtonCandidate
{
    /// <summary>Bounding rectangle (in source image coordinates).</summary>
    public Rect Rect { get; init; }

    /// <summary>Optional color label (e.g. from pipeline 1).</summary>
    public string? ColorLabel { get; set; }

    /// <summary>Optional OCR text (e.g. from pipeline 3).</summary>
    public string? OcrText { get; set; }
}
