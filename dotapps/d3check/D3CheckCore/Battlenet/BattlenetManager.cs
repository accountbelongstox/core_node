using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;

namespace DotApps.d3check.Core.Battlenet;

/// <summary>
/// Battle.net process and window: start, kill, restart, activate. Path from app via SetPathProvider.
/// Logic 1:1 with Python battlenet_manager (start_program, kill by exe, restart=kill+wait+start, activate by hwnd).
/// </summary>
public sealed class BattlenetManager
{
    private Func<string?>? _pathProvider;
    private static BattlenetManager? _instance;

    public static BattlenetManager Instance => _instance ??= new BattlenetManager();

    private BattlenetManager() { }

    /// <summary>Set by app at startup. Called to get battlenet.exe path from config.</summary>
    public void SetPathProvider(Func<string?>? provider) => _pathProvider = provider;

    /// <summary>Battle.net process name (no extension) for GetProcessesByName.</summary>
    public const string ProcessName = "Battle.net";

    /// <summary>Get path from provider. Returns null if not set or empty.</summary>
    public string? GetPath()
    {
        var path = _pathProvider?.Invoke();
        return string.IsNullOrWhiteSpace(path) ? null : path.Trim();
    }

    /// <summary>Start Battle.net process. Returns true if start was sent.</summary>
    public bool Start(string? exePath = null)
    {
        string? path = exePath ?? GetPath();
        if (string.IsNullOrWhiteSpace(path) || !File.Exists(path))
            return false;
        if (HasWindow())
            return true;
        try
        {
            var startInfo = new ProcessStartInfo
            {
                FileName = path,
                UseShellExecute = true,
                WorkingDirectory = Path.GetDirectoryName(path) ?? ""
            };
            Process.Start(startInfo);
            return true;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>Kill Battle.net process. Returns true if killed or not found. 1:1 Python kill().</summary>
    public bool Close()
    {
        try
        {
            var processes = Process.GetProcessesByName(ProcessName);
            if (processes.Length == 0)
                return true;
            foreach (var p in processes)
            {
                try { p.Kill(); }
                catch { /* ignore */ }
            }
            return true;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>Kill then start. exePath defaults to GetPath(). waitAfterSec between kill and start. Returns true if start was sent. 1:1 Python restart(exe_path, wait_after_sec).</summary>
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

    /// <summary>First Battle.net process that has a main window, or null. For UI automation (FlaUI).</summary>
    public Process? GetProcess()
    {
        try
        {
            foreach (var p in Process.GetProcessesByName(ProcessName))
            {
                try
                {
                    if (p.MainWindowHandle != IntPtr.Zero)
                        return p;
                }
                catch { /* ignore */ }
            }
        }
        catch { /* ignore */ }
        return null;
    }

    /// <summary>True if at least one Battle.net process has a main window.</summary>
    public bool HasWindow()
    {
        try
        {
            var processes = Process.GetProcessesByName(ProcessName);
            foreach (var p in processes)
            {
                try
                {
                    if (p.MainWindowHandle != IntPtr.Zero)
                        return true;
                }
                catch { /* ignore */ }
            }
        }
        catch { /* ignore */ }
        return false;
    }

    /// <summary>Bring first Battle.net main window to foreground. Returns true if a window was found.</summary>
    public bool ActivateWindow()
    {
        try
        {
            var processes = Process.GetProcessesByName(ProcessName);
            foreach (var p in processes)
            {
                try
                {
                    if (p.MainWindowHandle != IntPtr.Zero)
                    {
                        SetForegroundWindow(p.MainWindowHandle);
                        return true;
                    }
                }
                catch { /* ignore */ }
            }
        }
        catch { /* ignore */ }
        return false;
    }

    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr hWnd);
}
