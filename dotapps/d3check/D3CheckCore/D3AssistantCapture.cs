using DotCore.Foundations;
using DotCore.ScreenCapture;

namespace DotApps.d3check.Core;

/// <summary>
/// Helper for assistant macro: find D3 window and capture game window image. 1:1 with Python
/// collect_ui_info flow (D3Manager.find_windows -> ScreenshotProvider.gen -> update_global_scale).
/// Uses D3WindowFinder (config exe first, then title with browser/editor skip). Interface detection and collect_bag are separate.
/// </summary>
public static class D3AssistantCapture
{
    /// <summary>
    /// Find first D3 window handle. 1:1 Python D3Manager.find_windows: by config exe path then by title with skip.
    /// Returns IntPtr.Zero if not found. Call D3WindowFinder.SetConfigPathProvider from app before use.
    /// </summary>
    public static IntPtr FindD3WindowHandle() => D3WindowFinder.FindFirstHandle();

    /// <summary>
    /// Collect UI info: find D3 window, capture game window, update shared scale. 1:1 with Python
    /// collect_ui_info(force_new_capture=True) -> ScreenshotProvider.gen -> update_global_scale.
    /// Returns true if capture succeeded (game window image and scale updated).
    /// </summary>
    public static bool TryCollectUiInfo()
    {
        var hwnd = FindD3WindowHandle();
        if (hwnd == IntPtr.Zero)
        {
            ColorPrinter.Red("[AutoUseInterface] Step 1 failed: no D3 window found");
            return false;
        }
        var provider = ScreenCaptureService.GetScreenshotProvider();
        var data = provider.Gen(hwnd);
        if (data == null)
        {
            ColorPrinter.Red("[AutoUseInterface] Step 1 failed: screenshot capture returned null");
            return false;
        }
        if (data.GameWindowImage == null || !data.GameWindowSize.HasValue)
        {
            ColorPrinter.Red("[AutoUseInterface] Step 1 failed: no game window image or size");
            return false;
        }
        var (gw, gh) = data.GameWindowSize.Value;
        var (fw, fh) = data.FullscreenSize;
        GameInterfaceData.Instance.UpdateGlobalScale(gw, gh, fw, fh);
        ColorPrinter.Green($"[AutoUseInterface] Step 1 OK: D3 window captured {gw}x{gh}, scale updated");
        return true;
    }
}
