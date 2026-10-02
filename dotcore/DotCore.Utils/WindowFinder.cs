// PY-REF: pyapps/d3-check/d3utils/d3_manager.py
using System.Runtime.InteropServices;
using System.Text;
using DotCore.Utils.Window;

namespace DotCore.Utils;

/// <summary>
/// Window finder: enumerate by exe or by title with skip filter. 1:1 with Python WindowFinder.find_windows_by_titles
/// and browser/editor skip logic. No app-specific constants; callers pass titles and skip predicate.
/// </summary>
public static class WindowFinder
{
    /// <summary>Match mode for title comparison. 1:1 Python match_mode.</summary>
    public enum TitleMatchMode
    {
        /// <summary>target contained in window title (case-insensitive).</summary>
        In,
        Exact,
        StartsWith,
        EndsWith
    }

    /// <summary>One window info. 1:1 Python window dict (hwnd, title, class_name, rect, width, height).</summary>
    public sealed class WindowInfo
    {
        public IntPtr Hwnd { get; set; }
        public string Title { get; set; } = "";
        public string ClassName { get; set; } = "";
        public int Left { get; set; }
        public int Top { get; set; }
        public int Right { get; set; }
        public int Bottom { get; set; }
        public int Width => Right - Left;
        public int Height => Bottom - Top;
    }

    /// <summary>Get process executable path for window. Delegates to BrowserWindowDetector.GetProcessExePath.</summary>
    public static string? GetProcessExePath(IntPtr hwnd) => BrowserWindowDetector.GetProcessExePath(hwnd);

    /// <summary>Exe base names (lowercase) that indicate a browser. Same list as BrowserWindowDetector.BrowserExeNames.</summary>
    public static IReadOnlyList<string> BrowserExeNames => BrowserWindowDetector.BrowserExeNames;

    /// <summary>True if exe path belongs to a known browser. Delegates to BrowserWindowDetector.IsBrowserProcessByPath.</summary>
    public static bool IsBrowserProcessByPath(string? exePath) => BrowserWindowDetector.IsBrowserProcessByPath(exePath);

    /// <summary>True if window title looks like an editor/document (Notepad++, path + .txt/.json etc). 1:1 Python _is_editor_like_title.</summary>
    public static bool IsEditorLikeTitle(string? title)
    {
        if (string.IsNullOrWhiteSpace(title)) return false;
        var t = title.Trim();
        if (t.Contains(" - Notepad++", StringComparison.Ordinal) || t.EndsWith(" - Notepad", StringComparison.Ordinal))
            return true;
        if (t.Contains(" - ", StringComparison.Ordinal) &&
            (t.Contains(".txt", StringComparison.Ordinal) || t.Contains(".ini", StringComparison.Ordinal) ||
             t.Contains(".json", StringComparison.Ordinal) || t.Contains(".xml", StringComparison.Ordinal)))
            return true;
        return false;
    }

    /// <summary>Find windows by title list with match mode and optional skip filter. 1:1 Python find_windows_by_titles (match_mode "in", skip_browser_if).</summary>
    /// <param name="titles">Titles to match (e.g. "Diablo III", "III").</param>
    /// <param name="matchMode">How to compare (In = target contained in window title, case-insensitive).</param>
    /// <param name="skipIf">When true, window is skipped (e.g. browser by exe, editor-like title). Signature: (hwnd, windowTitle) -> skip.</param>
    public static IReadOnlyList<WindowInfo> FindWindowsByTitles(
        IReadOnlyList<string> titles,
        TitleMatchMode matchMode = TitleMatchMode.In,
        Func<IntPtr, string, bool>? skipIf = null)
    {
        var list = new List<WindowInfo>();
        if (titles == null || titles.Count == 0) return list;

        bool EnumCallback(IntPtr hwnd, IntPtr _)
        {
            if (!WindowFinderNative.IsWindowVisible(hwnd)) return true;
            var title = GetWindowText(hwnd);
            if (string.IsNullOrEmpty(title)) return true;

            foreach (var target in titles)
            {
                bool match = matchMode switch
                {
                    TitleMatchMode.Exact => string.Equals(title, target, StringComparison.OrdinalIgnoreCase),
                    TitleMatchMode.StartsWith => title.StartsWith(target, StringComparison.OrdinalIgnoreCase),
                    TitleMatchMode.EndsWith => title.EndsWith(target, StringComparison.OrdinalIgnoreCase),
                    _ => title.Contains(target, StringComparison.OrdinalIgnoreCase)
                };
                if (!match) continue;

                if (skipIf != null && skipIf(hwnd, title))
                    continue;

                if (WindowFinderNative.GetWindowRect(hwnd, out var r))
                {
                    list.Add(new WindowInfo
                    {
                        Hwnd = hwnd,
                        Title = title,
                        ClassName = GetClassName(hwnd),
                        Left = r.Left,
                        Top = r.Top,
                        Right = r.Right,
                        Bottom = r.Bottom
                    });
                }
                return true;
            }
            return true;
        }

        try
        {
            WindowFinderNative.EnumWindows(EnumCallback, IntPtr.Zero);
        }
        catch (Exception)
        {
            // ignore
        }
        return list;
    }

    /// <summary>Find windows by process exe basename (e.g. "Diablo III.exe"). 1:1 Python _find_windows_by_exe.</summary>
    public static IReadOnlyList<WindowInfo> FindWindowsByExe(string exeName)
    {
        var list = new List<WindowInfo>();
        var exeLower = (exeName ?? "").Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(exeLower)) return list;

        bool EnumCallback(IntPtr hwnd, IntPtr _)
        {
            if (!WindowFinderNative.IsWindowVisible(hwnd)) return true;
            var path = GetProcessExePath(hwnd);
            if (string.IsNullOrEmpty(path))
                return true;
            var baseName = Path.GetFileName(path).ToLowerInvariant();
            if (baseName != exeLower) return true;

            if (!WindowFinderNative.GetWindowRect(hwnd, out var r)) return true;
            list.Add(new WindowInfo
            {
                Hwnd = hwnd,
                Title = GetWindowText(hwnd),
                ClassName = GetClassName(hwnd),
                Left = r.Left,
                Top = r.Top,
                Right = r.Right,
                Bottom = r.Bottom
            });
            return true;
        }

        try
        {
            WindowFinderNative.EnumWindows(EnumCallback, IntPtr.Zero);
        }
        catch (Exception)
        {
            // ignore
        }
        return list;
    }

    private static string GetWindowText(IntPtr hwnd)
    {
        var sb = new StringBuilder(512);
        return WindowFinderNative.GetWindowText(hwnd, sb, sb.Capacity) > 0 ? sb.ToString() : "";
    }

    private static string GetClassName(IntPtr hwnd)
    {
        try
        {
            var sb = new StringBuilder(256);
            if (GetClassNameNative(hwnd, sb, sb.Capacity) > 0)
                return sb.ToString();
        }
        catch { /* ignore */ }
        return "";
    }

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetClassNameNative(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);
}
