// PY-REF: dotapps/d3d4tester/reference/py_d3check/controller/d4func/screenshot_handler.py
using DotCore.Foundations;
using DotCore.ScreenCapture;
using DotCore.Utils.ImagePreprocess;

namespace DotApps.d3d4tester.Core.D4;

/// <summary>
/// D4 capture: find the D4 window by title, capture it (window-only) and fill the window/screenshot fields.
/// 1:1 Python dotapps/d3d4tester/reference/py_d3check/controller/d4func/screenshot_handler.py. The game window image is copied into
/// <see cref="D4InterfaceData"/> so a later shared-provider capture (D3) cannot dispose it.
/// </summary>
public sealed class D4ScreenshotHandler
{
    private const string LogPrefix = "[ScreenshotHandler]";

    private static readonly Lazy<D4ScreenshotHandler> LazyInstance = new(() => new D4ScreenshotHandler());

    private D4ScreenshotHandler()
    {
        ColorPrinter.Blue($"{LogPrefix} Initialized");
    }

    public static D4ScreenshotHandler Instance => LazyInstance.Value;

    /// <summary>Capture the D4 window and update the shared data. 1:1 capture_and_collect_info.</summary>
    public D4CaptureResult CaptureAndCollectInfo(D4InterfaceData data)
    {
        ColorPrinter.Blue($"{LogPrefix} Capturing screenshot and collecting info...");
        var shot = ScreenCaptureService.GetScreenshotProvider().Gen(new ScreenCaptureOptions
        {
            WindowTitles = D4Constants.WindowTitles,
            WindowOnly = true,
        });
        if (shot == null)
        {
            ColorPrinter.Yellow($"{LogPrefix} Failed to capture screenshot");
            MarkWindowLost(data);
            return Fail(data, "capture failed");
        }
        if (shot.GameWindowSize is not { } size || shot.GameWindowImage == null)
        {
            MarkWindowLost(data);
            return Fail(data, "no game window");
        }

        var window = D4Manager.Instance.FindFirstWindow();
        data.GameRunning = true;
        data.WindowDetected = true;
        data.WindowHwnd = window?.Hwnd;
        data.WindowTitle = window?.Title ?? "";
        data.WindowPosition = shot.WindowOffset;
        data.SetGameWindowImage(ImageConvert.NormalizeToBgr(shot.GameWindowImage));
        data.GameWindowSize = size;
        data.FullscreenSize = shot.FullscreenSize;
        data.WindowOffset = shot.WindowOffset;
        data.Timestamp = DateTime.Now.ToString("o");
        bool windowed = data.IsWindowedMode();
        ColorPrinter.Blue($"{LogPrefix} Updated D4 data:");
        ColorPrinter.Blue($"  fullscreen_size: {data.FullscreenSize}");
        ColorPrinter.Blue($"  game_window_size: {data.GameWindowSize}");
        ColorPrinter.Blue($"  window_offset: {data.WindowOffset}");
        ColorPrinter.Blue($"  is_windowed: {windowed}");
        ColorPrinter.Green($"{LogPrefix} Screenshot captured and info collected");
        return new D4CaptureResult(true, data.GameWindowSize, data.FullscreenSize, data.WindowOffset, windowed);
    }

    /// <summary>Save the game window image as d4_exp_farming_&lt;ts&gt;.png; empty string on failure. 1:1 save_screenshot_to_disk.</summary>
    public string SaveScreenshotToDisk(D4InterfaceData data, string screenshotDir)
    {
        using var image = data.CloneGameWindowImage();
        if (image == null) return "";
        var path = D4ImageCrop.TimestampedPath(screenshotDir, D4Constants.ExpFarmingScreenshotPrefix);
        if (D4ImageCrop.Save(image, path, LogPrefix) == null) return "";
        ColorPrinter.Green($"{LogPrefix} Screenshot saved: {path}");
        return path;
    }

    private static void MarkWindowLost(D4InterfaceData data)
    {
        data.GameRunning = D4Manager.Instance.IsRunning();
        data.WindowDetected = false;
        data.WindowHwnd = null;
        data.WindowTitle = "";
        data.WindowPosition = (0, 0);
    }

    private static D4CaptureResult Fail(D4InterfaceData data, string error) =>
        new(false, data.GameWindowSize, data.FullscreenSize, data.WindowOffset, data.IsWindowedMode(), error);
}
