// PY-REF: dotapps/d3d4tester/reference/py_d3check/main.py
// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/screenshot_provider.py
using System.Collections.Concurrent;
using System.Drawing;
using DotCore.Foundations;
using DotCore.Utils;
using DotCore.Utils.Window;

namespace DotCore.ScreenCapture;

/// <summary>
/// Screen capture service. Aligned with PY ScreenshotProvider / main.py downstream: full screen, window, region;
/// Share/Gen for current screenshot cache; output in-memory image, optional save. No recognition.
/// Singleton via GetScreenshotProvider() only; do not instantiate elsewhere (DOT_PROJECT_STANDARDS).
/// </summary>
public sealed class ScreenCaptureService
{
    private ScreenshotData? _currentScreenshot;
    private readonly ConcurrentDictionary<string, CachedWindowInfo> _windowCache = new();
    private static ScreenCaptureService? _instance;
    private static readonly object _instanceLock = new();

    private ScreenCaptureService() { }

    /// <summary>
    /// App-wide fullscreen-mode locator used when options carry none (Python ScreenshotProvider holds get_game_window_detector()).
    /// Set once at app startup.
    /// </summary>
    public static Func<Bitmap, Rectangle?>? DefaultGameWindowLocator { get; set; }

    /// <summary>Current cached screenshot data (used by Share/Gen).</summary>
    public ScreenshotData? CurrentScreenshot => _currentScreenshot;

    /// <summary>Returns the global screenshot provider singleton (same as PY get_screenshot_provider()).</summary>
    public static ScreenCaptureService GetScreenshotProvider()
    {
        if (_instance != null) return _instance;
        lock (_instanceLock)
        {
            _instance ??= new ScreenCaptureService();
            return _instance;
        }
    }

    /// <summary>Share current screenshot; if none, capture then return (same as PY share()).</summary>
    public ScreenshotData? Share(IntPtr? gameWindowHwnd = null) =>
        _currentScreenshot != null ? _currentScreenshot : Gen(gameWindowHwnd);

    /// <summary>Force a new capture and set as current screenshot (same as PY gen()).</summary>
    /// <param name="gameWindowHwnd">If set, also capture this window as GameWindowImage and fill GameWindowRect/WindowOffset.</param>
    public ScreenshotData? Gen(IntPtr? gameWindowHwnd = null)
    {
        ClearScreenshot();
        var full = CaptureFullScreen();
        if (full == null) return null;
        Bitmap? game = null;
        Rectangle? gameRect = null;
        (int X, int Y) offset = (0, 0);
        (int W, int H)? gameSize = null;
        if (gameWindowHwnd.HasValue && gameWindowHwnd.Value != IntPtr.Zero && NativeMethods.GetWindowRect(gameWindowHwnd.Value, out var r))
        {
            game = CaptureWindow(gameWindowHwnd.Value);
            if (game != null)
            {
                gameRect = new Rectangle(r.Left, r.Top, r.Width, r.Height);
                offset = (r.Left, r.Top);
                gameSize = (r.Width, r.Height);
            }
        }
        int fw = full.Width;
        int fh = full.Height;
        var timestamp = DateTime.Now.ToString(ScreenCaptureConstants.TimestampFormat);
        var data = new ScreenshotData
        {
            FullscreenImage = full,
            GameWindowImage = game,
            GameWindowRect = gameRect,
            WindowOffset = offset,
            FullscreenSize = (fw, fh),
            GameWindowSize = gameSize,
            Timestamp = timestamp
        };
        _currentScreenshot = data;
        return data;
    }

    /// <summary>
    /// Force a new capture with options and set it as current screenshot. 1:1 Python ScreenshotProvider.gen:
    /// optional activate-first, native region grab (rect cached), window-only capture, or fullscreen with crop
    /// (given rect, window rect, or locator). Returns null when the target window is missing or capture fails.
    /// </summary>
    public ScreenshotData? Gen(ScreenCaptureOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);
        var titles = options.WindowTitles is { Count: > 0 } t ? t : null;
        if (titles != null && (options.WindowOnly || options.NativeRegionCapture) && FindWindows(titles, options, options.TitleMatchMode).Count == 0)
        {
            ColorPrinter.Gray("[Provider] No window found, skip capture");
            return null;
        }

        ColorPrinter.Blue("[Provider] Capturing...");
        try
        {
            if (options.ActivateFirst)
            {
                var windows = titles != null ? FindWindows(titles, options, options.TitleMatchMode) : Array.Empty<WindowFinder.WindowInfo>();
                if (windows.Count > 0 && windows[0].Hwnd != IntPtr.Zero)
                {
                    Activate(windows[0].Hwnd, options);
                    Thread.Sleep(options.ActivateDelayMs);
                    ColorPrinter.Green("[Provider] Target window activated before capture");
                }
                else
                {
                    ColorPrinter.Yellow("[Provider] Target window not found for activation");
                }
            }

            if (options.NativeRegionCapture)
                return SetCurrent(CaptureNativeRegion(titles, options));

            if (options.WindowOnly)
            {
                if (titles == null)
                {
                    ColorPrinter.Red("[Provider] window_titles required when use_optimized_capture=True");
                    return null;
                }
                return SetCurrent(CaptureWindowOnly(titles, options));
            }

            return SetCurrent(CaptureFullscreenAndCrop(titles, options));
        }
        catch (Exception e)
        {
            ColorPrinter.Red($"[Provider] Error capturing screenshot: {e.Message}");
            return null;
        }
    }

    /// <summary>Cached window entry for a title list (key = first title, lower-case); null when missing.</summary>
    public CachedWindowInfo? GetCachedWindow(IReadOnlyList<string> titles) =>
        CacheKey(titles) is { } key && _windowCache.TryGetValue(key, out var info) ? info : null;

    /// <summary>Store a window position in the rect cache (key = first title, lower-case).</summary>
    public void CacheWindow(IReadOnlyList<string> titles, IntPtr hwnd, string title = "", string className = "")
    {
        if (CacheKey(titles) is not { } key || !NativeMethods.GetWindowRect(hwnd, out var r)) return;
        _windowCache[key] = new CachedWindowInfo(hwnd, title, new Rectangle(r.Left, r.Top, r.Width, r.Height), className);
    }

    /// <summary>Clear the window rect cache.</summary>
    public void ClearWindowCache() => _windowCache.Clear();

    /// <summary>
    /// Restore (if minimized) and foreground a window; true when it became the foreground window.
    /// 1:1 Python pycore WindowActivator.activate_window_by_handle (0.5 s settle).
    /// </summary>
    public static bool ActivateWindow(IntPtr hwnd)
    {
        if (hwnd == IntPtr.Zero || !NativeMethods.IsWindow(hwnd))
        {
            ColorPrinter.Red($"[ERROR] Invalid window handle: {hwnd}");
            return false;
        }
        if (!NativeMethods.IsWindowVisible(hwnd))
        {
            ColorPrinter.Yellow($"[WARN] Window is not visible (handle: {hwnd})");
            return false;
        }
        if (NativeMethods.IsIconic(hwnd))
        {
            ColorPrinter.Blue($"[RESTORE] Restoring minimized window (handle: {hwnd})");
            NativeMethods.ShowWindow(hwnd, NativeMethods.SW_RESTORE);
            Thread.Sleep(ActivationSettleMs);
        }
        ColorPrinter.Blue($"[ACTIVATE] Activating window (handle: {hwnd})");
        if (!NativeMethods.SetForegroundWindow(hwnd))
        {
            ColorPrinter.Yellow($"[WARN] SetForegroundWindow failed (handle: {hwnd})");
            return true;
        }
        Thread.Sleep(ActivationSettleMs);
        if (NativeMethods.GetForegroundWindow() == hwnd)
        {
            ColorPrinter.Green($"[SUCCESS] Window activated (handle: {hwnd})");
            return true;
        }
        ColorPrinter.Yellow($"[WARN] Window activation may have failed (handle: {hwnd})");
        return false;
    }

    private const int ActivationSettleMs = 500;
    private const int ForegroundRetries = 3;
    private const int ForegroundRetryMs = 150;

    /// <summary>
    /// Idempotent: make hwnd the foreground window only when it is not already (no-op, no settle wait otherwise). Windows refuses
    /// SetForegroundWindow from a process that did not get the last input; attaching this thread's input to the current foreground
    /// window's thread lifts that lock without any keystroke (a synthetic Alt would reach games: D3 toggles its item labels on Alt).
    /// Retries while another program keeps taking the foreground. True when it is the foreground window afterwards.
    /// </summary>
    public static bool EnsureForeground(IntPtr hwnd)
    {
        if (hwnd == IntPtr.Zero || !NativeMethods.IsWindow(hwnd)) return false;
        if (NativeMethods.GetForegroundWindow() == hwnd) return true;
        if (NativeMethods.IsIconic(hwnd)) NativeMethods.ShowWindow(hwnd, NativeMethods.SW_RESTORE);
        for (int i = 0; i < ForegroundRetries; i++)
        {
            uint self = NativeMethods.GetCurrentThreadId();
            uint foreground = NativeMethods.GetWindowThreadProcessId(NativeMethods.GetForegroundWindow(), IntPtr.Zero);
            bool attached = foreground != 0 && foreground != self && NativeMethods.AttachThreadInput(self, foreground, true);
            try
            {
                NativeMethods.BringWindowToTop(hwnd);
                NativeMethods.SetForegroundWindow(hwnd);
            }
            finally
            {
                if (attached) NativeMethods.AttachThreadInput(self, foreground, false);
            }
            Thread.Sleep(ForegroundRetryMs);
            if (NativeMethods.GetForegroundWindow() == hwnd) return true;
        }
        ColorPrinter.Yellow($"[WARN] Window not foreground after {ForegroundRetries} attempts (handle: {hwnd})");
        return false;
    }

    private ScreenshotData? CaptureNativeRegion(IReadOnlyList<string>? titles, ScreenCaptureOptions options)
    {
        IntPtr hwnd = IntPtr.Zero;
        string title = "", className = "";
        if (titles != null && options.UseWindowCache && GetCachedWindow(titles) is { } cached &&
            NativeMethods.IsWindow(cached.Hwnd) && NativeMethods.IsWindowVisible(cached.Hwnd))
        {
            hwnd = cached.Hwnd;
            title = cached.Title;
            className = cached.ClassName;
            ColorPrinter.Blue("[Provider] Native region: using cached window position");
        }
        if (hwnd == IntPtr.Zero)
        {
            var windows = titles != null ? FindWindows(titles, options, options.TitleMatchMode) : Array.Empty<WindowFinder.WindowInfo>();
            if (windows.Count == 0 || windows[0].Hwnd == IntPtr.Zero)
            {
                ColorPrinter.Red("[Provider] use_native_region_capture: window not found");
                return null;
            }
            hwnd = windows[0].Hwnd;
            title = windows[0].Title;
            className = windows[0].ClassName;
        }
        Activate(hwnd, options);
        Thread.Sleep(options.ActivateDelayMs);
        if (!NativeMethods.GetWindowRect(hwnd, out var r))
        {
            ColorPrinter.Red("[Provider] use_native_region_capture: get rect failed");
            return null;
        }
        if (titles != null) CacheWindow(titles, hwnd, title, className);
        var image = CaptureRegionBitBlt(r.Left, r.Top, r.Width, r.Height);
        if (image == null)
        {
            ColorPrinter.Red("[Provider] use_native_region_capture: capture_screen_region failed");
            return null;
        }
        ColorPrinter.Green("[Provider] Native region capture: window rect region grab");
        return BuildData(null, image, new Rectangle(r.Left, r.Top, r.Width, r.Height), GetScreenSize());
    }

    private ScreenshotData? CaptureWindowOnly(IReadOnlyList<string> titles, ScreenCaptureOptions options)
    {
        if (options.ActivateIfNotForeground)
        {
            IntPtr target = IntPtr.Zero;
            if (options.UseWindowCache && GetCachedWindow(titles) is { } cached && NativeMethods.IsWindow(cached.Hwnd) && NativeMethods.IsWindowVisible(cached.Hwnd))
                target = cached.Hwnd;
            if (target == IntPtr.Zero)
            {
                var found = FindWindows(titles, options, options.TitleMatchMode);
                if (found.Count > 0) target = found[0].Hwnd;
            }
            if (target != IntPtr.Zero && NativeMethods.GetForegroundWindow() != target)
            {
                Activate(target, options);
                Thread.Sleep(options.ActivateDelayMs);
                ColorPrinter.Green("[Provider] Target window activated before capture (was not foreground)");
            }
        }

        var windows = FindWindows(titles, options, options.WindowOnlyTitleMatchMode);
        if (windows.Count == 0)
        {
            ColorPrinter.Yellow($"[FAST_SINGLE] No windows found matching: {string.Join(", ", titles)}");
            ColorPrinter.Red("[Provider] Screenshot capture returned None. Reason above: no window matching titles, or exception in capture.");
            return null;
        }
        var w = windows[0];
        var rect = new Rectangle(w.Left, w.Top, w.Width, w.Height);
        if (NativeMethods.IsIconic(w.Hwnd) || rect.Left < ScreenCaptureConstants.OffscreenThreshold || rect.Top < ScreenCaptureConstants.OffscreenThreshold)
        {
            ColorPrinter.Blue($"[FAST_SINGLE] Window minimized/off-screen, activating: '{w.Title}'");
            if (!Activate(w.Hwnd, options))
                ColorPrinter.Yellow("[FAST_SINGLE] Proceeding after activation attempt");
            Thread.Sleep(ScreenCaptureConstants.MinimizedActivateDelayMs);
            if (NativeMethods.GetWindowRect(w.Hwnd, out var fresh))
                rect = new Rectangle(fresh.Left, fresh.Top, fresh.Width, fresh.Height);
        }
        if (rect.Width <= 0 || rect.Height <= 0) return null;
        CacheWindow(titles, w.Hwnd, w.Title, w.ClassName);
        var image = CaptureRegionBitBlt(rect);
        if (image == null)
        {
            ColorPrinter.Red("[FAST_SINGLE] Failed to capture fullscreen");
            return null;
        }
        return BuildData(null, image, rect, GetScreenSize());
    }

    private ScreenshotData? CaptureFullscreenAndCrop(IReadOnlyList<string>? titles, ScreenCaptureOptions options)
    {
        ColorPrinter.Blue("[Provider] Capturing full screen...");
        var full = CaptureFullScreenBitBlt();
        if (full == null)
        {
            ColorPrinter.Red("[Provider] Screenshot capture returned None. Reason above: no window matching titles, or exception in capture.");
            return null;
        }
        var screen = (full.Width, full.Height);
        Rectangle? gameRect = options.CropRect;
        if (gameRect == null && options.CropToWindowRect && titles != null)
        {
            var windows = FindWindows(titles, options, options.TitleMatchMode);
            if (windows.Count > 0)
                gameRect = new Rectangle(windows[0].Left, windows[0].Top, windows[0].Width, windows[0].Height);
        }
        var locator = options.GameWindowLocator ?? DefaultGameWindowLocator;
        if (gameRect == null && locator != null)
        {
            ColorPrinter.Blue("[Provider] Normal mode: detecting game window from fullscreen...");
            gameRect = locator(full);
        }
        if (gameRect is not { Width: > 0, Height: > 0 } rect)
        {
            ColorPrinter.Yellow("[Provider] Game window NOT detected - no anchor points found");
            ColorPrinter.Yellow("[Provider] Game window image will be NULL");
            return BuildData(full, null, null, screen);
        }
        ColorPrinter.Green($"[Provider] Game window detected: {rect}");
        var game = CropBitmap(full, rect);
        ColorPrinter.Green($"[Provider] Game window cropped: {rect.Width}x{rect.Height}");
        return BuildData(full, game, rect, screen);
    }

    private ScreenshotData? SetCurrent(ScreenshotData? data)
    {
        if (data == null) return null;
        ClearScreenshot();
        _currentScreenshot = data;
        var gw = data.GameWindowSize;
        ColorPrinter.Green($"[Provider] {(gw is { } s ? $"{s.Width}x{s.Height}" : "0x0")} offset ({data.WindowOffset.X}, {data.WindowOffset.Y})");
        return data;
    }

    private static ScreenshotData BuildData(Bitmap? full, Bitmap? game, Rectangle? gameRect, (int Width, int Height) fullscreenSize) => new()
    {
        FullscreenImage = full,
        GameWindowImage = game,
        GameWindowRect = gameRect,
        WindowOffset = gameRect is { } r ? (r.Left, r.Top) : (0, 0),
        FullscreenSize = fullscreenSize,
        GameWindowSize = gameRect is { } g && game != null ? (g.Width, g.Height) : null,
        Timestamp = DateTime.Now.ToString(ScreenCaptureConstants.TimestampFormat)
    };

    /// <summary>Crop a bitmap by a rect; areas outside the source stay black (PIL crop semantics). Caller disposes.</summary>
    public static Bitmap CropBitmap(Bitmap source, Rectangle rect)
    {
        var dst = new Bitmap(rect.Width, rect.Height);
        using var g = Graphics.FromImage(dst);
        g.Clear(Color.Black);
        g.DrawImage(source, new Rectangle(0, 0, rect.Width, rect.Height), rect, GraphicsUnit.Pixel);
        return dst;
    }

    private static (int Width, int Height) GetScreenSize() =>
        (NativeMethods.GetSystemMetrics(NativeMethods.SM_CXSCREEN), NativeMethods.GetSystemMetrics(NativeMethods.SM_CYSCREEN));

    private static IReadOnlyList<WindowFinder.WindowInfo> FindWindows(IReadOnlyList<string> titles, ScreenCaptureOptions options, WindowFinder.TitleMatchMode mode) =>
        options.FindWindows != null
            ? options.FindWindows(titles)
            : WindowFinder.FindWindowsByTitles(titles, mode, options.SkipIf ?? BrowserWindowDetector.SkipBrowserFilter);

    private static bool Activate(IntPtr hwnd, ScreenCaptureOptions options) =>
        options.Activator != null ? options.Activator(hwnd) : ActivateWindow(hwnd);

    private static string? CacheKey(IReadOnlyList<string>? titles)
    {
        var first = titles is { Count: > 0 } ? (titles[0] ?? "").ToLowerInvariant() : "";
        return first.Length == 0 ? null : ScreenCaptureConstants.WindowCacheKeyPrefix + first;
    }

    /// <summary>Clear current cached screenshot and release images (same as PY clear_screenshot()).</summary>
    public void ClearScreenshot()
    {
        if (_currentScreenshot == null) return;
        _currentScreenshot.FullscreenImage?.Dispose();
        _currentScreenshot.GameWindowImage?.Dispose();
        _currentScreenshot = null;
    }

    /// <summary>Save current screenshot to disk (same as PY save_current_screenshot()). Returns null if no current screenshot.</summary>
    public (string? FullscreenPath, string? GameWindowPath)? SaveCurrentScreenshot(string? outputDir = null, string prefix = ScreenCaptureConstants.DefaultSavePrefix)
    {
        if (_currentScreenshot == null) return null;
        var (a, b) = _currentScreenshot.Save(outputDir, prefix);
        return (a, b);
    }

    /// <summary>Capture full screen (primary monitor). Caller must Dispose the returned bitmap.</summary>
    public Bitmap? CaptureFullScreen()
    {
        int w = NativeMethods.GetSystemMetrics(NativeMethods.SM_CXSCREEN);
        int h = NativeMethods.GetSystemMetrics(NativeMethods.SM_CYSCREEN);
        if (w <= 0 || h <= 0) return null;
        return CaptureRegion(0, 0, w, h);
    }

    /// <summary>Capture virtual screen (all monitors). Caller must Dispose the returned bitmap.</summary>
    public Bitmap? CaptureVirtualScreen()
    {
        int x = NativeMethods.GetSystemMetrics(NativeMethods.SM_XVIRTUALSCREEN);
        int y = NativeMethods.GetSystemMetrics(NativeMethods.SM_YVIRTUALSCREEN);
        int w = NativeMethods.GetSystemMetrics(NativeMethods.SM_CXVIRTUALSCREEN);
        int h = NativeMethods.GetSystemMetrics(NativeMethods.SM_CYVIRTUALSCREEN);
        if (w <= 0 || h <= 0) return null;
        return CaptureRegion(x, y, w, h);
    }

    /// <summary>Capture the window's screen rectangle by handle. Caller must Dispose the returned bitmap.</summary>
    public Bitmap? CaptureWindow(IntPtr hwnd)
    {
        if (hwnd == IntPtr.Zero || !NativeMethods.IsWindow(hwnd))
            return null;
        if (!NativeMethods.GetWindowRect(hwnd, out var rect))
            return null;
        int w = rect.Width;
        int h = rect.Height;
        if (w <= 0 || h <= 0) return null;
        return CaptureRegion(rect.Left, rect.Top, w, h);
    }

    /// <summary>Capture screen region by rectangle. Caller must Dispose the returned bitmap.</summary>
    public Bitmap? CaptureRegion(Rectangle rect)
    {
        return CaptureRegion(rect.X, rect.Y, rect.Width, rect.Height);
    }

    /// <summary>Capture screen region by (x, y, width, height). Uses GDI+ CopyFromScreen.</summary>
    public Bitmap? CaptureRegion(int x, int y, int width, int height)
    {
        if (width <= 0 || height <= 0) return null;
        try
        {
            var bmp = new Bitmap(width, height);
            using (var g = Graphics.FromImage(bmp))
            {
                g.CopyFromScreen(x, y, 0, 0, new Size(width, height));
            }
            return bmp;
        }
        catch
        {
            return null;
        }
    }

    // --- Efficient paths (BitBlt for region/full screen; PrintWindow for window) ---

    /// <summary>Region capture via BitBlt. P/Invoke gdi32 BitBlt, no GDI+ overhead. Uses CAPTUREBLT for layered windows.</summary>
    public Bitmap? CaptureRegionBitBlt(Rectangle rect) => CaptureRegionBitBlt(rect.X, rect.Y, rect.Width, rect.Height);

    /// <summary>Region capture via BitBlt by (x, y, width, height).</summary>
    public Bitmap? CaptureRegionBitBlt(int x, int y, int width, int height)
    {
        if (width <= 0 || height <= 0) return null;
        IntPtr hdcScreen = IntPtr.Zero;
        IntPtr hdcMem = IntPtr.Zero;
        IntPtr hBmp = IntPtr.Zero;
        IntPtr hOld = IntPtr.Zero;
        try
        {
            hdcScreen = NativeMethods.GetDC(IntPtr.Zero);
            if (hdcScreen == IntPtr.Zero) return null;
            hdcMem = NativeMethods.CreateCompatibleDC(hdcScreen);
            if (hdcMem == IntPtr.Zero) return null;
            hBmp = NativeMethods.CreateCompatibleBitmap(hdcScreen, width, height);
            if (hBmp == IntPtr.Zero) return null;
            hOld = NativeMethods.SelectObject(hdcMem, hBmp);
            uint rop = NativeMethods.SRCCOPY | NativeMethods.CAPTUREBLT;
            if (!NativeMethods.BitBlt(hdcMem, 0, 0, width, height, hdcScreen, x, y, rop))
                return null;
            NativeMethods.SelectObject(hdcMem, hOld);
            return Image.FromHbitmap(hBmp);
        }
        catch
        {
            return null;
        }
        finally
        {
            if (hOld != IntPtr.Zero && hdcMem != IntPtr.Zero) NativeMethods.SelectObject(hdcMem, hOld);
            if (hBmp != IntPtr.Zero) NativeMethods.DeleteObject(hBmp);
            if (hdcMem != IntPtr.Zero) NativeMethods.DeleteDC(hdcMem);
            if (hdcScreen != IntPtr.Zero) NativeMethods.ReleaseDC(IntPtr.Zero, hdcScreen);
        }
    }

    /// <summary>Full screen capture via BitBlt (primary monitor). More efficient than GDI+ CopyFromScreen.</summary>
    public Bitmap? CaptureFullScreenBitBlt()
    {
        int w = NativeMethods.GetSystemMetrics(NativeMethods.SM_CXSCREEN);
        int h = NativeMethods.GetSystemMetrics(NativeMethods.SM_CYSCREEN);
        if (w <= 0 || h <= 0) return null;
        return CaptureRegionBitBlt(0, 0, w, h);
    }

    /// <summary>Virtual screen capture via BitBlt (all monitors).</summary>
    public Bitmap? CaptureVirtualScreenBitBlt()
    {
        int x = NativeMethods.GetSystemMetrics(NativeMethods.SM_XVIRTUALSCREEN);
        int y = NativeMethods.GetSystemMetrics(NativeMethods.SM_YVIRTUALSCREEN);
        int w = NativeMethods.GetSystemMetrics(NativeMethods.SM_CXVIRTUALSCREEN);
        int h = NativeMethods.GetSystemMetrics(NativeMethods.SM_CYVIRTUALSCREEN);
        if (w <= 0 || h <= 0) return null;
        return CaptureRegionBitBlt(x, y, w, h);
    }

    /// <summary>Window capture via PrintWindow. Can capture occluded/minimized windows; fullContent uses PW_RENDERFULLCONTENT (Win10+).</summary>
    /// <param name="hwnd">Window handle.</param>
    /// <param name="clientOnly">True to capture client area only, false for entire window.</param>
    /// <param name="fullContent">True to use PW_RENDERFULLCONTENT for full DWM content.</param>
    public Bitmap? CaptureWindowPrintWindow(IntPtr hwnd, bool clientOnly = false, bool fullContent = true)
    {
        if (hwnd == IntPtr.Zero || !NativeMethods.IsWindow(hwnd)) return null;
        NativeMethods.RECT r;
        if (clientOnly)
        {
            if (!NativeMethods.GetClientRect(hwnd, out r)) return null;
        }
        else
        {
            if (!NativeMethods.GetWindowRect(hwnd, out r)) return null;
        }
        int w = r.Width;
        int h = r.Height;
        if (w <= 0 || h <= 0) return null;
        IntPtr hdcScreen = IntPtr.Zero;
        IntPtr hdcMem = IntPtr.Zero;
        IntPtr hBmp = IntPtr.Zero;
        IntPtr hOld = IntPtr.Zero;
        try
        {
            hdcScreen = NativeMethods.GetDC(IntPtr.Zero);
            if (hdcScreen == IntPtr.Zero) return null;
            hdcMem = NativeMethods.CreateCompatibleDC(hdcScreen);
            if (hdcMem == IntPtr.Zero) return null;
            hBmp = NativeMethods.CreateCompatibleBitmap(hdcScreen, w, h);
            if (hBmp == IntPtr.Zero) return null;
            hOld = NativeMethods.SelectObject(hdcMem, hBmp);
            uint flags = 0;
            if (clientOnly) flags |= NativeMethods.PW_CLIENTONLY;
            if (fullContent) flags |= NativeMethods.PW_RENDERFULLCONTENT;
            if (!NativeMethods.PrintWindow(hwnd, hdcMem, flags))
                return null;
            NativeMethods.SelectObject(hdcMem, hOld);
            return Image.FromHbitmap(hBmp);
        }
        catch
        {
            return null;
        }
        finally
        {
            if (hOld != IntPtr.Zero && hdcMem != IntPtr.Zero) NativeMethods.SelectObject(hdcMem, hOld);
            if (hBmp != IntPtr.Zero) NativeMethods.DeleteObject(hBmp);
            if (hdcMem != IntPtr.Zero) NativeMethods.DeleteDC(hdcMem);
            if (hdcScreen != IntPtr.Zero) NativeMethods.ReleaseDC(IntPtr.Zero, hdcScreen);
        }
    }

    /// <summary>Save bitmap to file. Format determined by extension (e.g. .png).</summary>
    public static void SaveToFile(Bitmap bitmap, string filePath)
    {
        if (bitmap == null || string.IsNullOrWhiteSpace(filePath))
            return;
        var dir = Path.GetDirectoryName(filePath);
        if (!string.IsNullOrEmpty(dir))
            Directory.CreateDirectory(dir);
        bitmap.Save(filePath);
    }
}
