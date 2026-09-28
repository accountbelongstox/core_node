namespace DotApps.d3check.Core;

public enum InMemoryCenterKind
{
    State = 1,
    Cache = 2,
    Registry = 3,
    EventHub = 4,
    UiShared = 5,
}

/// <summary>
/// Authoritative, code-level inventory for d3check in-memory "center data".
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
            TypeName: "DotApps.d3check.Core.GameInterfaceData",
            Kind: InMemoryCenterKind.State,
            Access: "GameInterfaceData.Instance; GetStateSnapshot/RegisterCallback/NotifyCallbacks; SetMarshalToUi",
            ThreadingContract: "Writers may run on background threads; NotifyCallbacks must marshal to UI via SetMarshalToUi.",
            Responsibility: "Runtime status snapshot for Battle.net / D3 / ROSBOT, path-valid flags, scale/window cache."),
        new Center(
            Key: "core.assistant_execution_state",
            TypeName: "DotApps.d3check.Core.AssistantExecutionState",
            Kind: InMemoryCenterKind.State,
            Access: "AssistantExecutionState.Instance",
            ThreadingContract: "Thread-safe (internal lock).",
            Responsibility: "Assistant macro execution state (IsRunning/ShouldStop/Enabled)."),
        new Center(
            Key: "core.main_function_thread_registry",
            TypeName: "DotApps.d3check.Core.MainFunctionThreadRegistry",
            Kind: InMemoryCenterKind.Registry,
            Access: "MainFunctionThreadRegistry.Instance",
            ThreadingContract: "Thread-safe (internal lock).",
            Responsibility: "Holds the extension/main-function thread pointer for fallback logic."),

        // Core caches (should be thread-safe; invalidate explicitly)
        new Center(
            Key: "core.rosbot_detection_cache",
            TypeName: "DotApps.d3check.Core.RosbotDetection",
            Kind: InMemoryCenterKind.Cache,
            Access: "RosbotDetection.GetDetection(...); RosbotDetection.InvalidateCache()",
            ThreadingContract: "Thread-safe (cache lock).",
            Responsibility: "TTL-based cache for ROSBOT process/window lookup."),
        new Center(
            Key: "core.drive_order_cache",
            TypeName: "DotApps.d3check.Core.DriveOrder",
            Kind: InMemoryCenterKind.Cache,
            Access: "DriveOrder.GetFixedDriveRootsForScan(useCache); DriveOrder.InvalidateCache()",
            ThreadingContract: "Thread-safe (cache lock).",
            Responsibility: "Cached fixed-drive roots ordering for path scan."),

        // Infrastructure-like singletons (runtime service objects)
        new Center(
            Key: "core.battlenet_manager",
            TypeName: "DotApps.d3check.Core.Battlenet.BattlenetManager",
            Kind: InMemoryCenterKind.State,
            Access: "BattlenetManager.Instance; SetPathProvider/HasWindow/Start/Close/Restart",
            ThreadingContract: "Instance creation is best-effort; treat as app-scoped singleton.",
            Responsibility: "Battle.net process/window control and queries."),
        new Center(
            Key: "core.d3_window_finder",
            TypeName: "DotApps.d3check.Core.D3WindowFinder",
            Kind: InMemoryCenterKind.Registry,
            Access: "D3WindowFinder.SetConfigPathProvider(...); FindWindows/FindFirstHandle",
            ThreadingContract: "Provider is assigned at startup; reads are concurrent-safe (delegate read).",
            Responsibility: "D3 window discovery using configured exe path provider, else title matching."),

        // Config-backed runtime caches (in-memory representation refreshed from persistent config)
        new Center(
            Key: "config.macro_config_loader",
            TypeName: "DotApps.d3check.Config.MacroConfigLoader",
            Kind: InMemoryCenterKind.State,
            Access: "MacroConfigLoader.Instance; LoadActive/GetCurrentSkillConfig",
            ThreadingContract: "Thread-safe (internal lock).",
            Responsibility: "Loads current macro skill configuration into memory for macro runner."),
        new Center(
            Key: "core.macro_fallback_runner",
            TypeName: "DotApps.d3check.Core.MacroFallbackRunner",
            Kind: InMemoryCenterKind.State,
            Access: "MacroFallbackRunner.Instance; MacroFallbackRunner.SkillConfigProvider",
            ThreadingContract: "Background loop reads SkillConfigProvider; assignment should occur on UI thread at startup.",
            Responsibility: "Fallback macro loop when no main-function thread exists."),

        // Event hub / notifications
        new Center(
            Key: "config.change_hub",
            TypeName: "DotApps.d3check.Config.D3CheckConfigChangeHub",
            Kind: InMemoryCenterKind.EventHub,
            Access: "D3CheckConfigChangeHub.Notifier; D3CheckConfigChangeHub.Notify(keyPath)",
            ThreadingContract: "Event dispatch must marshal to UI when handlers touch UI.",
            Responsibility: "Broadcasts config-change notifications (e.g., hotkey rebinding)."),
        new Center(
            Key: "i18n.d3check_i18n",
            TypeName: "DotApps.d3check.I18n.D3CheckI18n",
            Kind: InMemoryCenterKind.State,
            Access: "D3CheckI18n.Provider; EnsureInitialized(); LanguageChanged event",
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
            TypeName: "DotApps.d3check.RosbotUpdateManager",
            Kind: InMemoryCenterKind.State,
            Access: "RosbotUpdateManager.Instance; CheckUpdate/ApplyUpdate/GetDownloadsDir/GetBattlenetRegion",
            ThreadingContract: "Instance is app-scoped; methods may run on background threads.",
            Responsibility: "ROSBOT update check, Downloads dir, apply update; region for update."),
        new Center(
            Key: "ui.status_bar_display_builder",
            TypeName: "DotApps.d3check.StatusBar.D3StatusBarDisplayBuilder",
            Kind: InMemoryCenterKind.State,
            Access: "D3StatusBarDisplayBuilder.Instance; Build(snapshot, i18n)",
            ThreadingContract: "UI thread; stateless build from snapshot + i18n.",
            Responsibility: "Status bar text and brush keys from snapshot + i18n."),
        new Center(
            Key: "ctl.rosbot_flow_controller",
            TypeName: "DotApps.d3check.Ctl.RosbotFlowController",
            Kind: InMemoryCenterKind.State,
            Access: "RosbotFlowController.RunAsync/StopRosbot/SetShowCredentialsDialogAndWait/TickBnOnlyFlowAsync",
            ThreadingContract: "RunAsync on thread pool; NotifyCallbacks via GameInterfaceData marshal to UI.",
            Responsibility: "ROSBOT flow state and Run/EnsureBattlenet; depends on GameInterfaceData, AsiaCredentialsService."),
        new Center(
            Key: "config.asia_credentials_service",
            TypeName: "DotApps.d3check.Config.AsiaCredentialsService",
            Kind: InMemoryCenterKind.State,
            Access: "AsiaCredentialsService.GetCredentials(region)/SaveCredentials/LoadCredentialsForUi; RegionAsia/RegionCn",
            ThreadingContract: "Persisted in Config; decrypted values are in-memory; UI thread for LoadCredentialsForUi.",
            Responsibility: "Asia/CN credentials read-write; persistence via Config, decrypted view as memory data."),

        // Presentation-level shared state (kept here as inventory only; do not introduce more globals)
        new Center(
            Key: "ui.ui_registry",
            TypeName: "DotApps.d3check.Ui.UiRegistry",
            Kind: InMemoryCenterKind.Registry,
            Access: "UiRegistry.RegisterMainUi/UnregisterMainUi/GetRoot/GetPage/RegisterCombatMacroController",
            ThreadingContract: "UI thread only.",
            Responsibility: "UI shell/page registry and combat macro controller access."),
        new Center(
            Key: "ui.combat_macro_controller",
            TypeName: "DotApps.d3check.Ctl.CombatMacroController",
            Kind: InMemoryCenterKind.State,
            Access: "UiRegistry.GetCombatMacroController(); Toggle() etc.",
            ThreadingContract: "UI thread for toggle; marshal if invoked from background.",
            Responsibility: "Combat macro on/off state and execution; obtained via UiRegistry."),
        new Center(
            Key: "ui.rosbot_status_provider_cache",
            TypeName: "DotApps.d3check.Ctl.RosbotStatusProvider",
            Kind: InMemoryCenterKind.Cache,
            Access: "RosbotStatusProvider.GetRosbotOperation()",
            ThreadingContract: "Thread-safe (lazy init lock).",
            Responsibility: "Holds single IRosbotOperation instance used by status refresh."),
        new Center(
            Key: "ui.skill_row_strategy_display_names",
            TypeName: "DotApps.d3check.ViewModels.SkillRowViewModel",
            Kind: InMemoryCenterKind.UiShared,
            Access: "SkillRowViewModel.StrategyDisplayNames (ItemsSource); populated by MainPage.RefreshI18n",
            ThreadingContract: "UI thread only (ObservableCollection).",
            Responsibility: "Shared strategy display list for ComboBox binding."),
    };

    public static void InvalidateCaches()
    {
        RosbotDetection.InvalidateCache();
        DriveOrder.InvalidateCache();
    }
}

