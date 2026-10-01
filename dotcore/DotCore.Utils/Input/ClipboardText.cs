using System.Runtime.InteropServices;

namespace DotCore.Utils.Input;

/// <summary>
/// System clipboard text get/set (Win32 CF_UNICODETEXT). 1:1 Python pycore/pyutils/common/clipboard_text.py
/// Windows path (get_clipboard_text / set_clipboard_text). Returns null/false on other platforms.
/// </summary>
public static class ClipboardText
{
    private const string User32 = "user32.dll";
    private const string Kernel32 = "kernel32.dll";
    private const uint CF_UNICODETEXT = 13;
    private const uint GMEM_MOVEABLE = 0x0002;
    private const int OpenRetries = 5;
    private const int OpenRetryDelayMs = 20;

    /// <summary>Current clipboard text, or null when empty/unavailable.</summary>
    public static string? GetText()
    {
        if (!OperatingSystem.IsWindows() || !Open()) return null;
        try
        {
            IntPtr handle = GetClipboardData(CF_UNICODETEXT);
            if (handle == IntPtr.Zero) return null;
            IntPtr locked = GlobalLock(handle);
            if (locked == IntPtr.Zero) return null;
            try
            {
                return Marshal.PtrToStringUni(locked);
            }
            finally
            {
                GlobalUnlock(handle);
            }
        }
        finally
        {
            CloseClipboard();
        }
    }

    /// <summary>Replace clipboard content with text (empties every format first).</summary>
    public static bool SetText(string text)
    {
        if (!OperatingSystem.IsWindows()) return false;
        int size = (text.Length + 1) * 2;
        IntPtr handle = GlobalAlloc(GMEM_MOVEABLE, (UIntPtr)size);
        if (handle == IntPtr.Zero) return false;
        IntPtr locked = GlobalLock(handle);
        if (locked == IntPtr.Zero)
        {
            GlobalFree(handle);
            return false;
        }
        var buffer = new char[text.Length + 1];
        text.CopyTo(0, buffer, 0, text.Length);
        Marshal.Copy(buffer, 0, locked, buffer.Length);
        GlobalUnlock(handle);
        if (!Open())
        {
            GlobalFree(handle);
            return false;
        }
        try
        {
            if (!EmptyClipboard() || SetClipboardData(CF_UNICODETEXT, handle) == IntPtr.Zero)
            {
                GlobalFree(handle);
                return false;
            }
            return true;
        }
        finally
        {
            CloseClipboard();
        }
    }

    private static bool Open()
    {
        for (int i = 0; i < OpenRetries; i++)
        {
            if (OpenClipboard(IntPtr.Zero)) return true;
            Thread.Sleep(OpenRetryDelayMs);
        }
        return false;
    }

    [DllImport(User32, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool OpenClipboard(IntPtr hWndNewOwner);

    [DllImport(User32)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CloseClipboard();

    [DllImport(User32)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool EmptyClipboard();

    [DllImport(User32)]
    private static extern IntPtr GetClipboardData(uint uFormat);

    [DllImport(User32)]
    private static extern IntPtr SetClipboardData(uint uFormat, IntPtr hMem);

    [DllImport(Kernel32)]
    private static extern IntPtr GlobalAlloc(uint uFlags, UIntPtr dwBytes);

    [DllImport(Kernel32)]
    private static extern IntPtr GlobalLock(IntPtr hMem);

    [DllImport(Kernel32)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GlobalUnlock(IntPtr hMem);

    [DllImport(Kernel32)]
    private static extern IntPtr GlobalFree(IntPtr hMem);
}
