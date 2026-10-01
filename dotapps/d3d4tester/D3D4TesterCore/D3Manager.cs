using DotCore.Foundations;
using DotCore.ScreenCapture;
using DotCore.Utils;

namespace DotApps.d3d4tester.Core;

/// <summary>
/// Diablo III process/window management: find (exe first, then title via D3WindowFinder), poll until window appears,
/// kill by PID of the found window(s), prime the capture window cache, activate + capture the game window.
/// 1:1 Python d3utils/d3_manager.py (+ _activate_d3_window / provider.gen(window_titles=D3) of d3_start_game_and_teleport_waiter.py).
/// </summary>
public sealed class D3Manager
{
    private const string LogPrefix = "[D3Manager]";
    private const double DefaultPollTimeoutSec = 8.0;
    private const double DefaultPollIntervalSec = 0.5;
    private const int DefaultPollLogEveryN = 4;

    public static D3Manager Instance { get; } = new();

    private D3Manager()
    {
    }

    /// <summary>Titles passed to provider/analyzer after prime. 1:1 Python get_capture_titles.</summary>
    public IReadOnlyList<string> GetCaptureTitles() => D3WindowConstants.DiabloIIIWindowTitles;

    /// <summary>D3 windows: by exe when d3.d3_path is set, else by title. 1:1 Python find_windows.</summary>
    public IReadOnlyList<WindowFinder.WindowInfo> FindWindows() => D3WindowFinder.FindWindows();

    public WindowFinder.WindowInfo? FindFirstWindow()
    {
        var windows = FindWindows();
        return windows.Count > 0 ? windows[0] : null;
    }

    public bool IsRunning() => FindWindows().Count > 0;

    /// <summary>After clicking Play, poll until a D3 window appears. 1:1 Python poll_until_window_appears.</summary>
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
                if (log) ColorPrinter.Gray($"{LogPrefix} poll D3 window #{pollI} -> found");
                return true;
            }
            if (log) ColorPrinter.Gray($"{LogPrefix} poll D3 window #{pollI}/{totalRounds} -> not found");
            Thread.Sleep(TimeSpan.FromSeconds(intervalSec));
        }
        return false;
    }

    /// <summary>
    /// Kill the process(es) owning the found D3 window(s) by PID (not by exe name). True if killed or not running.
    /// 1:1 Python kill_if_running.
    /// </summary>
    public bool KillIfRunning()
    {
        var windows = FindWindows();
        if (windows.Count == 0) return true;
        var pids = new HashSet<int>();
        foreach (var w in windows)
        {
            if (w.Hwnd == IntPtr.Zero) continue;
            if (ProcessUtil.GetPidFromHwnd(w.Hwnd) is int pid && pid > 0)
                pids.Add(pid);
        }
        if (pids.Count == 0)
        {
            ColorPrinter.Yellow($"{LogPrefix} D3 window found but could not get PID");
            return false;
        }
        ColorPrinter.Blue($"{LogPrefix} D3 window(s) found, killing {pids.Count} process(es) by PID...");
        bool ok = true;
        foreach (var pid in pids)
        {
            if (!ProcessUtil.KillProcessByPid(pid, logPrefix: LogPrefix))
                ok = false;
        }
        return ok;
    }

    /// <summary>Find the window and prime the capture window cache. 1:1 Python prime_window_cache_for_capture.</summary>
    public bool PrimeWindowCacheForCapture()
    {
        var w = FindFirstWindow();
        if (w == null) return false;
        var title = string.IsNullOrEmpty(w.Title) ? GetCaptureTitles()[0] : w.Title;
        ScreenCaptureService.GetScreenshotProvider().CacheWindow(GetCaptureTitles(), w.Hwnd, title, w.ClassName);
        return true;
    }

    /// <summary>Clear the capture window cache (Python WindowFinder.invalidate_window_cache(D3 titles)).</summary>
    public void InvalidateWindowCache() => ScreenCaptureService.GetScreenshotProvider().ClearWindowCache();

    /// <summary>Bring the D3 window to front and wait the settle delay. 1:1 Python _activate_d3_window.</summary>
    public bool ActivateWindow()
    {
        var w = FindFirstWindow();
        if (w == null || w.Hwnd == IntPtr.Zero) return false;
        ScreenCaptureService.ActivateWindow(w.Hwnd);
        Thread.Sleep(D3InterfaceConstants.ActivateBeforeCaptureDelayMs);
        return true;
    }

    /// <summary>
    /// Capture the D3 game window and update global scale; null when no window or capture failed.
    /// 1:1 Python get_screenshot_provider().gen(use_optimized_capture=True, window_titles=D3 titles).
    /// </summary>
    public ScreenshotData? CaptureGameWindow(bool activateFirst = false)
    {
        if (activateFirst) ActivateWindow();
        var w = FindFirstWindow();
        if (w == null || w.Hwnd == IntPtr.Zero) return null;
        var sd = ScreenshotAndScaleHelper.CaptureGameWindowAndUpdateScale(w.Hwnd);
        return sd?.GameWindowImage == null ? null : sd;
    }

    /// <summary>Send one key (down, short hold, up) to the D3 window via PostMessage. 1:1 Python window_send_key press/release.</summary>
    public bool SendKeyToWindow(ushort vk)
    {
        var w = FindFirstWindow();
        if (w == null || w.Hwnd == IntPtr.Zero) return false;
        WindowInputHelper.SendKey(w.Hwnd, vk, true);
        Thread.Sleep(D3InterfaceConstants.SendKeyHoldMs);
        WindowInputHelper.SendKey(w.Hwnd, vk, false);
        return true;
    }
}
