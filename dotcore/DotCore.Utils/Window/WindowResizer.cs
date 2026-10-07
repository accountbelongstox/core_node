// PY-REF: pyapps/d3-check/d3utils/window_resizer.py
using System.Runtime.InteropServices;
using DotCore.Foundations;

namespace DotCore.Utils.Window;

/// <summary>
/// Resize a window so its client area matches a target size (keeps the frame delta, clamps on the primary screen).
/// 1:1 Python pyapps/d3-check/d3utils/window_resizer.py. No app titles or sizes; callers pass them.
/// </summary>
public static class WindowResizer
{
    private const string LogTag = "[WindowResizer]";
    private const int SM_CXSCREEN = 0;
    private const int SM_CYSCREEN = 1;
    private const int FallbackScreenWidth = 1920;
    private const int FallbackScreenHeight = 1080;
    private const double DefaultRetryDelaySec = 0.4;
    private const int DefaultMaxAttempts = 3;

    /// <summary>
    /// Resize hwnd so its client area becomes targetClientWidth x targetClientHeight. Returns (MoveOk, Verified):
    /// MoveOk when MoveWindow was sent, Verified when the client size matched afterwards. 1:1 Python resize_window_to_client_size.
    /// </summary>
    public static (bool MoveOk, bool Verified) ResizeWindowToClientSize(
        IntPtr hwnd,
        int targetClientWidth,
        int targetClientHeight,
        bool keepPosition = true,
        bool ensureOnScreen = true,
        int screenMargin = 0)
    {
        if (!OperatingSystem.IsWindows())
        {
            ColorPrinter.Yellow($"{LogTag} win32gui not available");
            return (false, false);
        }
        if (!WindowFinderNative.IsWindow(hwnd))
        {
            ColorPrinter.Yellow($"{LogTag} Invalid hwnd");
            return (false, false);
        }
        if (!WindowFinderNative.GetWindowRect(hwnd, out var wr) || !WindowInputNative.GetClientRect(hwnd, out var cr))
        {
            ColorPrinter.Red($"{LogTag} resize_window_to_client_size: GetWindowRect/GetClientRect failed");
            return (false, false);
        }
        int winW = wr.Right - wr.Left, winH = wr.Bottom - wr.Top;
        int clientW = cr.Right - cr.Left, clientH = cr.Bottom - cr.Top;
        if (clientW <= 0 || clientH <= 0)
        {
            ColorPrinter.Yellow($"{LogTag} Client size is 0, window may not be ready");
            return (false, false);
        }
        int frameW = winW - clientW, frameH = winH - clientH;
        int newWinW = targetClientWidth + frameW, newWinH = targetClientHeight + frameH;
        ColorPrinter.Blue(
            $"{LogTag} Before: client {clientW}x{clientH}, outer {winW}x{winH}, " +
            $"frame {frameW}x{frameH} -> set outer {newWinW}x{newWinH} so client = {targetClientWidth}x{targetClientHeight}");
        int left = wr.Left, top = wr.Top;
        if (ensureOnScreen)
        {
            (left, top) = ClampPositionToScreen(left, top, newWinW, newWinH, screenMargin);
            if (left != wr.Left || top != wr.Top)
                ColorPrinter.Blue($"{LogTag} Position clamped to stay on screen: ({wr.Left}, {wr.Top}) -> ({left}, {top})");
        }
        if (!MoveWindow(hwnd, left, top, newWinW, newWinH, true))
        {
            ColorPrinter.Red($"{LogTag} resize_window_to_client_size: MoveWindow failed (Win32 error {Marshal.GetLastWin32Error()})");
            return (false, false);
        }
        bool verified = false;
        if (WindowFinderNative.IsWindow(hwnd) && WindowInputNative.GetClientRect(hwnd, out var cr2))
        {
            int actualW = cr2.Right - cr2.Left, actualH = cr2.Bottom - cr2.Top;
            if (actualW == targetClientWidth && actualH == targetClientHeight)
            {
                ColorPrinter.Green($"{LogTag} Done: client area = {actualW}x{actualH} (matches base size)");
                verified = true;
            }
            else
            {
                ColorPrinter.Yellow($"{LogTag} After resize client = {actualW}x{actualH} (expected {targetClientWidth}x{targetClientHeight})");
            }
        }
        else
        {
            ColorPrinter.Gray($"{LogTag} Resize sent; could not verify (handle invalid, window may have been recreated)");
        }
        return (true, verified);
    }

    /// <summary>
    /// Find the first window whose title contains any of windowTitles and resize its client area; retries with a fresh
    /// handle when the window is recreated on resize. True when verified. 1:1 Python resize_window_by_titles_to_client_size.
    /// </summary>
    public static bool ResizeWindowByTitlesToClientSize(
        IReadOnlyList<string> windowTitles,
        int clientWidth,
        int clientHeight,
        bool retryAfterRecreate = true,
        double retryDelaySec = DefaultRetryDelaySec,
        int maxAttempts = DefaultMaxAttempts,
        Func<IntPtr, string, bool>? skipIf = null)
    {
        int attempt = 0;
        while (attempt < maxAttempts)
        {
            attempt++;
            var windows = WindowFinder.FindWindowsByTitles(windowTitles, WindowFinder.TitleMatchMode.In, skipIf);
            if (windows.Count == 0)
            {
                ColorPrinter.Gray($"{LogTag} No window found for given titles, skip resize");
                return false;
            }
            IntPtr hwnd = windows[0].Hwnd;
            if (hwnd == IntPtr.Zero) return false;
            var (moveOk, verified) = ResizeWindowToClientSize(hwnd, clientWidth, clientHeight, keepPosition: true);
            if (verified) return true;
            if (!moveOk) return false;
            if (!retryAfterRecreate || attempt >= maxAttempts) break;
            ColorPrinter.Blue($"{LogTag} Retry in {retryDelaySec}s with fresh handle (attempt {attempt}/{maxAttempts})");
            Thread.Sleep(TimeSpan.FromSeconds(retryDelaySec));
        }
        return false;
    }

    /// <summary>Resize hwnd's client area, then move the window so its outer rect touches the primary screen's top-right corner. True when moved.</summary>
    public static bool PlaceAtTopRight(IntPtr hwnd, int clientWidth, int clientHeight)
    {
        var (moveOk, _) = ResizeWindowToClientSize(hwnd, clientWidth, clientHeight, keepPosition: true, ensureOnScreen: false);
        if (!moveOk || !WindowFinderNative.GetWindowRect(hwnd, out var wr)) return false;
        int w = wr.Right - wr.Left, h = wr.Bottom - wr.Top;
        var (sw, _) = GetScreenSize();
        int left = Math.Max(0, sw - w);
        if (!MoveWindow(hwnd, left, 0, w, h, true))
        {
            ColorPrinter.Red($"{LogTag} PlaceAtTopRight: MoveWindow failed (Win32 error {Marshal.GetLastWin32Error()})");
            return false;
        }
        ColorPrinter.Blue($"{LogTag} Placed at top-right ({left}, 0) outer {w}x{h}");
        return true;
    }

    /// <summary>Primary monitor size in pixels. 1:1 Python _get_screen_size.</summary>
    public static (int Width, int Height) GetScreenSize()
    {
        if (!OperatingSystem.IsWindows()) return (FallbackScreenWidth, FallbackScreenHeight);
        int w = GetSystemMetrics(SM_CXSCREEN), h = GetSystemMetrics(SM_CYSCREEN);
        return w > 0 && h > 0 ? (w, h) : (FallbackScreenWidth, FallbackScreenHeight);
    }

    /// <summary>Clamp (left, top) so the rect stays inside the primary screen with margin. 1:1 Python _clamp_position_to_screen.</summary>
    public static (int Left, int Top) ClampPositionToScreen(int left, int top, int width, int height, int margin = 0)
    {
        var (sw, sh) = GetScreenSize();
        int maxLeft = Math.Max(margin, sw - width - margin);
        int maxTop = Math.Max(margin, sh - height - margin);
        return (Math.Max(margin, Math.Min(left, maxLeft)), Math.Max(margin, Math.Min(top, maxTop)));
    }

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool MoveWindow(IntPtr hWnd, int x, int y, int nWidth, int nHeight, [MarshalAs(UnmanagedType.Bool)] bool bRepaint);

    [DllImport("user32.dll")]
    private static extern int GetSystemMetrics(int nIndex);
}
