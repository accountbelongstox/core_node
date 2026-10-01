namespace DotApps.d3d4tester.Core.Bag;

/// <summary>Bag grid in game-window coordinates. 1:1 Python share.game_interface_data.BagCoordinates.</summary>
public sealed record BagCoordinates(
    (int X, int Y) TopLeft,
    (int X, int Y) BottomRight,
    int Width,
    int Height,
    int Rows,
    int Cols,
    int TotalSlots)
{
    /// <summary>Slot width in pixels (width / cols).</summary>
    public double SlotWidth => Cols > 0 ? Width / (double)Cols : 0;

    /// <summary>Slot height in pixels (height / rows).</summary>
    public double SlotHeight => Rows > 0 ? Height / (double)Rows : 0;

    /// <summary>Slot center in game-window coordinates (int-truncated like Python).</summary>
    public (int X, int Y) SlotCenter(int row, int col) =>
        ((int)(TopLeft.X + (col + 0.5) * SlotWidth), (int)(TopLeft.Y + (row + 0.5) * SlotHeight));
}

/// <summary>Color analysis of one item: colors sorted by percentage desc, non-black pixel count. 1:1 _calculate_color_percentages dict.</summary>
public sealed record BagColorAnalysis(IReadOnlyList<KeyValuePair<string, double>> Colors, int TotalPixels)
{
    public static readonly BagColorAnalysis Empty = new(Array.Empty<KeyValuePair<string, double>>(), 0);
}

/// <summary>One slot entry. 1:1 Python bag_layout.items[(row, col)] dict (type, quality, color_analysis).</summary>
public sealed record BagItemInfo(string Type, string Quality, BagColorAnalysis? ColorAnalysis);

/// <summary>Bag layout: per-slot layout strings and item info by (row, col). 1:1 Python share.game_interface_data.BagLayout.</summary>
public sealed record BagLayout(
    IReadOnlyList<IReadOnlyList<string>> Layout,
    IReadOnlyDictionary<(int Row, int Col), BagItemInfo> Items);

/// <summary>Slot type / quality strings. 1:1 Python bag_layout_detector values.</summary>
public static class BagSlotValues
{
    public const string TypeEmpty = "empty";
    public const string TypeItem1Slot = "item_1slot";
    public const string TypeItem2Slot = "item_2slot";
    public const string TypeItem2SlotBottom = "item_2slot_bottom";
    public const string LayoutUnknown = "unknown";
    public const string LayoutItemOrEmpty = "item_or_empty";
    public const string LayoutItem2SlotTop = "item_2slot_top";
    public const string LayoutItem2SlotBottom = "item_2slot_bottom";

    public const string QualityEmpty = "empty";
    public const string QualityLegendarySet = "legendary_set";
    public const string QualityLegendary = "legendary";
    public const string QualityRare = "rare";
    public const string QualityMagic = "magic";
    public const string QualityUnknown = "unknown";
    public const string QualitySeeTop = "see_top";

    /// <summary>Legendary tier from hover line detection. 1:1 slot_quality / blacksmith tier strings.</summary>
    public const string TierPrimal = "primal";
    public const string TierAncient = "ancient";
    public const string TierNormal = "normal";

    public const int DefaultRows = 6;
    public const int DefaultCols = 10;
}
