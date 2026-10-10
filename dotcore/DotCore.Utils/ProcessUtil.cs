// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/process_helper.py
// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/rosbot_manager.py
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using DotCore.Foundations;

namespace DotCore.Utils;

/// <summary>
/// Process helpers: PID from window, exe path, exact exe-name lookup, kill by PID / exe / directory, waits.
/// 1:1 Python dotapps/d3d4tester/reference/py_d3check/d3utils/process_helper.py (get_pid_from_hwnd, kill_process_by_pid, kill_process_by_exe)
/// plus the generic part of rosbot_manager.py find_process_by_exe_name / kill_if_running / wait_for_process.
/// </summary>
public static class ProcessUtil
{
    private const string DefaultLogPrefix = "[ProcessHelper]";
    private const int DefaultKillTimeoutSec = 15;
    private const int DefaultWaitPollMs = 2000;
    private const uint PROCESS_TERMINATE = 0x0001;
    private const uint PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
    private const int ERROR_ACCESS_DENIED = 5;
    private const int ERROR_INVALID_PARAMETER = 87;
    private const int ExePathCapacity = 1024;

    /// <summary>One running process matched by exe.</summary>
    public sealed record ProcessMatch(int Pid, string ExeName, string ExePath);

    /// <summary>PID of the process owning hwnd, or null. 1:1 Python get_pid_from_hwnd.</summary>
    public static int? GetPidFromHwnd(IntPtr hwnd)
    {
        if (hwnd == IntPtr.Zero || !OperatingSystem.IsWindows()) return null;
        GetWindowThreadProcessId(hwnd, out uint pid);
        return pid == 0 ? null : (int)pid;
    }

    /// <summary>Full exe path of a process, or null when unavailable (exited / access denied).</summary>
    public static string? GetProcessExePath(int pid)
    {
        if (pid <= 0) return null;
        if (!OperatingSystem.IsWindows())
        {
            try
            {
                using var p = Process.GetProcessById(pid);
                return p.MainModule?.FileName;
            }
            catch (Exception ex) when (ex is ArgumentException or InvalidOperationException or System.ComponentModel.Win32Exception)
            {
                return null;
            }
        }
        IntPtr handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, (uint)pid);
        if (handle == IntPtr.Zero) return null;
        try
        {
            var sb = new StringBuilder(ExePathCapacity);
            uint size = (uint)sb.Capacity;
            return QueryFullProcessImageName(handle, 0, sb, ref size) ? sb.ToString() : null;
        }
        finally
        {
            CloseHandle(handle);
        }
    }

    /// <summary>
    /// Processes whose image name or exe-path basename equals exeName exactly (case-insensitive). When underDirectory is set,
    /// a path match also requires the exe to live under that directory. 1:1 Python ROSBOTManager.find_process_by_exe_name.
    /// </summary>
    public static IReadOnlyList<ProcessMatch> FindProcessesByExeName(string exeName, string? underDirectory = null)
    {
        var result = new List<ProcessMatch>();
        if (string.IsNullOrWhiteSpace(exeName)) return result;
        string dirNorm = NormalizeDirectory(underDirectory);
        foreach (var p in Process.GetProcesses())
        {
            using (p)
            {
                string imageName = SafeImageName(p);
                string exePath = GetProcessExePath(p.Id) ?? "";
                bool nameMatch = string.Equals(imageName, exeName, StringComparison.OrdinalIgnoreCase);
                bool pathBasenameOk = exePath.Length > 0 && string.Equals(Path.GetFileName(exePath), exeName, StringComparison.OrdinalIgnoreCase);
                bool pathMatch = pathBasenameOk && (dirNorm.Length == 0 || IsUnderDirectory(exePath, dirNorm));
                if (!nameMatch && !pathMatch) continue;
                result.Add(new ProcessMatch(p.Id, imageName.Length > 0 ? imageName : Path.GetFileName(exePath), exePath));
            }
        }
        return result;
    }

    /// <summary>First process matching exeName (see FindProcessesByExeName), or null.</summary>
    public static ProcessMatch? FindProcessByExeName(string exeName, string? underDirectory = null)
        => FindProcessesByExeName(exeName, underDirectory).FirstOrDefault();

    /// <summary>Processes whose exe file lives under directory (any name, so renamed copies are included).</summary>
    public static IReadOnlyList<ProcessMatch> FindProcessesUnderDirectory(string directory)
    {
        var result = new List<ProcessMatch>();
        string dirNorm = NormalizeDirectory(directory);
        if (dirNorm.Length == 0) return result;
        int selfPid = Environment.ProcessId;
        foreach (var p in Process.GetProcesses())
        {
            using (p)
            {
                if (p.Id == selfPid) continue;
                string? exePath = GetProcessExePath(p.Id);
                if (string.IsNullOrEmpty(exePath) || !IsUnderDirectory(exePath, dirNorm)) continue;
                result.Add(new ProcessMatch(p.Id, Path.GetFileName(exePath), exePath));
            }
        }
        return result;
    }

    /// <summary>
    /// Kill by PID. Windows: TerminateProcess, Win32 error 5/87 counts as already exited; else Kill + wait timeoutSec.
    /// True if killed or not running. 1:1 Python kill_process_by_pid.
    /// </summary>
    public static bool KillProcessByPid(int pid, int timeoutSec = DefaultKillTimeoutSec, string logPrefix = DefaultLogPrefix)
    {
        if (OperatingSystem.IsWindows())
        {
            IntPtr handle = OpenProcess(PROCESS_TERMINATE, false, (uint)pid);
            int err = handle == IntPtr.Zero ? Marshal.GetLastWin32Error() : 0;
            if (handle != IntPtr.Zero)
            {
                bool ok = TerminateProcess(handle, 0);
                if (!ok) err = Marshal.GetLastWin32Error();
                CloseHandle(handle);
                if (ok)
                {
                    ColorPrinter.Green($"{logPrefix} Process PID {pid} killed");
                    return true;
                }
            }
            if (err is ERROR_INVALID_PARAMETER or ERROR_ACCESS_DENIED)
            {
                ColorPrinter.Yellow($"{logPrefix} Process PID {pid} was not running (already exited)");
                return true;
            }
            ColorPrinter.Red($"{logPrefix} Kill PID {pid} error: Win32 error {err}");
            return false;
        }
        try
        {
            using var p = Process.GetProcessById(pid);
            p.Kill();
            if (!p.WaitForExit(timeoutSec * 1000))
            {
                ColorPrinter.Red($"{logPrefix} Kill PID {pid} error: timeout after {timeoutSec}s");
                return false;
            }
            ColorPrinter.Green($"{logPrefix} Process PID {pid} killed");
            return true;
        }
        catch (ArgumentException)
        {
            ColorPrinter.Yellow($"{logPrefix} Process PID {pid} was not running");
            return true;
        }
        catch (Exception ex) when (ex is InvalidOperationException or System.ComponentModel.Win32Exception)
        {
            ColorPrinter.Red($"{logPrefix} Kill PID {pid} error: {ex.Message}");
            return false;
        }
    }

    /// <summary>Kill every process whose image name equals exeName (terminate + wait timeoutSec). Always true. 1:1 Python kill_process_by_exe.</summary>
    public static bool KillProcessByExe(string exeName, int timeoutSec = DefaultKillTimeoutSec, string logPrefix = DefaultLogPrefix)
    {
        bool found = false;
        foreach (var p in Process.GetProcesses())
        {
            using (p)
            {
                if (!string.Equals(SafeImageName(p), exeName, StringComparison.OrdinalIgnoreCase)) continue;
                try
                {
                    p.Kill();
                    p.WaitForExit(timeoutSec * 1000);
                    found = true;
                    ColorPrinter.Green($"{logPrefix} {exeName} killed (PID {p.Id})");
                }
                catch (Exception ex) when (ex is InvalidOperationException or System.ComponentModel.Win32Exception)
                {
                }
            }
        }
        if (!found)
            ColorPrinter.Yellow($"{logPrefix} {exeName} was not running");
        return true;
    }

    /// <summary>Kill by PID every process whose exe lives under directory (includes renamed exes). True if all kills succeeded.</summary>
    public static bool KillProcessesUnderDirectory(string directory, int timeoutSec = DefaultKillTimeoutSec, string logPrefix = DefaultLogPrefix)
    {
        bool ok = true;
        foreach (var m in FindProcessesUnderDirectory(directory))
        {
            ColorPrinter.Blue($"{logPrefix} Killing same-dir {m.ExeName} (PID: {m.Pid})...");
            if (!KillProcessByPid(m.Pid, timeoutSec, logPrefix)) ok = false;
        }
        return ok;
    }

    /// <summary>True once the process has exited (or never existed) within timeoutMs.</summary>
    public static bool WaitForExit(int pid, int timeoutMs)
    {
        try
        {
            using var p = Process.GetProcessById(pid);
            return p.WaitForExit(timeoutMs);
        }
        catch (ArgumentException)
        {
            return true;
        }
        catch (Exception ex) when (ex is InvalidOperationException or System.ComponentModel.Win32Exception)
        {
            return !IsRunning(pid);
        }
    }

    /// <summary>Poll every pollMs until a process matching exeName appears; null on timeout. 1:1 Python wait_for_process.</summary>
    public static ProcessMatch? WaitForProcess(string exeName, int timeoutSec, string? underDirectory = null, int pollMs = DefaultWaitPollMs, CancellationToken cancellationToken = default)
    {
        var deadline = DateTime.UtcNow.AddSeconds(timeoutSec);
        while (DateTime.UtcNow < deadline && !cancellationToken.IsCancellationRequested)
        {
            var match = FindProcessByExeName(exeName, underDirectory);
            if (match != null) return match;
            cancellationToken.WaitHandle.WaitOne(pollMs);
        }
        return null;
    }

    /// <summary>True if a process with pid is running.</summary>
    public static bool IsRunning(int pid)
    {
        try
        {
            using var p = Process.GetProcessById(pid);
            return !p.HasExited;
        }
        catch (Exception ex) when (ex is ArgumentException or InvalidOperationException or System.ComponentModel.Win32Exception)
        {
            return false;
        }
    }

    private static string SafeImageName(Process p)
    {
        try
        {
            string name = p.ProcessName;
            return OperatingSystem.IsWindows() ? name + ".exe" : name;
        }
        catch (InvalidOperationException)
        {
            return "";
        }
    }

    private static string NormalizeDirectory(string? directory)
    {
        if (string.IsNullOrWhiteSpace(directory)) return "";
        return Path.TrimEndingDirectorySeparator(Path.GetFullPath(directory)) + Path.DirectorySeparatorChar;
    }

    private static bool IsUnderDirectory(string exePath, string dirNorm)
    {
        var comparison = OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;
        return Path.GetFullPath(exePath).StartsWith(dirNorm, comparison);
    }

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr OpenProcess(uint dwDesiredAccess, [MarshalAs(UnmanagedType.Bool)] bool bInheritHandle, uint dwProcessId);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool TerminateProcess(IntPtr hProcess, uint uExitCode);

    [DllImport("kernel32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CloseHandle(IntPtr hObject);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool QueryFullProcessImageName(IntPtr hProcess, uint dwFlags, StringBuilder lpExeName, ref uint lpdwSize);
}
