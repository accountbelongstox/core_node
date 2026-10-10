// PY-REF: dotapps/d3d4tester/reference/py_d3check/ui/components/coordinate_picker_window.py
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.Services;
using DotCore.ScreenCapture;
using DotCore.Utils.ImagePreprocess;
using OpenCvSharp;

namespace DotApps.d3d4tester.Windows.CoordinatePicker;

/// <summary>
/// Capture the current client window (Battle.net / D3 / D4) to memory off the UI thread: D3 through D3Manager.CaptureGameWindow (activate first),
/// others activate through their manager (which settles; Battle.net waits here), then grab the window as BGR.
/// 1:1 Python coordinate_calibration_panel._capture_for_client + WindowScreenshot.capture_first_window_to_memory.
/// </summary>
public static class ClientWindowCapture
{
    /// <summary>(image, null) or (null, i18n error). The caller owns the returned Mat.</summary>
    public static async Task<(Mat? Image, string? Error)> CaptureAsync(string clientType)
    {
        var image = clientType == AppConstants.ClientTypeD3Game
            ? await Task.Run(CaptureD3)
            : await CaptureOtherAsync(clientType);
        return image != null ? (image, null) : (null, D3D4TesterI18n.Provider.GetUiText(I18nKeys.CoordCalNoGameWindow));
    }

    private static Mat? CaptureD3()
    {
        var sd = D3Manager.Instance.CaptureGameWindow(activateFirst: true);
        if (sd?.GameWindowImage == null) return null;
        try
        {
            return ImageConvert.NormalizeToBgr(sd.GameWindowImage);
        }
        finally
        {
            sd.GameWindowImage.Dispose();
            sd.FullscreenImage?.Dispose();
        }
    }

    private static async Task<Mat?> CaptureOtherAsync(string clientType)
    {
        if (!await Task.Run(() => YoloCalibrationData.ActivateClientWindow(clientType))) return null;
        if (clientType == AppConstants.ClientTypeBattlenet)
            await Task.Delay(D3InterfaceConstants.ActivateBeforeCaptureDelayMs);
        return await Task.Run(() =>
        {
            var hwnd = YoloCalibrationData.FindClientWindow(clientType);
            if (hwnd == IntPtr.Zero) return null;
            using var bitmap = ScreenCaptureService.GetScreenshotProvider().CaptureWindow(hwnd);
            return bitmap != null ? ImageConvert.NormalizeToBgr(bitmap) : null;
        });
    }
}
