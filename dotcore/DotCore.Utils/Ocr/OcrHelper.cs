using System.Collections.Generic;
using System.Linq;
using DotCore.Foundations;

namespace DotCore.Utils.Ocr;

/// <summary>
/// OCR helper: keyword-in-image check, get result, find keyword boxes. Same contract as Python ocr_helper.
/// </summary>
public static class OcrHelper
{
    /// <summary>Run OCR once; return result or null. Uses given engine or default.</summary>
    public static OcrResult? GetResult(string imagePath, IOcrEngine? engine = null)
    {
        var eng = engine;
        if (eng == null || !eng.IsInitialized)
            return null;
        return eng.Ocr(imagePath, null);
    }

    /// <summary>Return true if any keyword appears in OCR text. Same as Python ocr_has_any_keywords.</summary>
    public static bool HasAnyKeyword(string imagePath, IEnumerable<string> keywords, IOcrEngine? engine = null, string logPrefix = "[OCR]")
    {
        var kwList = keywords?.ToList() ?? new List<string>();
        if (kwList.Count == 0) return false;
        var eng = engine;
        if (eng == null || !eng.IsInitialized)
        {
            ColorPrinter.Yellow($"{logPrefix} OCR not available, skip keyword check");
            return false;
        }
        var result = eng.Ocr(imagePath, null);
        var text = result?.Text ?? "";
        foreach (var kw in kwList)
        {
            if (text.Contains(kw, System.StringComparison.Ordinal))
            {
                ColorPrinter.Blue($"{logPrefix} Keyword in UI: '{kw}'");
                return true;
            }
        }
        return false;
    }

    /// <summary>From raw result, return boxes (keyword, text, bbox) for items matching any keyword. Bbox = (minX, minY, maxX, maxY).</summary>
    public static IReadOnlyList<KeywordBox> FindKeywordBoxes(OcrResult? result, IEnumerable<string> keywords)
    {
        var outList = new List<KeywordBox>();
        if (result?.RawResult == null) return outList;
        var kwList = keywords?.ToList() ?? new List<string>();
        if (kwList.Count == 0) return outList;
        foreach (var item in result.RawResult)
        {
            var text = (item.Text ?? "").Trim();
            if (string.IsNullOrEmpty(text)) continue;
            var bbox = PositionToBbox(item.Position);
            if (bbox == null) continue;
            foreach (var kw in kwList)
            {
                if (text.Contains(kw, System.StringComparison.Ordinal))
                {
                    outList.Add(new KeywordBox { Keyword = kw, Text = text, Bbox = bbox.Value });
                    break;
                }
            }
        }
        return outList;
    }

    private static (double MinX, double MinY, double MaxX, double MaxY)? PositionToBbox(IReadOnlyList<(double X, double Y)>? position)
    {
        if (position == null || position.Count == 0) return null;
        double minX = double.MaxValue, minY = double.MaxValue, maxX = double.MinValue, maxY = double.MinValue;
        foreach (var p in position)
        {
            if (p.X < minX) minX = p.X;
            if (p.Y < minY) minY = p.Y;
            if (p.X > maxX) maxX = p.X;
            if (p.Y > maxY) maxY = p.Y;
        }
        return (minX, minY, maxX, maxY);
    }
}

/// <summary>Keyword match with text and bounding box (minX, minY, maxX, maxY).</summary>
public sealed class KeywordBox
{
    public string Keyword { get; set; } = "";
    public string Text { get; set; } = "";
    public (double MinX, double MinY, double MaxX, double MaxY) Bbox { get; set; }
}
