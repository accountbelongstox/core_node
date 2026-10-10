// PY-REF: dotapps/d3d4tester/reference/py_d3check/controller/ctl_func/blacksmith_handler.py
// PY-REF: dotapps/d3d4tester/reference/py_d3check/share/game_interface_data.py
using DotApps.d3d4tester.Core.Bag;
using DotCore.Foundations;
using DotCore.ScreenCapture;
using DotCore.Utils.ImagePreprocess;
using DotCore.Utils.Input;

namespace DotApps.d3d4tester.Core.Blacksmith;

/// <summary>
/// Blacksmith operations: sidebar tab (template match), salvage button, auto salvage by slots with line-quality hover.
/// 1:1 Python dotapps/d3d4tester/reference/py_d3check/controller/ctl_func/blacksmith_handler.py.
/// </summary>
public sealed class BlacksmithHandler
{
    public const string KeepAncientPlus = "keep_ancient_plus";
    public const string KeepPrimal = "keep_primal";

    private const int AfterSidebarTabMs = 500;
    private const int AfterSalvageTabMs = 400;
    private const int HoverSettleMs = 350;
    private const int AfterSlotClickMs = 200;
    private const int AfterSalvageButtonMs = 150;
    private const int AfterConfirmMs = 250;
    private const double HoverMoveDurationSec = 0.0;
    private const double SearchLengthRatio = 0.5;
    private const int FallbackWindowWidth = 1300;
    private const int FallbackWindowHeight = 800;

    private static readonly string[] SidebarTabTemplates = { D3TemplateNames.BlacksmithSidebarTab1, D3TemplateNames.BlacksmithSidebarTab2 };
    private static readonly Lazy<BlacksmithHandler> LazyInstance = new(() => new BlacksmithHandler());

    private readonly D3ScaledTemplateMatcher _matcher = D3ScaledTemplateMatcher.Instance;
    private readonly StateAwareClickHandler _click = StateAwareClickHandler.Instance;

    private BlacksmithHandler()
    {
        ColorPrinter.Green("[BlacksmithHandler] Initialized");
    }

    /// <summary>Singleton. 1:1 get_blacksmith_handler.</summary>
    public static BlacksmithHandler Instance => LazyInstance.Value;

    /// <summary>Click sidebar tab then the salvage button. 1:1 handle_salvage_operation.</summary>
    public bool HandleSalvageOperation()
    {
        ColorPrinter.Blue("\n[BlacksmithHandler] Starting salvage operation...");
        var shared = GameInterfaceData.Instance;
        var (ox, oy) = shared.WindowOffset;
        ColorPrinter.Blue("[BlacksmithHandler] Step 1: Clicking sidebar tab...");
        if (!ClickSidebarTab(shared, ox, oy))
        {
            ColorPrinter.Red("[BlacksmithHandler] Failed to click sidebar tab");
            return false;
        }
        Thread.Sleep(AfterSidebarTabMs);
        ColorPrinter.Blue("[BlacksmithHandler] Step 2: Clicking salvage button...");
        if (!ClickSalvageButton(shared, ox, oy))
        {
            ColorPrinter.Red("[BlacksmithHandler] Failed to click salvage button");
            return false;
        }
        ColorPrinter.Green("[BlacksmithHandler] Salvage operation completed");
        return true;
    }

    /// <summary>Match blacksmith_sidebar_tab_1/2 on the shared image and click the first found. 1:1 _click_sidebar_tab.</summary>
    private bool ClickSidebarTab(GameInterfaceData shared, int ox, int oy)
    {
        using var image = shared.CloneGameWindowImage();
        if (image == null)
        {
            ColorPrinter.Red("[BlacksmithHandler] No game window image in shared data");
            return false;
        }
        foreach (var tab in SidebarTabTemplates)
        {
            ColorPrinter.Blue($"[BlacksmithHandler] Trying {tab}...");
            var match = _matcher.MatchTemplate(image, tab).FirstMatch;
            if (match == null) continue;
            int x = match.CenterX + ox, y = match.CenterY + oy;
            ColorPrinter.Green($"[BlacksmithHandler] Found {tab} at ({match.CenterX}, {match.CenterY})");
            ColorPrinter.Blue($"[BlacksmithHandler] Clicking at screen: ({x}, {y})");
            ClickDirect(x, y);
            return true;
        }
        ColorPrinter.Red("[BlacksmithHandler] No sidebar tab matched");
        return false;
    }

    /// <summary>
    /// Click the scaled salvage button. 1:1 _click_salvage_button.
    /// Fixes Python bug: get_scaled_blacksmith_salvage_button was not imported, so the NameError was caught and the step always failed.
    /// </summary>
    private bool ClickSalvageButton(GameInterfaceData shared, int ox, int oy)
    {
        var (w, h) = shared.GameWindowSize;
        if (w == 0 && h == 0)
        {
            ColorPrinter.Red("[BlacksmithHandler] No game window size information");
            return false;
        }
        ColorPrinter.Blue($"[BlacksmithHandler] Using scaled coordinates for window size: {w}x{h}");
        var (bx, by) = D3StandardCoordinates.GetScaledBlacksmithSalvageButton();
        int x = bx + ox, y = by + oy;
        ColorPrinter.Green($"[BlacksmithHandler] Calculated salvage button at game window: ({bx}, {by})");
        ColorPrinter.Blue($"[BlacksmithHandler] Clicking at screen: ({x}, {y})");
        ClickDirect(x, y);
        return true;
    }

    /// <summary>
    /// Hover each gear slot once to read its tier (primal/ancient/normal), then salvage per keep rule
    /// (keep_ancient_plus keeps ancient+, keep_primal keeps primal only; rare/magic/non-legendary always salvaged). 1:1 handle_auto_salvage_by_slots.
    /// </summary>
    public bool HandleAutoSalvageBySlots(string keep, bool debugOnly = false)
    {
        var shared = GameInterfaceData.Instance;
        if (!HasBagLayout(shared, "auto salvage")) return false;
        if (debugOnly)
        {
            ColorPrinter.Gray($"[BlacksmithHandler] Salvage preview (debug_only): {GearSlots(shared).Count} slots to scan (hover each then decide)");
            return true;
        }

        var (ox, oy) = shared.WindowOffset;
        var ui = D3StandardCoordinates.GetScaledBlacksmithUiCoords();
        var (tabX, tabY) = ui[D3StandardCoordinates.KeyTabSalvageMaterials];
        var (salvageX, salvageY) = ui[D3StandardCoordinates.KeySalvageDialogSalvageButton];
        var (confirmX, confirmY) = ui[D3StandardCoordinates.KeySalvageDialogConfirm];

        ClickDirect(ox + tabX, oy + tabY);
        Thread.Sleep(AfterSalvageTabMs);

        int salvaged = 0;
        ForEachGearSlotTier(shared, null, (slotX, slotY, info, tier) =>
        {
            if (!ShouldSalvage(info.Quality, tier, keep)) return;
            ClickDirect(slotX, slotY);
            Thread.Sleep(AfterSlotClickMs);
            ClickDirect(ox + salvageX, oy + salvageY);
            Thread.Sleep(AfterSalvageButtonMs);
            ClickDirect(ox + confirmX, oy + confirmY);
            Thread.Sleep(AfterConfirmMs);
            salvaged++;
        });
        ColorPrinter.Green($"[BlacksmithHandler] Auto salvage by slots completed (salvaged {salvaged})");
        return true;
    }

    /// <summary>
    /// Salvage the items in the given backpack cells (row, column; top cell of each item) with the same click sequence as auto salvage:
    /// salvage tab, then per item: item, salvage button, confirm. Needs the bag coordinates (fresh capture); returns the cells clicked.
    /// </summary>
    public int SalvageCells(IReadOnlyList<(int Row, int Col)> cells, Func<bool>? shouldStop = null)
    {
        var shared = GameInterfaceData.Instance;
        var coords = shared.BagCoordinates;
        if (coords == null)
        {
            ColorPrinter.Red("[BlacksmithHandler] No bag coordinates for salvage by cells");
            return 0;
        }
        var (ox, oy) = shared.WindowOffset;
        var ui = D3StandardCoordinates.GetScaledBlacksmithUiCoords();
        var (tabX, tabY) = ui[D3StandardCoordinates.KeyTabSalvageMaterials];
        var (salvageX, salvageY) = ui[D3StandardCoordinates.KeySalvageDialogSalvageButton];
        var (confirmX, confirmY) = ui[D3StandardCoordinates.KeySalvageDialogConfirm];
        ClickDirect(ox + tabX, oy + tabY);
        Thread.Sleep(AfterSalvageTabMs);
        int done = 0;
        foreach (var (row, col) in cells)
        {
            if (shouldStop?.Invoke() == true || row < 0 || col < 0 || row >= coords.Rows || col >= coords.Cols) continue;
            var (x, y) = coords.SlotCenter(row, col);
            ClickDirect(ox + x, oy + y);
            Thread.Sleep(AfterSlotClickMs);
            ClickDirect(ox + salvageX, oy + salvageY);
            Thread.Sleep(AfterSalvageButtonMs);
            ClickDirect(ox + confirmX, oy + confirmY);
            Thread.Sleep(AfterConfirmMs);
            done++;
        }
        ColorPrinter.Green($"[BlacksmithHandler] Salvage by cells completed ({done} of {cells.Count})");
        return done;
    }

    /// <summary>True when the shared bag coordinates and layout are present; logs the failing feature otherwise.</summary>
    public static bool HasBagLayout(GameInterfaceData shared, string feature)
    {
        if (shared.BagCoordinates != null && shared.BagLayout is { Items.Count: > 0 }) return true;
        ColorPrinter.Red($"[BlacksmithHandler] No bag coordinates/layout for {feature}");
        return false;
    }

    /// <summary>Occupied gear slots (top cell of each item) in row-major order.</summary>
    public static List<(int R, int C, BagItemInfo Info)> GearSlots(GameInterfaceData shared)
    {
        var slots = new List<(int R, int C, BagItemInfo Info)>();
        var coords = shared.BagCoordinates;
        var layout = shared.BagLayout;
        if (coords == null || layout == null) return slots;
        for (int r = 0; r < coords.Rows; r++)
            for (int c = 0; c < coords.Cols; c++)
                if (layout.Items.TryGetValue((r, c), out var info) && info.Type is BagSlotValues.TypeItem1Slot or BagSlotValues.TypeItem2Slot)
                    slots.Add((r, c, info));
        return slots;
    }

    /// <summary>
    /// Hover every gear slot, read its legendary tier from the hover line and call onSlot(screenX, screenY, info, tier).
    /// shouldStop is polled before each slot. Shared by auto salvage and drop equipment.
    /// </summary>
    public void ForEachGearSlotTier(GameInterfaceData shared, Func<bool>? shouldStop, Action<int, int, BagItemInfo, string> onSlot)
    {
        foreach (var (r, c, info) in GearSlots(shared))
        {
            if (shouldStop?.Invoke() == true) return;
            var read = ReadSlotTier(shared, r, c);
            if (read != null) onSlot(read.Value.ScreenX, read.Value.ScreenY, info, read.Value.Tier);
        }
    }

    /// <summary>Hover bag slot (r, c) and read its legendary tier (primal / ancient / normal) from the hover line; null when the region cannot be captured.</summary>
    public (int ScreenX, int ScreenY, string Tier)? ReadSlotTier(GameInterfaceData shared, int r, int c)
    {
        var coords = shared.BagCoordinates;
        if (coords == null) return null;
        var (ox, oy) = shared.WindowOffset;
        var topLeft = coords.TopLeft;
        double slotWidth = coords.Width / (double)coords.Cols;
        double slotHeight = coords.Height / (double)coords.Rows;
        var (windowW, windowH) = shared.GameWindowSize;
        if (windowW <= 0 || windowH <= 0)
        {
            using var img = shared.CloneGameWindowImage();
            (windowW, windowH) = img != null ? (img.Width, img.Height) : (FallbackWindowWidth, FallbackWindowHeight);
        }
        int slotX = (int)(ox + topLeft.X + (c + 0.5) * slotWidth);
        int slotY = (int)(oy + topLeft.Y + (r + 0.5) * slotHeight);
        _click.MoveMouse(slotX, slotY, HoverMoveDurationSec);
        Thread.Sleep(HoverSettleMs);
        var (xMin, yMin, xMax, yMax, leftEdgeX, centerY) = DebugBagHover.SearchRegionBounds(topLeft, slotWidth, slotHeight, r, c, windowW, windowH);
        int regionW = xMax - xMin, regionH = yMax - yMin;
        if (regionW <= 0 || regionH <= 0) return null;
        using var regionBmp = ScreenCaptureService.GetScreenshotProvider().CaptureRegion(ox + xMin, oy + yMin, regionW, regionH);
        if (regionBmp == null) return null;
        using var crop = ImageConvert.NormalizeToBgr(regionBmp);
        var line = SlotQuality.FindLineInCrop(crop, leftEdgeX - xMin, centerY - yMin, SearchLengthRatio * slotWidth);
        string tier = line.Kind == SlotQuality.KindOrange && line.Height != null ? BagSlotValues.TierPrimal
            : line.Kind == SlotQuality.KindAncient && line.Height != null ? BagSlotValues.TierAncient
            : BagSlotValues.TierNormal;
        return (slotX, slotY, tier);
    }

    /// <summary>Salvage decision by quality, tier and keep rule. 1:1 inline rule in handle_auto_salvage_by_slots.</summary>
    public static bool ShouldSalvage(string quality, string tier, string keep)
    {
        if (quality is BagSlotValues.QualityRare or BagSlotValues.QualityMagic) return true;
        if (quality is not (BagSlotValues.QualityLegendarySet or BagSlotValues.QualityLegendary)) return true;
        if (keep == KeepAncientPlus) return tier == BagSlotValues.TierNormal;
        return tier is BagSlotValues.TierNormal or BagSlotValues.TierAncient;
    }

    public void ClickDirect(int x, int y) =>
        _click.Click(x, y, MouseButton.Left, StateAwareClickHandler.ClickMoveDurationSec, returnToOriginal: true, directClick: true,
            pauseAfterMove: StateAwareClickHandler.ClickPauseAfterMoveSec);
}
