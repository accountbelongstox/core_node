using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.I18n;
using DotCore.ScreenCapture;
using DotCore.Utils.ImagePreprocess;
using OpenCvSharp;

namespace DotApps.d3d4tester.Windows.CoordinatePicker;

/// <summary>
/// Capture the current client window (Battle.net / D3 / D4) to memory: activate it, wait 350 ms, grab its screen rectangle as BGR.
/// 1:1 Python coordinate_calibration_panel._capture_for_client + WindowScreenshot.capture_first_window_to_memory.
/// </summary>
public static class ClientWindowCapture
{
    private const int ActivateSettleMs = 350;

    /// <summary>(image, null) or (null, i18n error). The caller owns the returned Mat.</summary>
    public static (Mat? Image, string? Error) Capture(Func<IntPtr> findWindow)
    {
        var hwnd = findWindow();
        if (hwnd != IntPtr.Zero)
        {
            ScreenCaptureService.ActivateWindow(hwnd);
            Thread.Sleep(ActivateSettleMs);
            using var bitmap = ScreenCaptureService.GetScreenshotProvider().CaptureWindow(hwnd);
            if (bitmap != null)
                return (ImageConvert.NormalizeToBgr(bitmap), null);
        }
        return (null, D3D4TesterI18n.Provider.GetUiText(I18nKeys.CoordCalNoGameWindow));
    }
}
