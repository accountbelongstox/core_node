// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/rosbot_manager.py
using System.Runtime.InteropServices;
using System.Text;

namespace DotApps.d3d4tester.Core;

/// <summary>
/// ROSBOT detection result. 1:1 Python rosbot_manager.get_rosbot_detection dict.
/// Status: not_found (no process), running (process, zero visible windows), paused (any visible window: main UI or popup).
/// </summary>
public sealed class RosbotDetectionResult
{
    public string Status { get; init; } = RosbotDetection.StatusNotFound;
    public RosbotWindowInfo? WindowInfo { get; init; }
    public string ExeName { get; init; } = "";
    public IReadOnlyList<int> Pids { get; init; } = Array.Empty<int>();
    public bool IsMainUi { get; init; }
}

public sealed class RosbotWindowInfo
{
    public IntPtr Hwnd { get; init; }
    public string Title { get; init; } = "";
    public int Pid { get; init; }
}

/// <summary>
/// ROSBOT status values and the online check; detection itself is <see cref="RosbotManager.GetDetection"/>.
/// </summary>
public static class RosbotDetection
{
    public const string StatusNotFound = "not_found";
    public const string StatusRunning = "running";
    public const string StatusPaused = "paused";

    /// <summary>True for running or paused (ROSBOT online). 1:1 Python status in ("running", "paused").</summary>
    public static bool IsOnline(string? status) => status == StatusRunning || status == StatusPaused;

    /// <summary>
    /// ROSBOT is botting: process with no visible window, or online with its main UI hidden (the overlay window stays visible while
    /// it bots, so "paused" alone does not mean stopped).
    /// </summary>
    public static bool IsBotting(GameInterfaceStateSnapshot s) =>
        s.RosbotExtendedStatus == StatusRunning || (s.RosbotExtendedStatus == StatusPaused && !s.RosbotHasMainUi);
}

/// <summary>Win32 window helpers for the ROSBOT lookup (win32gui equivalents).</summary>
internal static class NativeWindowHelper
{
    private const int SwRestore = 9;
    private const int TitleCapacity = 512;

    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    private struct Rect
    {
        public int Left, Top, Right, Bottom;
    }

    [DllImport("user32.dll")]
    private static extern bool IsWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    private static extern bool GetWindowRect(IntPtr hWnd, out Rect lpRect);

    public static bool IsWindowValid(IntPtr hWnd) => hWnd != IntPtr.Zero && IsWindow(hWnd);


    /// <summary>Bring window to foreground and restore. 1:1 Python SetForegroundWindow + ShowWindow(SW_RESTORE).</summary>
    public static bool ActivateWindow(IntPtr hWnd)
    {
        if (!IsWindowValid(hWnd)) return false;
        try
        {
            SetForegroundWindow(hWnd);
            ShowWindow(hWnd, SwRestore);
            return true;
        }
        catch
        {
            return false;
        }
    }

    public static string GetTitle(IntPtr hWnd)
    {
        var sb = new StringBuilder(TitleCapacity);
        return GetWindowText(hWnd, sb, sb.Capacity) > 0 ? sb.ToString() : "";
    }

    /// <summary>Window size (width, height) from GetWindowRect, or null.</summary>
    public static (int Width, int Height)? GetWindowSize(IntPtr hWnd)
    {
        if (!IsWindowValid(hWnd) || !GetWindowRect(hWnd, out var r)) return null;
        return (r.Right - r.Left, r.Bottom - r.Top);
    }

    /// <summary>All top-level windows of the PID in EnumWindows order: (visible, all). 1:1 Python find_windows_by_pid callback lists.</summary>
    public static (List<RosbotWindowInfo> Visible, List<RosbotWindowInfo> Any) EnumWindowsByPid(int pid)
    {
        var visible = new List<RosbotWindowInfo>();
        var any = new List<RosbotWindowInfo>();
        if (pid <= 0) return (visible, any);
        try
        {
            EnumWindows((hWnd, _) =>
            {
                try
                {
                    GetWindowThreadProcessId(hWnd, out uint wpid);
                    if ((int)wpid != pid) return true;
                    var w = new RosbotWindowInfo { Hwnd = hWnd, Title = GetTitle(hWnd), Pid = pid };
                    any.Add(w);
                    if (IsWindowVisible(hWnd)) visible.Add(w);
                }
                catch { /* skip window */ }
                return true;
            }, IntPtr.Zero);
        }
        catch { /* return what was collected */ }
        return (visible, any);
    }

    /// <summary>All visible top-level windows. 1:1 Python EnumWindows + IsWindowVisible filter.</summary>
    public static List<IntPtr> EnumVisibleWindows()
    {
        var list = new List<IntPtr>();
        try
        {
            EnumWindows((hWnd, _) =>
            {
                if (IsWindowVisible(hWnd)) list.Add(hWnd);
                return true;
            }, IntPtr.Zero);
        }
        catch { /* ignore */ }
        return list;
    }
}
