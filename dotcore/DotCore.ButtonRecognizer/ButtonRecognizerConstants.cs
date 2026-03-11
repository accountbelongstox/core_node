namespace DotCore.ButtonRecognizer;

/// <summary>
/// Constants for button/text-region recognition. No magic literals in public API defaults; use these names.
/// Aligns with DOT_PROJECT_STANDARDS §3.
/// </summary>
public static class ButtonRecognizerConstants
{
    /// <summary>Placeholder text set in <see cref="ButtonCandidate.OcrText"/> when OCR verification matched. Used by <see cref="ButtonRecognizerService.DetectButtons"/>.</summary>
    public const string OcrMatchedPlaceholder = "(matched)";

    /// <summary>Filename prefix for temporary crop images used during OCR verification. Suffix is a GUID.</summary>
    public const string OcrTempFilePrefix = "btn_ocr_";

    /// <summary>File extension for temporary OCR crop images.</summary>
    public const string OcrTempFileExtension = "png";
}
