using System.Runtime.InteropServices;
using System.Text;

namespace DotApps.d3check.Core.Battlenet;

/// <summary>
/// Find browser login windows by title. 1:1 Python browser_login_window_finder:
/// find_browser_login_windows / get_frontmost_browser_login_window.
/// </summary>
public static class BrowserWindowFinder
{
    /// <summary>Result: hwnd, title, rect (Left, Top, Right, Bottom).</summary>
    public sealed class BrowserLoginWindow
    {
        public IntPtr Hwnd { get; set; }
        public string Title { get; set; } = "";
        public (int Left, int Top, int Right, int Bottom) Rect { get; set; }
    }

    /// <summary>Find visible windows whose title contains any of the given substrings.</summary>
    public static IReadOnlyList<BrowserLoginWindow> FindBrowserLoginWindows(string[]? titleSubstrs = null)
    {
        var needles = titleSubstrs ?? BattlenetConstants.CnBrowserLoginWindowTitleKeywords;
        if (needles == null || needles.Length == 0) return Array.Empty<BrowserLoginWindow>();
        var list = new List<BrowserLoginWindow>();
        var needlesList = needles.ToList();
        try
        {
            EnumWindows((hwnd, _) =>
            {
                if (!IsWindowVisible(hwnd)) return true;
                var title = GetWindowText(hwnd);
                if (string.IsNullOrEmpty(title)) return true;
                if (!needlesList.Any(nd => title.Contains(nd, StringComparison.Ordinal))) return true;
                if (!GetWindowRect(hwnd, out var r)) return true;
                list.Add(new BrowserLoginWindow
                {
                    Hwnd = hwnd,
                    Title = title,
                    Rect = (r.Left, r.Top, r.Right, r.Bottom)
                });
                return true;
            }, IntPtr.Zero);
        }
        catch { /* ignore */ }
        return list;
    }

    /// <summary>Return foreground window if it matches, otherwise first from FindBrowserLoginWindows. 1:1 get_frontmost_browser_login_window.</summary>
    public static BrowserLoginWindow? GetFrontmostBrowserLoginWindow(string[]? titleSubstrs = null)
    {
        var candidates = FindBrowserLoginWindows(titleSubstrs).ToList();
        if (candidates.Count == 0) return null;
        try
        {
            var fg = GetForegroundWindow();
            if (fg != IntPtr.Zero)
            {
                var match = candidates.FirstOrDefault(c => c.Hwnd == fg);
                if (match != null) return match;
            }
        }
        catch { /* ignore */ }
        return candidates[0];
    }

    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [StructLayout(LayoutKind.Sequential)]
    private struct RECT
    {
        public int Left, Top, Right, Bottom;
    }

    private static string GetWindowText(IntPtr hwnd)
    {
        var sb = new StringBuilder(512);
        return GetWindowText(hwnd, sb, sb.Capacity) > 0 ? sb.ToString() : "";
    }
}
