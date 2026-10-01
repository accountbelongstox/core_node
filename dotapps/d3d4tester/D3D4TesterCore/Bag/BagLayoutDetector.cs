using DotCore.Foundations;
using DotCore.Utils.ImagePreprocess;
using OpenCvSharp;

namespace DotApps.d3d4tester.Core.Bag;

/// <summary>Layout detection output: bag layout, per-item color analysis and color extraction regions (bag-image coords x1,y1,x2,y2).</summary>
public sealed record BagLayoutResult(
    BagLayout Layout,
    IReadOnlyDictionary<(int Row, int Col), BagColorAnalysis> ColorAnalysis,
    IReadOnlyDictionary<(int Row, int Col), (int X1, int Y1, int X2, int Y2)> ExtractRegions);

/// <summary>
/// Bag slot usage from one bag image (BGR): separator lines (1- vs 2-slot items), empty slots, color percentages and quality.
/// 1:1 Python pyapps/d3-check/d3utils/collectors/collect_tools/bag_layout_detector.py.
/// </summary>
public sealed class BagLayoutDetector
{
    private const double ColorAnalysisWidthRatio1Slot = 85.0 / 150.0;
    private const double ColorAnalysisHeightRatio1Slot = 125.0 / 150.0;
    private const double ColorAnalysisWidthRatio2Slot = 90.0 / 150.0;
    private const double ColorAnalysisHeightRatio2Slot = 250.0 / 308.0;
    private const double ColorAnalysisBottomInset1Slot = 0.10;
    private const double ColorAnalysisBottomInset2Slot = 0.08;
    private const int BlackThreshold = 30;
    private const int ColorTolerance = (int)(255 * 0.02);
    private const double EmptyScanHeightRatio = 0.10;
    private const double EmptyScanWidthRatio = 0.60;
    private const int EmptyDarkMax = 20;
    private const double ColorPrintMinPercent = 0.1;
    private const string DarkGoldKey = "dark_gold";
    private const string Separator80 = "================================================================================";

    private static readonly Lazy<BagLayoutDetector> LazyInstance = new(() => new BagLayoutDetector());

    private static readonly IReadOnlyDictionary<string, string> QualityMap = new Dictionary<string, string>
    {
        [BagColorReferences.KeyGreen] = BagSlotValues.QualityLegendarySet,
        [DarkGoldKey] = BagSlotValues.QualityLegendary,
        [BagColorReferences.KeyYellow] = BagSlotValues.QualityRare,
        [BagColorReferences.KeyBlue] = BagSlotValues.QualityMagic,
        [BagColorReferences.KeyBlack] = BagSlotValues.QualityEmpty,
    };

    private static readonly IReadOnlyDictionary<string, Scalar> PieColorMap = new Dictionary<string, Scalar>
    {
        [BagColorReferences.KeyYellow] = new(0, 255, 255),
        [BagColorReferences.KeyBlue] = new(255, 0, 0),
        [DarkGoldKey] = new(0, 140, 180),
        [BagColorReferences.KeyGreen] = new(0, 255, 0),
    };

    private readonly IReadOnlyDictionary<string, IReadOnlySet<(byte B, byte G, byte R)>> _colorRefs;
    private readonly IReadOnlySet<(byte B, byte G, byte R)> _interferenceColors;
    private readonly IReadOnlySet<(byte B, byte G, byte R)> _darkGold1And2;
    private Mat? _originalBagImage;

    public int Rows { get; }
    public int Cols { get; }

    /// <summary>Bag offset (left, right, top, bottom) shown on the visualization image; set by the app (ui_analysis.bag_offset).</summary>
    public static Func<(int Left, int Right, int Top, int Bottom)>? VisualizationOffsetProvider { get; set; }

    /// <summary>When false, the visualization image is saved after each detection (Python FLOW_IMAGES_IN_MEMORY_ONLY = True default).</summary>
    public static bool FlowImagesInMemoryOnly { get; set; } = true;

    private BagLayoutDetector(int rows = BagSlotValues.DefaultRows, int cols = BagSlotValues.DefaultCols)
    {
        Rows = rows;
        Cols = cols;
        _colorRefs = BagColorReferences.GetColorReferences();
        _interferenceColors = BagColorReferences.GetInterferenceColors();
        _darkGold1And2 = _colorRefs[BagColorReferences.KeyDarkGold1Slot].Union(_colorRefs[BagColorReferences.KeyDarkGold2Slot]).ToHashSet();
        ColorPrinter.Green("[BagLayoutDetector] Initialized");
    }

    /// <summary>Default 6x10 detector. 1:1 get_bag_layout_detector.</summary>
    public static BagLayoutDetector Instance => LazyInstance.Value;

    private bool MatchColorWithTolerance(Vec3b px, IReadOnlySet<(byte B, byte G, byte R)> refs)
    {
        foreach (var (b, g, r) in refs)
            if (Math.Abs(px.Item0 - b) <= ColorTolerance && Math.Abs(px.Item1 - g) <= ColorTolerance && Math.Abs(px.Item2 - r) <= ColorTolerance)
                return true;
        return false;
    }

    /// <summary>Detect slot usage, empty slots, item colors and quality from a cropped bag image (BGR). 1:1 detect_layout.</summary>
    public BagLayoutResult DetectLayout(Mat bagImage)
    {
        ColorPrinter.Blue("\n[Layout] Detecting bag slot usage...");
        int height = bagImage.Height, width = bagImage.Width;
        double slotHeight = height / (double)Rows;
        double slotWidth = width / (double)Cols;
        ColorPrinter.Blue($"[Layout] Bag size: {width}x{height}");
        ColorPrinter.Blue($"[Layout] Slot size: {slotWidth:F1}x{slotHeight:F1}");

        _originalBagImage?.Dispose();
        _originalBagImage = bagImage.Clone();

        var layout = new string[Rows][];
        for (int r = 0; r < Rows; r++)
            layout[r] = Enumerable.Repeat(BagSlotValues.LayoutUnknown, Cols).ToArray();

        for (int col = 0; col < Cols; col++)
        {
            ColorPrinter.Gray($"[Layout] Scanning column {col + 1}/{Cols}...");
            int row = 0;
            while (row < Rows)
            {
                if (layout[row][col] != BagSlotValues.LayoutUnknown)
                {
                    row++;
                    continue;
                }
                if (row + 1 < Rows && layout[row + 1][col] == BagSlotValues.LayoutUnknown)
                {
                    if (HasSeparatorLine(bagImage, row, col, slotWidth, slotHeight))
                    {
                        ColorPrinter.Gray($"[Separator] Found between ({row},{col}) and ({row + 1},{col})");
                        layout[row][col] = BagSlotValues.LayoutItemOrEmpty;
                        row++;
                    }
                    else
                    {
                        ColorPrinter.Green($"[2-slot] Slots ({row},{col})-({row + 1},{col}) have same item");
                        layout[row][col] = BagSlotValues.LayoutItem2SlotTop;
                        layout[row + 1][col] = BagSlotValues.LayoutItem2SlotBottom;
                        row += 2;
                    }
                }
                else
                {
                    layout[row][col] = BagSlotValues.LayoutItemOrEmpty;
                    row++;
                }
            }
        }

        for (int row = 0; row < Rows; row++)
            for (int col = 0; col < Cols; col++)
            {
                if (layout[row][col] != BagSlotValues.LayoutItemOrEmpty) continue;
                if (IsSlotEmpty(bagImage, row, col, slotWidth, slotHeight))
                {
                    ColorPrinter.Gray($"[Empty] Slot ({row},{col}) is empty");
                    layout[row][col] = BagSlotValues.TypeEmpty;
                }
                else
                {
                    ColorPrinter.Gray($"[Item] Slot ({row},{col}) has 1-slot item");
                    layout[row][col] = BagSlotValues.TypeItem1Slot;
                }
            }

        var (colorAnalysis, extractRegions) = AnalyzeItemColors(bagImage, layout, slotWidth, slotHeight);

        var items = new Dictionary<(int Row, int Col), BagItemInfo>();
        for (int row = 0; row < Rows; row++)
            for (int col = 0; col < Cols; col++)
            {
                colorAnalysis.TryGetValue((row, col), out var ca);
                switch (layout[row][col])
                {
                    case BagSlotValues.TypeEmpty:
                        items[(row, col)] = new BagItemInfo(BagSlotValues.TypeEmpty, BagSlotValues.QualityEmpty, null);
                        break;
                    case BagSlotValues.TypeItem1Slot:
                        items[(row, col)] = new BagItemInfo(BagSlotValues.TypeItem1Slot, DetermineItemQuality(ca), ca);
                        break;
                    case BagSlotValues.LayoutItem2SlotTop:
                        items[(row, col)] = new BagItemInfo(BagSlotValues.TypeItem2Slot, DetermineItemQuality(ca), ca);
                        break;
                    case BagSlotValues.LayoutItem2SlotBottom:
                        items[(row, col)] = new BagItemInfo(BagSlotValues.TypeItem2SlotBottom, BagSlotValues.QualitySeeTop, null);
                        break;
                }
            }

        var bagLayout = new BagLayout(layout.Select(r => (IReadOnlyList<string>)r).ToList(), items);
        var result = new BagLayoutResult(bagLayout, colorAnalysis, extractRegions);
        PrintLayout(result);
        return result;
    }

    /// <summary>Any uniform row (2% gray tolerance) in the middle 20% height / 80% width band between two slots. 1:1 _has_separator_line.</summary>
    private bool HasSeparatorLine(Mat bagImage, int row, int col, double slotWidth, double slotHeight)
    {
        int boundaryY = (int)((row + 1) * slotHeight);
        int scanHeightRange = (int)(slotHeight * BagColorReferences.SeparatorScanHeightPercent);
        int y1 = Math.Max(0, boundaryY - scanHeightRange / 2);
        int y2 = Math.Min(bagImage.Height, boundaryY + scanHeightRange / 2);
        int slotCenterX = (int)(col * slotWidth + slotWidth / 2);
        int scanWidth = (int)(slotWidth * BagColorReferences.SeparatorScanWidthPercent);
        int x1 = Math.Max(0, (int)(slotCenterX - scanWidth / 2.0));
        int x2 = Math.Min(bagImage.Width, (int)(slotCenterX + scanWidth / 2.0));
        if (y2 <= y1 || x2 <= x1) return false;
        using var region = new Mat(bagImage, new Rect(x1, y1, x2 - x1, y2 - y1));
        using var gray = ToGray(region);
        var idx = gray.GetGenericIndexer<byte>();
        double tolerance = 255 * BagColorReferences.SeparatorColorTolerance;
        for (int y = 0; y < gray.Height; y++)
        {
            double first = idx[y, 0];
            bool allSimilar = true;
            for (int x = 0; x < gray.Width; x++)
            {
                if (Math.Abs(idx[y, x] - first) > tolerance)
                {
                    allSimilar = false;
                    break;
                }
            }
            if (allSimilar)
            {
                ColorPrinter.Gray($"[Separator] Found uniform row at ({row},{col})->({row + 1},{col}), first_pixel={first:F1}, row_width={gray.Width}");
                return true;
            }
        }
        return false;
    }

    /// <summary>Center 10% x 60% region: at least 2 rows share the same dark (&lt;20) first pixel. 1:1 _is_slot_empty.</summary>
    private bool IsSlotEmpty(Mat bagImage, int row, int col, double slotWidth, double slotHeight)
    {
        var slot = ClampRect(bagImage, (int)(col * slotWidth), (int)(row * slotHeight), (int)((col + 1) * slotWidth), (int)((row + 1) * slotHeight));
        if (slot.Width <= 0 || slot.Height <= 0) return false;
        int marginH = (int)(slot.Height * (1 - EmptyScanHeightRatio) / 2);
        int marginW = (int)(slot.Width * (1 - EmptyScanWidthRatio) / 2);
        int scanH = slot.Height - 2 * marginH, scanW = slot.Width - 2 * marginW;
        if (scanH < 2 || scanW <= 0) return false;
        using var region = new Mat(bagImage, new Rect(slot.X + marginW, slot.Y + marginH, scanW, scanH));
        using var gray = ToGray(region);
        var idx = gray.GetGenericIndexer<byte>();
        var counts = new Dictionary<int, int>();
        var order = new List<int>();
        for (int y = 0; y < gray.Height; y++)
        {
            int key = idx[y, 0];
            if (!counts.ContainsKey(key))
            {
                counts[key] = 0;
                order.Add(key);
            }
            counts[key]++;
        }
        if (counts.Count == 0) return false;
        int maxCount = counts.Values.Max();
        int mostCommon = order.First(k => counts[k] == maxCount);
        return maxCount >= 2 && mostCommon < EmptyDarkMax;
    }

    private (Dictionary<(int Row, int Col), BagColorAnalysis> Colors, Dictionary<(int Row, int Col), (int X1, int Y1, int X2, int Y2)> Regions) AnalyzeItemColors(
        Mat bagImage, string[][] layout, double slotWidth, double slotHeight)
    {
        ColorPrinter.Blue("\n[ColorAnalysis] Analyzing item colors...");
        var colors = new Dictionary<(int, int), BagColorAnalysis>();
        var regions = new Dictionary<(int, int), (int, int, int, int)>();
        var processed = new HashSet<(int, int)>();
        for (int row = 0; row < Rows; row++)
            for (int col = 0; col < Cols; col++)
            {
                if (processed.Contains((row, col))) continue;
                var slotType = layout[row][col];
                if (slotType == BagSlotValues.TypeItem1Slot)
                {
                    var (ca, reg) = AnalyzeSlotColor(bagImage, row, col, 1, slotWidth, slotHeight, ColorAnalysisWidthRatio1Slot, ColorAnalysisHeightRatio1Slot, ColorAnalysisBottomInset1Slot, false);
                    colors[(row, col)] = ca;
                    regions[(row, col)] = reg;
                    processed.Add((row, col));
                }
                else if (slotType == BagSlotValues.LayoutItem2SlotTop)
                {
                    var (ca, reg) = AnalyzeSlotColor(bagImage, row, col, 2, slotWidth, slotHeight, ColorAnalysisWidthRatio2Slot, ColorAnalysisHeightRatio2Slot, ColorAnalysisBottomInset2Slot, true);
                    colors[(row, col)] = ca;
                    regions[(row, col)] = reg;
                    processed.Add((row, col));
                    processed.Add((row + 1, col));
                }
            }
        return (colors, regions);
    }

    /// <summary>Bottom-aligned, center-aligned extract region then color percentages. 1:1 _analyze_single_slot_color / _analyze_double_slot_color.</summary>
    private (BagColorAnalysis Analysis, (int, int, int, int) Region) AnalyzeSlotColor(
        Mat bagImage, int row, int col, int spanRows, double slotWidth, double slotHeight,
        double widthRatio, double heightRatio, double bottomInsetRatio, bool is2Slot)
    {
        var slot = ClampRect(bagImage, (int)(col * slotWidth), (int)(row * slotHeight), (int)((col + 1) * slotWidth), (int)((row + spanRows) * slotHeight));
        int slotH = slot.Height, slotW = slot.Width;
        int extractW = (int)(slotW * widthRatio);
        int extractH = (int)(slotH * heightRatio);
        int centerX = slotW / 2;
        int startX = Math.Max(0, centerX - extractW / 2);
        int endX = Math.Min(slotW, startX + extractW);
        int bottomInset = (int)(slotH * bottomInsetRatio);
        int endY = slotH - bottomInset;
        int startY = Math.Max(0, endY - extractH);
        var regionTuple = (slot.X + startX, slot.Y + startY, slot.X + endX, slot.Y + endY);
        if (endX <= startX || endY <= startY) return (BagColorAnalysis.Empty, regionTuple);
        using var region = new Mat(bagImage, new Rect(slot.X + startX, slot.Y + startY, endX - startX, endY - startY));
        return (CalculateColorPercentages(region, is2Slot), regionTuple);
    }

    /// <summary>Drop interference (exact) and dark pixels, count reference-color matches (a pixel may count for several), percent desc. 1:1 _calculate_color_percentages.</summary>
    private BagColorAnalysis CalculateColorPercentages(Mat region, bool is2Slot)
    {
        if (region.Empty()) return BagColorAnalysis.Empty;
        using var bgr = ImageConvert.ToBgr(region);
        var idx = bgr.GetGenericIndexer<Vec3b>();
        var counts = new Dictionary<string, int>
        {
            [BagColorReferences.KeyBlue] = 0,
            [BagColorReferences.KeyYellow] = 0,
            [DarkGoldKey] = 0,
            [BagColorReferences.KeyGreen] = 0,
            [BagColorReferences.KeyBlack] = 0,
        };
        var darkGoldRefs = is2Slot ? _darkGold1And2 : _colorRefs[BagColorReferences.KeyDarkGold1Slot];
        int total = 0;
        for (int y = 0; y < bgr.Height; y++)
            for (int x = 0; x < bgr.Width; x++)
            {
                var p = idx[y, x];
                if (_interferenceColors.Contains((p.Item0, p.Item1, p.Item2))) continue;
                if (Math.Max(p.Item0, Math.Max(p.Item1, p.Item2)) <= BlackThreshold) continue;
                total++;
                if (MatchColorWithTolerance(p, _colorRefs[BagColorReferences.KeyBlue])) counts[BagColorReferences.KeyBlue]++;
                if (MatchColorWithTolerance(p, _colorRefs[BagColorReferences.KeyYellow])) counts[BagColorReferences.KeyYellow]++;
                if (MatchColorWithTolerance(p, _colorRefs[BagColorReferences.KeyGreen])) counts[BagColorReferences.KeyGreen]++;
                if (MatchColorWithTolerance(p, darkGoldRefs)) counts[DarkGoldKey]++;
                if (MatchColorWithTolerance(p, _colorRefs[BagColorReferences.KeyBlack])) counts[BagColorReferences.KeyBlack]++;
            }
        if (total == 0) return BagColorAnalysis.Empty;
        var sorted = counts
            .Select(kv => new KeyValuePair<string, double>(kv.Key, kv.Value / (double)total * 100))
            .Where(kv => kv.Value > 0)
            .OrderByDescending(kv => kv.Value)
            .ToList();
        return new BagColorAnalysis(sorted, total);
    }

    /// <summary>Dominant color -> quality. 1:1 _determine_item_quality.</summary>
    private static string DetermineItemQuality(BagColorAnalysis? colorData)
    {
        if (colorData == null || colorData.Colors.Count == 0) return BagSlotValues.QualityUnknown;
        return QualityMap.TryGetValue(colorData.Colors[0].Key, out var q) ? q : BagSlotValues.QualityUnknown;
    }

    private (int Empty, int OneSlot, int TwoSlot) CountTypes(IReadOnlyList<IReadOnlyList<string>> layout)
    {
        int empty = 0, item1 = 0, item2 = 0;
        for (int r = 0; r < Rows; r++)
            for (int c = 0; c < Cols; c++)
            {
                var t = layout[r][c];
                if (t == BagSlotValues.TypeEmpty) empty++;
                else if (t == BagSlotValues.TypeItem1Slot) item1++;
                else if (t == BagSlotValues.LayoutItem2SlotTop) item2++;
            }
        return (empty, item1, item2);
    }

    /// <summary>Console table, quality stats, color analysis; saves the visualization unless in-memory only. 1:1 _print_layout.</summary>
    private void PrintLayout(BagLayoutResult result)
    {
        var layout = result.Layout.Layout;
        var items = result.Layout.Items;
        ColorPrinter.Blue("\n" + Separator80);
        ColorPrinter.Blue("Bag Layout Detection Results");
        ColorPrinter.Blue(Separator80);
        var (empty, item1, item2) = CountTypes(layout);
        ColorPrinter.Green($"\nEmpty slots: {empty}");
        ColorPrinter.Green($"1-slot items: {item1}");
        ColorPrinter.Green($"2-slot items: {item2}");
        ColorPrinter.Green($"Total occupied: {item1 + item2 * 2}/{Rows * Cols}");

        if (items.Count > 0)
        {
            var qc = new Dictionary<string, int>
            {
                [BagSlotValues.QualityLegendarySet] = 0, [BagSlotValues.QualityLegendary] = 0, [BagSlotValues.QualityRare] = 0,
                [BagSlotValues.QualityMagic] = 0, [BagSlotValues.QualityEmpty] = 0, [BagSlotValues.QualityUnknown] = 0,
            };
            foreach (var info in items.Values)
                if (info.Type is BagSlotValues.TypeItem1Slot or BagSlotValues.TypeItem2Slot)
                    qc[info.Quality] = qc.GetValueOrDefault(info.Quality) + 1;
            ColorPrinter.Blue("\nItem Quality Statistics (color-based; 4 types: empty, magic, rare, legendary):");
            ColorPrinter.Green($"  Legendary Set (Green): {qc[BagSlotValues.QualityLegendarySet]}");
            ColorPrinter.Green($"  Legendary (Ancient): {qc[BagSlotValues.QualityLegendary]}");
            ColorPrinter.Gray("  (Legendary tier normal/ancient/primal requires hover to detect ancient/primal line)");
            ColorPrinter.Green($"  Rare (Yellow): {qc[BagSlotValues.QualityRare]}");
            ColorPrinter.Green($"  Magic (Blue): {qc[BagSlotValues.QualityMagic]}");
            if (qc[BagSlotValues.QualityUnknown] > 0)
                ColorPrinter.Yellow($"  Unknown: {qc[BagSlotValues.QualityUnknown]}");
        }

        ColorPrinter.Blue("\nGrid Layout:");
        ColorPrinter.Gray("  " + string.Concat(Enumerable.Range(0, Cols).Select(c => $"C{c,2} ")));
        for (int row = 0; row < Rows; row++)
        {
            var line = $"R{row} ";
            for (int col = 0; col < Cols; col++)
                line += layout[row][col] switch
                {
                    BagSlotValues.TypeEmpty => " .  ",
                    BagSlotValues.TypeItem1Slot => " O  ",
                    BagSlotValues.LayoutItem2SlotTop => " ^  ",
                    BagSlotValues.LayoutItem2SlotBottom => " v  ",
                    _ => " ?  ",
                };
            ColorPrinter.Gray(line);
        }
        ColorPrinter.Blue(Separator80 + "\n");
        ColorPrinter.Gray("Legend: . = Empty, O = 1-slot item, ^ = Top of 2-slot item, v = Bottom of 2-slot item");

        if (result.ColorAnalysis.Count > 0)
        {
            ColorPrinter.Blue("\n" + Separator80);
            ColorPrinter.Blue("Color Analysis Results");
            ColorPrinter.Blue(Separator80 + "\n");
            foreach (var kv in result.ColorAnalysis.OrderBy(k => k.Key.Row).ThenBy(k => k.Key.Col))
            {
                var (row, col) = kv.Key;
                string typeStr = layout[row][col] == BagSlotValues.LayoutItem2SlotTop ? "2-slot" : "1-slot";
                ColorPrinter.Green($"[{typeStr}] Slot ({row},{col}):");
                if (kv.Value.Colors.Count > 0)
                {
                    foreach (var (name, pct) in kv.Value.Colors)
                        if (pct > ColorPrintMinPercent)
                            ColorPrinter.Gray($"  {name,-12}: {pct,5:F2}%");
                }
                else
                    ColorPrinter.Gray("  No colors detected");
            }
            ColorPrinter.Blue(Separator80 + "\n");
        }
        SaveLayoutVisualization(result);
    }

    private void SaveLayoutVisualization(BagLayoutResult result)
    {
        if (FlowImagesInMemoryOnly) return;
        ColorPrinter.Blue("[Visualization] Creating bag layout visualization...");
        using var combined = BuildVisualizationImage(result);
        if (combined == null) return;
        var path = Path.Combine(BagPaths.TmpDir, $"bag_layout_{DateTime.Now:yyyyMMdd_HHmmss}.png");
        if (ImageConvert.SaveMat(combined, path))
            ColorPrinter.Green($"[Visualization] Saved bag layout visualization: {path}");
    }

    /// <summary>
    /// Combined BGR image: result grid + bag screenshot + extraction regions + color table with pie charts. Call after DetectLayout.
    /// Caller disposes. 1:1 build_visualization_image / _build_layout_visualization_image.
    /// Fixes Python bug: offset info read system_settings.bag_offset (unused key); uses the app ui_analysis.bag_offset provider.
    /// </summary>
    public Mat? BuildVisualizationImage(BagLayoutResult? result)
    {
        if (result == null || _originalBagImage == null || _originalBagImage.Empty()) return null;
        var layout = result.Layout.Layout;
        if (layout.Count != Rows || layout[0].Count != Cols) return null;
        var (emptyCount, item1Count, item2Count) = CountTypes(layout);
        var parts = new List<Mat>();
        try
        {
            const int cellSize = 60, margin = 20, legendHeight = 150, titleHeight = 60, sectionTitleHeight = 40;
            var white = new Scalar(255, 255, 255);
            var colorEmpty = new Scalar(200, 200, 200);
            var color1Slot = new Scalar(100, 200, 100);
            var color2Top = new Scalar(200, 150, 100);
            var color2Bottom = new Scalar(150, 100, 200);
            var colorBorder = new Scalar(50, 50, 50);
            var colorText = new Scalar(0, 0, 0);
            int gridWidth = Cols * cellSize + 2 * margin;
            int gridHeight = Rows * cellSize + 2 * margin + titleHeight + legendHeight;

            var grid = new Mat(gridHeight, gridWidth, MatType.CV_8UC3, white);
            parts.Add(grid);
            var (scaleX, scaleY) = GameInterfaceData.Instance.GetGlobalScale();
            var (oL, oR, oT, oB) = VisualizationOffsetProvider?.Invoke() ?? (0, 0, 0, 0);
            Cv2.PutText(grid, "Bag Layout Detection Result", new Point(margin, 25), HersheyFonts.HersheySimplex, 0.7, colorText, 2);
            Cv2.PutText(grid, $"Offset: L={(int)(oL * scaleX)}px R={(int)(oR * scaleX)}px T={(int)(oT * scaleY)}px B={(int)(oB * scaleY)}px (Scale: {scaleX:F2}x{scaleY:F2})",
                new Point(margin, 50), HersheyFonts.HersheySimplex, 0.45, new Scalar(100, 100, 100), 1);
            int gridStartY = titleHeight + margin;
            for (int row = 0; row < Rows; row++)
                for (int col = 0; col < Cols; col++)
                {
                    int x1 = margin + col * cellSize, y1 = gridStartY + row * cellSize;
                    var (fill, label) = layout[row][col] switch
                    {
                        BagSlotValues.TypeEmpty => (colorEmpty, "."),
                        BagSlotValues.TypeItem1Slot => (color1Slot, "O"),
                        BagSlotValues.LayoutItem2SlotTop => (color2Top, "^"),
                        BagSlotValues.LayoutItem2SlotBottom => (color2Bottom, "v"),
                        _ => (white, "?"),
                    };
                    Cv2.Rectangle(grid, new Point(x1, y1), new Point(x1 + cellSize, y1 + cellSize), fill, -1);
                    Cv2.Rectangle(grid, new Point(x1, y1), new Point(x1 + cellSize, y1 + cellSize), colorBorder, 1);
                    var ls = Cv2.GetTextSize(label, HersheyFonts.HersheySimplex, 0.8, 2, out _);
                    Cv2.PutText(grid, label, new Point(x1 + (cellSize - ls.Width) / 2, y1 + (cellSize + ls.Height) / 2), HersheyFonts.HersheySimplex, 0.8, colorText, 2);
                }
            int legendStartY = gridStartY + Rows * cellSize + margin;
            var legend = new (string Text, Scalar Color, string Symbol)[]
            {
                ("Empty slot", colorEmpty, "."), ("1-slot item", color1Slot, "O"), ("2-slot top", color2Top, "^"), ("2-slot bottom", color2Bottom, "v"),
            };
            for (int i = 0; i < legend.Length; i++)
            {
                int y = legendStartY + i * 30;
                Cv2.Rectangle(grid, new Point(margin, y), new Point(margin + 25, y + 20), legend[i].Color, -1);
                Cv2.Rectangle(grid, new Point(margin, y), new Point(margin + 25, y + 20), colorBorder, 1);
                Cv2.PutText(grid, legend[i].Symbol, new Point(margin + 5, y + 16), HersheyFonts.HersheySimplex, 0.6, colorText, 2);
                Cv2.PutText(grid, legend[i].Text, new Point(margin + 35, y + 16), HersheyFonts.HersheySimplex, 0.5, colorText, 1);
            }
            Cv2.PutText(grid, $"Empty: {emptyCount}  |  1-slot: {item1Count}  |  2-slot: {item2Count}",
                new Point(margin, legendStartY + legend.Length * 30 + 10), HersheyFonts.HersheySimplex, 0.5, colorText, 1);

            int bagW = _originalBagImage.Width, bagH = _originalBagImage.Height;
            int newBagH = (int)(bagH * (gridWidth / (double)bagW));
            using (var bagShot = ImageConvert.ToBgr(_originalBagImage))
            {
                ImageAnnotate.DrawGridOverlay(bagShot, Rows, Cols, gridColor: "green", thickness: 2);
                parts.Add(WithTitle(bagShot, "Actual Bag Screenshot", gridWidth, newBagH, sectionTitleHeight, margin, colorText, white));
            }

            if (result.ColorAnalysis.Count > 0)
            {
                using (var extraction = ImageConvert.ToBgr(_originalBagImage))
                {
                    ImageAnnotate.DrawGridOverlay(extraction, Rows, Cols, gridColor: "cyan", thickness: 2);
                    foreach (var (x1, y1, x2, y2) in result.ExtractRegions.Values)
                        ImageAnnotate.DrawRectangle(extraction, new Point(x1, y1), new Point(x2, y2), ImageAnnotate.GetAnnotationColor("green"), 2);
                    parts.Add(WithTitle(extraction, "Color Analysis Regions", gridWidth, newBagH, sectionTitleHeight, margin, colorText, white));
                }

                int tableHeight = Rows * cellSize + 2 * margin + titleHeight;
                var table = new Mat(tableHeight, gridWidth, MatType.CV_8UC3, white);
                parts.Add(table);
                Cv2.PutText(table, "Color Analysis Table", new Point(margin, 35), HersheyFonts.HersheySimplex, 0.8, colorText, 2);
                int tableStartY = titleHeight + margin;
                var processed = new HashSet<(int, int)>();
                for (int row = 0; row < Rows; row++)
                    for (int col = 0; col < Cols; col++)
                    {
                        if (processed.Contains((row, col))) continue;
                        int x1 = margin + col * cellSize, y1 = tableStartY + row * cellSize, x2 = x1 + cellSize, y2 = y1 + cellSize;
                        bool is2Slot = layout[row][col] == BagSlotValues.LayoutItem2SlotTop;
                        if (is2Slot)
                        {
                            y2 = y1 + cellSize * 2;
                            processed.Add((row, col));
                            processed.Add((row + 1, col));
                        }
                        Cv2.Rectangle(table, new Point(x1, y1), new Point(x2, y2), colorBorder, is2Slot ? 2 : 1);
                        if (is2Slot)
                        {
                            var ts = Cv2.GetTextSize("2-slot", HersheyFonts.HersheySimplex, 0.3, 1, out _);
                            Cv2.PutText(table, "2-slot", new Point(x1 + (cellSize - ts.Width) / 2, y1 + 10), HersheyFonts.HersheySimplex, 0.3, new Scalar(255, 0, 0), 1);
                        }
                        if (!result.ColorAnalysis.TryGetValue((row, col), out var ca) || ca.Colors.Count == 0) continue;
                        var pieCenter = new Point(x1 + cellSize / 2, y1 + (y2 - y1) / 2);
                        ImageAnnotate.DrawPieChart(table, pieCenter, Math.Min(cellSize / 3, 18), ca.Colors, PieColorMap);
                        var (dominant, dominantPct) = ca.Colors[0];
                        if (dominantPct > 0.01)
                        {
                            var ts = Cv2.GetTextSize(dominant, HersheyFonts.HersheySimplex, 0.3, 1, out _);
                            Cv2.PutText(table, dominant, new Point(x1 + (cellSize - ts.Width) / 2, y2 - 5), HersheyFonts.HersheySimplex, 0.3, colorText, 1);
                        }
                    }
            }

            var combined = new Mat(parts.Sum(p => p.Height), gridWidth, MatType.CV_8UC3, white);
            int currentY = 0;
            foreach (var p in parts)
            {
                using var dst = new Mat(combined, new Rect(0, currentY, gridWidth, p.Height));
                p.CopyTo(dst);
                currentY += p.Height;
            }
            return combined;
        }
        catch (Exception e)
        {
            ColorPrinter.Red($"[Visualization] Error creating visualization: {e.Message}");
            return null;
        }
        finally
        {
            foreach (var p in parts) p.Dispose();
        }
    }

    private static Mat WithTitle(Mat image, string title, int width, int height, int titleHeight, int margin, Scalar textColor, Scalar background)
    {
        var output = new Mat(height + titleHeight, width, MatType.CV_8UC3, background);
        Cv2.PutText(output, title, new Point(margin, 28), HersheyFonts.HersheySimplex, 0.8, textColor, 2);
        using var resized = image.Resize(new Size(width, height));
        using var dst = new Mat(output, new Rect(0, titleHeight, width, height));
        resized.CopyTo(dst);
        return output;
    }

    /// <summary>Print each item slot with type and quality. 1:1 print_bag_memory_state.</summary>
    public void PrintBagMemoryState(BagLayout? bag)
    {
        if (bag == null)
        {
            ColorPrinter.Yellow("[BagMemory] No bag data available");
            return;
        }
        ColorPrinter.Blue("\n" + Separator80);
        ColorPrinter.Blue("Bag Memory State");
        ColorPrinter.Blue(Separator80 + "\n");
        for (int row = 0; row < Rows; row++)
            for (int col = 0; col < Cols; col++)
                if (bag.Items.TryGetValue((row, col), out var info) && info.Type is BagSlotValues.TypeItem1Slot or BagSlotValues.TypeItem2Slot)
                    ColorPrinter.Green($"Slot ({row},{col}): {info.Type} - {info.Quality}");
        ColorPrinter.Blue("\n" + Separator80 + "\n");
    }

    private static Rect ClampRect(Mat image, int x1, int y1, int x2, int y2)
    {
        x1 = Math.Clamp(x1, 0, image.Width);
        x2 = Math.Clamp(x2, 0, image.Width);
        y1 = Math.Clamp(y1, 0, image.Height);
        y2 = Math.Clamp(y2, 0, image.Height);
        return new Rect(x1, y1, Math.Max(0, x2 - x1), Math.Max(0, y2 - y1));
    }

    private static Mat ToGray(Mat region)
    {
        if (region.Channels() == 1) return region.Clone();
        var gray = new Mat();
        Cv2.CvtColor(region, gray, region.Channels() == 4 ? ColorConversionCodes.BGRA2GRAY : ColorConversionCodes.BGR2GRAY);
        return gray;
    }
}
