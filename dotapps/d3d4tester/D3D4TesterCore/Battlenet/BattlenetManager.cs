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
    private static readonly string[] TrayIconKeywords = { "battle", "blizzard" };
    private const int AfterTrayClickMs = 1000;

    private static BattlenetManager? _instance;
    private Func<string?>? _pathProvider;
    private Func<string?>? _regionProvider;

    public static BattlenetManager Instance => _instance ??= new BattlenetManager();

    private BattlenetManager() { }

    /// <summary>Set by app at startup. Called to get battlenet.exe path from config.</summary>
    public void SetPathProvider(Func<string?>? provider) => _pathProvider = provider;

    /// <summary>Set by app at startup: the user's global region ("cn" / "asia" / empty). Every start passes it as --setregion.</summary>
    public void SetRegionProvider(Func<string?>? provider) => _regionProvider = provider;

    /// <summary>The global region the client must run in, or null when the user did not choose one.</summary>
    public string? GetConfiguredRegion() => _regionProvider?.Invoke() is { } r && (r == BattlenetConstants.RegionCn || r == BattlenetConstants.RegionAsia) ? r : null;

    /// <summary>Configured path when the file exists, else the installed client from the registry (RBAssist), else null. 1:1 Python get_battlenet_path.</summary>
    public string? GetPath()
    {
        var path = _pathProvider?.Invoke()?.Trim();
        if (!string.IsNullOrEmpty(path) && File.Exists(path)) return path;
        return InstalledClientPath();
    }

    private static string? InstalledClientPath()
    {
        if (!OperatingSystem.IsWindows()) return null;
        try
        {
            using var key = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(BattlenetConstants.UninstallRegistryKey);
            if (key?.GetValue(BattlenetConstants.UninstallInstallLocationValue) is not string dir || dir.Length == 0) return null;
            string exe = Path.Combine(dir, BattlenetConstants.BattlenetExeName);
            return File.Exists(exe) ? exe : null;
        }
        catch (Exception ex) when (ex is System.Security.SecurityException or UnauthorizedAccessException or IOException)
        {
            return null;
        }
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
        if (!WaitForNetwork()) return false;
        return Launch(path, GetConfiguredRegion());
    }

    /// <summary>
    /// Battle.net is only (re)started with a working internet connection: started offline it drops the login. False (logged)
    /// when offline; the callers' loops retry on their next tick.
    /// </summary>
    public static bool IsNetworkReady() => NetworkProbe.IsInternetAvailable();

    private static bool WaitForNetwork()
    {
        if (IsNetworkReady()) return true;
        ColorPrinter.Yellow($"{LogPrefix} No internet connection, not starting Battle.net (retry on the next check) caller: {DescribeCaller()}");
        return false;
    }

    /// <summary>
    /// Switch the client region the official way: close Battle.net, then start it with --setregion (CN / TW) so it comes up in
    /// that region. 1:1 with the documented launcher argument; Battle.net.config LastLoginRegion then reads CN / KR.
    /// </summary>
    public bool RestartWithRegion(string region, double waitAfterSec = 2.0, bool force = false)
    {
        string? path = GetPath();
        if (path == null)
        {
            ColorPrinter.Red($"{LogPrefix} Battle.net path not configured");
            return false;
        }
        if (!WaitForNetwork()) return false;
        ColorPrinter.Blue($"{LogPrefix} Restart Battle.net in region {region}");
        if (!Close(force)) return false;
        if (waitAfterSec > 0) Thread.Sleep((int)(waitAfterSec * 1000));
        return Launch(path, region);
    }

    /// <summary>Start Battle.net Launcher.exe (else Battle.net.exe) next to the configured path, with --setregion when known.</summary>
    private bool Launch(string battlenetExePath, string? region)
    {
        string dir = Path.GetDirectoryName(battlenetExePath) ?? "";
        string launcher = Path.Combine(dir, BattlenetConstants.LauncherExeName);
        string exe = region != null && File.Exists(launcher) ? launcher : battlenetExePath;
        string args = region == null ? "" : string.Format(BattlenetConstants.SetRegionArgFormat,
            region == BattlenetConstants.RegionCn ? BattlenetConstants.SetRegionCodeCn : BattlenetConstants.SetRegionCodeAsia);
        ColorPrinter.Yellow($"{LogPrefix} Starting Battle.net: {exe} {args} caller: {DescribeCaller()}");
        try
        {
            // Outside our job object: a dotnet watch restart / app exit must not take Battle.net down with it.
            if (!ShellOpen.StartProgramElevated(exe, args.Length > 0 ? new[] { args } : Array.Empty<string>()))
                throw new InvalidOperationException("start failed");
            ColorPrinter.Green($"{LogPrefix} Battle.net start command sent");
            return true;
        }
        catch (Exception ex)
        {
            ColorPrinter.Red($"{LogPrefix} Start failed: {ex.Message}");
            return false;
        }
    }

    /// <summary>
    /// Kill Battle.net.exe and wait for exit (15 s). 1:1 Python kill() via kill_process_by_exe. Every close and restart in the app
    /// goes through here: unless forced by an explicit user action, it refuses while the client is logging in or waiting for a
    /// security check / verification code (fresh probe), and returns false.
    /// </summary>
    public bool Close(bool force = false)
    {
        if (!force && BattlenetClientStateDetector.Detect() is { } status
            && (status.IsWaitingForUser || status.State == BattlenetClientState.GameStarting))
        {
            ColorPrinter.Yellow($"{LogPrefix} Not closing Battle.net: {status.State} (user is logging in / entering the code, or a game is starting) caller: {DescribeCaller()}");
            return false;
        }
        ColorPrinter.Yellow($"{LogPrefix} Killing Battle.net (state {BattlenetClientStateDetector.Detect().State}, force={force}) caller: {DescribeCaller()}");
        bool ok = ProcessUtil.KillProcessByExe(BattlenetConstants.BattlenetExeName, BattlenetConstants.KillWaitTimeoutSec, LogPrefix);
        BattlenetControlTree.InvalidateLightCache();
        return ok;
    }

    /// <summary>First few calling methods outside this class, so every kill in the log names who asked for it.</summary>
    private static string DescribeCaller() => string.Join(" <- ", new StackTrace(2, false).GetFrames()
        .Select(f => f.GetMethod())
        .Where(m => m?.DeclaringType != null && m.DeclaringType != typeof(BattlenetManager) && m.DeclaringType.Namespace?.StartsWith("DotApps", StringComparison.Ordinal) == true)
        .Take(4)
        .Select(m => m!.DeclaringType!.Name + "." + m.Name));

    /// <summary>Kill then start (skipped entirely when Close refuses). 1:1 Python restart(exe_path, wait_after_sec).</summary>
    public bool Restart(string? exePath = null, double waitAfterSec = 2.0, bool force = false)
    {
        string? path = exePath ?? GetPath();
        if (string.IsNullOrWhiteSpace(path))
            return false;
        if (!WaitForNetwork()) return false;
        if (!Close(force)) return false;
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

    /// <summary>
    /// Launch a game directly through the client: Battle.net.exe --exec="launch &lt;product&gt;" (no tab / Play clicks, the RBAssist
    /// method). Battle.net.exe next to the configured path is used; false when it cannot be started.
    /// </summary>
    public bool LaunchProduct(string productCode)
    {
        string? path = GetPath();
        if (path == null) return false;
        string exe = Path.Combine(Path.GetDirectoryName(path) ?? "", BattlenetConstants.BattlenetExeName);
        if (!File.Exists(exe)) exe = path;
        string arg = string.Format(BattlenetConstants.ExecLaunchArgFormat, productCode);
        ColorPrinter.Blue($"{LogPrefix} Launch {productCode}: {exe} {arg}");
        return ShellOpen.StartProgramElevated(exe, arg);
    }

    /// <summary>D3 product code for --exec in the configured (else UI) region; null when the region is unknown.</summary>
    public string? GetD3ProductCode(string? uiRegion) => (GetConfiguredRegion() ?? uiRegion) switch
    {
        BattlenetConstants.RegionCn => BattlenetConstants.ProductD3Cn,
        BattlenetConstants.RegionAsia => BattlenetConstants.ProductD3Global,
        _ => null,
    };

    /// <summary>
    /// Bring back a client that runs with every window hidden in the tray: tray icon double-click, else start Battle.net.exe again
    /// (a second start only surfaces the running instance). Never closes the client, so its login is kept.
    /// </summary>
    public bool ShowHiddenClient()
    {
        if (RestoreFromTray() && HasWindow()) return true;
        string? path = GetPath();
        if (path == null) return false;
        ColorPrinter.Blue($"{LogPrefix} Battle.net runs hidden in the tray, start it again to show its window");
        return Launch(path, null);
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
}
