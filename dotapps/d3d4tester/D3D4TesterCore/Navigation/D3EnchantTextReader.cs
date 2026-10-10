// PY-REF: none (DOT-only)
using DotCore.Foundations;
using DotCore.Utils.Ocr;
using OpenCvSharp;

namespace DotApps.d3d4tester.Core.Navigation;

/// <summary>One OCR text line; Center is in the pixels of the frame the text was read from.</summary>
public sealed record D3TextLine(string Text, Point Center);

/// <summary>
/// Reads the mystic's enchant affix list: the YOLO "enchant_text" box is cut from the frame, enlarged so small glyphs reach the
/// recognizer's working size, read by the general OCR engine and grouped into lines (top to bottom, words left to right).
/// </summary>
public static class D3EnchantTextReader
{
    private const string LogTag = "[EnchantOCR]";
    private const int Margin = 2;
    private const int MinOcrHeight = 360;
    private const double MaxUpscale = 4;
    private const double SameLineFraction = 0.5;

    public static IReadOnlyList<D3TextLine> Read(Mat frame, Rect box)
    {
        var region = new Rect(box.X - Margin, box.Y - Margin, box.Width + 2 * Margin, box.Height + 2 * Margin)
            .Intersect(new Rect(0, 0, frame.Width, frame.Height));
        if (region.Width <= 0 || region.Height <= 0) return Array.Empty<D3TextLine>();
        var engine = OcrEngineRegistry.Instance.General();
        if (engine == null)
        {
            ColorPrinter.Yellow($"{LogTag} No OCR engine available");
            return Array.Empty<D3TextLine>();
        }
        using var crop = new Mat(frame, region).Clone();
        double scale = Math.Clamp(MinOcrHeight / (double)crop.Height, 1, MaxUpscale);
        using var input = new Mat();
        if (scale > 1) Cv2.Resize(crop, input, new Size(), scale, scale, InterpolationFlags.Cubic);
        else crop.CopyTo(input);
        var result = engine.Ocr(input);
        if (result == null) return Array.Empty<D3TextLine>();

        var words = result.RawResult
            .Where(w => w.Text.Trim().Length > 0 && w.Position.Count >= 4)
            .Select(w => (Text: w.Text.Trim(), X: w.Position.Min(p => p.X), Cx: w.Position.Average(p => p.X), Cy: w.Position.Average(p => p.Y),
                H: Math.Max(1, w.Position.Max(p => p.Y) - w.Position.Min(p => p.Y))))
            .OrderBy(w => w.Cy).ToList();
        var lines = new List<List<(string Text, double X, double Cx, double Cy, double H)>>();
        foreach (var w in words)
        {
            var last = lines.LastOrDefault();
            if (last != null && Math.Abs(last.Average(x => x.Cy) - w.Cy) < SameLineFraction * Math.Max(w.H, last.Max(x => x.H))) last.Add(w);
            else lines.Add(new() { w });
        }
        return lines.Select(l =>
        {
            var ordered = l.OrderBy(x => x.X).ToList();
            double cx = ordered.Average(x => x.Cx) + result.Offset.X, cy = ordered.Average(x => x.Cy) + result.Offset.Y;
            return new D3TextLine(string.Join(" ", ordered.Select(x => x.Text)),
                new Point(region.X + (int)Math.Round(cx / scale), region.Y + (int)Math.Round(cy / scale)));
        }).ToList();
    }
}
