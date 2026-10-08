// PY-REF: pyapps/d3-check/d3utils/d3_manager.py
using DotCore.Foundations;
using DotCore.ScreenCapture;
using DotCore.Utils;

namespace DotApps.d3d4tester.Core;

/// <summary>
/// Shared game-client window control for D3 and D4: find windows (subclass), first window, running check, poll until the window
/// appears after Play, kill the owning process(es) by PID, activate. 1:1 Python d3utils/d3_manager.py, generalised for D4.
/// </summary>
public abstract class GameWindowManager
{
    public const double DefaultPollTimeoutSec = 8.0;
    public const double DefaultPollIntervalSec = 0.5;
    public const int DefaultPollLogEveryN = 4;

    protected abstract string LogPrefix { get; }

    /// <summary>Short game label for logs (D3 / D4).</summary>
    protected abstract string GameLabel { get; }

    /// <summary>Visible windows of this game client.</summary>
    public abstract IReadOnlyList<WindowFinder.WindowInfo> FindWindows();

    public WindowFinder.WindowInfo? FindFirstWindow()
    {
        var windows = FindWindows();
        return windows.Count > 0 ? windows[0] : null;
    }

    /// <summary>Handle of the first game window, or IntPtr.Zero.</summary>
    public IntPtr FindFirstHwnd() => FindFirstWindow()?.Hwnd ?? IntPtr.Zero;

    public bool IsRunning() => FindWindows().Count > 0;

    /// <summary>Minimum window height (pixels) for a ready game window; 0 = any window counts.</summary>
    protected virtual int ReadyMinHeight => 0;

    /// <summary>True when the game window is up and full size (not a splash / loading stub).</summary>
    public bool IsWindowReady() => FindFirstWindow() is { } w && w.Height > ReadyMinHeight;

    /// <summary>Client process names of this game (process may run before its window shows); empty when unknown.</summary>
    protected virtual IReadOnlyList<string> ProcessNames => Array.Empty<string>();

    /// <summary>True when a client process of this game runs, window or not.</summary>
    public bool IsProcessRunning()
    {
        foreach (string name in ProcessNames)
        {
            var processes = System.Diagnostics.Process.GetProcessesByName(name);
            foreach (var p in processes) p.Dispose();
            if (processes.Length > 0) return true;
        }
        return false;
    }

    /// <summary>Process ids owning the game window(s) (resource monitor, kill).</summary>
    public IReadOnlyCollection<int> GetProcessIds()
    {
        var pids = new HashSet<int>();
        foreach (var w in FindWindows())
        {
            if (w.Hwnd != IntPtr.Zero && ProcessUtil.GetPidFromHwnd(w.Hwnd) is int pid && pid > 0)
                pids.Add(pid);
        }
        return pids;
    }

    /// <summary>After clicking Play, poll until a game window appears. 1:1 Python poll_until_window_appears.</summary>
    public bool PollUntilWindowAppears(
        double timeoutSec = DefaultPollTimeoutSec,
        double intervalSec = DefaultPollIntervalSec,
        int logProgressEveryN = DefaultPollLogEveryN)
    {
        int totalRounds = Math.Max(1, (int)Math.Round(timeoutSec / intervalSec));
        var deadline = DateTime.UtcNow.AddSeconds(timeoutSec);
        int pollI = 0;
        while (DateTime.UtcNow < deadline)
        {
            pollI++;
            bool log = logProgressEveryN > 0 && (pollI == 1 || pollI % logProgressEveryN == 0);
            if (IsRunning())
            {
                if (log) ColorPrinter.Gray($"{LogPrefix} poll {GameLabel} window #{pollI} -> found");
                return true;
            }
            if (log) ColorPrinter.Gray($"{LogPrefix} poll {GameLabel} window #{pollI}/{totalRounds} -> not found");
            Thread.Sleep(TimeSpan.FromSeconds(intervalSec));
        }
        return false;
    }

    /// <summary>
    /// Kill the process(es) owning the found window(s) by PID (not by exe name). True if killed or not running.
    /// 1:1 Python kill_if_running.
    /// </summary>
    public bool KillIfRunning()
    {
        if (!IsRunning()) return true;
        var pids = GetProcessIds();
        if (pids.Count == 0)
        {
            ColorPrinter.Yellow($"{LogPrefix} {GameLabel} window found but could not get PID");
            return false;
        }
        ColorPrinter.Blue($"{LogPrefix} {GameLabel} window(s) found, killing {pids.Count} process(es) by PID...");
        bool ok = true;
        foreach (var pid in pids)
        {
            if (!ProcessUtil.KillProcessByPid(pid, logPrefix: LogPrefix))
                ok = false;
        }
        return ok;
    }

    /// <summary>Bring the game window to front and wait the settle delay. 1:1 Python _activate_d3_window.</summary>
    public bool ActivateWindow()
    {
        var w = FindFirstWindow();
        if (w == null || w.Hwnd == IntPtr.Zero) return false;
        ScreenCaptureService.ActivateWindow(w.Hwnd);
        Thread.Sleep(D3InterfaceConstants.ActivateBeforeCaptureDelayMs);
        return true;
    }
}
