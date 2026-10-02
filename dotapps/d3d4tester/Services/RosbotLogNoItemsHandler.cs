using DotApps.d3d4tester.Core;

namespace DotApps.d3d4tester.Services;

/// <summary>
/// "No items" / "Vendor loop done" log lines: close the D3-must-be-launched dialog, then the No items popup; when the
/// popup closed, switch ROSBOT to rift mode and start. 1:1 Python LogAnalyzer._on_no_items_popup / _close_no_items_popup_and_switch_rift.
/// </summary>
public static class RosbotLogNoItemsHandler
{
    private const string NoItemsMarker = "No items";
    private const string VendorLoopDoneMarker = "Vendor loop done";

    public static void OnLine(string line)
    {
        if (!line.Contains(NoItemsMarker, StringComparison.Ordinal) && !line.Contains(VendorLoopDoneMarker, StringComparison.Ordinal))
            return;
        if (RosbotManager.Instance.GetDetection().Status == RosbotDetection.StatusNotFound)
            return;
        RosbotUiAutomation.TryCloseD3MustBeLaunchedDialog();
        if (RosbotUiAutomation.TryCloseNoItemsPopup())
            RosbotUiAutomation.DoAfterNoItemsCloseSwitchRiftAndStart();
    }
}
