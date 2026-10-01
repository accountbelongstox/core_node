using DotApps.d3d4tester.Core.Bag;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Core.Kanai;

/// <summary>
/// Kanai Cube operations: right panel toggle, reset to first page, navigate, process rare items, upgrade/reforge.
/// 1:1 Python pyapps/d3-check/d3utils/kanai/operations.py (KANAI_*_PAGE_CLICKS from providor/constants/d3.py).
/// </summary>
public static class KanaiOperations
{
    public const int UpgradePageClicks = 2;
    public const int ReforgePageClicks = 1;

    private const double ToggleClickDurationSec = 0.1;
    private const double NavClickDurationSec = 0.1;
    private const double ItemClickDurationSec = 0;
    private const int AfterToggleMs = 500;
    private const int BetweenTogglesMs = 300;
    private const int AfterPageClickMs = 300;
    private const int AfterRightClickMs = 300;
    private const int AfterPutMaterialMs = 300;
    private const int ConversionWaitMs = 2000;
    private const int AfterSecondConversionMs = 500;

    /// <summary>Click the right panel toggle and flip the tracked opened state. 1:1 _click_right_panel_toggle.</summary>
    private static bool ClickRightPanelToggle(GameInterfaceData shared)
    {
        var (ox, oy) = shared.WindowOffset;
        var (bx, by) = D3StandardCoordinates.GetScaledKanaiRightPanelToggle();
        if (!StateAwareClickHandler.Instance.LeftClick(bx + ox, by + oy, ToggleClickDurationSec))
            return false;
        if (shared.KanaiRightPageOpened is { } opened)
            shared.KanaiRightPageOpened = !opened;
        Thread.Sleep(AfterToggleMs);
        return true;
    }

    /// <summary>Reset the right panel to its first page and keep it opened. 1:1 reset_panel_to_first_page.</summary>
    public static bool ResetPanelToFirstPage(GameInterfaceData shared)
    {
        var opened = shared.KanaiRightPageOpened;
        if (opened == null) return false;
        if (opened == false) return ClickRightPanelToggle(shared);
        if (!ClickRightPanelToggle(shared)) return false;
        Thread.Sleep(BetweenTogglesMs);
        return ClickRightPanelToggle(shared);
    }

    /// <summary>Click next page pageClicks times from the first page. 1:1 navigate_to_page.</summary>
    public static bool NavigateToPage(GameInterfaceData shared, int pageClicks)
    {
        if (shared.KanaiRightPageOpened != true) return false;
        var (ox, oy) = shared.WindowOffset;
        var (bx, by) = D3StandardCoordinates.GetScaledKanaiNextPageButton();
        var click = StateAwareClickHandler.Instance;
        for (int i = 0; i < pageClicks; i++)
        {
            if (AssistantExecutionState.Instance.ShouldStopAssistant()) return false;
            if (!click.LeftClick(bx + ox, by + oy, NavClickDurationSec)) return false;
            Thread.Sleep(AfterPageClickMs);
        }
        return true;
    }

    /// <summary>For each rare item: right-click -> put material -> conversion -> wait 2 s -> conversion. 1:1 process_yellow_items.</summary>
    public static bool ProcessYellowItems(GameInterfaceData shared)
    {
        var layout = shared.BagLayout;
        var bag = shared.BagCoordinates;
        if (layout == null || bag == null) return false;
        var (ox, oy) = shared.WindowOffset;
        var (mx, my) = D3StandardCoordinates.GetScaledKanaiPutMaterialButton();
        var (cx, cy) = D3StandardCoordinates.GetScaledConversionButton();
        var rareItems = layout.Items.Where(kv => kv.Value.Quality == BagSlotValues.QualityRare).Select(kv => kv.Key).ToList();
        if (rareItems.Count == 0)
        {
            ColorPrinter.Gray("[Kanai] No rare (yellow) items to process");
            return true;
        }
        var click = StateAwareClickHandler.Instance;
        foreach (var (row, col) in rareItems)
        {
            if (AssistantExecutionState.Instance.ShouldStopAssistant()) return false;
            var (sx, sy) = bag.SlotCenter(row, col);
            if (!click.RightClick(sx + ox, sy + oy, ItemClickDurationSec)) continue;
            Thread.Sleep(AfterRightClickMs);
            if (!click.LeftClick(mx + ox, my + oy, ItemClickDurationSec)) continue;
            Thread.Sleep(AfterPutMaterialMs);
            if (!click.LeftClick(cx + ox, cy + oy, ItemClickDurationSec)) continue;
            Thread.Sleep(ConversionWaitMs);
            if (!click.LeftClick(cx + ox, cy + oy, ItemClickDurationSec)) continue;
            Thread.Sleep(AfterSecondConversionMs);
        }
        return true;
    }

    /// <summary>Validate -> reset panel -> navigate to upgrade page -> process rare items. 1:1 run_upgrade_operation.</summary>
    public static bool RunUpgradeOperation(GameInterfaceData shared) => RunPageOperation(shared, UpgradePageClicks);

    /// <summary>Validate -> reset panel -> navigate to reforge page -> process rare items. 1:1 run_reforge_operation.</summary>
    public static bool RunReforgeOperation(GameInterfaceData shared) => RunPageOperation(shared, ReforgePageClicks);

    private static bool RunPageOperation(GameInterfaceData shared, int pageClicks)
    {
        if (shared.InterfaceType != D3InterfaceDetection.InterfaceKanaiCube)
        {
            ColorPrinter.Red("[Kanai] interface_type is not kanai_cube");
            return false;
        }
        if (shared.BagLayout == null)
        {
            ColorPrinter.Red("[Kanai] No bag layout");
            return false;
        }
        if (!ResetPanelToFirstPage(shared)) return false;
        if (!NavigateToPage(shared, pageClicks)) return false;
        return ProcessYellowItems(shared);
    }
}
