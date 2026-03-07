using System.Runtime.InteropServices;

namespace DotCore.ScreenCapture;

/// <summary>P/Invoke for screen and window capture (Windows). GDI/GDI32 + User32.</summary>
internal static class NativeMethods
{
    private const string User32 = "user32.dll";
    private const string Gdi32 = "gdi32.dll";

    // --- User32 ---
    [DllImport(User32)]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport(User32)]
    public static extern bool GetClientRect(IntPtr hWnd, out RECT lpRect);

    [DllImport(User32)]
    public static extern bool IsWindow(IntPtr hWnd);

    [DllImport(User32)]
    public static extern int GetSystemMetrics(int nIndex);

    /// <summary>Desktop window. GetDC(NULL) also returns screen DC.</summary>
    [DllImport(User32)]
    public static extern IntPtr GetDesktopWindow();

    [DllImport(User32)]
    public static extern IntPtr GetDC(IntPtr hWnd);

    [DllImport(User32)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool ReleaseDC(IntPtr hWnd, IntPtr hDC);

    /// <summary>Copies window visual to DC. PW_RENDERFULLCONTENT (0x2) = capture layered/full content even when occluded (Win10+).</summary>
    [DllImport(User32)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool PrintWindow(IntPtr hwnd, IntPtr hdcBlt, uint nFlags);

    public const uint PW_CLIENTONLY = 0x1;
    /// <summary>Render full content (DWM); can capture minimized/occluded windows. Windows 10+.</summary>
    public const uint PW_RENDERFULLCONTENT = 0x2;

    public const int SM_CXSCREEN = 0;
    public const int SM_CYSCREEN = 1;
    public const int SM_XVIRTUALSCREEN = 76;
    public const int SM_YVIRTUALSCREEN = 77;
    public const int SM_CXVIRTUALSCREEN = 78;
    public const int SM_CYVIRTUALSCREEN = 79;

    // --- GDI32 (BitBlt: most efficient for region/full screen) ---
    [DllImport(Gdi32)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool BitBlt(IntPtr hdcDest, int xDest, int yDest, int width, int height, IntPtr hdcSrc, int xSrc, int ySrc, uint rop);

    public const uint SRCCOPY = 0x00CC0020;
    /// <summary>Include layered windows on top in the capture.</summary>
    public const uint CAPTUREBLT = 0x40000000;

    [DllImport(Gdi32)]
    public static extern IntPtr CreateCompatibleDC(IntPtr hdc);

    [DllImport(Gdi32)]
    public static extern IntPtr CreateCompatibleBitmap(IntPtr hdc, int width, int height);

    [DllImport(Gdi32)]
    public static extern IntPtr SelectObject(IntPtr hdc, IntPtr hgdiobj);

    [DllImport(Gdi32)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool DeleteDC(IntPtr hdc);

    [DllImport(Gdi32)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool DeleteObject(IntPtr hObject);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;

        public int Width => Right - Left;
        public int Height => Bottom - Top;
    }
}
