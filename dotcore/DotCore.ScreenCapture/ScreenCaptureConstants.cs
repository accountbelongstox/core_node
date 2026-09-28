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
}
