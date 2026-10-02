// PY-REF: pyapps/d3-check/share/game_interface_data.py
// PY-REF: pyapps/d3-check/d3utils/click_handler_singleton.py
using System.Runtime.InteropServices;
using DotCore.Utils.Input;

namespace DotApps.d3d4tester.Core;

/// <summary>
/// Program operation: click at standard coordinate (scale + border) in a window. Uses GameInterfaceData for scale.
/// 1:1 with Python calculate_unified_scaled_coordinate + get_click_handler().click at screen position.
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
        return ClickHandler.Instance.Click(rect.Left + px, rect.Top + py, directClick: true, returnToOriginal: true);
    }

    [DllImport("user32.dll")]
    private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [StructLayout(LayoutKind.Sequential)]
    private struct RECT
    {
        public int Left, Top, Right, Bottom;
    }
}
