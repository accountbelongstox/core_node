using OpenCvSharp;

namespace DotApps.d3d4tester.Core.Bag;

/// <summary>Line detection result: Kind "orange" (primal) | "ancient" | null, line height, matched primal/ancient pixels (crop coords).</summary>
public sealed record SlotLineDetection(
    string? Kind,
    int? Height,
    IReadOnlyList<(int X, int Y)> PrimalPoints,
    IReadOnlyList<(int X, int Y)> AncientPoints);

/// <summary>
/// Bag slot legendary tier (primal / ancient / normal) from the hover tooltip line left of the slot.
/// 1:1 Python pyapps/d3-check/d3utils/slot_quality.py. All Mat inputs are BGR (8UC3, OpenCV order);
/// reference colors are RGB as in Python and pixels are compared as (R, G, B) = (Item2, Item1, Item0).
/// </summary>
public static class SlotQuality
{
    public const string KindOrange = "orange";
    public const string KindAncient = "ancient";
    public const double LinePrimalAncientTolerance = 0.10;
    public const double LineBrightnessTolerance = 0.10;
    public const int MinLineHeightPx = 5;
    private const double SearchLengthRatio = 0.5;
    private const double MarginYRatio = 1.5;
    private const int SearchRightPadPx = 10;

    /// <summary>Primal Ancient line RGBs.</summary>
    public static readonly (int R, int G, int B)[] LinePrimalAncientRgbs =
    {
        (0x86, 0x0A, 0x0D), (0x97, 0x0A, 0x0D), (0x92, 0x0A, 0x08), (0x8C, 0x0A, 0x09),
        (0x99, 0x0B, 0x08), (0xA1, 0x0B, 0x0E), (0x9A, 0x0B, 0x08), (0x5B, 0x09, 0x08),
        (0x4A, 0x08, 0x08), (0x39, 0x07, 0x07), (0x2C, 0x04, 0x06), (0x3A, 0x07, 0x04),
        (0x5C, 0x09, 0x08), (0x45, 0x07, 0x06),
    };

    /// <summary>Ancient line RGBs.</summary>
    public static readonly (int R, int G, int B)[] LineAncientRgbs =
    {
        (0xBA, 0x70, 0x01), (0x9E, 0x61, 0x08), (0xA2, 0x64, 0x08), (0x78, 0x44, 0x03),
        (0x54, 0x30, 0x07), (0x7F, 0x47, 0x05), (0xB7, 0x72, 0x08), (0x74, 0x42, 0x03),
        (0x84, 0x48, 0x02), (0x87, 0x4D, 0x07), (0x42, 0x24, 0x08), (0x61, 0x38, 0x08),
        (0x5B, 0x39, 0x02),
    };

    /// <summary>Each RGB channel within [ref*(1-tol), ref*(1+tol)]. 1:1 _pixel_matches_ref.</summary>
    public static bool PixelMatchesRef((int R, int G, int B) pixel, (int R, int G, int B) reference, double tolerance = LineBrightnessTolerance)
    {
        double lo = 1.0 - tolerance, hi = 1.0 + tolerance;
        return reference.R * lo <= pixel.R && pixel.R <= reference.R * hi
            && reference.G * lo <= pixel.G && pixel.G <= reference.G * hi
            && reference.B * lo <= pixel.B && pixel.B <= reference.B * hi;
    }

    /// <summary>1:1 _pixel_matches_any_ref.</summary>
    public static bool PixelMatchesAnyRef((int R, int G, int B) pixel, IReadOnlyList<(int R, int G, int B)> refs, double tolerance = LineBrightnessTolerance)
    {
        foreach (var r in refs)
            if (PixelMatchesRef(pixel, r, tolerance)) return true;
        return false;
    }

    private static bool IsPrimal((int R, int G, int B) p) => PixelMatchesAnyRef(p, LinePrimalAncientRgbs, LinePrimalAncientTolerance);
    private static bool IsAncient((int R, int G, int B) p) => PixelMatchesAnyRef(p, LineAncientRgbs);

    private static (int R, int G, int B) Rgb(Mat.Indexer<Vec3b> idx, int y, int x)
    {
        var v = idx[y, x];
        return (v.Item2, v.Item1, v.Item0);
    }

    private static (List<(int X, int Y)> Primal, List<(int X, int Y)> Ancient) FullCropScanPrimalAncient(Mat crop)
    {
        var primal = new List<(int, int)>();
        var ancient = new List<(int, int)>();
        var idx = crop.GetGenericIndexer<Vec3b>();
        for (int y = 0; y < crop.Height; y++)
            for (int x = 0; x < crop.Width; x++)
            {
                var p = Rgb(idx, y, x);
                if (IsPrimal(p)) primal.Add((x, y));
                else if (IsAncient(p)) ancient.Add((x, y));
            }
        return (primal, ancient);
    }

    private static SlotLineDetection NoLine(Mat crop)
    {
        var (p, a) = FullCropScanPrimalAncient(crop);
        return new SlotLineDetection(null, null, p, a);
    }

    /// <summary>
    /// Search leftward from the slot left edge for a primal/ancient line, extend vertically, return kind + height;
    /// when no line, scan the whole crop for dots. Crop is BGR. 1:1 _find_line_in_crop.
    /// </summary>
    public static SlotLineDetection FindLineInCrop(Mat crop, double leftEdgeXInCrop, double centerYInCrop, double searchLength)
    {
        int hCrop = crop.Height, wCrop = crop.Width;
        int xStart = Math.Min((int)leftEdgeXInCrop, wCrop - 1);
        int xEnd = Math.Max(0, (int)(leftEdgeXInCrop - searchLength));
        if (xStart < 0 || xEnd >= wCrop || hCrop <= 0)
            return NoLine(crop);

        var idx = crop.GetGenericIndexer<Vec3b>();
        int? xFound = null, ySeed = null;
        string? kindFound = null;
        for (int x = xStart; x > xEnd - 1; x--)
        {
            if (x < 0) break;
            for (int y = 0; y < hCrop; y++)
            {
                var p = Rgb(idx, y, x);
                if (IsPrimal(p))
                {
                    xFound = x; kindFound = KindOrange; ySeed = y;
                    break;
                }
                if (IsAncient(p))
                {
                    xFound = x; kindFound = KindAncient; ySeed = y;
                    break;
                }
            }
            if (kindFound == KindOrange) break;
        }
        if (xFound is not { } xf || kindFound == null || ySeed is not { } seed)
            return NoLine(crop);

        Func<(int R, int G, int B), bool> matchesRef = kindFound == KindOrange ? IsPrimal : IsAncient;
        int yTop = seed;
        for (int y = seed - 1; y >= 0; y--)
        {
            if (matchesRef(Rgb(idx, y, xf))) yTop = y;
            else break;
        }
        int yBottom = seed;
        for (int y = seed + 1; y < hCrop; y++)
        {
            if (matchesRef(Rgb(idx, y, xf))) yBottom = y;
            else break;
        }
        if (yBottom - yTop + 1 < MinLineHeightPx)
            return NoLine(crop);

        int stripTop = yTop;
        for (int y = yTop - 1; y >= 0; y--)
        {
            var p = Rgb(idx, y, xf);
            if (IsPrimal(p) || IsAncient(p)) stripTop = y;
            else break;
        }
        int stripBottom = yBottom;
        for (int y = yBottom + 1; y < hCrop; y++)
        {
            var p = Rgb(idx, y, xf);
            if (IsPrimal(p) || IsAncient(p)) stripBottom = y;
            else break;
        }
        var primal = new List<(int, int)>();
        var ancient = new List<(int, int)>();
        for (int y = stripTop; y <= stripBottom; y++)
        {
            var p = Rgb(idx, y, xf);
            if (IsPrimal(p)) primal.Add((xf, y));
            else if (IsAncient(p)) ancient.Add((xf, y));
        }
        return new SlotLineDetection(kindFound, yBottom - yTop + 1, primal, ancient);
    }

    /// <summary>Search region bounds (window coords): x [left-0.5w, left+10], y center ± 1.5h. Returns crop x/y origin too.</summary>
    private static (int XMin, int YMin, int XMax, int YMax, double LeftEdgeX, double CenterY, double SearchLength) Bounds(
        int imageW, int imageH, (int X, int Y) topLeft, double slotWidth, double slotHeight, int r, int c)
    {
        double leftEdgeX = topLeft.X + c * slotWidth;
        double searchLength = SearchLengthRatio * slotWidth;
        double centerY = topLeft.Y + (r + 0.5) * slotHeight;
        double marginY = MarginYRatio * slotHeight;
        int xMin = Math.Max(0, (int)(leftEdgeX - searchLength));
        int xMax = Math.Min(imageW, (int)leftEdgeX + SearchRightPadPx);
        int yMin = Math.Max(0, (int)(centerY - marginY));
        int yMax = Math.Min(imageH, (int)(centerY + marginY) + 1);
        return (xMin, yMin, xMax, yMax, leftEdgeX, centerY, searchLength);
    }

    /// <summary>Crop the slot search region from a full game window image (BGR). Caller disposes; may be empty. 1:1 _crop_search_region.</summary>
    public static Mat CropSearchRegion(Mat window, (int X, int Y) topLeft, double slotWidth, double slotHeight, int r, int c)
    {
        var b = Bounds(window.Width, window.Height, topLeft, slotWidth, slotHeight, r, c);
        if (b.XMax <= b.XMin || b.YMax <= b.YMin) return new Mat();
        return new Mat(window, new Rect(b.XMin, b.YMin, b.XMax - b.XMin, b.YMax - b.YMin)).Clone();
    }

    /// <summary>Classify a bag slot as "primal" | "ancient" | "normal" from the full game window (BGR). 1:1 classify_slot_quality_from_window.</summary>
    public static string ClassifySlotQualityFromWindow(Mat window, (int X, int Y) topLeft, double slotWidth, double slotHeight, int r, int c)
    {
        using var crop = CropSearchRegion(window, topLeft, slotWidth, slotHeight, r, c);
        if (crop.Empty()) return BagSlotValues.TierNormal;
        var b = Bounds(window.Width, window.Height, topLeft, slotWidth, slotHeight, r, c);
        var line = FindLineInCrop(crop, b.LeftEdgeX - b.XMin, b.CenterY - b.YMin, b.SearchLength);
        if (line.Kind == KindOrange || line.PrimalPoints.Count > 0) return BagSlotValues.TierPrimal;
        if (line.Kind == KindAncient || line.AncientPoints.Count > 0) return BagSlotValues.TierAncient;
        return BagSlotValues.TierNormal;
    }
}
