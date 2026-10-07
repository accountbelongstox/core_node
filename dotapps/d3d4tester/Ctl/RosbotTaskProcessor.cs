// PY-REF: pyapps/d3-check/d3utils/rosbot_task_processor.py
// PY-REF: pyapps/d3-check/threads/d3_extension_thread.py
// PY-REF: pyapps/d3-check/d3utils/system_initializer.py
// PY-REF: pyapps/d3-check/ui/panels/rosbot_extension_panel.py
// PY-REF: pyapps/d3-check/timers/one_shot_tasks.py
// PY-REF: pyapps/d3-check/lifecycle/log_monitor.py
using System.Collections.Concurrent;
using System.Globalization;
using System.Text.Json;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Battlenet;
using DotApps.d3d4tester.Core.D4;
using DotApps.d3d4tester.Core.Flow;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.Services;
using DotCore.Foundations;
using DotCore.Utils;

namespace DotApps.d3d4tester.Ctl;

/// <summary>
/// ROSBOT task processor: the single 1 s tick entry (TickDriver) and the flow host for Core. Every tick drains the ROSBOT log
/// queue and refreshes the test-mode display and total restart count; on even ticks (flow step) runs "Ensure Battle.net only"
/// (BnOnlyFlow) and the flow master (FlowMasterDriver), skipped while the credentials dialog is pending. Owns the D3 extension
/// worker that runs one blocking flow job at a time (D block: launch D3; E block: F2 gate, E1-E6; later requests are ignored
/// while one is queued or running) plus ExtensionRosbotStop, and the main-thread start/stop completion.
/// UI buttons only toggle flags here. 1:1 Python d3utils/rosbot_task_processor.py + threads/d3_extension_thread.py +
/// rosbot_extension_panel _start_rosbot/_stop_rosbot/_ensure_battlenet_only/_on_login_check_done/_on_rosbot_stop_done.
/// </summary>
public sealed class RosbotTaskProcessor : IRosbotFlowHost
{
    private const string LogTag = "[RosbotTaskProcessor]";
    private const string ExtensionLogTag = "[D3ExtensionThread]";
    private const string FlowTickTag = "[A2/A3]";
    private const string CmdStartRosbot = "start_rosbot";
    private const string CmdStopRosbot = "stop_rosbot";
    private const string CmdLaunchD3 = "launch_d3";
    private const string ExtensionThreadName = "D3ExtensionThread";
    private const int ExtensionPriority = 50;

    private readonly object _lock = new();
    private readonly BlockingCollection<string> _extensionQueue = new();
    private RosbotLogFileWatcher? _logWatcher;
    private Thread? _extensionThread;
    private CancellationTokenSource? _extensionCts;
    private bool _installed;
    private bool _initialized;
    private int _flowTickCount;
    private int _flowJobBusy;
    private DateTime? _flowLastRunUtc;
    private DateTime? _bnStuckSinceUtc;

    public static RosbotTaskProcessor Instance { get; } = new();

    private RosbotTaskProcessor()
    {
    }

    /// <summary>Current flow tick (global tick / 2), set on each flow step. 1:1 Python get_flow_tick_count.</summary>
    public int FlowTickCount => Volatile.Read(ref _flowTickCount);

    /// <summary>
    /// Wire once at startup (MainWindow loaded): flow host, log tail, tick callbacks, extension worker + event handlers, full
    /// status refresh for the window monitor, then start the 1 s clock. 1:1 Python system_initializer rosbot_task registration.
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
        StartExtensionWorker();
        var hub = EventCenter.Hub;
        hub.Subscribe(AppEventIds.ExtensionRosbotStart, _ => EnqueueFlowJob(CmdStartRosbot), ExtensionPriority);
        hub.Subscribe(AppEventIds.ExtensionRosbotStop, _ => _extensionQueue.Add(CmdStopRosbot), ExtensionPriority);
        hub.Subscribe(AppEventIds.ExtensionShutdown, _ => StopExtensionWorker(), ExtensionPriority);
        hub.Subscribe(AppEventIds.ExtensionRosbotStarted, OnRosbotStarted, ExtensionPriority);
        hub.Subscribe(AppEventIds.ExtensionRosbotStopped, _ => OnRosbotStopDone(), ExtensionPriority);
        var driver = TickDriver.Instance;
        driver.RegisterEveryTick(ProcessEveryTick);
        driver.RegisterFlowStep(ProcessFlowStep);
        driver.Start();
        ShutdownManager.RegisterShutdownHook(Uninstall);
        ColorPrinter.Blue($"{LogTag} Initialized");
    }

    /// <summary>Stop the 1 s clock, the extension worker and the log tail (window closed).</summary>
    public void Uninstall()
    {
        lock (_lock)
        {
            if (!_installed) return;
            _installed = false;
        }
        var driver = TickDriver.Instance;
        driver.Stop();
        driver.Unregister(ProcessEveryTick);
        driver.Unregister(ProcessFlowStep);
        StopExtensionWorker();
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

    /// <summary>Start button: set flow master; the tick drives the flow. 1:1 Python _start_rosbot.</summary>
    public void RequestStartFlow()
    {
        var state = RosbotFlowState.Instance;
        if (state.FlowMasterEnabled) return;
        state.SetFlowMasterEnabled(true);
        RequestStatusRefresh();
    }

    /// <summary>Stop button: clear flow master and BN-only, reset the flow-master B block, stop on the extension worker. 1:1 Python _stop_rosbot.</summary>
    public void RequestStopFlow()
    {
        var state = RosbotFlowState.Instance;
        if (!state.FlowMasterEnabled) return;
        state.SetFlowMasterEnabled(false);
        state.SetBnOnlyEnabled(false);
        BattlenetReadyFlow.ResetFlowMasterBnBlock();
        RequestStatusRefresh();
        EventCenter.TriggerExtensionRosbotStop();
    }

    /// <summary>Start / stop button (ROSBOT tab, Monitor tab): stop when the flow master is on, else start.</summary>
    public void ToggleFlow()
    {
        if (RosbotFlowState.Instance.FlowMasterEnabled) RequestStopFlow();
        else RequestStartFlow();
    }

    /// <summary>"Ensure Battle.net" button: flips the persisted guard switch; BattlenetGuardService applies it. 1:1 Python _ensure_battlenet_only.</summary>
    public void ToggleEnsureBattlenetOnly() =>
        ConfigBinding.SetValue(ConfigKeys.BattlenetEnsureNormal, !RosbotFlowState.Instance.BnOnlyEnabled);

    /// <summary>Apply the BN-only guard (idempotent): on -> status refresh (tick runs the BN segment); off -> reset B blocks.</summary>
    public void SetEnsureBattlenetOnly(bool enabled)
    {
        var state = RosbotFlowState.Instance;
        if (state.BnOnlyEnabled == enabled) return;
        state.SetBnOnlyEnabled(enabled);
        if (enabled)
        {
            RequestStatusRefresh();
            return;
        }
        BattlenetReadyFlow.ResetFlowMasterBnBlock();
        BnBlockState.Reset(forBnOnly: true);
    }

    /// <summary>One-shot full refresh off the UI thread. 1:1 Python _request_status_refresh (submit do_window_monitor_initial_check).</summary>
    public void RequestStatusRefresh() => _ = Task.Run(WindowMonitorService.Instance.RunInitialCheck);

    /// <summary>
    /// BN-only (no flow master): Battle.net only; else Battle.net + D3 light + ROSBOT; then notify. Returns the D3 window or null.
    /// 1:1 Python run_full_status_refresh.
    /// </summary>
    public WindowFinder.WindowInfo? RunFullStatusRefresh()
    {
        var state = RosbotFlowState.Instance;
        if (state.BnOnlyEnabled && !state.FlowMasterEnabled)
        {
            BattlenetStatusProvider.Refresh();
            NotifyStateSync();
            return null;
        }
        return RefreshAllGameStatus(d3Dynamic: false);
    }

    /// <summary>
    /// Battle.net + D3 (+ dynamic capture when d3Dynamic) + D4 running + ROSBOT into GameInterfaceData, then notify once.
    /// Single full refresh path for the window monitor and the "refresh game status" debug action. Returns the D3 window or null.
    /// </summary>
    public WindowFinder.WindowInfo? RefreshAllGameStatus(bool d3Dynamic)
    {
        BattlenetStatusProvider.Refresh();
        var d3 = D3StatusProvider.RefreshD3Status(skipDynamic: !d3Dynamic);
        GameInterfaceData.Instance.D4.GameRunning = D4Manager.Instance.IsRunning();
        RosbotStatusProvider.Refresh();
        NotifyStateSync();
        return d3;
    }

    /// <summary>Per-tick head: drain + analyze log lines, test-mode display, total restart count. 1:1 Python process_task head.</summary>
    private void ProcessEveryTick(IFlowTick _)
    {
        RosbotLogTickProcessor.ProcessPendingLines();
        var game = GameInterfaceData.Instance;
        game.SetRosbotTestModeDisplay(FormatTestModeDisplay(F3LogTimeout.GetTestModeDisplay()));
        game.SetRosbotTotalRestartCount(RosbotExitState.GetTotalRestartCount());
    }

    /// <summary>Flow step (tick % 2 == 0): gate, credentials-dialog skip, BN-only tick, flow-master tick. 1:1 Python process_task tail.</summary>
    private void ProcessFlowStep(IFlowTick tick)
    {
        var state = RosbotFlowState.Instance;
        if (!state.IsFlowActive) return;
        int flowTick = tick.FlowTick;
        Volatile.Write(ref _flowTickCount, flowTick);
        if (BattlenetFlowHooks.IsCredentialsDialogPending()) return;
        DateTime now = DateTime.UtcNow;
        double sincePrevious = _flowLastRunUtc is { } last ? (now - last).TotalSeconds : 0.0;
        _flowLastRunUtc = now;
        string dt = sincePrevious.ToString("0.00", CultureInfo.InvariantCulture);
        if (!state.FlowMasterEnabled)
            ColorPrinter.Gray($"{FlowTickTag} Tick #{flowTick} (2s step) bn_only={state.BnOnlyEnabled} | time since previous: {dt} s");
        if (state.BnOnlyEnabled)
            BnOnlyFlow.Tick();
        FlowMasterDriver.Tick(flowTick, $"{FlowTickTag} Tick #{flowTick} dt={dt}s | ");
        CheckBattlenetStuck();
        BattlenetStateWatchdog.Tick();
    }

    /// <summary>
    /// Kept from the previous C# start path (no Python counterpart): while the B block is in its login phase and Battle.net
    /// is stuck (sleep / fetching account info), show "waking up"; after BattlenetConstants.StuckCleanupDelaySec clear the cache.
    /// </summary>
    private void CheckBattlenetStuck()
    {
        var game = GameInterfaceData.Instance;
        if (!BattlenetReadyFlow.IsBnFlowInLoginPhase())
        {
            ResetStuckWatch(game);
            return;
        }
        bool stuck;
        using (var bn = BattlenetManager.Instance.GetProcess())
            stuck = bn != null && BattlenetStuckDetector.IsStuck(bn);
        if (!stuck)
        {
            ResetStuckWatch(game);
            return;
        }
        _bnStuckSinceUtc ??= DateTime.UtcNow;
        game.SetBattlenetWakingUp(true);
        double elapsed = (DateTime.UtcNow - _bnStuckSinceUtc.Value).TotalSeconds;
        if (elapsed < BattlenetConstants.StuckCleanupDelaySec) return;
        ColorPrinter.Blue($"[ROSBOT] Battle.net stuck {(int)elapsed}s (sleep or fetching account) -> clearing cache.");
        BattlenetCacheCleanup.ClearCache();
        ResetStuckWatch(game);
    }

    private void ResetStuckWatch(GameInterfaceData game)
    {
        if (_bnStuckSinceUtc == null) return;
        _bnStuckSinceUtc = null;
        game.SetBattlenetWakingUp(false);
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

    private void StartExtensionWorker()
    {
        lock (_lock)
        {
            if (_extensionThread != null) return;
            _extensionCts = new CancellationTokenSource();
            var token = _extensionCts.Token;
            _extensionThread = new Thread(() => RunExtensionWorker(token)) { IsBackground = true, Name = ExtensionThreadName };
            _extensionThread.Start();
        }
    }

    private void StopExtensionWorker()
    {
        lock (_lock)
        {
            _extensionCts?.Cancel();
            _extensionCts = null;
            _extensionThread = null;
        }
    }

    /// <summary>True while a D or E block job is queued or running on the extension worker.</summary>
    public bool IsFlowJobBusy => Volatile.Read(ref _flowJobBusy) == 1;

    /// <summary>Queue one blocking flow job; ignored while another one is queued or running (no stacked restarts of D3 / ROSBOT).</summary>
    private void EnqueueFlowJob(string cmd)
    {
        if (Interlocked.CompareExchange(ref _flowJobBusy, 1, 0) != 0)
        {
            ColorPrinter.Gray($"{ExtensionLogTag} {cmd} ignored: a flow job is already queued or running");
            return;
        }
        _extensionQueue.Add(cmd);
    }

    /// <summary>1:1 Python D3ExtensionThread.run (one command at a time).</summary>
    private void RunExtensionWorker(CancellationToken token)
    {
        ColorPrinter.Blue($"{ExtensionLogTag} Started");
        try
        {
            foreach (var cmd in _extensionQueue.GetConsumingEnumerable(token))
            {
                try
                {
                    if (cmd == CmdStartRosbot) DoStartRosbot();
                    else if (cmd == CmdLaunchD3) DoLaunchD3();
                    else if (cmd == CmdStopRosbot) DoStopRosbot();
                }
                catch (Exception ex)
                {
                    ColorPrinter.Red($"{ExtensionLogTag} Error handling command: {ex.Message}");
                }
                finally
                {
                    if (cmd != CmdStopRosbot) Volatile.Write(ref _flowJobBusy, 0);
                }
            }
        }
        catch (OperationCanceledException)
        {
        }
        ColorPrinter.Yellow($"{ExtensionLogTag} Stopped");
    }

    /// <summary>[A8] -> [F2] ROSBOT online -> nothing to start; else E1..E6. Needs a running D3 (the flow master routes F1 -> B -> D otherwise).</summary>
    private void DoStartRosbot()
    {
        if (!RosbotFlowState.Instance.FlowMasterEnabled)
        {
            EventCenter.TriggerExtensionRosbotStarted(false, null, false);
            return;
        }
        bool success = false;
        Exception? error = null;
        bool ranEBlock = false;
        try
        {
            if (!D3Manager.Instance.IsRunning())
                ColorPrinter.Yellow($"{ExtensionLogTag} F2: D3 not running, skip E block (flow master routes F1 -> B -> D)");
            else if (RosbotRunFlow.RunF2RosbotOnline())
                success = true;
            else
            {
                ColorPrinter.Gray($"{ExtensionLogTag} F2: ROSBOT not online -> E1-E6 (Start ROSBOT)");
                RosbotRunFlow.RunEBlock(StartRosbotTask);
                ranEBlock = true;
                success = true;
            }
        }
        catch (Exception ex)
        {
            error = ex;
        }
        EventCenter.TriggerExtensionRosbotStarted(success, error, ranEBlock);
    }

    /// <summary>[D] launch D3 from the confirmed Battle.net; [D13] window found -> mark "just entered" for the next C1 tick.</summary>
    private static void DoLaunchD3()
    {
        if (!RosbotFlowState.Instance.FlowMasterEnabled) return;
        if (LoginTryController.LaunchD3FromBattlenet())
            ExtensionFlowState.Instance.SetD3JustEnteredFromD13(true);
    }

    /// <summary>1:1 Python D3ExtensionThread._do_stop_rosbot.</summary>
    private void DoStopRosbot()
    {
        try
        {
            StopRosbotTask();
        }
        catch (Exception ex)
        {
            ColorPrinter.Red($"{ExtensionLogTag} Stop error: {ex.Message}");
        }
        EventCenter.TriggerExtensionRosbotStopped();
    }

    /// <summary>Main thread: error -> stop flow master; success -> monitoring (task start unless E already ran). 1:1 Python _on_login_check_done.</summary>
    private void OnRosbotStarted(object? payload)
    {
        if (payload is not RosbotStartedPayload data) return;
        if (data.Error != null)
        {
            ColorPrinter.Red($"[RosbotPanel] Login check error: {data.Error.Message}");
            RosbotFlowState.Instance.SetFlowMasterEnabled(false);
            BattlenetReadyFlow.ResetFlowMasterBnBlock();
            RequestStatusRefresh();
            return;
        }
        if (!data.Success) return;
        if (!RosbotFlowState.Instance.FlowMasterEnabled)
        {
            ColorPrinter.Gray("[RosbotPanel] start finished after Stop monitoring, result ignored");
            return;
        }
        Initialize();
        if (!data.RanEBlock)
            StartRosbotTask();
        ColorPrinter.Green("[ROSBOT] Started monitoring");
    }

    /// <summary>Main thread: clear flow master, reset the B block, refresh. 1:1 Python _on_rosbot_stop_done.</summary>
    private void OnRosbotStopDone()
    {
        RosbotFlowState.Instance.SetFlowMasterEnabled(false);
        BattlenetReadyFlow.ResetFlowMasterBnBlock();
        RequestStatusRefresh();
        ColorPrinter.Yellow("[ROSBOT] Stopped monitoring");
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

    public bool RefreshBattlenetStatus() => BattlenetStatusProvider.Refresh().Changed;

    public void NotifyStateSync() => GameInterfaceData.Instance.NotifyCallbacks();

    public void TriggerExtensionRosbotStart() => EventCenter.TriggerExtensionRosbotStart();

    public void TriggerD3Launch() => EnqueueFlowJob(CmdLaunchD3);
}
