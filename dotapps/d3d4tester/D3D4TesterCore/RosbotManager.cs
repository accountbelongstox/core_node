// PY-REF: pyapps/d3-check/d3utils/rosbot_manager.py
// PY-REF: pyapps/d3-check/d3utils/rosbot_operation.py
// PY-REF: pyapps/d3-check/d3utils/rosbot_ui_automation.py
using System.IO;
using DotApps.d3d4tester.Core.Flow;
using DotCore.Foundations;
using DotCore.Utils;
using DotCore.Utils.Input;
using DotApps.d3d4tester.Constants;

namespace DotApps.d3d4tester.Core;

/// <summary>
/// ROSBOT process management and the single process/window lookup flow: same-dir exe list (other exes first, then main) ->
/// exact exe-name process -> windows by PID (content validator selects the main window). Kill by PID of main and every
/// same-dir exe (renamed copies included), start, F7 to process / system, cleanup, waits.
/// Settings are read from ros_settings on every call (Python cached them in the singleton constructor).
/// 1:1 Python pyapps/d3-check/d3utils/rosbot_manager.py.
/// </summary>
public sealed class RosbotManager
{
    private readonly object _cacheLock = new();
    private RosbotDetectionResult _cache = NotFound;
    private bool _cacheProcessFound;
    private DateTime _cacheAtUtc = DateTime.MinValue;
    private Func<IntPtr, bool>? _mainWindowContentValidator;
    private string? _lastLoggedFindRosbotExe;

    private static readonly RosbotDetectionResult NotFound = new() { Status = RosbotDetection.StatusNotFound };

    public static RosbotManager Instance { get; } = new();

    private RosbotManager()
    {
        _mainWindowContentValidator = RosbotUiAutomation.WindowHasRosbotMainContent;
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

    public int DetectionTimeoutSeconds => RosbotFlowHost.GetConfig(ConfigKeys.RosSettingsProcessDetectionTimeout, RosbotConstants.ProcessDetectionTimeoutDefault);

    /// <summary>Configured ROS directory (directory of exe if config is an exe path), or null. 1:1 Python get_ros_directory.</summary>
    public string? GetRosDirectory()
    {
        string raw = RawRosDirectory;
        if (raw.Length == 0) return null;
        if (Directory.Exists(raw)) return raw;
        string? parent = Path.GetDirectoryName(raw);
        return !string.IsNullOrEmpty(parent) && Directory.Exists(parent) ? parent : null;
    }

    /// <summary>1:1 Python validate_ros_directory.</summary>
    public bool ValidateRosDirectory()
    {
        string raw = RawRosDirectory;
        if (raw.Length == 0)
        {
            ColorPrinter.Red($"{RosbotConstants.ManagerLogPrefix} ROS directory not configured");
            return false;
        }
        if (!Directory.Exists(raw) && !File.Exists(raw))
        {
            ColorPrinter.Red($"{RosbotConstants.ManagerLogPrefix} ROS directory not found: {raw}");
            return false;
        }
        ColorPrinter.Gray($"{RosbotConstants.ManagerLogPrefix} ROS directory: {raw}");
        return true;
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
        var excludes = ExcludePatterns;
        try
        {
            foreach (string pattern in SearchPatterns)
            {
                foreach (string filePath in Directory.GetFiles(baseDir, pattern))
                {
                    if (!File.Exists(filePath)) continue;
                    string fileName = Path.GetFileName(filePath);
                    if (IsGarbledFileName(fileName)) continue;
                    bool exclude = false;
                    foreach (string ex in excludes)
                    {
                        string stub = (ex ?? "").Replace("*", "");
                        if (stub.Length > 0 && fileName.Contains(stub, StringComparison.OrdinalIgnoreCase))
                        {
                            exclude = true;
                            break;
                        }
                    }
                    if (!exclude && !outList.Contains(filePath)) outList.Add(filePath);
                }
            }
        }
        catch (IOException) { /* return collected */ }
        catch (UnauthorizedAccessException) { /* return collected */ }
        return outList;
    }

    /// <summary>1:1 Python find_same_dir_exe_names.</summary>
    public List<string> FindSameDirExeNames() => FindOtherExeFiles().Select(p => Path.GetFileName(p)).ToList();

    /// <summary>Validator(hwnd) identifying the main window by UI content; null = first visible window by PID. 1:1 Python set_main_window_content_validator.</summary>
    public void SetMainWindowContentValidator(Func<IntPtr, bool>? validator) => _mainWindowContentValidator = validator;

    /// <summary>Windows of the PID: visible ones (when any) else all. 1:1 Python find_windows_by_pid.</summary>
    public List<RosbotWindowInfo> FindWindowsByPid(int pid, bool visibleOnly = true)
    {
        var (visible, any) = NativeWindowHelper.EnumWindowsByPid(pid);
        return visibleOnly && visible.Count > 0 ? visible : (visible.Count > 0 ? visible : any);
    }

    /// <summary>One window of the PID: prefers a non-empty title. 1:1 Python find_window_by_pid (no exclude/prefer filters used by ROSBOT).</summary>
    public RosbotWindowInfo? FindWindowByPid(int pid, bool visibleOnly = false)
    {
        var (visible, any) = NativeWindowHelper.EnumWindowsByPid(pid);
        var list = visibleOnly ? visible : (visible.Count > 0 ? visible : any);
        if (list.Count == 0) return null;
        return list.FirstOrDefault(w => w.Title.Trim().Length > 0) ?? list[0];
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

    /// <summary>PIDs of every running same-dir exe then the main exe. 1:1 Python pid collection in get_ui_state / try_close_d3_must_be_launched_dialog.</summary>
    public List<int> CollectRosbotPids()
    {
        var pids = new List<int>();
        foreach (string exePath in FindOtherExeFiles())
        {
            var proc = FindProcessByExeName(Path.GetFileName(exePath));
            if (proc != null && proc.Pid > 0 && !pids.Contains(proc.Pid)) pids.Add(proc.Pid);
        }
        var main = FindProcessByExeName(RosbotExeName);
        if (main != null && main.Pid > 0 && !pids.Contains(main.Pid)) pids.Add(main.Pid);
        return pids;
    }

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

        string? rosDir = GetRosDirectory();
        var otherFiles = FindOtherExeFiles();
        log($"{RosbotConstants.ManagerLogPrefix} get_rosbot_window Step 1: same-dir exe list -> ros_directory='{rosDir}', count={otherFiles.Count}, list=[{string.Join(", ", otherFiles.Select(Path.GetFileName))}]");
        bool anyProcessFound = false;
        var pids = new List<int>();
        string resolvedExeName = "";
        bool hasValidator = _mainWindowContentValidator != null;

        var candidates = otherFiles.Select(p => (ExeName: Path.GetFileName(p), Label: "same-dir")).ToList();
        candidates.Add((RosbotExeName, "main exe"));
        foreach (var (exeName, label) in candidates)
        {
            var proc = FindProcessByExeName(exeName);
            if (proc == null || proc.Pid <= 0) continue;
            anyProcessFound = true;
            pids.Add(proc.Pid);
            if (resolvedExeName.Length == 0) resolvedExeName = exeName;
            var (winfo, visibleCount, isMain) = ResolveWindow(proc.Pid);
            if (winfo != null)
            {
                if (hasValidator && isMain)
                    log($"{RosbotConstants.ManagerLogPrefix} get_rosbot_window Step 2: {label} '{exeName}' {visibleCount} visible window(s), content-matched main window");
                else if (hasValidator)
                    log($"{RosbotConstants.ManagerLogPrefix} get_rosbot_window Step 2: {label} '{exeName}' {visibleCount} visible window(s) -> paused (any visible)");
                else
                    log($"{RosbotConstants.ManagerLogPrefix} get_rosbot_window Step 2: {label} '{exeName}' visible window, title='{winfo.Title}'");
                return StoreCache(new RosbotDetectionResult
                {
                    Status = RosbotDetection.StatusPaused,
                    WindowInfo = winfo,
                    ExeName = exeName,
                    Pids = pids.ToList(),
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

    /// <summary>(window, visible count, is main). Validator set: content-matched main window preferred, popup title "The Vault" skipped, else any visible. 1:1 Python _resolve_window.</summary>
    private (RosbotWindowInfo? Window, int VisibleCount, bool IsMain) ResolveWindow(int pid)
    {
        var validator = _mainWindowContentValidator;
        if (validator != null)
        {
            var (visible, _) = NativeWindowHelper.EnumWindowsByPid(pid);
            if (visible.Count == 0) return (null, 0, false);
            var mainCandidates = visible.Where(w => w.Title.Trim() != RosbotConstants.PopupNoItemsTitle).ToList();
            foreach (var w in mainCandidates)
            {
                try
                {
                    if (validator(w.Hwnd)) return (w, visible.Count, true);
                }
                catch { /* next candidate */ }
            }
            return (mainCandidates.Count > 0 ? mainCandidates[0] : visible[0], visible.Count, false);
        }
        var win = FindWindowByPid(pid, visibleOnly: true);
        return (win, win != null ? 1 : 0, win != null);
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

    /// <summary>Any window incl. minimized; debug/export only. 1:1 Python get_any_rosbot_window_for_debug.</summary>
    public RosbotWindowInfo? GetAnyRosbotWindowForDebug() => GetAnyRosbotWindow(false);

    private RosbotWindowInfo? GetAnyRosbotWindow(bool visibleOnly)
    {
        foreach (int pid in CollectRosbotPids())
        {
            foreach (var w in FindWindowsByPid(pid, visibleOnly))
            {
                if (w.Title.Trim() == RosbotConstants.PopupNoItemsTitle) continue;
                return w;
            }
        }
        return null;
    }

    /// <summary>True if running or paused. 1:1 Python is_running.</summary>
    public bool IsRunning() => RosbotDetection.IsOnline(GetDetection().Status);

    /// <summary>Kill the main exe and every same-dir exe process by PID (renamed copies included). 1:1 Python kill_if_running.</summary>
    public bool KillIfRunning()
    {
        bool ok = true;
        string mainExe = RosbotExeName;
        var main = FindProcessByExeName(mainExe);
        if (main != null && main.Pid > 0)
        {
            ColorPrinter.Blue($"{RosbotConstants.ManagerLogPrefix} Killing main exe {mainExe} (PID: {main.Pid})...");
            if (!ProcessUtil.KillProcessByPid(main.Pid, logPrefix: RosbotConstants.ManagerLogPrefix)) ok = false;
        }
        foreach (string exePath in FindOtherExeFiles())
        {
            string exeName = Path.GetFileName(exePath);
            var proc = FindProcessByExeName(exeName);
            if (proc == null || proc.Pid <= 0) continue;
            ColorPrinter.Blue($"{RosbotConstants.ManagerLogPrefix} Killing same-dir {exeName} (PID: {proc.Pid})...");
            if (!ProcessUtil.KillProcessByPid(proc.Pid, logPrefix: RosbotConstants.ManagerLogPrefix)) ok = false;
        }
        return ok;
    }

    /// <summary>1:1 Python start_executable (system_launcher.start_program).</summary>
    public bool StartExecutable(string exePath)
    {
        if (string.IsNullOrEmpty(exePath) || !File.Exists(exePath)) return false;
        if (ShellOpen.StartProgram(exePath))
        {
            ColorPrinter.Green($"{RosbotConstants.ManagerLogPrefix} Started: {exePath}");
            return true;
        }
        ColorPrinter.Red($"{RosbotConstants.ManagerLogPrefix} Start failed");
        return false;
    }

    /// <summary>Start the main ROSBOT exe. 1:1 Python start.</summary>
    public bool Start()
    {
        string? exePath = FindRosbotExe();
        if (exePath == null)
        {
            ColorPrinter.Yellow($"{RosbotConstants.ManagerLogPrefix} No ROSBOT exe found, skip start");
            return false;
        }
        return StartExecutable(exePath);
    }

    /// <summary>Poll every 2 s until a process with exeName appears. 1:1 Python wait_for_process.</summary>
    public ProcessUtil.ProcessMatch? WaitForProcess(string exeName, int? timeoutSeconds = null)
    {
        var deadline = DateTime.UtcNow.AddSeconds(timeoutSeconds ?? DetectionTimeoutSeconds);
        while (DateTime.UtcNow < deadline)
        {
            var info = FindProcessByExeName(exeName);
            if (info != null) return info;
            Thread.Sleep(RosbotConstants.WaitForProcessPollMs);
        }
        return null;
    }

    /// <summary>Activate the window then press F7 (system key). 1:1 Python send_f7_to_process.</summary>
    public bool SendF7ToProcess(IntPtr hwnd)
    {
        if (hwnd == IntPtr.Zero) return false;
        try
        {
            NativeWindowHelper.ActivateWindow(hwnd);
            Thread.Sleep(RosbotConstants.SendF7ActivateDelayMs);
            var input = ClickHandler.Instance;
            input.KeyDown("f7");
            Thread.Sleep(RosbotConstants.SendF7HoldMs);
            input.KeyUp("f7");
            return true;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>Global F7 key press (ROSBOT pause/stop). 1:1 Python key_send.send_f7_to_system.</summary>
    public static bool SendF7ToSystem() => WindowInputHelper.SendSystemKey(RosbotConstants.VkF7);

    /// <summary>Kill all same-dir other exe processes, optionally F7 to each window first. 1:1 Python cleanup_old_other_exe_processes.</summary>
    public bool CleanupOldOtherExeProcesses(bool sendF7BeforeKill = false)
    {
        var files = FindOtherExeFiles();
        if (files.Count == 0) return true;
        int cleanupCount = 0;
        foreach (string exePath in files)
        {
            var proc = FindProcessByExeName(Path.GetFileName(exePath));
            if (proc == null) continue;
            if (sendF7BeforeKill && proc.Pid > 0)
            {
                var winfo = FindWindowByPid(proc.Pid);
                if (winfo != null) SendF7ToProcess(winfo.Hwnd);
                Thread.Sleep(RosbotConstants.CleanupF7WaitMs);
            }
            if (proc.Pid > 0 && ProcessUtil.KillProcessByPid(proc.Pid, logPrefix: RosbotConstants.ManagerLogPrefix))
                cleanupCount++;
            Thread.Sleep(RosbotConstants.CleanupPerProcessWaitMs);
        }
        if (cleanupCount > 0) Thread.Sleep(RosbotConstants.CleanupAfterKillWaitMs);
        return true;
    }

    /// <summary>Poll every 3 s until a same-dir other exe process appears. 1:1 Python wait_for_new_other_exe.</summary>
    public (string ExeName, string ExePath, ProcessUtil.ProcessMatch Process)? WaitForNewOtherExe(int timeoutSeconds = RosbotConstants.WaitForNewOtherExeTimeoutSec)
    {
        var deadline = DateTime.UtcNow.AddSeconds(timeoutSeconds);
        while (DateTime.UtcNow < deadline)
        {
            foreach (string exePath in FindOtherExeFiles())
            {
                string exeName = Path.GetFileName(exePath);
                var proc = FindProcessByExeName(exeName);
                if (proc != null) return (exeName, exePath, proc);
            }
            Thread.Sleep(RosbotConstants.WaitForNewOtherExePollMs);
        }
        return null;
    }

    private static bool IsGarbledFileName(string name)
    {
        foreach (char ch in name)
        {
            if (ch >= '─' && ch <= '▟') return true;
        }
        return false;
    }
}
