// PY-REF: none (DOT-only)
using System.Drawing;
using System.Globalization;
using System.Text.RegularExpressions;
using DotApps.d3d4tester.Core.Bag;
using DotApps.d3d4tester.Core.Blacksmith;
using DotApps.d3d4tester.Core.Planner;
using DotCore.ScreenCapture;
using DotCore.Utils.Ocr;
using DotCore.Utils.Text;

namespace DotApps.d3d4tester.Core.Kanai;

/// <summary>An OCR'd item tooltip: legendary tier from the hover line (primal / ancient / normal) and the text lines top to bottom.</summary>
public sealed record KanaiTooltip(string Tier, IReadOnlyList<string> Lines)
{
    /// <summary>Lines at the top that hold the item name (the name may wrap).</summary>
    private const int NameLines = 4;
    /// <summary>Share of a stat name's characters that must appear in order in a line.</summary>
    private const double StatNameCoverage = 0.8;
    private static readonly Regex Number = new(@"\d+(?:[.,]\d+)*", RegexOptions.Compiled | RegexOptions.CultureInvariant);

    public string Text => string.Join('\n', Lines);

    public int AncientRank => Tier switch { BagSlotValues.TierPrimal => 2, BagSlotValues.TierAncient => 1, _ => 0 };

    /// <summary>Best similarity of the top lines (and pairs of them, for a wrapped name) to any of the names.</summary>
    public double NameScore(params string[] names)
    {
        var top = Lines.Take(NameLines).ToList();
        var texts = top.Concat(top.Zip(top.Skip(1), (a, b) => a + b));
        return texts.SelectMany(t => names.Where(n => n.Length > 0).Select(n => FuzzyText.Similarity(t, n))).DefaultIfEmpty(0).Max();
    }

    /// <summary>Value of an affix: the first number on the line that shows its name (Chinese or English); null when no line does.</summary>
    public double? StatValue(PlannerStat stat)
    {
        foreach (var line in Lines)
        {
            string norm = FuzzyText.Normalize(line);
            bool named = new[] { stat.NameZh, stat.NameEn }.Select(FuzzyText.Normalize)
                .Any(n => n.Length > 0 && FuzzyText.Lcs(n, norm) >= Math.Ceiling(n.Length * StatNameCoverage));
            if (!named || Number.Match(line) is not { Success: true } m) continue;
            if (double.TryParse(m.Value.Replace(",", ""), NumberStyles.Float, CultureInfo.InvariantCulture, out double v)) return v;
        }
        return null;
    }
}

/// <summary>
/// Reads the tooltip of a bag item: hover the item (the blacksmith hover reads the tier line), capture the area left of the bag where
/// D3 draws bag tooltips and OCR it. Slow (OCR on CPU), so callers read only items whose icon already matches something wanted.
/// </summary>
public static class KanaiTooltipReader
{
    /// <summary>Tooltips of bag items are drawn between this share of the window width and the bag's left edge.</summary>
    public const double TooltipLeftRatio = 0.25;

    public static KanaiTooltip? Read(GameInterfaceData shared, int row, int col)
    {
        var tier = BlacksmithHandler.Instance.ReadSlotTier(shared, row, col)?.Tier ?? BagSlotValues.TierNormal;
        return Capture(shared) is { } lines ? new KanaiTooltip(tier, lines) : null;
    }

    /// <summary>OCR lines (top to bottom) of the tooltip area while an item is hovered; null when it cannot be captured.</summary>
    public static IReadOnlyList<string>? Capture(GameInterfaceData shared)
    {
        if (shared.BagCoordinates is not { } bag) return null;
        var (ox, oy) = shared.WindowOffset;
        var (w, h) = shared.GameWindowSize;
        int left = (int)(w * TooltipLeftRatio);
        int width = bag.TopLeft.X - left;
        if (width <= 0 || h <= 0) return null;
        using Bitmap? tooltip = ScreenCaptureService.GetScreenshotProvider().CaptureRegion(ox + left, oy, width, h);
        if (tooltip == null || OcrHelper.GetResult(tooltip) is not { } result) return null;
        return OcrBbox.SortByLine(result.RawResult).Select(line => string.Join(' ', line.Select(b => b.Text)).Trim()).Where(t => t.Length > 0).ToList();
    }
}
