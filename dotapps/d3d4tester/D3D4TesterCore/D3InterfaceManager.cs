// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/interface_manager.py
using DotApps.d3d4tester.Core.Bag;
using DotCore.Foundations;
using DotCore.Utils;

namespace DotApps.d3d4tester.Core;

/// <summary>
/// Coordinates UI region and bag collectors over shared GameInterfaceData. 1:1 Python dotapps/d3d4tester/reference/py_d3check/d3utils/interface_manager.py
/// (collect_ui_info, collect_bag_info_quik, collect_bag_info_from_current_shared, get_window_offset, print_summary; *_anchor variants are unused and not ported).
/// </summary>
public sealed class D3InterfaceManager
{
    private const ushort VkI = 0x49;
    private const int AfterBagKeyMs = 400;
    private const string Separator = "============================================================";

    private static readonly Lazy<D3InterfaceManager> LazyInstance = new(() => new D3InterfaceManager());

    private D3InterfaceManager()
    {
        ColorPrinter.Green("[D3InterfaceManager] Initialized");
    }

    /// <summary>Singleton. 1:1 get_d3_interface_manager.</summary>
    public static D3InterfaceManager Instance => LazyInstance.Value;

    /// <summary>Capture D3 window and update UI region in shared data. 1:1 collect_ui_info.</summary>
    public UiRegion? CollectUiInfo(bool forceNewCapture = true, bool saveScreenshot = false)
    {
        ColorPrinter.Blue("[InterfaceManager] Collecting UI...");
        var region = D3AssistantCapture.CollectUiRegion(forceNewCapture, saveScreenshot);
        if (region == null)
        {
            ColorPrinter.Red("[InterfaceManager] Failed to collect UI info");
            return null;
        }
        ColorPrinter.Green($"[InterfaceManager] UI region ({region.X},{region.Y}) {region.Width}x{region.Height} offset ({region.UiOffsetX},{region.UiOffsetY})");
        return region;
    }

    /// <summary>Refresh UI capture then detect bag; when no bag, send I to D3 and retry once. 1:1 collect_bag_info_quik.</summary>
    public BagCoordinates? CollectBagInfoQuik(bool forceRefresh = false, bool saveScreenshot = false, bool forceNewCapture = true)
    {
        ColorPrinter.Blue("\n" + Separator);
        ColorPrinter.Blue("[InterfaceManager] Collecting Bag Information (Optimized)");
        ColorPrinter.Blue(Separator);
        ColorPrinter.Yellow("[InterfaceManager] Refreshing screen data and UI region...");
        if (CollectUiInfo(forceNewCapture: true, saveScreenshot) == null)
        {
            ColorPrinter.Red("[InterfaceManager] Failed to collect UI region");
            return null;
        }
        var collector = BagInfoCollector.Instance;
        var bag = collector.Collect(forceRefresh || forceNewCapture, saveScreenshot);
        if (bag == null)
        {
            ColorPrinter.Yellow("[InterfaceManager] No bag data: send I to D3 and retry once");
            if (D3Manager.Instance.SendKeyToWindow(VkI))
            {
                Thread.Sleep(AfterBagKeyMs);
                if (CollectUiInfo(forceNewCapture: true, saveScreenshot) != null)
                    bag = collector.Collect(forceRefresh: true, saveScreenshot);
            }
            if (bag == null)
            {
                ColorPrinter.Red("[InterfaceManager] Failed to collect bag info");
                return null;
            }
        }
        ColorPrinter.Green("[InterfaceManager] Quick bag detection completed successfully");
        ColorPrinter.Green($"  Top-left: ({bag.TopLeft.X}, {bag.TopLeft.Y})");
        ColorPrinter.Green($"  Bottom-right: ({bag.BottomRight.X}, {bag.BottomRight.Y})");
        ColorPrinter.Green($"  Grid: {bag.Rows}x{bag.Cols} ({bag.TotalSlots} slots)");
        return bag;
    }

    /// <summary>Detect bag/interface from the already captured shared game window image (no new capture). 1:1 collect_bag_info_from_current_shared.</summary>
    public BagCoordinates? CollectBagInfoFromCurrentShared(bool saveScreenshot = false)
    {
        if (!GameInterfaceData.Instance.HasGameWindowImage)
        {
            ColorPrinter.Red("[InterfaceManager] No game_window_image in shared data; call collect_ui_info first");
            return null;
        }
        return BagInfoCollector.Instance.Collect(forceRefresh: true, saveScreenshot);
    }

}
