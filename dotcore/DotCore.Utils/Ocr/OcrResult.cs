namespace DotCore.Utils.Ocr;

/// <summary>
/// OCR result. Same shape as Python engine.ocr(): text, raw_result, offset, region, grid_position.
/// </summary>
public sealed class OcrResult
{
    public string Text { get; set; } = string.Empty;
    /// <summary>List of { text, position } where position is 4 points [top-left, top-right, bottom-right, bottom-left].</summary>
    public IReadOnlyList<OcrWordBox> RawResult { get; set; } = Array.Empty<OcrWordBox>();
    public (int X, int Y) Offset { get; set; }
    public (int Left, int Top, int Right, int Bottom) Region { get; set; }
    public int? GridPosition { get; set; }
}

/// <summary>Single word box: text and quadrilateral position (4 points, same as CnOCR).</summary>
public sealed class OcrWordBox
{
    public string Text { get; set; } = string.Empty;
    /// <summary>Four [x,y] points: top-left, top-right, bottom-right, bottom-left.</summary>
    public IReadOnlyList<(double X, double Y)> Position { get; set; } = Array.Empty<(double, double)>();
}
