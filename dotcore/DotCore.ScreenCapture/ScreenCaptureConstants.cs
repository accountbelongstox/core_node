// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/screenshot_provider.py
namespace DotCore.ScreenCapture;

/// <summary>
/// Constants for screen capture. No magic literals in public API defaults; use these names.
/// </summary>
public static class ScreenCaptureConstants
{
    /// <summary>Default filename prefix when saving current screenshot (e.g. SaveCurrentScreenshot). Aligns with PY save_current_screenshot(prefix="d3").</summary>
    public const string DefaultSavePrefix = "d3";

    /// <summary>Default filename prefix for generic screenshot save (e.g. ScreenshotData.Save).</summary>
    public const string DefaultScreenshotPrefix = "screenshot";

    /// <summary>Timestamp format for saved filenames (e.g. 20250101_123456_789).</summary>
    public const string TimestampFormat = "yyyyMMdd_HHmmss_fff";

    /// <summary>File extension for saved screenshots.</summary>
    public const string DefaultImageExtension = "png";

    /// <summary>Settle delay after activating the target window before capture (ms). 1:1 Python ACTIVATE_BEFORE_CAPTURE_DELAY_SEC = 0.3.</summary>
    public const int ActivateBeforeCaptureDelayMs = 300;

    /// <summary>Settle delay after activating a minimized/off-screen window in window-only capture (ms). 1:1 Python time.sleep(1).</summary>
    public const int MinimizedActivateDelayMs = 1000;

    /// <summary>Rect left/top below this means minimized/off-screen. 1:1 Python _OFFSCREEN_THRESHOLD.</summary>
    public const int OffscreenThreshold = -30000;

    /// <summary>Window rect cache key prefix + lower-case first title. 1:1 Python ENCYCLOPEDIA "window_cache_{title}".</summary>
    public const string WindowCacheKeyPrefix = "window_cache_";
}
