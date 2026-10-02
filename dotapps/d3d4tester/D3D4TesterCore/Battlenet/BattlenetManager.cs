// PY-REF: pyapps/d3-check/d3utils/battlenet_manager.py
// PY-REF: pyapps/d3-check/share/battlenet_window_finder.py
// PY-REF: pyapps/d3-check/d3utils/process_helper.py
using System.Diagnostics;
using System.IO;
using DotCore.Foundations;
using DotCore.ScreenCapture;
using DotCore.UIInspect;
using DotCore.Utils;

namespace DotApps.d3d4tester.Core.Battlenet;

/// <summary>
/// Battle.net process and window: start, kill (terminate + wait), restart, find windows by process exe, activate. Path from app via SetPathProvider.
/// 1:1 Python d3utils/battlenet_manager.py + share/battlenet_window_finder.py.
/// </summary>
public sealed class BattlenetManager
{
    private const string LogPrefix = "[BattleNetManager]";
    private const string DefaultCaptureTitle = "Battle.net";
    private static readonly string[] TrayIconKeywords = { "battle", "blizzard" };
    private const int AfterTrayClickMs = 1000;

    private static BattlenetManager? _instance;
    private Func<string?>? _pathProvider;

    public static BattlenetManager Instance => _instance ??= new BattlenetManager();

    private BattlenetManager() { }

    /// <summary>Set by app at startup. Called to get battlenet.exe path from config.</summary>
    public void SetPathProvider(Func<string?>? provider) => _pathProvider = provider;

    /// <summary>Configured path when the file exists, else null. 1:1 Python get_battlenet_path.</summary>
    public string? GetPath()
    {
        var path = _pathProvider?.Invoke();
        if (string.IsNullOrWhiteSpace(path)) return null;
        path = path.Trim();
        return File.Exists(path) ? path : null;
    }

    /// <summary>Start Battle.net. Returns true if the start command was sent. 1:1 Python start(exe_path).</summary>
    public bool Start(string? exePath = null)
    {
        string? path = exePath ?? GetPath();
        if (string.IsNullOrWhiteSpace(path) || !File.Exists(path))
        {
            ColorPrinter.Red($"{LogPrefix} Battle.net path not configured");
            return false;
        }
        if (HasWindow())
            return true;
        ColorPrinter.Blue($"{LogPrefix} Starting Battle.net: {path}");
        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = path,
                UseShellExecute = true,
                WorkingDirectory = Path.GetDirectoryName(path) ?? ""
            });
            ColorPrinter.Green($"{LogPrefix} Battle.net start command sent");
            return true;
        }
        catch (Exception ex)
        {
            ColorPrinter.Red($"{LogPrefix} Start failed: {ex.Message}");
            return false;
        }
    }

    /// <summary>Kill Battle.net.exe and wait for exit (15 s). Always true. 1:1 Python kill() via kill_process_by_exe.</summary>
    public bool Close()
    {
        ColorPrinter.Blue($"{LogPrefix} Killing Battle.net...");
        bool ok = ProcessUtil.KillProcessByExe(BattlenetConstants.BattlenetExeName, BattlenetConstants.KillWaitTimeoutSec, LogPrefix);
        BattlenetControlTree.InvalidateLightCache();
        return ok;
    }

    /// <summary>Alias of Close. 1:1 Python kill.</summary>
    public bool Kill() => Close();

    /// <summary>Kill then start. 1:1 Python restart(exe_path, wait_after_sec).</summary>
    public bool Restart(string? exePath = null, double waitAfterSec = 2.0)
    {
        string? path = exePath ?? GetPath();
        if (string.IsNullOrWhiteSpace(path))
            return false;
        Close();
        if (waitAfterSec > 0)
            Thread.Sleep((int)(waitAfterSec * 1000));
        return Start(path);
    }

    /// <summary>Visible windows owned by Battle.net.exe. 1:1 Python find_battlenet_windows.</summary>
    public IReadOnlyList<WindowFinder.WindowInfo> FindWindows() => WindowFinder.FindWindowsByExe(BattlenetConstants.BattlenetExeName);

    /// <summary>First Battle.net window or null. 1:1 Python find_battlenet_window.</summary>
    public WindowFinder.WindowInfo? FindBattlenetWindow()
    {
        var windows = FindWindows();
        return windows.Count > 0 ? windows[0] : null;
    }

    /// <summary>Process owning the first Battle.net window, or null.</summary>
    public Process? GetProcess()
    {
        var win = FindBattlenetWindow();
        if (win == null) return null;
        int? pid = ProcessUtil.GetPidFromHwnd(win.Hwnd);
        if (pid == null) return null;
        try
        {
            return Process.GetProcessById(pid.Value);
        }
        catch (ArgumentException)
        {
            return null;
        }
    }

    /// <summary>Process ids of the Battle.net client and its update agent (resource monitor).</summary>
    public IReadOnlyCollection<int> GetProcessIds()
    {
        var pids = new List<int>();
        foreach (var name in BattlenetConstants.ClientProcessNames)
        {
            foreach (var p in Process.GetProcessesByName(name))
            {
                pids.Add(p.Id);
                p.Dispose();
            }
        }
        return pids;
    }

    /// <summary>True when a Battle.net.exe process runs (also when every window is hidden in the tray).</summary>
    public bool IsProcessRunning()
    {
        var processes = Process.GetProcessesByName(BattlenetConstants.ClientProcessNames[0]);
        foreach (var p in processes) p.Dispose();
        return processes.Length > 0;
    }

    /// <summary>True if a visible Battle.net window exists.</summary>
    public bool HasWindow() => FindBattlenetWindow() != null;

    /// <summary>
    /// Restore a Battle.net hidden in the notification area by double-clicking its tray icon, then wait 1 s.
    /// 1:1 Python ClickHandler.find_and_click_tray_icon(instant=True, interval_after=1.0).
    /// </summary>
    public bool RestoreFromTray()
    {
        bool ok = TrayIconClicker.ClickTrayIcon(TrayIconKeywords);
        if (ok) Thread.Sleep(AfterTrayClickMs);
        return ok;
    }

    /// <summary>Restore + foreground the first window. True if a window was found. 1:1 Python activate_window.</summary>
    public bool ActivateWindow()
    {
        var win = FindBattlenetWindow();
        if (win == null) return false;
        ColorPrinter.Blue($"{LogPrefix} Activating Battle.net window to front...");
        ScreenCaptureService.ActivateWindow(win.Hwnd);
        return true;
    }

    /// <summary>Titles passed to capture (BATTLE_NET_WINDOW_TITLES[0]). 1:1 Python get_capture_titles.</summary>
    public IReadOnlyList<string> GetCaptureTitles() => new[] { DefaultCaptureTitle };
}
