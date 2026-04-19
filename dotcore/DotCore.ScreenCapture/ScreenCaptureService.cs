using System.Drawing;

namespace DotCore.ScreenCapture;

/// <summary>
/// Screen capture service. Aligned with PY ScreenshotProvider / main.py downstream: full screen, window, region;
/// Share/Gen for current screenshot cache; output in-memory image, optional save. No recognition.
/// Singleton via GetScreenshotProvider() only; do not instantiate elsewhere (DOT_PROJECT_STANDARDS).
/// </summary>
public sealed class ScreenCaptureService
{
    private ScreenshotData? _currentScreenshot;
    private static ScreenCaptureService? _instance;
    private static readonly object _instanceLock = new();

    private ScreenCaptureService() { }

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
