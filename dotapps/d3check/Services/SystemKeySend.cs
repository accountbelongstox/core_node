using System.Runtime.InteropServices;

namespace DotApps.d3check.Services;

/// <summary>System-wide key injection (e.g. F7 for Smart Echo). 1:1 Python d3utils.key_send.send_f7_to_system (keybd_event).</summary>
public static class SystemKeySend
{
    private const uint KeyeventfKeyup = 0x0002;
    private const byte VkF7 = 0x76;

    [DllImport("user32.dll")]
    private static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    public static bool TrySendF7()
    {
        try
        {
            keybd_event(VkF7, 0, 0, UIntPtr.Zero);
            Thread.Sleep(50);
            keybd_event(VkF7, 0, KeyeventfKeyup, UIntPtr.Zero);
            return true;
        }
        catch
        {
            return false;
        }
    }
}
