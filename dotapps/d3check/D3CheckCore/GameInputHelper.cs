using System.Runtime.InteropServices;

namespace DotApps.d3check.Core;

/// <summary>
/// Program operation: click at standard coordinate (scale + border) in a window. Uses GameInterfaceData for scale.
/// 1:1 with Python calculate_unified_scaled_coordinate + click at screen position.
/// </summary>
public static class GameInputHelper
{
    /// <summary>Click at standard outer-window coordinate (e.g. 0..1316, 0..839). Converts via GameInterfaceData scale and window rect.</summary>
    /// <returns>True if click was sent.</returns>
    public static bool ClickAtStandardCoordinate(IntPtr hwnd, int stdX, int stdY)
    {
        if (hwnd == IntPtr.Zero || !GetWindowRect(hwnd, out var rect))
            return false;
        var (px, py) = GameInterfaceData.Instance.CalculateUnifiedScaledCoordinate(stdX, stdY);
        int screenX = rect.Left + px;
        int screenY = rect.Top + py;
        return SendMouseClick(screenX, screenY);
    }

    /// <summary>Send left mouse click at screen coordinates.</summary>
    public static bool SendMouseClick(int screenX, int screenY)
    {
        if (!SetCursorPos(screenX, screenY))
            return false;
        const int MOUSEEVENTF_LEFTDOWN = 0x0002;
        const int MOUSEEVENTF_LEFTUP = 0x0004;
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
        return true;
    }

    [DllImport("user32.dll")]
    private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    private static extern bool SetCursorPos(int x, int y);

    [DllImport("user32.dll")]
    private static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);

    [StructLayout(LayoutKind.Sequential)]
    private struct RECT
    {
        public int Left, Top, Right, Bottom;
    }
}
