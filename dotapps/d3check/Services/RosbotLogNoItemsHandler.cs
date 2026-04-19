using DotApps.d3check.Config;
using DotApps.d3check.Config.Options;
using DotApps.d3check.Core;
using DotCore.Foundations;

namespace DotApps.d3check.Services;

/// <summary>
/// No items / Vendor loop done lines. 1:1 Python LogAnalyzer._on_no_items_popup (full UI automation TODO).
/// </summary>
public static class RosbotLogNoItemsHandler
{
    public static void OnLine(string line)
    {
        if (!line.Contains("No items", StringComparison.Ordinal) && !line.Contains("Vendor loop done", StringComparison.Ordinal))
            return;
        string? rosDir = ConfigOptionsProvider.GetOptions<RosSettingsOptions>().RosDirectory;
        if (string.IsNullOrWhiteSpace(rosDir))
            return;
        var det = RosbotDetection.GetDetection(rosDir, RosbotConstants.DefaultRosbotExeName);
        if (det.Status == "not_found")
            return;
        ColorPrinter.Blue("[LogAnalyzer] No items / Vendor loop done detected (Dot: wire try_close_no_items + switch rift like Python rosbot_ui_automation when needed).");
    }
}
