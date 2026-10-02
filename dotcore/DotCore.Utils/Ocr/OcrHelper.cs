// PY-REF: pyapps/d3-check/d3utils/ocr_helper.py
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using DotCore.Foundations;
using OpenCvSharp;

namespace DotCore.Utils.Ocr;

/// <summary>
/// OCR helper: keyword-in-image check, get result, find keyword boxes. Engine null = OcrEngineRegistry default.
/// 1:1 Python pyapps/d3-check/d3utils/ocr_helper.py.
/// </summary>
public static class OcrHelper
{
    /// <summary>Run OCR once on an image file; return result or null. 1:1 Python ocr_get_result(path).</summary>
    public static OcrResult? GetResult(string imagePath, IOcrEngine? engine = null)
    {
        var eng = ResolveEngine(engine);
        if (eng == null)
            return null;
        try
        {
            return eng.Ocr(imagePath, null);
        }
        catch (Exception ex)
        {
            ColorPrinter.Red($"[OCR] ocr_get_result error: {ex.Message}");
            try
            {
                bool exists = File.Exists(imagePath);
                long? size = exists ? new FileInfo(imagePath).Length : null;
                string ext = string.IsNullOrEmpty(imagePath) ? "" : Path.GetExtension(imagePath).ToLowerInvariant();
                ColorPrinter.Gray($"[OCR] IMG path='{imagePath}' exists={exists} size={size} ext='{ext}'");
            }
            catch (Exception infoErr)
            {
                ColorPrinter.Gray($"[OCR] IMG input (info failed: {infoErr.Message})");
            }
            return null;
        }
    }

    /// <summary>Run OCR once on an in-memory bitmap (avoids disk I/O). 1:1 Python ocr_get_result(PIL image).</summary>
    public static OcrResult? GetResult(Bitmap image, IOcrEngine? engine = null)
    {
        var eng = ResolveEngine(engine);
        if (eng == null || image == null)
            return null;
        try
        {
            return eng.Ocr(image, null);
        }
        catch (Exception ex)
        {
            ColorPrinter.Red($"[OCR] ocr_get_result error: {ex.Message}");
            return null;
        }
    }

    /// <summary>Run OCR once on an in-memory Mat.</summary>
    public static OcrResult? GetResult(Mat image, IOcrEngine? engine = null)
    {
        var eng = ResolveEngine(engine);
        if (eng == null || image == null || image.Empty())
            return null;
        try
        {
            return eng.Ocr(image, null);
        }
        catch (Exception ex)
        {
            ColorPrinter.Red($"[OCR] ocr_get_result error: {ex.Message}");
            return null;
        }
    }

    /// <summary>Return true if any keyword appears in OCR text. Same as Python ocr_has_any_keywords.</summary>
    public static bool HasAnyKeyword(string imagePath, IEnumerable<string> keywords, IOcrEngine? engine = null, string logPrefix = "[OCR]")
    {
        return HasAnyKeywordCore(keywords, engine, logPrefix, eng => eng.Ocr(imagePath, null));
    }

    /// <summary>In-memory variant of <see cref="HasAnyKeyword(string, IEnumerable{string}, IOcrEngine?, string)"/>.</summary>
    public static bool HasAnyKeyword(Bitmap image, IEnumerable<string> keywords, IOcrEngine? engine = null, string logPrefix = "[OCR]")
    {
        return HasAnyKeywordCore(keywords, engine, logPrefix, eng => eng.Ocr(image, null));
    }

    /// <summary>Run OCR on an image file and return keyword boxes, logging each match. 1:1 Python ocr_find_keyword_boxes.</summary>
    public static IReadOnlyList<KeywordBox> FindKeywordBoxes(string imagePath, IEnumerable<string> keywords, IOcrEngine? engine = null, string logPrefix = "[OCR]")
    {
        return LogBoxes(FindKeywordBoxes(GetResult(imagePath, engine), keywords), logPrefix);
    }

    /// <summary>In-memory variant of <see cref="FindKeywordBoxes(string, IEnumerable{string}, IOcrEngine?, string)"/>.</summary>
    public static IReadOnlyList<KeywordBox> FindKeywordBoxes(Bitmap image, IEnumerable<string> keywords, IOcrEngine? engine = null, string logPrefix = "[OCR]")
    {
        return LogBoxes(FindKeywordBoxes(GetResult(image, engine), keywords), logPrefix);
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
            var bbox = OcrBbox.FromPosition(item.Position);
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

    private static IOcrEngine? ResolveEngine(IOcrEngine? engine)
    {
        var eng = engine ?? OcrEngineRegistry.Instance.Default();
        return eng != null && eng.IsInitialized ? eng : null;
    }

    private static bool HasAnyKeywordCore(IEnumerable<string> keywords, IOcrEngine? engine, string logPrefix, Func<IOcrEngine, OcrResult?> ocr)
    {
        var kwList = keywords?.ToList() ?? new List<string>();
        if (kwList.Count == 0) return false;
        var eng = ResolveEngine(engine);
        if (eng == null)
        {
            ColorPrinter.Yellow($"{logPrefix} OCR not available, skip keyword check");
            return false;
        }
        try
        {
            var text = ocr(eng)?.Text ?? "";
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
        catch (Exception ex)
        {
            ColorPrinter.Red($"{logPrefix} OCR error: {ex.Message}");
            return false;
        }
    }

    private static IReadOnlyList<KeywordBox> LogBoxes(IReadOnlyList<KeywordBox> boxes, string logPrefix)
    {
        foreach (var m in boxes)
            ColorPrinter.Blue($"{logPrefix} Found keyword '{m.Keyword}' at bbox {m.Bbox}");
        return boxes;
    }
}

/// <summary>Keyword match with text and bounding box (minX, minY, maxX, maxY).</summary>
public sealed class KeywordBox
{
    public string Keyword { get; set; } = "";
    public string Text { get; set; } = "";
    public (double MinX, double MinY, double MaxX, double MaxY) Bbox { get; set; }
}
