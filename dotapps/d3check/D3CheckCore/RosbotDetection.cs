using System.Diagnostics;
using System.IO;
using DotCore.Foundations;

namespace DotApps.d3check.Core;

/// <summary>
/// ROSBOT detection: same-dir exe list (other first, then main), find process by exe name, window by PID.
/// 1:1 with Python d3utils.rosbot_manager get_rosbot_detection / _get_rosbot_window_and_process.
/// Status: not_found (no process), running (process, zero visible main windows), paused (has visible window, excluding popup title).
/// </summary>
public sealed class RosbotDetectionResult
{
    public string Status { get; init; } = "not_found";
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
/// Single lookup flow for ROSBOT process/window. Same-dir exe list -> find process by exe name -> window by PID.
/// Exclude popup title "The Vault"; cache result for RosbotConstants.LookupCacheTtlSec.
/// </summary>
public static class RosbotDetection
{
    private static readonly object _cacheLock = new();
    private static RosbotDetectionResult? _cachedResult;
    private static string _cachedRosDir = "";
    private static string _cachedMainExe = "";
    private static double _cachedAt;

    /// <summary>Clear lookup cache. Call after F4 or when ROSBOT is closed. 1:1 Python invalidate_lookup_cache.</summary>
    public static void InvalidateCache()
    {
        lock (_cacheLock)
        {
            _cachedResult = null;
            _cachedRosDir = "";
            _cachedMainExe = "";
            _cachedAt = 0;
        }
    }

    /// <summary>
    /// Get ROSBOT detection: not_found | running | paused. Same-dir other exes first, then main exe.
    /// rosDirectory: configured ROS directory (directory of exe or parent). mainExeName: e.g. RoS-BoT.exe.
    /// </summary>
    public static RosbotDetectionResult GetDetection(string? rosDirectory, string? mainExeName = null)
    {
        mainExeName ??= RosbotConstants.DefaultRosbotExeName;
        string? rosDir = NormalizeRosDirectory(rosDirectory);
        if (string.IsNullOrEmpty(rosDir) || !Directory.Exists(rosDir))
        {
            return new RosbotDetectionResult { Status = "not_found" };
        }

        double now = GetTimestamp();
        lock (_cacheLock)
        {
            if (_cachedResult != null && _cachedRosDir == rosDir && _cachedMainExe == mainExeName &&
                (now - _cachedAt) <= RosbotConstants.LookupCacheTtlSec)
            {
                if (_cachedResult.WindowInfo != null)
                {
                    try
                    {
                        if (NativeWindowHelper.IsWindowValid(_cachedResult.WindowInfo.Hwnd))
                            return _cachedResult;
                    }
                    catch { /* fall through to refresh */ }
                    _cachedResult = new RosbotDetectionResult
                    {
                        Status = "running",
                        ExeName = _cachedResult.ExeName,
                        Pids = _cachedResult.Pids,
                        IsMainUi = false
                    };
                    _cachedAt = now;
                    return _cachedResult;
                }
                return _cachedResult;
            }
        }

        var otherExes = FindOtherExeFiles(rosDir, mainExeName);
        var collectedPids = new List<int>();
        string? resolvedExeName = null;
        bool anyProcessFound = false;

        foreach (string exePath in otherExes)
        {
            string exeName = Path.GetFileName(exePath);
            var procInfo = FindProcessByExeName(exePath, exeName, rosDir);
            if (procInfo == null) continue;
            anyProcessFound = true;
            collectedPids.Add(procInfo.Value.Pid);
            if (string.IsNullOrEmpty(resolvedExeName)) resolvedExeName = exeName;

            var winfo = GetWindowInfo(procInfo.Value.Pid);
            if (winfo != null)
            {
                var result = new RosbotDetectionResult
                {
                    Status = "paused",
                    WindowInfo = winfo,
                    ExeName = exeName,
                    Pids = collectedPids.ToList(),
                    IsMainUi = true
                };
                lock (_cacheLock)
                {
                    _cachedResult = result;
                    _cachedRosDir = rosDir;
                    _cachedMainExe = mainExeName;
                    _cachedAt = now;
                }
                return result;
            }
        }

        string mainFullPath = Path.Combine(rosDir, mainExeName);
        var mainProc = FindProcessByExeName(mainFullPath, mainExeName, rosDir);
        if (mainProc != null)
        {
            anyProcessFound = true;
            collectedPids.Add(mainProc.Value.Pid);
            if (string.IsNullOrEmpty(resolvedExeName)) resolvedExeName = mainExeName;
            var winfo = GetWindowInfo(mainProc.Value.Pid);
            if (winfo != null)
            {
                var result = new RosbotDetectionResult
                {
                    Status = "paused",
                    WindowInfo = winfo,
                    ExeName = mainExeName,
                    Pids = collectedPids.ToList(),
                    IsMainUi = true
                };
                lock (_cacheLock)
                {
                    _cachedResult = result;
                    _cachedRosDir = rosDir;
                    _cachedMainExe = mainExeName;
                    _cachedAt = now;
                }
                return result;
            }
        }

        var finalResult = anyProcessFound
            ? new RosbotDetectionResult
            {
                Status = "running",
                ExeName = resolvedExeName ?? "",
                Pids = collectedPids.ToList(),
                IsMainUi = false
            }
            : new RosbotDetectionResult { Status = "not_found" };
        lock (_cacheLock)
        {
            _cachedResult = finalResult;
            _cachedRosDir = rosDir;
            _cachedMainExe = mainExeName;
            _cachedAt = now;
        }
        return finalResult;
    }

    /// <summary>Return ROSBOT window when any visible (paused). When running (no visible window) returns null. 1:1 Python get_rosbot_window.</summary>
    public static RosbotWindowInfo? GetRosbotWindow(string? rosDirectory, string? mainExeName = null)
    {
        var det = GetDetection(rosDirectory, mainExeName);
        return det.WindowInfo;
    }

    private static string? NormalizeRosDirectory(string? path)
    {
        if (string.IsNullOrWhiteSpace(path)) return null;
        path = Path.GetFullPath(path).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        if (File.Exists(path) && path.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
            return Path.GetDirectoryName(path);
        return Directory.Exists(path) ? path : null;
    }

    private static List<string> FindOtherExeFiles(string rosDir, string mainExeName)
    {
        var outList = new List<string>();
        try
        {
            foreach (string pattern in RosbotConstants.OtherExeSearchPatterns)
            {
                foreach (string full in Directory.GetFiles(rosDir, pattern))
                {
                    if (!File.Exists(full)) continue;
                    string fileName = Path.GetFileName(full);
                    if (IsGarbledFileName(fileName)) continue;
                    if (string.Equals(fileName, mainExeName, StringComparison.OrdinalIgnoreCase))
                        continue;
                    bool exclude = false;
                    foreach (string sub in RosbotConstants.DefaultExcludeSubstrings)
                    {
                        if (!string.IsNullOrEmpty(sub) && fileName.Contains(sub, StringComparison.OrdinalIgnoreCase))
                        {
                            exclude = true;
                            break;
                        }
                    }
                    if (!exclude && !outList.Contains(full))
                        outList.Add(full);
                }
            }
        }
        catch { /* ignore */ }
        return outList;
    }

    private static bool IsGarbledFileName(string name)
    {
        if (string.IsNullOrEmpty(name)) return false;
        foreach (char ch in name)
        {
            int cp = ch;
            if (0x2500 <= cp && cp <= 0x259F) return true;
        }
        return false;
    }

    private static (int Pid, string ExePath)? FindProcessByExeName(string exePath, string exeName, string rosDirNorm)
    {
        if (!File.Exists(exePath)) return null;
        string processName = Path.GetFileNameWithoutExtension(exeName);
        string exeLower = exeName.ToLowerInvariant();
        string rosDirNormLower = rosDirNorm.ToLowerInvariant().TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        try
        {
            foreach (var p in Process.GetProcessesByName(processName))
            {
                try
                {
                    string? procExe = null;
                    try
                    {
                        procExe = p.MainModule?.FileName;
                    }
                    catch { /* ignore */ }
                    if (string.IsNullOrEmpty(procExe)) continue;
                    string procExeLower = procExe.ToLowerInvariant();
                    string procBase = Path.GetFileName(procExe);
                    bool nameMatch = procBase == exeLower;
                    bool pathUnderRos = procExeLower.StartsWith(rosDirNormLower + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)
                        || procExeLower.StartsWith(rosDirNormLower + Path.AltDirectorySeparatorChar, StringComparison.OrdinalIgnoreCase);
                    bool pathMatch = Path.GetFileName(procExe).Equals(exeName, StringComparison.OrdinalIgnoreCase) && (pathUnderRos || string.IsNullOrEmpty(rosDirNorm));
                    if (!nameMatch && !pathMatch) continue;
                    return (p.Id, procExe);
                }
                finally
                {
                    p.Dispose();
                }
            }
        }
        catch (Exception ex)
        {
            ColorPrinter.Red("[RosbotDetection] FindProcessByExeName: " + ex.Message);
        }
        return null;
    }

    private static RosbotWindowInfo? GetWindowInfo(int pid)
    {
        try
        {
            using var p = Process.GetProcessById(pid);
            if (p.MainWindowHandle == IntPtr.Zero) return null;
            string title = p.MainWindowTitle ?? "";
            if (string.Equals(title.Trim(), RosbotConstants.PopupNoItemsTitle, StringComparison.OrdinalIgnoreCase))
                return null;
            return new RosbotWindowInfo { Hwnd = p.MainWindowHandle, Title = title, Pid = pid };
        }
        catch
        {
            return null;
        }
    }

    private static double GetTimestamp() => (double)Environment.TickCount64 / 1000.0;
}

internal static class NativeWindowHelper
{
    private const int SwRestore = 9;

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern bool IsWindow(IntPtr hWnd);

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr hWnd);

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    public static bool IsWindowValid(IntPtr hWnd) => hWnd != IntPtr.Zero && IsWindow(hWnd);

    /// <summary>Bring window to foreground and restore. 1:1 Python RosbotOperation.activate_window (SetForegroundWindow + SW_RESTORE).</summary>
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
}
