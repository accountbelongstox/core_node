using DotCore.Foundations;

namespace DotCore.Utils.Window;

/// <summary>
/// Is a window owned by a browser process? Detection by process exe name only (no title or app logic).
/// 1:1 Python pycore/pyutils/common/browser_window_detector.py.
/// </summary>
public static class BrowserWindowDetector
{
    private const string LogTag = "[BrowserWindowDetector]";

    /// <summary>Exe base names (lowercase) that indicate a browser process. 1:1 Python BROWSER_EXE_NAMES.</summary>
    public static readonly IReadOnlyList<string> BrowserExeNames = new[]
    {
        "chrome.exe", "msedge.exe", "firefox.exe", "safari.exe",
        "opera.exe", "opera_gx.exe", "brave.exe", "browser.exe"
    };

    /// <summary>Exe path of the process owning hwnd, or null. 1:1 Python get_process_exe_path.</summary>
    public static string? GetProcessExePath(IntPtr hwnd)
    {
        if (hwnd == IntPtr.Zero || !OperatingSystem.IsWindows() || !WindowFinderNative.IsWindow(hwnd))
            return null;
        int? pid = ProcessUtil.GetPidFromHwnd(hwnd);
        return pid == null ? null : ProcessUtil.GetProcessExePath(pid.Value);
    }

    /// <summary>True if the exe file name is a known browser. 1:1 Python is_browser_process_by_path.</summary>
    public static bool IsBrowserProcessByPath(string? exePath)
    {
        if (string.IsNullOrWhiteSpace(exePath)) return false;
        string path = exePath.Trim().Replace('/', '\\');
        int last = path.LastIndexOf('\\');
        string name = (last >= 0 ? path[(last + 1)..] : path).ToLowerInvariant();
        return BrowserExeNames.Contains(name);
    }

    /// <summary>True if the window belongs to a browser process. 1:1 Python is_browser_window.</summary>
    public static bool IsBrowserWindow(IntPtr hwnd) => IsBrowserProcessByPath(GetProcessExePath(hwnd));

    /// <summary>Skip predicate for WindowFinder.FindWindowsByTitles: true (and log) for browser windows. 1:1 Python skip_browser_filter.</summary>
    public static bool SkipBrowserFilter(IntPtr hwnd, string windowTitle)
    {
        if (!IsBrowserWindow(hwnd)) return false;
        ColorPrinter.Yellow($"{LogTag} Skipping browser window (exe): '{windowTitle}'");
        return true;
    }

    /// <summary>Default skip callable for WindowFinder skipIf. 1:1 Python get_default_skip_browser_callable.</summary>
    public static Func<IntPtr, string, bool> GetDefaultSkipBrowserCallable() => SkipBrowserFilter;
}
