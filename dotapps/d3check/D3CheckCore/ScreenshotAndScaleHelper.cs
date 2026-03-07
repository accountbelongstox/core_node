using DotCore.ScreenCapture;

namespace DotApps.d3check.Core;

/// <summary>
/// After capturing game window, call UpdateGlobalScale so template matching and scaled click use correct scale.
/// 1:1 with PY: ScreenshotProvider.gen() then update_global_scale(width, height).
/// </summary>
public static class ScreenshotAndScaleHelper
{
    /// <summary>Capture via provider.Gen(gameWindowHwnd); when GameWindowSize is set, call UpdateGlobalScale. Returns screenshot data or null.</summary>
    public static ScreenshotData? CaptureGameWindowAndUpdateScale(IntPtr? gameWindowHwnd)
    {
        var provider = ScreenCaptureService.GetScreenshotProvider();
        var data = provider.Gen(gameWindowHwnd);
        if (data?.GameWindowSize != null)
        {
            var (gw, gh) = data.GameWindowSize.Value;
            var (fw, fh) = data.FullscreenSize;
            GameInterfaceData.Instance.UpdateGlobalScale(gw, gh, fw, fh);
        }
        return data;
    }
}
