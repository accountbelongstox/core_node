// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/log_analyzer.py
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Flow;

namespace DotApps.d3d4tester.Services;

/// <summary>
/// "No items" / "Vendor loop done" log lines: close the D3-must-be-launched dialog, then the No items popup; when the
/// popup closed, switch ROSBOT to rift mode and start. 1:1 Python LogAnalyzer._on_no_items_popup / _close_no_items_popup_and_switch_rift.
/// </summary>
public static class RosbotLogNoItemsHandler
{
    private const string NoItemsMarker = "No items";
    private const string VendorLoopDoneMarker = "Vendor loop done";
    private const string LeaseNoItems = "ROSBOT no-items restart";
    private const int LeaseWaitMs = 10000;

    public static void OnLine(string line)
    {
        if (!line.Contains(NoItemsMarker, StringComparison.Ordinal) && !line.Contains(VendorLoopDoneMarker, StringComparison.Ordinal))
            return;
        if (RosbotManager.Instance.GetDetection().Status == RosbotDetection.StatusNotFound)
            return;
        if (!GameControl.Allowed(LeaseNoItems, needsMonitoring: true))
            return;
        using var lease = GameControl.TryAcquire(LeaseNoItems, LeaseWaitMs);
        if (lease != null) RosbotUiAutomation.HandleStartupPopups();
    }
}
