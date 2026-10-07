// PY-REF: none (DOT-only)
namespace DotApps.d3d4tester.Core;

public enum InMemoryCenterKind
{
    State = 1,
    Cache = 2,
    Registry = 3,
    EventHub = 4,
    UiShared = 5,
}

/// <summary>
/// Authoritative, code-level inventory for d3d4tester in-memory "center data".
/// This is the place to add new shared runtime state (instead of scattering new static fields).
/// </summary>
public static class InMemoryCentersCatalog
{
    public sealed record Center(
        string Key,
        string TypeName,
        InMemoryCenterKind Kind,
        string Access,
        string ThreadingContract,
        string Responsibility);

    public static IReadOnlyList<Center> All { get; } = new[]
    {
        // Core runtime state (single source of truth for UI/flows)
        new Center(
            Key: "core.game_interface_data",
            TypeName: "DotApps.d3d4tester.Core.GameInterfaceData",
            Kind: InMemoryCenterKind.State,
            Access: "GameInterfaceData.Instance; GetStateSnapshot/RegisterCallback/NotifyCallbacks; SetMarshalToUi; Set* return changed; D4 section via .D4",
            ThreadingContract: "Writers may run on background threads; NotifyCallbacks must marshal to UI via SetMarshalToUi.",
            Responsibility: "Global state center (single source of truth): Battle.net window/probed client screen state (10 s)/UI region/dynamic triple/config region, D3 running/dynamic (menu, disconnected, in game) and window geometry (hwnd, title, offset, fullscreen), ROSBOT, flow switches, path-valid flags, scale/window cache."),
        new Center(
            Key: "core.assistant_execution_state",
            TypeName: "DotApps.d3d4tester.Core.AssistantExecutionState",
            Kind: InMemoryCenterKind.State,
            Access: "AssistantExecutionState.Instance",
            ThreadingContract: "Thread-safe (internal lock).",
            Responsibility: "Assistant macro execution state (IsRunning/ShouldStop/Enabled)."),
        new Center(
            Key: "core.main_function_thread_registry",
            TypeName: "DotApps.d3d4tester.Core.MainFunctionThreadRegistry",
            Kind: InMemoryCenterKind.Registry,
            Access: "MainFunctionThreadRegistry.Instance",
            ThreadingContract: "Thread-safe (internal lock).",
            Responsibility: "Holds the extension/main-function thread pointer for fallback logic."),

        // Core caches (should be thread-safe; invalidate explicitly)
        new Center(
            Key: "core.rosbot_detection_cache",
            TypeName: "DotApps.d3d4tester.Core.RosbotDetection",
            Kind: InMemoryCenterKind.Cache,
            Access: "RosbotDetection.GetDetection(...); RosbotDetection.InvalidateCache()",
            ThreadingContract: "Thread-safe (cache lock).",
            Responsibility: "TTL-based cache for ROSBOT process/window lookup."),
        new Center(
            Key: "core.drive_order_cache",
            TypeName: "DotApps.d3d4tester.Core.DriveOrder",
            Kind: InMemoryCenterKind.Cache,
            Access: "DriveOrder.GetFixedDriveRootsForScan(useCache); DriveOrder.InvalidateCache()",
            ThreadingContract: "Thread-safe (cache lock).",
            Responsibility: "Cached fixed-drive roots ordering for path scan."),

        // Infrastructure-like singletons (runtime service objects)
        new Center(
            Key: "core.battlenet_manager",
            TypeName: "DotApps.d3d4tester.Core.Battlenet.BattlenetManager",
            Kind: InMemoryCenterKind.State,
            Access: "BattlenetManager.Instance; SetPathProvider/GetPath/HasWindow/GetProcess/Start/RestoreFromTray/ActivateWindow/Close/Restart",
            ThreadingContract: "Instance creation is best-effort; treat as app-scoped singleton.",
            Responsibility: "Only Battle.net process/window control and lookup (Start is idempotent: no-op while a window exists)."),
        new Center(
            Key: "core.game_window_managers",
            TypeName: "DotApps.d3d4tester.Core.GameWindowManager (D3Manager, D4.D4Manager)",
            Kind: InMemoryCenterKind.Registry,
            Access: "D3Manager.Instance / D4Manager.Instance; FindWindows/IsRunning/PollUntilWindowAppears/KillIfRunning/ActivateWindow",
            ThreadingContract: "Stateless lookups; safe from any thread.",
            Responsibility: "Only D3 / D4 window lookup and control; launch from Battle.net goes through LoginTryController (D block)."),
        new Center(
            Key: "core.d3_window_finder",
            TypeName: "DotApps.d3d4tester.Core.D3WindowFinder",
            Kind: InMemoryCenterKind.Registry,
            Access: "D3WindowFinder.SetConfigPathProvider(...); FindWindows/FindFirstHandle",
            ThreadingContract: "Provider is assigned at startup; reads are concurrent-safe (delegate read).",
            Responsibility: "D3 window discovery using configured exe path provider, else title matching."),

        // Config-backed runtime caches (in-memory representation refreshed from persistent config)
        new Center(
            Key: "config.macro_config_loader",
            TypeName: "DotApps.d3d4tester.Config.MacroConfigLoader",
            Kind: InMemoryCenterKind.State,
            Access: "MacroConfigLoader.Instance; LoadActive/GetCurrentSkillConfig",
            ThreadingContract: "Thread-safe (internal lock).",
            Responsibility: "Loads current macro skill configuration into memory for macro runner."),
        new Center(
            Key: "core.macro_fallback_runner",
            TypeName: "DotApps.d3d4tester.Core.MacroFallbackRunner",
            Kind: InMemoryCenterKind.State,
            Access: "MacroFallbackRunner.Instance; MacroFallbackRunner.SkillConfigProvider",
            ThreadingContract: "Background loop reads SkillConfigProvider; assignment should occur on UI thread at startup.",
            Responsibility: "Fallback macro loop when no main-function thread exists."),

        // Flow / tick state
        new Center(
            Key: "flow.tick_driver",
            TypeName: "DotApps.d3d4tester.Core.Flow.TickDriver",
            Kind: InMemoryCenterKind.State,
            Access: "TickDriver.Instance; Start/Stop; RegisterEveryTick/RegisterSmartEcho/RegisterInactiveRefresh",
            ThreadingContract: "Ticks run on a background timer without overlap; callbacks marshal to UI when touching UI.",
            Responsibility: "Single 1 s app tick for periodic services (log drain, monitor, smart echo %3, inactive refresh %10); not the ROSBOT flow."),
        new Center(
            Key: "flow.rosbot_flow_state",
            TypeName: "DotApps.d3d4tester.Core.Flow.RosbotFlowState",
            Kind: InMemoryCenterKind.State,
            Access: "RosbotFlowState.Instance; FlowMasterEnabled, BnOnlyEnabled; SetFlowMasterEnabled/SetBnOnlyEnabled",
            ThreadingContract: "Set by the runners and the UI; holds no copy, reads and writes GameInterfaceData.",
            Responsibility: "Monitoring and Battle.net guard switches (view over GameInterfaceData)."),
        new Center(
            Key: "flow.rosbot_flow_runner",
            TypeName: "DotApps.d3d4tester.Core.Flow.RosbotFlowRunner",
            Kind: InMemoryCenterKind.State,
            Access: "RosbotFlowRunner.Start/Stop/IsRunning (RosbotTaskProcessor.RequestStartFlow/RequestStopFlow)",
            ThreadingContract: "One FlowThread; every wait is cancellable through FlowContext, Stop ends it at the current step.",
            Responsibility: "Sequential ROSBOT flow F1 -> B -> D -> C -> E -> F3 (docs/ROSBOT_FLOW_MERMAID.md); D3 / Battle.net / ROSBOT reused when healthy."),
        new Center(
            Key: "flow.battlenet_guard",
            TypeName: "DotApps.d3d4tester.Services.BattlenetGuardService + Core.Flow.BattlenetGuardRunner",
            Kind: InMemoryCenterKind.State,
            Access: "BattlenetGuardService.Initialize (config battlenet.ensure_normal / battlenet.region via ConfigChangeHub) -> RosbotTaskProcessor.SetEnsureBattlenetOnly -> BattlenetGuardRunner.Start/Stop",
            ThreadingContract: "Own FlowThread; BattlenetReadyProcess runs one at a time (shared gate) and the guard yields to monitoring.",
            Responsibility: "Global Battle.net guard (default on): BattlenetReadyProcess without activation while monitoring and D3 are off (region first, login, abnormal / login timeout restarts)."),
        new Center(
            Key: "d4.interface_data",
            TypeName: "DotApps.d3d4tester.Core.D4.D4InterfaceData",
            Kind: InMemoryCenterKind.State,
            Access: "GameInterfaceData.Instance.D4 (= D4InterfaceData.Instance); read via D4UiStatusUpdater.Collect / StatusUpdated",
            ThreadingContract: "Written by the D4 3 s tick and the D4 launch; UI reads snapshots only.",
            Responsibility: "D4 section of the global center: game running, window, map, team, location and region-image state."),

        // Event hub / notifications
        new Center(
            Key: "config.change_hub",
            TypeName: "DotApps.d3d4tester.Config.D3D4TesterConfigChangeHub",
            Kind: InMemoryCenterKind.EventHub,
            Access: "D3D4TesterConfigChangeHub.Notifier; D3D4TesterConfigChangeHub.Notify(keyPath)",
            ThreadingContract: "Event dispatch must marshal to UI when handlers touch UI.",
            Responsibility: "Broadcasts config-change notifications (e.g., hotkey rebinding)."),
        new Center(
            Key: "i18n.d3d4tester_i18n",
            TypeName: "DotApps.d3d4tester.I18n.D3D4TesterI18n",
            Kind: InMemoryCenterKind.State,
            Access: "D3D4TesterI18n.Provider; EnsureInitialized(); LanguageChanged event",
            ThreadingContract: "UI thread for Provider and language combo; init at startup.",
            Responsibility: "Current language and UI copy (i18n); single source for GetUiText."),
        new Center(
            Key: "infra.color_printer",
            TypeName: "DotCore.Foundations.ColorPrinter",
            Kind: InMemoryCenterKind.EventHub,
            Access: "ColorPrinter.RegisterCallback/UnregisterCallback; Gray/Blue/... (no persistent store)",
            ThreadingContract: "Callbacks may be invoked from any thread; handlers must marshal to UI if touching UI.",
            Responsibility: "Log callback registration and dispatch to Log/ROS pages; not a data store."),
        new Center(
            Key: "ctl.rosbot_update_manager",
            TypeName: "DotApps.d3d4tester.RosbotUpdateManager",
            Kind: InMemoryCenterKind.State,
            Access: "RosbotUpdateManager.Instance; CheckUpdate/ApplyUpdate/GetDownloadsDir/GetBattlenetRegion",
            ThreadingContract: "Instance is app-scoped; methods may run on background threads.",
            Responsibility: "ROSBOT update check, Downloads dir, apply update; region for update."),
        new Center(
            Key: "ui.status_bar_display_builder",
            TypeName: "DotApps.d3d4tester.StatusBar.D3StatusBarDisplayBuilder",
            Kind: InMemoryCenterKind.State,
            Access: "D3StatusBarDisplayBuilder.Instance; Build(snapshot, i18n)",
            ThreadingContract: "UI thread; stateless build from snapshot + i18n.",
            Responsibility: "Status bar text and brush keys from snapshot + i18n."),
        new Center(
            Key: "ctl.rosbot_flow_controller",
            TypeName: "DotApps.d3d4tester.Ctl.RosbotFlowController",
            Kind: InMemoryCenterKind.State,
            Access: "RosbotFlowController.InstallHooks/StopRosbot/SetShowCredentialsDialogAndWait; flow runs from RosbotTaskProcessor (1 s tick, BN-only, flow master)",
            ThreadingContract: "Hooks installed once; NotifyCallbacks via GameInterfaceData marshal to UI.",
            Responsibility: "Battle.net flow hook wiring and ROSBOT stop; no flow state of its own."),
        new Center(
            Key: "config.asia_credentials_service",
            TypeName: "DotApps.d3d4tester.Config.AsiaCredentialsService",
            Kind: InMemoryCenterKind.State,
            Access: "AsiaCredentialsService.GetCredentials(region)/SaveCredentials/LoadCredentialsForUi; RegionAsia/RegionCn",
            ThreadingContract: "Persisted in Config; decrypted values are in-memory; UI thread for LoadCredentialsForUi.",
            Responsibility: "Asia/CN credentials read-write; persistence via Config, decrypted view as memory data."),

        // Presentation-level shared state (kept here as inventory only; do not introduce more globals)
        new Center(
            Key: "ui.ui_registry",
            TypeName: "DotApps.d3d4tester.Ui.UiRegistry",
            Kind: InMemoryCenterKind.Registry,
            Access: "UiRegistry.RegisterMainUi/UnregisterMainUi/GetRoot/GetPage/RegisterCombatMacroController",
            ThreadingContract: "UI thread only.",
            Responsibility: "UI shell/page registry and combat macro controller access."),
        new Center(
            Key: "ui.combat_macro_controller",
            TypeName: "DotApps.d3d4tester.Ctl.CombatMacroController",
            Kind: InMemoryCenterKind.State,
            Access: "UiRegistry.GetCombatMacroController(); Toggle() etc.",
            ThreadingContract: "UI thread for toggle; marshal if invoked from background.",
            Responsibility: "Combat macro on/off state and execution; obtained via UiRegistry."),
        new Center(
            Key: "ui.rosbot_status_provider_cache",
            TypeName: "DotApps.d3d4tester.Ctl.RosbotStatusProvider",
            Kind: InMemoryCenterKind.Cache,
            Access: "RosbotStatusProvider.GetRosbotOperation()",
            ThreadingContract: "Thread-safe (lazy init lock).",
            Responsibility: "Holds single IRosbotOperation instance used by status refresh."),
        new Center(
            Key: "ui.skill_row_strategy_display_names",
            TypeName: "DotApps.d3d4tester.ViewModels.SkillRowViewModel",
            Kind: InMemoryCenterKind.UiShared,
            Access: "SkillRowViewModel.StrategyOptions (ItemsSource, value + display); display updated in place by MainPage.RefreshI18n",
            ThreadingContract: "UI thread only (ObservableCollection).",
            Responsibility: "Shared strategy display list for ComboBox binding."),
        new Center(
            Key: "services.yolo_training",
            TypeName: "DotApps.d3d4tester.Services.YoloTrainingService",
            Kind: InMemoryCenterKind.State,
            Access: "YoloTrainingService.Instance; RunAsync/Cancel; Phase; Log/Progress/PhaseChanged events",
            ThreadingContract: "Thread-safe (internal lock); events fire on worker threads, subscribers marshal to UI.",
            Responsibility: "Single running YOLO training job (dataset build, Ultralytics train, ONNX export)."),
        new Center(
            Key: "services.monitor",
            TypeName: "DotApps.d3d4tester.Services.Monitor.MonitorService",
            Kind: InMemoryCenterKind.State,
            Access: "MonitorService.Instance; Install/GetStatus/RequestRestart/OnLogLine",
            ThreadingContract: "Tick and log lines on the TickDriver thread; GetStatus from the UI thread (internal lock).",
            Responsibility: "RBAssist monitor state: last log / history lines and idle, death / fail / run counters, process edges, pylon / portal / probe states."),
        new Center(
            Key: "services.monitor_triggers",
            TypeName: "DotApps.d3d4tester.Services.Monitor.TriggerEngine",
            Kind: InMemoryCenterKind.Registry,
            Access: "TriggerEngine.Instance; Triggers/Save/Fire/Evaluate/Enqueue",
            ThreadingContract: "Thread-safe (internal lock); actions run one at a time on a background worker.",
            Responsibility: "Trigger list (monitor.triggers) and the action queue."),
        new Center(
            Key: "core.rosbot_restart_request",
            TypeName: "DotApps.d3d4tester.Core.Flow.RosbotRestartRequest",
            Kind: InMemoryCenterKind.State,
            Access: "RosbotRestartRequest.Request/TryConsume/IsPending; Executed event",
            ThreadingContract: "Thread-safe (internal lock); Executed runs on the tick thread before F4.",
            Responsibility: "Pending restart outside the F3 timeout, consumed by the flow master (F4 -> B2)."),
    };

    public static void InvalidateCaches()
    {
        RosbotDetection.InvalidateCache();
        DriveOrder.InvalidateCache();
    }
}

