// PY-REF: dotapps/d3d4tester/reference/py_d3check/utils/_obsolete_window_ops.py
// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/macro_config_ops.py
using System.Runtime.InteropServices;
using DotCore.Utils.Input;

namespace DotCore.Utils;

/// <summary>
/// Window input helper: send keys and mouse to a window by handle. 1:1 with Python pycore.pyutils.window_ops
/// (send_key, get_window_client_rect, send_mouse_click_at_cursor, is_cursor_in_rect).
/// Used by D3D4TesterCore.MacroSkillRunner for combat macro key/mouse sending.
/// </summary>
public static class WindowInputHelper
{
    private const int WM_KEYDOWN = 0x0100;
    private const int WM_KEYUP = 0x0101;
    private const int WM_LBUTTONDOWN = 0x0201;
    private const int WM_LBUTTONUP = 0x0202;
    private const int WM_RBUTTONDOWN = 0x0204;
    private const int WM_RBUTTONUP = 0x0205;
    private const int MK_LBUTTON = 0x0001;
    private const int MK_RBUTTON = 0x0002;
    private const int SystemKeyHoldMs = 50;

    private const uint WM_CLOSE = 0x0010;
    private const uint WM_SETTEXT = 0x000C;
    private const uint BM_CLICK = 0x00F5;

    /// <summary>Post a raw window message (e.g. key down/up with an explicit lParam).</summary>
    public static bool PostMessage(IntPtr hwnd, uint msg, IntPtr wParam, IntPtr lParam) =>
        hwnd != IntPtr.Zero && WindowInputNative.PostMessage(hwnd, msg, wParam, lParam);

    /// <summary>Ask the window to close (WM_CLOSE).</summary>
    public static bool PostClose(IntPtr hwnd) => PostMessage(hwnd, WM_CLOSE, IntPtr.Zero, IntPtr.Zero);

    /// <summary>Replace a control's text (WM_SETTEXT, synchronous; edit boxes of other processes, no keyboard or focus needed).</summary>
    public static bool SetControlText(IntPtr control, string text) =>
        control != IntPtr.Zero && WindowInputNative.SendMessageText(control, WM_SETTEXT, IntPtr.Zero, text) != IntPtr.Zero;

    /// <summary>Press a button control (BM_CLICK, synchronous).</summary>
    public static void ClickButton(IntPtr button)
    {
        if (button != IntPtr.Zero) WindowInputNative.SendMessage(button, BM_CLICK, IntPtr.Zero, IntPtr.Zero);
    }

    /// <summary>Send key down or up to window. 1:1 Python send_key(hwnd, key_code, press).</summary>
    public static bool SendKey(IntPtr hwnd, uint vk, bool press)
    {
        if (hwnd == IntPtr.Zero) return false;
        uint msg = (uint)(press ? WM_KEYDOWN : WM_KEYUP);
        return WindowInputNative.PostMessage(hwnd, msg, (IntPtr)vk, IntPtr.Zero);
    }

    /// <summary>Press and release key (down + short delay + up). 1:1 Python press_key_to_window.</summary>
    public static bool PressKey(IntPtr hwnd, uint vk)
    {
        if (!SendKey(hwnd, vk, true)) return false;
        Thread.Sleep(20);
        return SendKey(hwnd, vk, false);
    }

    /// <summary>Get window client rect in screen coordinates. 1:1 Python get_window_client_rect.</summary>
    public static (int Left, int Top, int Right, int Bottom)? GetWindowClientRectScreen(IntPtr hwnd)
    {
        if (hwnd == IntPtr.Zero) return null;
        if (!WindowInputNative.GetClientRect(hwnd, out var r)) return null;
        var pt = new WindowInputNative.POINT { X = 0, Y = 0 };
        if (!WindowInputNative.ClientToScreen(hwnd, ref pt)) return null;
        int left = pt.X, top = pt.Y;
        return (left, top, left + (r.Right - r.Left), top + (r.Bottom - r.Top));
    }

    /// <summary>Set foreground window. 1:1 Python set_foreground_window.</summary>
    public static bool SetForegroundWindow(IntPtr hwnd)
    {
        if (hwnd == IntPtr.Zero) return false;
        return WindowInputNative.SetForegroundWindow(hwnd);
    }

    /// <summary>True when hwnd is the foreground window.</summary>
    public static bool IsForegroundWindow(IntPtr hwnd) => hwnd != IntPtr.Zero && WindowInputNative.GetForegroundWindow() == hwnd;

    public static IntPtr GetForegroundWindowHandle() => WindowInputNative.GetForegroundWindow();

    /// <summary>True while the key is physically down (GetAsyncKeyState high bit).</summary>
    public static bool IsKeyDown(int vk) => (WindowInputNative.GetAsyncKeyState(vk) & 0x8000) != 0;

    /// <summary>True if current cursor (screen coords) is inside rect. 1:1 Python is_cursor_in_rect.</summary>
    public static bool IsCursorInRect(int left, int top, int right, int bottom)
    {
        if (!WindowInputNative.GetCursorPos(out int x, out int y)) return false;
        return x >= left && x < right && y >= top && y < bottom;
    }

    /// <summary>True if current cursor (screen coords) is inside the window client area. 1:1 Python is_cursor_in_window.</summary>
    public static bool IsCursorInWindow(IntPtr hwnd)
    {
        var rect = GetWindowClientRectScreen(hwnd);
        return rect != null && IsCursorInRect(rect.Value.Left, rect.Value.Top, rect.Value.Right, rect.Value.Bottom);
    }

    /// <summary>System-wide key press (down, 50 ms, up) to the foreground input queue. 1:1 Python d3utils.key_send.send_f7_to_system.</summary>
    public static bool SendSystemKey(ushort vk)
    {
        if (!InputNative.SendKey(vk, down: true)) return false;
        Thread.Sleep(SystemKeyHoldMs);
        return InputNative.SendKey(vk, down: false);
    }

    /// <summary>Send mouse click at current cursor position (in window client coords). 1:1 Python send_mouse_click_at_cursor.</summary>
    public static bool SendMouseClickAtCursor(IntPtr hwnd, bool leftButton)
    {
        if (hwnd == IntPtr.Zero) return false;
        if (!WindowInputNative.GetCursorPos(out int sx, out int sy)) return false;
        if (!WindowInputNative.ScreenToClient(hwnd, sx, sy, out int cx, out int cy)) return false;
        int lparam = (cy << 16) | (cx & 0xFFFF);
        if (leftButton)
        {
            if (!WindowInputNative.PostMessage(hwnd, WM_LBUTTONDOWN, (IntPtr)MK_LBUTTON, (IntPtr)lparam)) return false;
            Thread.Sleep(20);
            return WindowInputNative.PostMessage(hwnd, WM_LBUTTONUP, IntPtr.Zero, (IntPtr)lparam);
        }
        if (!WindowInputNative.PostMessage(hwnd, WM_RBUTTONDOWN, (IntPtr)MK_RBUTTON, (IntPtr)lparam)) return false;
        Thread.Sleep(20);
        return WindowInputNative.PostMessage(hwnd, WM_RBUTTONUP, IntPtr.Zero, (IntPtr)lparam);
    }
}

internal static class WindowInputNative
{
    private const string User32 = "user32.dll";

    [DllImport(User32)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

    [DllImport(User32)]
    public static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

    [DllImport(User32, EntryPoint = "SendMessageW", CharSet = CharSet.Unicode)]
    public static extern IntPtr SendMessageText(IntPtr hWnd, uint Msg, IntPtr wParam, string lParam);

    [DllImport(User32)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool GetClientRect(IntPtr hWnd, out RECT lpRect);

    [DllImport(User32)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool ClientToScreen(IntPtr hWnd, ref POINT lpPoint);

    [DllImport(User32, EntryPoint = "GetCursorPos")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetCursorPosNative(out POINT lpPoint);

    public static bool GetCursorPos(out int x, out int y)
    {
        x = 0; y = 0;
        if (!GetCursorPosNative(out var p)) return false;
        x = p.X; y = p.Y;
        return true;
    }

    [DllImport(User32)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool ScreenToClient(IntPtr hWnd, ref POINT lpPoint);

    public static bool ScreenToClient(IntPtr hWnd, int screenX, int screenY, out int clientX, out int clientY)
    {
        clientX = 0; clientY = 0;
        var p = new POINT { X = screenX, Y = screenY };
        if (!ScreenToClient(hWnd, ref p)) return false;
        clientX = p.X; clientY = p.Y;
        return true;
    }

    [DllImport(User32)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport(User32)]
    public static extern IntPtr GetForegroundWindow();

    [DllImport(User32)]
    public static extern short GetAsyncKeyState(int vKey);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT
    {
        public int Left, Top, Right, Bottom;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT
    {
        public int X, Y;
    }
}
