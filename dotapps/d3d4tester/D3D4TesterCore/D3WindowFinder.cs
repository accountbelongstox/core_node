// PY-REF: pyapps/d3-check/d3utils/d3_manager.py
using System.IO;
using DotCore.Foundations;
using DotCore.Utils;

namespace DotApps.d3d4tester.Core;

/// <summary>
/// D3 window finder: by config exe path (d3.d3_path, same key as path scan and the ROSBOT page) first, then by title with
/// browser/editor skip. 1:1 with Python D3Manager.find_windows. Config path from app via SetConfigPathProvider.
/// </summary>
public static class D3WindowFinder
{
    private static Func<string?>? _configPathProvider;

    /// <summary>Set provider for d3.d3_path (full exe path). Call from app once (e.g. OnLoaded). Same key as path scan / RosbotPage TxtD3Path (ConfigKeys.D3Path). When null, find by title only.</summary>
    public static void SetConfigPathProvider(Func<string?>? provider) => _configPathProvider = provider;

    /// <summary>Return D3 exe path from config if valid file; else null. 1:1 Python get_path().</summary>
    public static string? GetConfiguredExePath()
    {
        var path = _configPathProvider?.Invoke()?.Trim();
        if (string.IsNullOrEmpty(path)) return null;
        try
        {
            var p = Path.GetFullPath(path);
            return File.Exists(p) ? p : null;
        }
        catch
        {
            return null;
        }
    }

    /// <summary>Skip predicate: browser (by exe) or editor-like title. 1:1 Python _skip_browser = default_skip or _is_editor_like_title.</summary>
    private static bool SkipBrowserOrEditor(IntPtr hwnd, string title)
    {
        if (WindowFinder.IsEditorLikeTitle(title)) return true;
        var exePath = WindowFinder.GetProcessExePath(hwnd);
        if (WindowFinder.IsBrowserProcessByPath(exePath))
        {
            ColorPrinter.Yellow($"[D3WindowFinder] Skipping browser window (exe): '{title}'");
            return true;
        }
        return false;
    }

    /// <summary>Find D3 windows: by exe when config path set, else by title with skip. 1:1 Python find_windows(use_cache).</summary>
    public static IReadOnlyList<WindowFinder.WindowInfo> FindWindows()
    {
        var exePath = GetConfiguredExePath();
        if (!string.IsNullOrEmpty(exePath))
        {
            var exeName = Path.GetFileName(exePath);
            if (!string.IsNullOrEmpty(exeName))
            {
                var byExe = WindowFinder.FindWindowsByExe(exeName);
                if (byExe.Count > 0)
                    return byExe;
            }
        }
        return WindowFinder.FindWindowsByTitles(
            D3WindowConstants.DiabloIIIWindowTitles,
            WindowFinder.TitleMatchMode.In,
            SkipBrowserOrEditor);
    }

    /// <summary>First D3 window handle or IntPtr.Zero. Convenience for callers that only need hwnd.</summary>
    public static IntPtr FindFirstHandle()
    {
        var list = FindWindows();
        return list.Count > 0 ? list[0].Hwnd : IntPtr.Zero;
    }
}
