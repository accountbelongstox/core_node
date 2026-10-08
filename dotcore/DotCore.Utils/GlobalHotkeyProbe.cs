using System.Runtime.InteropServices;

namespace DotCore.Utils;

/// <summary>
/// RegisterHotKey is exclusive per key: the first process that registers a key owns it and every later registration fails
/// (ERROR_HOTKEY_ALREADY_REGISTERED). IsTaken registers the plain key for an instant and releases it at once.
/// </summary>
public static class GlobalHotkeyProbe
{
    private const uint ModNoRepeat = 0x4000;
    private const int ProbeIdBase = 0x7A00;

    public static bool IsTaken(uint vk)
    {
        int id = ProbeIdBase + (int)vk;
        if (!RegisterHotKey(IntPtr.Zero, id, ModNoRepeat, vk)) return true;
        UnregisterHotKey(IntPtr.Zero, id);
        return false;
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);

    [DllImport("user32.dll")]
    private static extern bool UnregisterHotKey(IntPtr hWnd, int id);
}
