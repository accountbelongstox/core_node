// PY-REF: pyapps/d3-check/d3utils/rosbot_task_processor.py
// PY-REF: pyapps/d3-check/threads/d3_extension_thread.py
// PY-REF: pyapps/d3-check/d3utils/system_initializer.py
// PY-REF: pyapps/d3-check/ui/panels/rosbot_extension_panel.py
// PY-REF: pyapps/d3-check/lifecycle/log_monitor.py
using System.Globalization;
using System.Text.Json;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.D4;
using DotApps.d3d4tester.Core.Flow;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.Services;
using DotCore.Foundations;
using DotCore.Utils;

namespace DotApps.d3d4tester.Ctl;

/// <summary>
/// ROSBOT task processor and the flow host for Core. Start / Stop monitoring start and cancel <see cref="RosbotFlowRunner"/> (the
/// sequential ROSBOT flow on its own thread); the "Ensure Battle.net" switch starts / stops <see cref="BattlenetGuardRunner"/>. The
/// 1 s TickDriver only drains the ROSBOT log queue and refreshes the test-mode display and total restart count. Runs the E block
/// for the flow (<see cref="RunRosbotStart"/>). 1:1 Python d3utils/rosbot_task_processor.py + rosbot_extension_panel start / stop.
/// </summary>
public sealed class RosbotTaskProcessor : IRosbotFlowHost
{
    private const string LogTag = "[RosbotTaskProcessor]";

    private readonly object _lock = new();
    private RosbotLogFileWatcher? _logWatcher;
    private bool _installed;
    private bool _initialized;

    public static RosbotTaskProcessor Instance { get; } = new();

    private RosbotTaskProcessor()
    {
    }

    /// <summary>
    /// Wire once at startup (MainWindow loaded): flow host, Battle.net hooks, log tail, every-tick callback, full status refresh for
    /// the window monitor, then start the 1 s clock. 1:1 Python system_initializer rosbot_task registration.
    /// </summary>
    public void Install()
    {
        lock (_lock)
        {
            if (_installed) return;
            _installed = true;
        }
        RosbotFlowHost.Current = this;
        RosbotFlowController.InstallHooks();
        StartLogWatching();
        WindowMonitorService.Instance.SetFullStatusRefresh(RunFullStatusRefresh);
        var driver = TickDriver.Instance;
        driver.RegisterEveryTick(ProcessEveryTick);
        driver.Start();
        ShutdownManager.RegisterShutdownHook(Uninstall);
        ColorPrinter.Blue($"{LogTag} Initialized");
    }

    /// <summary>Stop the flow, the guard, the 1 s clock and the log tail (window closed).</summary>
    public void Uninstall()
    {
        lock (_lock)
        {
            if (!_installed) return;
            _installed = false;
        }
        RosbotFlowRunner.Stop();
        BattlenetGuardRunner.Stop();
        var driver = TickDriver.Instance;
        driver.Stop();
        driver.Unregister(ProcessEveryTick);
        StopLogWatching();
        WindowMonitorService.Instance.SetFullStatusRefresh(null);
        if (ReferenceEquals(RosbotFlowHost.Current, this))
            RosbotFlowHost.Current = null;
    }

    public void StartLogWatching()
    {
        lock (_lock)
        {
            _logWatcher ??= new RosbotLogFileWatcher();
            _logWatcher.Start(RosbotLogPaths.GetLogsFilePath());
        }
    }

    public void StopLogWatching()
    {
        lock (_lock)
        {
            _logWatcher?.Dispose();
            _logWatcher = null;
        }
    }

    /// <summary>1:1 Python RosbotTaskProcessor.initialize (log file path is owned by the watcher).</summary>
    public void Initialize()
    {
        lock (_lock)
        {
            if (_initialized) return;
            _initialized = true;
        }
        ColorPrinter.Blue($"{LogTag} Initialized with log file");
    }

    /// <summary>Enable ROSBOT monitoring. 1:1 Python start_rosbot_task.</summary>
    public void StartRosbotTask()
    {
        Initialize();
        GameInterfaceData.Instance.SetRosbotStatus(true);
        ColorPrinter.Green($"{LogTag} ROSBOT monitoring started");
    }

    /// <summary>Disable ROSBOT monitoring, clear the test display, refresh the restart count. 1:1 Python stop_rosbot_task.</summary>
    public void StopRosbotTask()
    {
        var game = GameInterfaceData.Instance;
        game.SetRosbotStatus(false);
        game.SetRosbotTestModeDisplay(null);
        game.SetRosbotTotalRestartCount(RosbotExitState.GetTotalRestartCount());
        ColorPrinter.Yellow($"{LogTag} ROSBOT monitoring stopped");
    }

    /// <summary>Start monitoring: run the ROSBOT flow. 1:1 Python _start_rosbot.</summary>
    public void RequestStartFlow()
    {
        if (RosbotFlowRunner.IsRunning) return;
        Initialize();
        RosbotFlowRunner.Start();
        ColorPrinter.Green("[ROSBOT] Started monitoring");
        RequestStatusRefresh();
    }

    /// <summary>Stop monitoring: cancel the flow at its current step. 1:1 Python _stop_rosbot + _on_rosbot_stop_done.</summary>
    public void RequestStopFlow()
    {
        if (!RosbotFlowState.Instance.FlowMasterEnabled && !RosbotFlowRunner.IsRunning) return;
        RosbotFlowRunner.Stop();
        StopRosbotTask();
        EventCenter.TriggerExtensionRosbotStopped();
        ColorPrinter.Yellow("[ROSBOT] Stopped monitoring");
        RequestStatusRefresh();
    }

    /// <summary>Start / stop button (ROSBOT tab, Monitor tab): stop when monitoring, else start.</summary>
    public void ToggleFlow()
    {
        if (RosbotFlowState.Instance.FlowMasterEnabled) RequestStopFlow();
        else RequestStartFlow();
    }

    /// <summary>"Ensure Battle.net" button: flips the persisted guard switch; BattlenetGuardService applies it. 1:1 Python _ensure_battlenet_only.</summary>
    public void ToggleEnsureBattlenetOnly() =>
        ConfigBinding.SetValue(ConfigKeys.BattlenetEnsureNormal, !RosbotFlowState.Instance.BnOnlyEnabled);

    /// <summary>Apply the Battle.net guard (idempotent): on -> guard thread; off -> stop it.</summary>
    public void SetEnsureBattlenetOnly(bool enabled)
    {
        RosbotFlowState.Instance.SetBnOnlyEnabled(enabled);
        if (enabled) BattlenetGuardRunner.Start();
        else BattlenetGuardRunner.Stop();
    }

    /// <summary>One-shot full refresh off the UI thread. 1:1 Python _request_status_refresh (submit do_window_monitor_initial_check).</summary>
    public void RequestStatusRefresh() => _ = Task.Run(WindowMonitorService.Instance.RunInitialCheck);

    /// <summary>Battle.net + D3 light + ROSBOT, then notify. Returns the D3 window or null. 1:1 Python run_full_status_refresh.</summary>
    public WindowFinder.WindowInfo? RunFullStatusRefresh() => RefreshAllGameStatus(d3Dynamic: false);

    /// <summary>
    /// Battle.net + D3 (+ dynamic capture when d3Dynamic) + D4 running + ROSBOT into GameInterfaceData, then notify once.
    /// Single full refresh path for the window monitor and the "refresh game status" debug action. Returns the D3 window or null.
    /// </summary>
    public WindowFinder.WindowInfo? RefreshAllGameStatus(bool d3Dynamic)
    {
        if (!BattlenetReadyProcess.IsRunning)
            BattlenetStatusProvider.Refresh();
        var d3 = D3StatusProvider.RefreshD3Status(skipDynamic: !d3Dynamic);
        GameInterfaceData.Instance.D4.GameRunning = D4Manager.Instance.IsRunning();
        RosbotStatusProvider.Refresh();
        NotifyStateSync();
        return d3;
    }

    /// <summary>Per-tick: drain + analyze log lines, test-mode display, total restart count. 1:1 Python process_task head.</summary>
    private void ProcessEveryTick(IFlowTick _)
    {
        RosbotLogTickProcessor.ProcessPendingLines();
        var game = GameInterfaceData.Instance;
        game.SetRosbotTestModeDisplay(FormatTestModeDisplay(F3LogTimeout.GetTestModeDisplay()));
        game.SetRosbotTotalRestartCount(RosbotExitState.GetTotalRestartCount());
    }

    private static string? FormatTestModeDisplay(F3TestModeDisplay? d)
    {
        if (d == null) return null;
        var p = D3D4TesterI18n.Provider;
        var inv = CultureInfo.InvariantCulture;
        var parts = new List<string>
        {
            string.Format(inv, p.GetUiText(I18nKeys.RosbotTestDisplayElapsed), d.ElapsedSec.ToString("0", inv)),
            string.Format(inv, p.GetUiText(I18nKeys.RosbotTestDisplayTimeout), d.TimeoutMinutes)
        };
        if (d.RecordedSec is { } recorded)
            parts.Add(string.Format(inv, p.GetUiText(I18nKeys.RosbotTestDisplayRecord), d.RecordCount, recorded.ToString("0", inv)));
        if (d.WaitRemainSec is { } remain)
            parts.Add(string.Format(inv, p.GetUiText(I18nKeys.RosbotTestDisplayWait), remain.ToString("0", inv)));
        return string.Join(p.GetUiText(I18nKeys.RosbotTestDisplaySeparator), parts);
    }

    /// <summary>
    /// [F2] ROSBOT online -> monitoring task on; else [E1-E6]. Publishes ExtensionRosbotStarted (tray, D3 shrink). Errors are logged
    /// and reported as false so the flow retries. 1:1 Python D3ExtensionThread._do_start_rosbot (F2 + E part).
    /// </summary>
    public bool RunRosbotStart(FlowContext ctx)
    {
        bool success = false;
        bool ranEBlock = false;
        Exception? error = null;
        try
        {
            if (RosbotRunFlow.RunF2RosbotOnline())
            {
                ColorPrinter.Gray("[F2] ROSBOT online -> no start needed");
                StartRosbotTask();
                success = true;
            }
            else
            {
                ColorPrinter.Gray("[F2] ROSBOT not online -> [E1-E6] start ROSBOT");
                ranEBlock = true;
                success = RosbotRunFlow.RunEBlock(ctx, StartRosbotTask);
            }
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            error = ex;
            ColorPrinter.Red($"[E] ROSBOT start error: {ex.Message}");
        }
        EventCenter.TriggerExtensionRosbotStarted(success, error, ranEBlock);
        return success;
    }

    public T? GetConfig<T>(string keyPath, T? defaultValue) => ConfigBinding.GetValue(keyPath, defaultValue);

    public IReadOnlyList<string>? GetConfigStringList(string keyPath)
    {
        string? raw = D3D4TesterConfigService.Instance.GetRawText(keyPath);
        if (string.IsNullOrEmpty(raw)) return null;
        try
        {
            return JsonSerializer.Deserialize<List<string>>(raw);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    public void SetConfig(string keyPath, object? value) => D3D4TesterConfigService.Instance.SetValueAsync(keyPath, value);

    public DateTime? GetLastLogModifiedUtc()
    {
        lock (_lock) return _logWatcher?.LastModifiedUtc;
    }

    public bool RefreshD3Status(bool skipDynamic) => D3StatusProvider.Refresh(skipDynamic).Changed;

    public bool RefreshRosbotStatus() => RosbotStatusProvider.RefreshInternal().Changed;

    public void NotifyStateSync() => GameInterfaceData.Instance.NotifyCallbacks();
}
