using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;

namespace DotApps.d3check.Services;

/// <summary>
/// Fluent 2 Mica backdrop for Win11. No-op on older OS. Call from MainWindow OnLoaded.
/// </summary>
public static class MicaBackdropHelper
{
    private const int DWMWA_SYSTEMBACKDROP_TYPE = 38;
    private const int DWM_SYSTEMBACKDROP_TYPE_MICA = 2;

    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int value, int size);

    /// <summary>Tries to enable Mica on the window. Returns true if the call succeeded (Win11).</summary>
    public static bool TryApplyMica(Window window)
    {
        var helper = new WindowInteropHelper(window);
        helper.EnsureHandle();
        int value = DWM_SYSTEMBACKDROP_TYPE_MICA;
        return DwmSetWindowAttribute(helper.Handle, DWMWA_SYSTEMBACKDROP_TYPE, ref value, sizeof(int)) == 0;
    }
}
