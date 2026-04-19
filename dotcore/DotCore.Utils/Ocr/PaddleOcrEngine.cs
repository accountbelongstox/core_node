using System.Drawing;
using System.Runtime.Versioning;
using DotCore.Foundations;
using PaddleOCRSharp;

namespace DotCore.Utils.Ocr;

/// <summary>
/// OCR engine using PaddleOCRSharp (open-source PaddleOCR .NET wrapper).
/// Same contract as IOcrEngine. Windows x64 (Paddle.Runtime.win_x64).
/// Ref: https://www.nuget.org/packages/PaddleOCRSharp
/// </summary>
[SupportedOSPlatform("windows")]
public sealed class PaddleOcrEngine : IOcrEngine
{
    private PaddleOCREngine? _engine;
    private bool _initialized;

    public bool IsInitialized => _initialized;

    public bool Init()
    {
        if (_initialized)
        {
            ColorPrinter.Blue("[PaddleOcrEngine] OCR already initialized, skipping");
            return true;
        }

        if (!OperatingSystem.IsWindows())
        {
            ColorPrinter.Red("[PaddleOcrEngine] PaddleOCRSharp is Windows only (Paddle.Runtime.win_x64).");
            return false;
        }

        try
        {
            var config = OCRModelConfig.Default;
            _engine = new PaddleOCREngine(config);
            _initialized = true;
            ColorPrinter.Green("[PaddleOcrEngine] Initialized (PaddleOCRSharp)");
            return true;
        }
        catch (Exception ex)
        {
            ColorPrinter.Red($"[PaddleOcrEngine] Init failed: {ex.Message}");
            return false;
        }
    }

    public OcrResult? Ocr(string imagePath, int? gridPosition = null)
    {
        if (!_initialized || _engine == null)
            throw new InvalidOperationException("OCR not initialized, call Init() first.");

        if (string.IsNullOrWhiteSpace(imagePath) || !File.Exists(imagePath))
            return null;

        try
        {
            using var bitmap = (Bitmap)Image.FromFile(imagePath);
            int w = bitmap.Width;
            int h = bitmap.Height;
            int left = 0, top = 0, right = w, bottom = h;
            Bitmap? regionBitmap = bitmap;

            if (gridPosition is >= 1 and <= 9)
            {
                int gw = w / 3, gh = h / 3;
                int row = (gridPosition.Value - 1) / 3, col = (gridPosition.Value - 1) % 3;
                left = col * gw;
                top = row * gh;
                right = left + gw;
                bottom = top + gh;
                regionBitmap = bitmap.Clone(new Rectangle(left, top, right - left, bottom - top), bitmap.PixelFormat);
            }

            var result = _engine.DetectText(regionBitmap);
            if (result == null)
                return null;

            var rawResult = PaddleResultToRawResult(result, left, top);
            var textLines = rawResult.Select(b => b.Text).ToList();
            var fullText = string.Join("\n", textLines);

            if (regionBitmap != bitmap)
                regionBitmap?.Dispose();

            return new OcrResult
            {
                Text = fullText,
                RawResult = rawResult,
                Offset = (left, top),
                Region = (left, top, right, bottom),
                GridPosition = gridPosition
            };
        }
        catch (Exception ex)
        {
            ColorPrinter.Red($"[PaddleOcrEngine] Ocr error: {ex.Message}");
            return null;
        }
    }

    private static List<OcrWordBox> PaddleResultToRawResult(OCRResult result, int offsetX, int offsetY)
    {
        var raw = new List<OcrWordBox>();
        if (result.TextBlocks == null) return raw;
        foreach (var block in result.TextBlocks)
        {
            string text = block.Text ?? "";
            var box = block.BoxPoints;
            if (box == null || box.Count < 4) continue;
            var pos = new List<(double, double)>();
            for (int i = 0; i < 4 && i < box.Count; i++)
            {
                var p = box[i];
                pos.Add((p.X + offsetX, p.Y + offsetY));
            }
            raw.Add(new OcrWordBox { Text = text, Position = pos });
        }
        return raw;
    }
}
