using System.Drawing;
using DotCore.Utils;

namespace DotCore.ScreenCapture;

/// <summary>
/// Options for <see cref="ScreenCaptureService.Gen(ScreenCaptureOptions)"/>. 1:1 Python pyapps/d3-check/d3utils/screenshot_provider.py
/// ScreenshotProvider.gen arguments (use_optimized_capture, window_titles, activate_d3_first, use_d3_rect_for_crop,
/// use_native_region_capture) with app-specific hooks (window lookup, activation, anchor locator) injected instead of D3 globals.
/// </summary>
public sealed record ScreenCaptureOptions
{
    /// <summary>Target window titles (first match wins).</summary>
    public IReadOnlyList<string>? WindowTitles { get; init; }

    /// <summary>Capture only the target window (no fullscreen image). 1:1 use_optimized_capture.</summary>
    public bool WindowOnly { get; init; }

    /// <summary>Activate the target window before capture. 1:1 activate_d3_first.</summary>
    public bool ActivateFirst { get; init; }

    /// <summary>In window-only mode, activate the target first when it is not the foreground window. 1:1 D3 optimized branch.</summary>
    public bool ActivateIfNotForeground { get; init; }

    /// <summary>Activate the window, then grab only its screen rect (rect cached). 1:1 use_native_region_capture.</summary>
    public bool NativeRegionCapture { get; init; }

    /// <summary>Fullscreen mode: crop the game window by the target window rect. 1:1 use_d3_rect_for_crop.</summary>
    public bool CropToWindowRect { get; init; }

    /// <summary>Fullscreen mode: crop the game window by this screen rect (takes precedence over other crops).</summary>
    public Rectangle? CropRect { get; init; }

    /// <summary>Fullscreen mode fallback: locate the game window rect in the fullscreen image (e.g. anchor templates). 1:1 GameWindowDetector.</summary>
    public Func<Bitmap, Rectangle?>? GameWindowLocator { get; init; }

    /// <summary>Title match mode for presence/activation/native lookups (Python WindowFinder match_mode="in").</summary>
    public WindowFinder.TitleMatchMode TitleMatchMode { get; init; } = WindowFinder.TitleMatchMode.In;

    /// <summary>Title match mode for window-only capture (Python WindowScreenshot default "endswith").</summary>
    public WindowFinder.TitleMatchMode WindowOnlyTitleMatchMode { get; init; } = WindowFinder.TitleMatchMode.EndsWith;

    /// <summary>Skip filter for title lookup; default skips browser windows (1:1 _skip_browser_if).</summary>
    public Func<IntPtr, string, bool>? SkipIf { get; init; }

    /// <summary>Custom window lookup (e.g. app exe-first lookup); overrides title search when set.</summary>
    public Func<IReadOnlyList<string>, IReadOnlyList<WindowFinder.WindowInfo>>? FindWindows { get; init; }

    /// <summary>Custom activation (restore + foreground); default restores and calls SetForegroundWindow. Returns true when active.</summary>
    public Func<IntPtr, bool>? Activator { get; init; }

    /// <summary>Settle delay after activation before capture (ms).</summary>
    public int ActivateDelayMs { get; init; } = ScreenCaptureConstants.ActivateBeforeCaptureDelayMs;

    /// <summary>Reuse the cached window handle/rect (rect cache) when still valid.</summary>
    public bool UseWindowCache { get; init; } = true;
}

/// <summary>Cached target window position. 1:1 Python ENCYCLOPEDIA window_cache entry (hwnd, title, rect, class_name).</summary>
public sealed record CachedWindowInfo(IntPtr Hwnd, string Title, Rectangle Rect, string ClassName);
