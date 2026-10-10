// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/kanai/operations.py
// PY-REF: dotapps/d3d4tester/reference/py_d3check/providor/constants/d3.py
using DotCore.Foundations;

namespace DotApps.d3d4tester.Core.Kanai;

/// <summary>
/// Kanai Cube operations: right panel toggle, reset to first page, navigate to a recipe page (reforge confirmed by its footer).
/// 1:1 Python dotapps/d3d4tester/reference/py_d3check/d3utils/kanai/operations.py (KANAI_*_PAGE_CLICKS from providor/constants/d3.py);
/// process_yellow_items / run_upgrade_operation are replaced by <see cref="KanaiUpgradeHunter"/>.
/// </summary>
public static class KanaiOperations
{
    public const int UpgradePageClicks = 2;
    public const int ReforgePageClicks = 1;
    private const int ReforgePageAttempts = 2;

    private const double ToggleClickDurationSec = 0.1;
    private const double NavClickDurationSec = 0.1;
    private const int AfterToggleMs = 500;
    private const int BetweenTogglesMs = 300;
    private const int AfterPageClickMs = 300;

    /// <summary>
    /// Read the recipe panel state from a fresh capture (opened when its header or page bar matches) into the shared state; null
    /// when the D3 window cannot be captured (state left as tracked).
    /// </summary>
    public static bool? RefreshRightPanelState(GameInterfaceData shared)
    {
        var sd = D3Manager.Instance.CaptureGameWindow();
        if (sd?.GameWindowImage is not { } image) return null;
        shared.UpdateFromScreenshot(sd);
        bool opened = D3InterfaceDetection.IsKanaiRecipePanelOpened(image);
        shared.KanaiRightPageOpened = opened;
        ColorPrinter.Gray($"[Kanai] recipe panel opened={opened} (template)");
        return opened;
    }

    /// <summary>Screen position of a Kanai button: its template on the shared capture, else the scaled standard coordinate.</summary>
    private static (int X, int Y) LocateButton(GameInterfaceData shared, string templateName, (int X, int Y) scaledFallback)
    {
        var (ox, oy) = shared.WindowOffset;
        using var image = shared.CloneGameWindowImage();
        if (image != null && D3TemplateProbe.Match(image, templateName) is { } m) return (m.CenterX + ox, m.CenterY + oy);
        return (scaledFallback.X + ox, scaledFallback.Y + oy);
    }

    /// <summary>
    /// Click the right panel toggle (recipe book icon by template, else the standard coordinate), then read the new panel state from
    /// the screen; the tracked state is only flipped when no capture is possible. 1:1 _click_right_panel_toggle.
    /// </summary>
    private static bool ClickRightPanelToggle(GameInterfaceData shared)
    {
        var (x, y) = LocateButton(shared, D3TemplateNames.KanaiRightPanelToggleIcon, D3StandardCoordinates.GetScaledKanaiRightPanelToggle());
        if (!StateAwareClickHandler.Instance.LeftClick(x, y, ToggleClickDurationSec))
            return false;
        Thread.Sleep(AfterToggleMs);
        if (RefreshRightPanelState(shared) == null && shared.KanaiRightPageOpened is { } opened)
            shared.KanaiRightPageOpened = !opened;
        return true;
    }

    /// <summary>Reset the right panel to its first page and keep it opened; an unknown panel state is read from the screen first. 1:1 reset_panel_to_first_page.</summary>
    public static bool ResetPanelToFirstPage(GameInterfaceData shared)
    {
        var opened = shared.KanaiRightPageOpened ?? RefreshRightPanelState(shared);
        if (opened == null) return false;
        if (opened == false) return ClickRightPanelToggle(shared);
        if (!ClickRightPanelToggle(shared)) return false;
        Thread.Sleep(BetweenTogglesMs);
        return ClickRightPanelToggle(shared);
    }

    /// <summary>Click next page (arrow by template, else the standard coordinate) pageClicks times from the first page. 1:1 navigate_to_page.</summary>
    public static bool NavigateToPage(GameInterfaceData shared, int pageClicks)
    {
        if (shared.KanaiRightPageOpened != true) return false;
        var (x, y) = LocateButton(shared, D3TemplateNames.KanaiNextPageIcon, D3StandardCoordinates.GetScaledKanaiNextPageButton());
        var click = StateAwareClickHandler.Instance;
        for (int i = 0; i < pageClicks; i++)
        {
            if (AssistantExecutionState.Instance.ShouldStopAssistant()) return false;
            if (!click.LeftClick(x, y, NavClickDurationSec)) return false;
            Thread.Sleep(AfterPageClickMs);
        }
        return true;
    }

    /// <summary>
    /// Go to the reforge recipe page and confirm it by its page footer template; one more reset + navigate when it does not show.
    /// False only when the panel cannot be reset / navigated; an unconfirmed page (other client language) is logged and accepted.
    /// </summary>
    public static bool GoToReforgePage(GameInterfaceData shared)
    {
        for (int attempt = 0; attempt < ReforgePageAttempts; attempt++)
        {
            if (!ResetPanelToFirstPage(shared) || !NavigateToPage(shared, ReforgePageClicks)) return false;
            if (D3TemplateProbe.CaptureAndMatchAny(false, D3TemplateNames.KanaiReforgePageIndicator) != null)
            {
                ColorPrinter.Green("[Kanai] reforge recipe page confirmed");
                return true;
            }
            ColorPrinter.Yellow($"[Kanai] reforge recipe page not confirmed by template (attempt {attempt + 1}/{ReforgePageAttempts})");
        }
        ColorPrinter.Yellow("[Kanai] reforge page footer never matched (client language differs from the template?), continue on the navigated page");
        return true;
    }

}
