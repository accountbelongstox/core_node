// PY-REF: pyapps/d3-check/d3utils/shutdown_manager.py
// PY-REF: pyapps/d3-check/lifecycle/shutdown_runner.py
using System.Diagnostics;
using System.Windows;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Services;

/// <summary>
/// Single shutdown/restart path. RequestShutdown/RequestRestart set the flags and run ExecuteShutdown on the UI thread:
/// clear log callbacks, signal extension shutdown, shutdown runner, hotkey stop, registered hooks, log watcher stop,
/// tray stop, then close the UI and end the application. A restart starts the new process only from App.Exit, after
/// all cleanup and the final config flush (StartRestartedProcessIfRequested).
/// Fixes earlier port bug: RestartApp started the new process before cleanup (double instance / hotkey and port race).
/// 1:1 Python d3utils/shutdown_manager.py + lifecycle/shutdown_runner.py.
/// </summary>
public static class ShutdownManager
{
    private static readonly DefaultShutdownRequest ShutdownRequest = new();
    private static readonly List<Action> ShutdownHooks = new();
    private static readonly object Lock = new();
    private static volatile bool _restartRequested;
    private static volatile bool _shutdownCompleted;
    private static volatile bool _executing;
    private static Action? _shutdownRunner;
    private static Action? _stopHotkeys;
    private static Action? _stopLogWatching;
    private static Action? _stopTray;
    private static Window? _ui;

    /// <summary>Shared shutdown request flag (DotCore IShutdownRequest).</summary>
    public static IShutdownRequest Request => ShutdownRequest;

    public static bool IsShutdownRequested => ShutdownRequest.IsShutdownRequested;

    public static bool IsRestartRequested => _restartRequested;

    /// <summary>True while ExecuteShutdown runs or after it completed (MainWindow lets the close through).</summary>
    public static bool IsShutdownInProgress => _executing || _shutdownCompleted;

    /// <summary>Main window to close at the end of the sequence.</summary>
    public static void RegisterUi(Window? ui) => _ui = ui;

    /// <summary>Stop workers (tick driver, extension loops). 1:1 Python register_shutdown_runner.</summary>
    public static void RegisterShutdownRunner(Action runner) => _shutdownRunner = runner;

    /// <summary>Unregister global hotkeys. 1:1 Python register_hotkey_listener + stop_listening.</summary>
    public static void RegisterHotkeyStop(Action stop) => _stopHotkeys = stop;

    /// <summary>Stop the ROSBOT log file watcher. 1:1 Python register_stop_log_watching.</summary>
    public static void RegisterStopLogWatching(Action stop) => _stopLogWatching = stop;

    /// <summary>Remove the tray icon (step 4).</summary>
    public static void RegisterTrayStop(Action stop) => _stopTray = stop;

    /// <summary>Hook run in step 2 (e.g. reset BN flow state). Same delegate registered once. 1:1 Python register_shutdown_hook.</summary>
    public static void RegisterShutdownHook(Action hook)
    {
        lock (Lock)
        {
            if (!ShutdownHooks.Contains(hook))
                ShutdownHooks.Add(hook);
        }
    }

    /// <summary>Request application exit (any thread). 1:1 Python request_shutdown.</summary>
    public static void RequestShutdown()
    {
        if (IsShutdownRequested) return;
        ColorPrinter.Yellow("[ShutdownManager] ========================================");
        ColorPrinter.Yellow("[ShutdownManager] Shutdown requested");
        ColorPrinter.Yellow("[ShutdownManager] ========================================");
        ShutdownRequest.Request();
        ScheduleExecute();
    }

    /// <summary>Request restart: full shutdown first, then a new process from App.Exit. 1:1 Python request_restart.</summary>
    public static void RequestRestart()
    {
        if (IsShutdownRequested) return;
        ColorPrinter.Yellow("[ShutdownManager] ========================================");
        ColorPrinter.Yellow("[ShutdownManager] Restart requested");
        ColorPrinter.Yellow("[ShutdownManager] ========================================");
        _restartRequested = true;
        ShutdownRequest.Request();
        ScheduleExecute();
    }

    /// <summary>Ordered shutdown sequence on the UI thread. Idempotent. 1:1 Python execute_shutdown.</summary>
    public static void ExecuteShutdown()
    {
        if (_shutdownCompleted || _executing) return;
        _executing = true;
        if (!IsShutdownRequested) ShutdownRequest.Request();

        ColorPrinter.Yellow("[ShutdownManager] ========================================");
        ColorPrinter.Yellow("[ShutdownManager] Executing shutdown sequence...");
        ColorPrinter.Yellow("[ShutdownManager] ========================================");

        ColorPrinter.ClearAllCallbacks();

        RunStep("[0/5] Stopping workers", _shutdownRunner);
        RunStep("[1/5] Stopping hotkey listener", _stopHotkeys);

        Action[] hooks;
        lock (Lock) hooks = ShutdownHooks.ToArray();
        foreach (var hook in hooks)
        {
            try { hook(); }
            catch (Exception ex) { ColorPrinter.Red($"[ShutdownManager] Shutdown hook error: {ex.Message}"); }
        }

        RunStep("[2/5] Stopping log watcher", _stopLogWatching);
        RunStep("[3/5] Stopping system tray", _stopTray);

        var ui = _ui;
        _ui = null;
        EventCenter.UnregisterMainUi();
        _shutdownCompleted = true;
        ColorPrinter.Green("[ShutdownManager] ========================================");
        ColorPrinter.Green("[ShutdownManager] Shutdown sequence completed");
        ColorPrinter.Green("[ShutdownManager] ========================================");

        ColorPrinter.Blue("[ShutdownManager] [4/5] Destroying UI...");
        try { ui?.Close(); }
        catch (Exception ex) { ColorPrinter.Red($"[ShutdownManager] [ERROR] UI destruction error: {ex.Message}"); }
        ColorPrinter.Blue(_restartRequested ? "[ShutdownManager] Restarting application..." : "[ShutdownManager] Exiting application...");
        Application.Current?.Shutdown();
    }

    /// <summary>Called from App.Exit after config flush: start the new instance when a restart was requested.</summary>
    public static void StartRestartedProcessIfRequested()
    {
        if (!_restartRequested) return;
        var path = Environment.ProcessPath ?? Process.GetCurrentProcess().MainModule?.FileName;
        if (string.IsNullOrEmpty(path)) return;
        try
        {
            var psi = new ProcessStartInfo(path) { UseShellExecute = false };
            foreach (var arg in Environment.GetCommandLineArgs().Skip(1))
                psi.ArgumentList.Add(arg);
            Process.Start(psi);
        }
        catch (Exception ex)
        {
            ColorPrinter.Red($"[ShutdownManager] Restart failed: {ex.Message}");
        }
    }

    private static void ScheduleExecute()
    {
        var app = Application.Current;
        if (app == null || app.Dispatcher.HasShutdownStarted)
        {
            ExecuteShutdown();
            return;
        }
        app.Dispatcher.BeginInvoke(ExecuteShutdown);
    }

    private static void RunStep(string label, Action? step)
    {
        if (step == null) return;
        try
        {
            ColorPrinter.Blue($"[ShutdownManager] {label}...");
            step();
        }
        catch (Exception ex)
        {
            ColorPrinter.Red($"[ShutdownManager] [ERROR] {label}: {ex.Message}");
        }
    }
}
