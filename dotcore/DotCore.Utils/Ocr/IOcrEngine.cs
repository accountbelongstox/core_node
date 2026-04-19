namespace DotCore.Utils.Ocr;

/// <summary>
/// OCR engine contract. Same capability as Python CnOCREngine / WindowsOCREngine:
/// init, then ocr from image path (and optionally grid region). Returns text and raw word boxes.
/// </summary>
public interface IOcrEngine
{
    /// <summary>Initialize the engine. Returns true if ready.</summary>
    bool Init();

    /// <summary>Whether the engine has been successfully initialized.</summary>
    bool IsInitialized { get; }

    /// <summary>
    /// Run OCR on image. Same contract as Python: text, raw_result (list of {text, position}), offset, region, grid_position.
    /// </summary>
    /// <param name="imagePath">Path to image file.</param>
    /// <param name="gridPosition">Optional 1-9 grid (same as CnOCR). Null = full image.</param>
    OcrResult? Ocr(string imagePath, int? gridPosition = null);
}
