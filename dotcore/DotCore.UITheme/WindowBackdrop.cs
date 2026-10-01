using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Shell;

namespace DotCore.UITheme;

/// <summary>
/// DWM window integration: Mica backdrop (Win11), immersive dark title/frame, rounded corners.
/// Falls back silently (solid window background) on older systems or when DWM calls fail.
/// </summary>
public static class WindowBackdrop
{
    private const int DwmwaUseImmersiveDarkModeLegacy = 19;
    private const int DwmwaUseImmersiveDarkMode = 20;
    private const int DwmwaWindowCornerPreference = 33;
    private const int DwmwaSystemBackdropType = 38;
    private const int DwmwaMicaEffect = 1029;
    private const int DwmsbtMainWindow = 2;
    private const int DwmwcpRound = 2;
    private const int BuildWin11 = 22000;
    private const int BuildWin11Backdrop = 22621;
    private const int BuildDarkModeAttribute = 18985;

    private static readonly DependencyProperty IsMicaAppliedProperty = DependencyProperty.RegisterAttached(
        "IsMicaApplied", typeof(bool), typeof(WindowBackdrop), new PropertyMetadata(false));

    [StructLayout(LayoutKind.Sequential)]
    private struct Margins
    {
        public int Left;
        public int Right;
        public int Top;
        public int Bottom;
    }

    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int value, int size);

    [DllImport("dwmapi.dll")]
    private static extern int DwmExtendFrameIntoClientArea(IntPtr hwnd, ref Margins margins);

    private static int OsBuild => Environment.OSVersion.Platform == PlatformID.Win32NT ? Environment.OSVersion.Version.Build : 0;

    /// <summary>True on Windows 11 (build 22000+), where Mica is available.</summary>
    public static bool IsMicaSupported => OsBuild >= BuildWin11;

    /// <summary>True when Mica was applied to the window by <see cref="TryApplyMica"/>.</summary>
    public static bool IsMicaApplied(Window window) => (bool)window.GetValue(IsMicaAppliedProperty);

    /// <summary>
    /// Applies dark/light frame and, on Win11, the Mica backdrop. On success the window background becomes transparent
    /// so Mica shows through transparent regions; otherwise the window keeps its solid background.
    /// </summary>
    public static bool TryApplyMica(Window window, bool darkMode)
    {
        var hwnd = new WindowInteropHelper(window).EnsureHandle();
        if (hwnd == IntPtr.Zero) return false;
        SetDarkMode(window, darkMode);
        TrySetAttribute(hwnd, DwmwaWindowCornerPreference, DwmwcpRound);
        if (IsMicaApplied(window))
        {
            ExtendGlassFrame(window, hwnd);
            return true;
        }
        if (!IsMicaSupported || RenderCapability.Tier == 0) return false;

        var applied = OsBuild >= BuildWin11Backdrop
            ? TrySetAttribute(hwnd, DwmwaSystemBackdropType, DwmsbtMainWindow)
            : TrySetAttribute(hwnd, DwmwaMicaEffect, 1);
        if (!applied) return false;

        ExtendGlassFrame(window, hwnd);
        window.Background = Brushes.Transparent;
        window.SetValue(IsMicaAppliedProperty, true);
        return true;
    }

    /// <summary>Sets the DWM immersive dark mode attribute (frame, caption, Mica tint).</summary>
    public static void SetDarkMode(Window window, bool darkMode)
    {
        var hwnd = new WindowInteropHelper(window).Handle;
        if (hwnd == IntPtr.Zero || OsBuild == 0) return;
        var attr = OsBuild >= BuildDarkModeAttribute ? DwmwaUseImmersiveDarkMode : DwmwaUseImmersiveDarkModeLegacy;
        TrySetAttribute(hwnd, attr, darkMode ? 1 : 0);
    }

    private static void ExtendGlassFrame(Window window, IntPtr hwnd)
    {
        var chrome = WindowChrome.GetWindowChrome(window);
        if (chrome != null && chrome.GlassFrameThickness != new Thickness(-1))
        {
            var updated = (WindowChrome)chrome.Clone();
            updated.GlassFrameThickness = new Thickness(-1);
            WindowChrome.SetWindowChrome(window, updated);
        }
        var source = HwndSource.FromHwnd(hwnd);
        if (source?.CompositionTarget != null)
            source.CompositionTarget.BackgroundColor = Colors.Transparent;
        var margins = new Margins { Left = -1, Right = -1, Top = -1, Bottom = -1 };
        try { DwmExtendFrameIntoClientArea(hwnd, ref margins); }
        catch (DllNotFoundException) { }
        catch (EntryPointNotFoundException) { }
    }

    private static bool TrySetAttribute(IntPtr hwnd, int attr, int value)
    {
        try { return DwmSetWindowAttribute(hwnd, attr, ref value, sizeof(int)) == 0; }
        catch (DllNotFoundException) { return false; }
        catch (EntryPointNotFoundException) { return false; }
    }
}
