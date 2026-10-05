// PY-REF: none (DOT-only)
using System.Diagnostics;
using System.Globalization;
using System.IO;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;

namespace DotApps.d3d4tester.Services.Monitor;

/// <summary>
/// User-supplied external tools driven by trigger actions, as RBAssist did: the speed bridge (bridge64.exe + speedpatch64/32.dll, stdin
/// "inject &lt;pid&gt;" / "change &lt;factor&gt;", RBAssist INITBRIDGE / BRIDGEINJECTANDCHANGE) and the quick-quit TCP reset tool
/// (D3_tcprst*.exe + WinDivert.dll / WinDivert64.sys, "-d &lt;delay&gt;", RBAssist QUICKQUIT). Missing files are logged, nothing is downloaded.
/// </summary>
public static class ExternalGameTools
{
    private static readonly string[] SpeedBridgeDependencies = { "speedpatch64.dll", "speedpatch32.dll" };
    private static readonly string[] TcpResetDependencies = { "WinDivert.dll", "WinDivert64.sys" };
    private const string InjectCommand = "inject {0}";
    private const string ChangeCommand = "change {0}";
    private const string ExitCommand = "exit";
    private const string DelayArgument = "-d {0}";
    private const int CommandGapMs = 50;
    private const int ExitWaitMs = 100;
    private static readonly object Lock = new();
    private static Process? _bridge;
    private static string? _lastFactor;

    /// <summary>Last speed factor sent (status display), or null.</summary>
    public static string? CurrentSpeedFactor
    {
        get { lock (Lock) return _lastFactor; }
    }

    /// <summary>Send a new speed factor to D3 through the bridge; repeated factors are skipped.</summary>
    public static bool SetSpeed(string factor)
    {
        factor = factor.Trim();
        if (factor.Length == 0) return false;
        lock (Lock)
        {
            if (factor == _lastFactor && _bridge is { HasExited: false }) return true;
            int pid = D3Manager.Instance.GetProcessIds().FirstOrDefault();
            if (pid == 0)
            {
                MonitorLog.Warn("Game speed skipped: D3 not running");
                return false;
            }
            if (!EnsureBridge()) return false;
            try
            {
                _bridge!.StandardInput.WriteLine(string.Format(CultureInfo.InvariantCulture, InjectCommand, pid));
                Thread.Sleep(CommandGapMs);
                _bridge.StandardInput.WriteLine(string.Format(CultureInfo.InvariantCulture, ChangeCommand, factor));
                _lastFactor = factor;
                MonitorLog.Info($"Game speed -> {factor}");
                return true;
            }
            catch (Exception ex)
            {
                MonitorLog.Warn($"Game speed failed: {ex.Message}");
                StopBridgeUnsafe();
                return false;
            }
        }
    }

    /// <summary>Run the TCP reset tool to leave the game quickly; delay (ms text) is passed as "-d".</summary>
    public static bool QuickQuit(string delay)
    {
        string exe = MonitorSettings.GetString(ConfigKeys.MonitorToolsTcpResetPath).Trim();
        if (!CheckTool(exe, TcpResetDependencies)) return false;
        string args = string.IsNullOrWhiteSpace(delay) ? "" : string.Format(CultureInfo.InvariantCulture, DelayArgument, delay.Trim());
        try
        {
            Process.Start(new ProcessStartInfo(exe, args) { UseShellExecute = true, WorkingDirectory = Path.GetDirectoryName(exe) ?? "" })?.Dispose();
            MonitorLog.Info($"Quick quit started {args}");
            return true;
        }
        catch (Exception ex)
        {
            MonitorLog.Warn($"Quick quit failed: {ex.Message}");
            return false;
        }
    }

    /// <summary>Close the bridge (app exit).</summary>
    public static void Shutdown()
    {
        lock (Lock) StopBridgeUnsafe();
    }

    private static bool EnsureBridge()
    {
        if (_bridge is { HasExited: false }) return true;
        string exe = MonitorSettings.GetString(ConfigKeys.MonitorToolsSpeedBridgePath).Trim();
        if (!CheckTool(exe, SpeedBridgeDependencies)) return false;
        try
        {
            var p = new Process
            {
                StartInfo = new ProcessStartInfo(exe)
                {
                    UseShellExecute = false,
                    RedirectStandardInput = true,
                    RedirectStandardOutput = true,
                    CreateNoWindow = true,
                    WorkingDirectory = Path.GetDirectoryName(exe) ?? ""
                }
            };
            p.OutputDataReceived += (_, _) => { };
            p.Start();
            p.BeginOutputReadLine();
            _bridge = p;
            _lastFactor = null;
            return true;
        }
        catch (Exception ex)
        {
            MonitorLog.Warn($"Speed bridge start failed (run as administrator?): {ex.Message}");
            return false;
        }
    }

    private static void StopBridgeUnsafe()
    {
        var p = _bridge;
        _bridge = null;
        _lastFactor = null;
        if (p == null) return;
        try
        {
            if (!p.HasExited)
            {
                p.StandardInput.WriteLine(ExitCommand);
                if (!p.WaitForExit(ExitWaitMs)) p.Kill();
            }
        }
        catch { /* bridge already gone */ }
        p.Dispose();
    }

    private static bool CheckTool(string exe, IReadOnlyList<string> dependencies)
    {
        if (exe.Length == 0 || !File.Exists(exe))
        {
            MonitorLog.Warn($"External tool not found: '{exe}'");
            return false;
        }
        string dir = Path.GetDirectoryName(exe) ?? "";
        var missing = dependencies.Where(d => !File.Exists(Path.Combine(dir, d))).ToList();
        if (missing.Count == 0) return true;
        MonitorLog.Warn($"External tool {Path.GetFileName(exe)} is missing {string.Join(", ", missing)}");
        return false;
    }
}
