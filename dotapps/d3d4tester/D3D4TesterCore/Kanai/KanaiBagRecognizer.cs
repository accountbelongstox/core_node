// PY-REF: none (DOT-only)
using DotApps.d3d4tester.Core.Bag;
using DotApps.d3d4tester.Core.Planner;
using DotCore.TemplateMatcher;
using OpenCvSharp;

namespace DotApps.d3d4tester.Core.Kanai;

/// <summary>An occupied bag item (top cell), whether it covers two cells, and its quality from the bag layout.</summary>
public sealed record KanaiBagItem(int Row, int Col, bool Tall, string Quality)
{
    public bool IsRare => Quality == BagSlotValues.QualityRare;

    public bool IsLegendary => Quality is BagSlotValues.QualityLegendary or BagSlotValues.QualityLegendarySet;
}

/// <summary>Best icon of a bag item: the wiki icon (group = item type folder), its score and the catalog item it shows (null for base items).</summary>
public sealed record KanaiIconGuess(string Path, string Group, double Score, D3CatalogItem? Item)
{
    public bool NonGear => Group == D3ItemIcons.GemGroup;
}

/// <summary>
/// Recognizes bag items by their art (<see cref="MaskedIconMatcher"/> on icons in the inventory layout): a rare against every wiki
/// icon of its footprint (base items included; the folder gives its item type group, gem icons mark gems / consumables to skip), a
/// legendary against the legendary / set items it can be (maxroll icon, else wiki icon). Crops are the item's cells plus a small
/// margin, taken from the window image the bag coordinates refer to.
/// </summary>
public static class KanaiBagRecognizer
{
    /// <summary>Lowest score of a usable guess (synthetic tests: right guesses score 0.8 - 1, wrong ones mostly below 0.6).</summary>
    public const double MinScore = 0.6;
    /// <summary>A target within this score of the best guess still counts as a possible match (then OCR decides).</summary>
    public const double TieMargin = 0.06;
    /// <summary>Icons taller than this (height / width) cover two bag cells.</summary>
    public const double TallAspect = 1.5;
    private const double CellMarginRatio = 0.08;
    private const int TopGuesses = 3;

    /// <summary>Occupied items (top cell of each) in row-major order.</summary>
    public static IReadOnlyList<KanaiBagItem> Items(BagLayout layout, BagCoordinates bag)
    {
        var items = new List<KanaiBagItem>();
        for (int r = 0; r < bag.Rows; r++)
            for (int c = 0; c < bag.Cols; c++)
                if (layout.Items.TryGetValue((r, c), out var info) && info.Type is BagSlotValues.TypeItem1Slot or BagSlotValues.TypeItem2Slot)
                    items.Add(new KanaiBagItem(r, c, info.Type == BagSlotValues.TypeItem2Slot, info.Quality));
        return items;
    }

    /// <summary>The item's cells plus margin from the window image (BGR, caller disposes); null when outside the image.</summary>
    public static Mat? Crop(Mat window, BagCoordinates bag, KanaiBagItem item)
    {
        double w = bag.SlotWidth, h = bag.SlotHeight * (item.Tall ? 2 : 1);
        double mx = w * CellMarginRatio, my = bag.SlotHeight * CellMarginRatio;
        var rect = new Rect((int)Math.Round(bag.TopLeft.X + item.Col * w - mx), (int)Math.Round(bag.TopLeft.Y + item.Row * bag.SlotHeight - my),
            (int)Math.Round(w + 2 * mx), (int)Math.Round(h + 2 * my)).Intersect(new Rect(0, 0, window.Cols, window.Rows));
        return rect.Width < 4 || rect.Height < 4 ? null : new Mat(window, rect).Clone();
    }

    /// <summary>Item type of a rare (or a gem / consumable to skip): best wiki icon of its footprint; null when no icon scores <see cref="MinScore"/>.</summary>
    public static KanaiIconGuess? Classify(Mat crop, bool tall, D3ItemCatalog catalog)
    {
        var icons = D3ItemIcons.WikiIcons.Where(e => MaskedIcon.Load(e.Path) is { } i && i.Aspect > TallAspect == tall);
        var best = MaskedIconMatcher.Rank(crop, icons, e => MaskedIcon.Load(e.Path), 1).FirstOrDefault();
        if (best.Item == null || best.Score < MinScore) return null;
        return new KanaiIconGuess(best.Item.Path, best.Item.Group, best.Score, catalog.ByName(best.Item.Key));
    }

    /// <summary>
    /// Best legendary / set guesses (best first) among the candidates of the item's footprint; items listed under several ids (legacy
    /// and current versions) are scored once.
    /// </summary>
    public static IReadOnlyList<KanaiIconGuess> RankEquipment(Mat crop, bool tall, IEnumerable<D3CatalogItem> candidates)
    {
        var fitting = candidates.DistinctBy(c => c.NameEn, StringComparer.OrdinalIgnoreCase).Select(c => (Item: c, Path: c.RecognitionIcon))
            .Where(c => c.Path != null && MaskedIcon.Load(c.Path) is { } i && i.Aspect > TallAspect == tall).ToList();
        return MaskedIconMatcher.Rank(crop, fitting, c => MaskedIcon.Load(c.Path!), TopGuesses)
            .Select(r => new KanaiIconGuess(r.Item.Path!, r.Item.Item.Group, r.Score, r.Item.Item)).ToList();
    }
}
