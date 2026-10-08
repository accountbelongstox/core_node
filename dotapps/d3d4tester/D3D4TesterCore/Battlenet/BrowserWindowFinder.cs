// PY-REF: pyapps/d3-check/d3utils/browser_login_window_finder.py
using DotCore.Utils;
using DotCore.Utils.Window;

namespace DotApps.d3d4tester.Core.Battlenet;

/// <summary>
/// Find browser login windows by title, owned by a browser process only. 1:1 Python browser_login_window_finder:
/// find_browser_login_windows.
/// Fixes C# port bug: without the browser-process filter the Battle.net client window itself matched.
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

    /// <summary>Find visible browser-process windows whose title contains any of the given substrings.</summary>
    public static IReadOnlyList<BrowserLoginWindow> FindBrowserLoginWindows(string[]? titleSubstrs = null)
    {
        var needles = (titleSubstrs ?? BattlenetConstants.CnBrowserLoginWindowTitleKeywords ?? Array.Empty<string>())
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .Select(s => s.Trim())
            .ToList();
        if (needles.Count == 0) return Array.Empty<BrowserLoginWindow>();
        return WindowFinder.FindWindowsByTitles(needles, WindowFinder.TitleMatchMode.In, (hwnd, _) => !BrowserWindowDetector.IsBrowserWindow(hwnd))
            .Select(w => new BrowserLoginWindow
            {
                Hwnd = w.Hwnd,
                Title = w.Title,
                Rect = (w.Left, w.Top, w.Right, w.Bottom)
            })
            .ToList();
    }
}
