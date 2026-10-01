using System.Drawing;
using OpenCvSharp;

namespace DotCore.Utils.Ocr;

/// <summary>
/// Decorator restricting recognized text to an alphabet (e.g. digits). Equivalent of CnOCR cand_alphabet
/// (MODEL_PROFILES["number"]) applied as a post-filter over a shared engine. Boxes left empty are dropped.
/// 1:1 Python pycore/pyutils/ocr_cluster/cnocr_engine_registry.py cand_alphabet.
/// </summary>
public sealed class CandAlphabetOcrEngine : IOcrEngine
{
    private readonly IOcrEngine _inner;
    private readonly HashSet<char> _alphabet;

    public CandAlphabetOcrEngine(IOcrEngine inner, string candAlphabet)
    {
        _inner = inner ?? throw new ArgumentNullException(nameof(inner));
        _alphabet = new HashSet<char>(candAlphabet ?? "");
    }

    public bool IsInitialized => _inner.IsInitialized;

    public bool Init() => _inner.Init();

    public OcrResult? Ocr(string imagePath, int? gridPosition = null) => Filter(_inner.Ocr(imagePath, gridPosition));

    public OcrResult? Ocr(Bitmap image, int? gridPosition = null) => Filter(_inner.Ocr(image, gridPosition));

    public OcrResult? Ocr(Mat image, int? gridPosition = null) => Filter(_inner.Ocr(image, gridPosition));

    private OcrResult? Filter(OcrResult? result)
    {
        if (result == null || _alphabet.Count == 0)
            return result;
        var raw = new List<OcrWordBox>();
        foreach (var box in result.RawResult)
        {
            var text = new string((box.Text ?? "").Where(_alphabet.Contains).ToArray());
            if (text.Length == 0) continue;
            raw.Add(new OcrWordBox { Text = text, Position = box.Position });
        }
        return new OcrResult
        {
            Text = string.Join("\n", raw.Select(b => b.Text)),
            RawResult = raw,
            Offset = result.Offset,
            Region = result.Region,
            GridPosition = result.GridPosition
        };
    }
}
