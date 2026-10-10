// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/rosbot_manager.py
// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/rosbot_operation.py
// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/rosbot_ui_automation.py
// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/key_send.py
using System.IO;
using DotApps.d3d4tester.Core.Flow;
using DotCore.Foundations;
using DotCore.Utils;
using DotCore.Utils.Input;
using DotApps.d3d4tester.Constants;

namespace DotApps.d3d4tester.Core;

/// <summary>One running ROSBOT process: PID, exe file name, and whether it is the configured main exe.</summary>
public sealed record RosbotProcess(int Pid, string ExeName, bool IsMainExe);

/// <summary>
/// ROSBOT process management and the single process/window lookup flow: ROSBOT processes (every process whose exe lives under
/// ros_directory, then the main exe by name) -> windows by PID (content validator selects the main window). Kill by PID of every
/// ROSBOT process, start, F7 to the system.
/// Settings are read from ros_settings on every call (Python cached them in the singleton constructor).
/// 1:1 Python dotapps/d3d4tester/reference/py_d3check/d3utils/rosbot_manager.py.
/// </summary>
public sealed class RosbotManager
{
    private readonly object _cacheLock = new();
    private RosbotDetectionResult _cache = NotFound;
    private bool _cacheProcessFound;
    private DateTime _cacheAtUtc = DateTime.MinValue;
    private string? _lastLoggedFindRosbotExe;
    private volatile Action<string>[] _beforeStart = Array.Empty<Action<string>>();
    private readonly object _beforeStartLock = new();
    private Func<string?>? _keyProvider;

    private static readonly RosbotDetectionResult NotFound = new() { Status = RosbotDetection.StatusNotFound };

    public static RosbotManager Instance { get; } = new();

    private RosbotManager()
    {
    }

    public string RosbotExeName
    {
        get
        {
            var name = RosbotFlowHost.GetConfig<string>(ConfigKeys.RosSettingsRosbotExeName, null);
            return string.IsNullOrWhiteSpace(name) ? RosbotConstants.DefaultRosbotExeName : name.Trim();
        }
    }

    private static string RawRosDirectory => (RosbotFlowHost.GetConfig<string>(ConfigKeys.RosSettingsRosDirectory, null) ?? "").Trim();

    private static IReadOnlyList<string> SearchPatterns =>
        RosbotFlowHost.Current?.GetConfigStringList(ConfigKeys.RosSettingsOtherExeSearchPatterns) ?? RosbotConstants.OtherExeSearchPatterns;

    private static IReadOnlyList<string> ExcludePatterns =>
        RosbotFlowHost.Current?.GetConfigStringList(ConfigKeys.RosSettingsOtherExeExcludePatterns) ?? RosbotConstants.DefaultOtherExeExcludePatterns;

    public int StartupDelaySeconds => RosbotFlowHost.GetConfig(ConfigKeys.RosSettingsStartupDelaySeconds, RosbotConstants.StartupDelaySecondsDefault);


    /// <summary>Configured ROS directory (directory of exe if config is an exe path), or null. 1:1 Python get_ros_directory.</summary>
    public string? GetRosDirectory()
    {
        string raw = RawRosDirectory;
        if (raw.Length == 0) return null;
        if (Directory.Exists(raw)) return raw;
        string? parent = Path.GetDirectoryName(raw);
        return !string.IsNullOrEmpty(parent) && Directory.Exists(parent) ? parent : null;
    }

    /// <summary>Main exe: exact rosbot_exe_name first, then ROSBOT_EXE_PATTERNS (never an arbitrary *.exe). Logs only when the path changes. 1:1 Python find_rosbot_exe.</summary>
    public string? FindRosbotExe()
    {
        string? baseDir = GetRosDirectory();
        if (baseDir == null)
        {
            _lastLoggedFindRosbotExe = null;
            return null;
        }
        string exact = Path.Combine(baseDir, RosbotExeName);
        if (File.Exists(exact)) return LogFoundExe(exact);
        foreach (string pattern in RosbotConstants.RosbotExePatterns)
        {
            try
            {
                foreach (string path in Directory.GetFiles(baseDir, pattern))
                {
                    if (File.Exists(path)) return LogFoundExe(path);
                }
            }
            catch (IOException) { /* next pattern */ }
            catch (UnauthorizedAccessException) { /* next pattern */ }
        }
        _lastLoggedFindRosbotExe = null;
        return null;
    }

    private string LogFoundExe(string path)
    {
        if (_lastLoggedFindRosbotExe != path)
        {
            ColorPrinter.Gray($"{RosbotConstants.ManagerLogPrefix} Found main exe: {path}");
            _lastLoggedFindRosbotExe = path;
        }
        return path;
    }

    /// <summary>Other exe full paths in ros_directory (search patterns, exclude substrings with '*' removed, garbled names skipped). 1:1 Python find_other_exe_files.</summary>
    public List<string> FindOtherExeFiles()
    {
        var outList = new List<string>();
        string? baseDir = GetRosDirectory();
        if (baseDir == null) return outList;
        try
        {
            foreach (string pattern in SearchPatterns)
            {
                foreach (string filePath in Directory.GetFiles(baseDir, pattern))
                {
                    if (!File.Exists(filePath) || IsExcludedExe(Path.GetFileName(filePath))) continue;
                    if (!outList.Contains(filePath)) outList.Add(filePath);
                }
            }
        }
        catch (IOException) { /* return collected */ }
        catch (UnauthorizedAccessException) { /* return collected */ }
        return outList;
    }

    /// <summary>Garbled name or matches an exclude pattern (installer / uninstaller ...): not a ROSBOT exe.</summary>
    private bool IsExcludedExe(string fileName)
    {
        if (IsGarbledFileName(fileName)) return true;
        foreach (string ex in ExcludePatterns)
        {
            string stub = (ex ?? "").Replace("*", "");
            if (stub.Length > 0 && fileName.Contains(stub, StringComparison.OrdinalIgnoreCase)) return true;
        }
        return false;
    }

    /// <summary>
    /// Running ROSBOT processes, the single scan for detection, PID collection and kill: every process whose exe lives under
    /// ros_directory (whatever its name, so the random-named copy ROSBOT starts itself as is found even when the folder listing changed),
    /// excluded names skipped, then the main exe by image name anywhere. Same-dir copies first, main exe last.
    /// </summary>
    public List<RosbotProcess> FindRosbotProcesses()
    {
        var result = new List<RosbotProcess>();
        var seen = new HashSet<int>();
        string mainExe = RosbotExeName;
        if (GetRosDirectory() is { } dir)
        {
            foreach (var p in ProcessUtil.FindProcessesUnderDirectory(dir))
            {
                if (p.Pid <= 0 || IsExcludedExe(p.ExeName) || !seen.Add(p.Pid)) continue;
                result.Add(new RosbotProcess(p.Pid, p.ExeName, string.Equals(p.ExeName, mainExe, StringComparison.OrdinalIgnoreCase)));
            }
        }
        if (FindProcessByExeName(mainExe) is { Pid: > 0 } main && seen.Add(main.Pid))
            result.Add(new RosbotProcess(main.Pid, mainExe, true));
        return result.OrderBy(p => p.IsMainExe).ToList();
    }

    /// <summary>ROSBOT KEY dialog windows (title "Error") of the given PIDs, or of every ROSBOT process when none are given; hidden ones included.</summary>
    public IEnumerable<RosbotWindowInfo> FindKeyDialogWindows(IReadOnlyList<int>? pids = null)
    {
        IReadOnlyList<int> scan = pids is { Count: > 0 } ? pids.Distinct().ToList() : CollectRosbotPids();
        foreach (int pid in scan)
            foreach (var w in FindWindowsByPid(pid, visibleOnly: false))
                if (w.Title.Trim() == RosbotConstants.KeyDialogWindowTitleDefault)
                    yield return w;
    }

    /// <summary>Windows of the PID: visible ones (when any) else all. 1:1 Python find_windows_by_pid.</summary>
    public List<RosbotWindowInfo> FindWindowsByPid(int pid, bool visibleOnly = true)
    {
        var (visible, any) = NativeWindowHelper.EnumWindowsByPid(pid);
        return visibleOnly && visible.Count > 0 ? visible : (visible.Count > 0 ? visible : any);
    }

    /// <summary>Process by exact exe name (image name, or exe basename under ros_directory). 1:1 Python find_process_by_exe_name.</summary>
    public ProcessUtil.ProcessMatch? FindProcessByExeName(string exeName)
    {
        try
        {
            return ProcessUtil.FindProcessByExeName(exeName, GetRosDirectory());
        }
        catch (Exception ex)
        {
            ColorPrinter.Red($"{RosbotConstants.ManagerLogPrefix} find_process_by_exe_name: {ex.Message}");
            return null;
        }
    }

    /// <summary>PIDs of every running ROSBOT process (same-dir copies, then the main exe). 1:1 Python pid collection in get_ui_state.</summary>
    public List<int> CollectRosbotPids() => FindRosbotProcesses().Select(p => p.Pid).ToList();

    /// <summary>
    /// Extended status: not_found | running (process, zero visible windows) | paused (any visible window). Cached for
    /// LookupCacheTtlSec; a cached window is validated with IsWindow; a cached not_found is never reused.
    /// 1:1 Python _get_rosbot_window_and_process + get_rosbot_detection.
    /// </summary>
    public RosbotDetectionResult GetDetection()
    {
        Action<string> log = F3RefreshLine.IsSilent ? _ => { } : ColorPrinter.Gray;
        var now = DateTime.UtcNow;
        lock (_cacheLock)
        {
            bool withinTtl = (now - _cacheAtUtc).TotalSeconds <= RosbotConstants.LookupCacheTtlSec;
            if (withinTtl)
            {
                if (_cache.WindowInfo != null)
                {
                    if (NativeWindowHelper.IsWindowValid(_cache.WindowInfo.Hwnd))
                        return _cache;
                    _cache = new RosbotDetectionResult { Status = RosbotDetection.StatusRunning, ExeName = _cache.ExeName, Pids = _cache.Pids };
                    _cacheProcessFound = true;
                    _cacheAtUtc = now;
                }
                else if (_cacheProcessFound)
                {
                    log($"{RosbotConstants.ManagerLogPrefix} get_rosbot_window cache hit (no main window), skip lookup");
                    return _cache;
                }
            }
        }

        var processes = FindRosbotProcesses();
        log($"{RosbotConstants.ManagerLogPrefix} get_rosbot_window Step 1: ROSBOT processes under '{GetRosDirectory()}' + main exe -> count={processes.Count}, list=[{string.Join(", ", processes.Select(p => $"{p.ExeName}#{p.Pid}"))}]");
        bool anyProcessFound = false;
        var pids = new List<int>();
        string resolvedExeName = "";
        foreach (var proc in processes)
        {
            string exeName = proc.ExeName;
            string label = proc.IsMainExe ? "main exe" : "same-dir";
            anyProcessFound = true;
            pids.Add(proc.Pid);
            if (resolvedExeName.Length == 0) resolvedExeName = exeName;
            var (winfo, visibleCount, isMain) = ResolveWindow(proc.Pid);
            if (winfo != null)
            {
                log(isMain
                    ? $"{RosbotConstants.ManagerLogPrefix} get_rosbot_window Step 2: {label} '{exeName}' {visibleCount} visible window(s), content-matched main window"
                    : $"{RosbotConstants.ManagerLogPrefix} get_rosbot_window Step 2: {label} '{exeName}' {visibleCount} visible window(s) -> paused (any visible)");
                return StoreCache(new RosbotDetectionResult
                {
                    Status = RosbotDetection.StatusPaused,
                    WindowInfo = winfo,
                    ExeName = exeName,
                    Pids = processes.Select(p => p.Pid).ToList(),
                    IsMainUi = isMain
                }, true);
            }
            log($"{RosbotConstants.ManagerLogPrefix} get_rosbot_window Step 2: {label} '{exeName}' process (PID={proc.Pid}) 0 visible windows -> running");
        }
        if (anyProcessFound)
        {
            log($"{RosbotConstants.ManagerLogPrefix} get_rosbot_window Step 2: process(es) found but no visible window -> running");
            return StoreCache(new RosbotDetectionResult { Status = RosbotDetection.StatusRunning, ExeName = resolvedExeName, Pids = pids.ToList() }, true);
        }
        log($"{RosbotConstants.ManagerLogPrefix} get_rosbot_window Step 2: no process/window for same-dir exe");
        return StoreCache(NotFound, false);
    }

    private RosbotDetectionResult StoreCache(RosbotDetectionResult result, bool processFound)
    {
        lock (_cacheLock)
        {
            _cache = result;
            _cacheProcessFound = processFound;
            _cacheAtUtc = DateTime.UtcNow;
        }
        return result;
    }

    /// <summary>(window, visible count, is main): content-matched main window preferred, popup title "The Vault" skipped, else any visible. 1:1 Python _resolve_window.</summary>
    private static (RosbotWindowInfo? Window, int VisibleCount, bool IsMain) ResolveWindow(int pid)
    {
        var (visible, _) = NativeWindowHelper.EnumWindowsByPid(pid);
        if (visible.Count == 0) return (null, 0, false);
        var mainCandidates = visible.Where(w => w.Title.Trim() != RosbotConstants.PopupNoItemsTitle).ToList();
        foreach (var w in mainCandidates)
        {
            try
            {
                if (RosbotUiAutomation.WindowHasRosbotMainContent(w.Hwnd)) return (w, visible.Count, true);
            }
            catch { /* next candidate */ }
        }
        return (mainCandidates.Count > 0 ? mainCandidates[0] : visible[0], visible.Count, false);
    }

    /// <summary>Clear the lookup cache so the next detection does a full lookup. Call after F4 or when ROSBOT is closed. 1:1 Python invalidate_lookup_cache.</summary>
    public void InvalidateLookupCache() => StoreCacheReset();

    private void StoreCacheReset()
    {
        lock (_cacheLock)
        {
            _cache = NotFound;
            _cacheProcessFound = false;
            _cacheAtUtc = DateTime.MinValue;
        }
    }

    /// <summary>ROSBOT window when any is visible (paused), else null. 1:1 Python get_rosbot_window.</summary>
    public RosbotWindowInfo? GetRosbotWindow() => GetDetection().WindowInfo;

    /// <summary>Any visible window of the same-dir ROSBOT process; no validator, no cache. 1:1 Python get_any_visible_rosbot_window.</summary>
    public RosbotWindowInfo? GetAnyVisibleRosbotWindow() => GetAnyRosbotWindow(true);

    /// <summary>First visible titled ROSBOT window (its overlay, which shows the combat cursor), popup skipped; null when none.</summary>
    public RosbotWindowInfo? GetOverlayWindow() => GetAnyRosbotWindow(true, titledOnly: true);

    /// <summary>Any window incl. minimized; debug/export only. 1:1 Python get_any_rosbot_window_for_debug.</summary>
    public RosbotWindowInfo? GetAnyRosbotWindowForDebug() => GetAnyRosbotWindow(false);

    private RosbotWindowInfo? GetAnyRosbotWindow(bool visibleOnly, bool titledOnly = false)
    {
        foreach (int pid in CollectRosbotPids())
        {
            foreach (var w in FindWindowsByPid(pid, visibleOnly))
            {
                string title = w.Title.Trim();
                if (title == RosbotConstants.PopupNoItemsTitle || (titledOnly && title.Length == 0)) continue;
                return w;
            }
        }
        return null;
    }

    /// <summary>True if running or paused. 1:1 Python is_running.</summary>
    public bool IsRunning() => RosbotDetection.IsOnline(GetDetection().Status);

    /// <summary>Kill every running ROSBOT process by PID (same-dir copies of any name, then the main exe), then clear the lookup cache. 1:1 Python kill_if_running.</summary>
    public bool KillIfRunning()
    {
        bool ok = true;
        foreach (var proc in FindRosbotProcesses())
        {
            ColorPrinter.Blue($"{RosbotConstants.ManagerLogPrefix} Killing {(proc.IsMainExe ? "main exe" : "same-dir")} {proc.ExeName} (PID: {proc.Pid})...");
            if (!ProcessUtil.KillProcessByPid(proc.Pid, logPrefix: RosbotConstants.ManagerLogPrefix)) ok = false;
        }
        InvalidateLookupCache();
        return ok;
    }

    /// <summary>1:1 Python start_executable (system_launcher.start_program).</summary>
    public bool StartExecutable(string exePath, params string[] args)
    {
        if (string.IsNullOrEmpty(exePath) || !File.Exists(exePath)) return false;
        if (ShellOpen.StartProgramElevated(exePath, args))
        {
            ColorPrinter.Green($"{RosbotConstants.ManagerLogPrefix} Started: {exePath} {string.Join(" ", args)}");
            return true;
        }
        ColorPrinter.Red($"{RosbotConstants.ManagerLogPrefix} Start failed");
        return false;
    }

    /// <summary>Set by app at startup: the ROSBOT key to type into ROSBOT's KEY dialog, or null when none is configured / enabled.</summary>
    public void SetKeyProvider(Func<string?>? provider) => _keyProvider = provider;

    public string? GetKey() => _keyProvider?.Invoke() is { Length: > 0 } key ? key : null;

    /// <summary>Added by app services at startup: each runs with the exe path right before every Start launches ROSBOT (ROSBOT key, plugin install).</summary>
    public void AddBeforeStartHook(Action<string> hook)
    {
        lock (_beforeStartLock) _beforeStart = _beforeStart.Append(hook).ToArray();
    }

    /// <summary>Start the main ROSBOT exe (before-start hooks first; a failing hook never blocks the start). 1:1 Python start.</summary>
    public bool Start(bool autostart = false)
    {
        string? exePath = FindRosbotExe();
        if (exePath == null)
        {
            ColorPrinter.Yellow($"{RosbotConstants.ManagerLogPrefix} No ROSBOT exe found, skip start");
            return false;
        }
        foreach (var hook in _beforeStart)
        {
            try
            {
                hook(exePath);
            }
            catch (Exception ex)
            {
                ColorPrinter.Yellow($"{RosbotConstants.ManagerLogPrefix} before-start hook failed: {ex.Message}");
            }
        }
        return autostart ? StartExecutable(exePath, RosbotConstants.AutostartArgument) : StartExecutable(exePath);
    }

    /// <summary>Global F7 key press (ROSBOT stop to its main UI), recorded so a later process exit counts as a normal pause. 1:1 Python key_send.send_f7_to_system.</summary>
    public static bool SendF7ToSystem()
    {
        bool sent = WindowInputHelper.SendSystemKey(RosbotConstants.VkF7);
        if (sent) Flow.RosbotExitState.SetF7SentForRosbot();
        return sent;
    }

    /// <summary>
    /// Close ROSBOT the way it expects (RBAssist): a second F7 after the one that stopped botting closes it; poll until it exits
    /// (at most F7CloseGraceMs instead of a fixed wait), then kill whatever is still running by PID.
    /// </summary>
    public bool CloseGracefully()
    {
        if (FindRosbotProcesses().Count == 0) return true;
        SendF7ToSystem();
        var deadline = DateTime.UtcNow.AddMilliseconds(RosbotConstants.F7CloseGraceMs);
        while (DateTime.UtcNow < deadline && FindRosbotProcesses().Count > 0)
            Thread.Sleep(RosbotConstants.F7ClosePollMs);
        return KillIfRunning();
    }

    /// <summary>Global F6 key press: ROSBOT's pause toggle hotkey (pause when botting, resume when paused).</summary>
    public static bool SendPauseToggleToSystem() => WindowInputHelper.SendSystemKey(RosbotConstants.VkF6);

    private static bool IsGarbledFileName(string name)
    {
        foreach (char ch in name)
        {
            if (ch >= '─' && ch <= '▟') return true;
        }
        return false;
    }
}
