using DotApps.d3check.Config;
using DotApps.d3check.Config.Options;
using DotApps.d3check.Constants;
using DotApps.d3check.Core;
using DotCore.Foundations;

namespace DotApps.d3check.Ctl;

/// <summary>
/// Combat macro start/stop controller. Logic 1:1 with Python D3MacroController.start_macro / stop_macro / _toggle_combat_macro.
/// Hotkey callback (already marshalled to main thread by IGlobalHotkeyService) calls Toggle() to start or stop.
/// Uses IEventHub (DotCore.Foundations) to trigger ExtensionMainStartMacro / ExtensionMainStopMacro; uses GameInterfaceData for D3 window cache clear.
/// </summary>
public sealed class CombatMacroController
{
    private readonly IEventHub _eventHub;
    private readonly object _lock = new();
    private bool _macroRunning;
    private string _currentSkillConfig = "config1";

    /// <summary>Whether the combat macro is currently running.</summary>
    public bool MacroRunning { get { lock (_lock) return _macroRunning; } }

    /// <summary>Current skill config name (config1..config4). 1:1 Python current_skill_config.</summary>
    public string CurrentSkillConfig { get { lock (_lock) return _currentSkillConfig; } }

    public CombatMacroController(IEventHub eventHub)
    {
        _eventHub = eventHub ?? throw new ArgumentNullException(nameof(eventHub));
        MacroFallbackRunner.SkillConfigProvider = () => MacroConfigLoader.Instance.GetCurrentSkillConfig();
    }

    /// <summary>Called after StartMacro. 1:1 Python on_macro_start.</summary>
    public Action? OnMacroStart { get; set; }

    /// <summary>Called after StopMacro. 1:1 Python on_macro_stop.</summary>
    public Action? OnMacroStop { get; set; }

    /// <summary>
    /// Toggle combat macro: if running then stop, else start. Call from hotkey callback (main thread).
    /// 1:1 with Python _toggle_combat_macro.
    /// </summary>
    public void Toggle()
    {
        if (MacroRunning)
        {
            ColorPrinter.Gray("[CombatMacro] Toggle -> Stop (was running)");
            StopMacro();
        }
        else
        {
            ColorPrinter.Gray("[CombatMacro] Toggle -> Start (was stopped)");
            StartMacro();
        }
    }

    /// <summary>
    /// Start the combat macro. 1:1 with Python start_macro: read current_skill_config from CONFIG, load_active (reload from CONFIG), notify extension, set running, fallback if no main thread, on_macro_start.
    /// Each start always reads CONFIG and loads the active config bindings (public lib -> D3 sub-lib: MacroConfigLoader reads CONFIG; MacroFallbackRunner uses SkillConfigProvider which returns loaded skills).
    /// </summary>
    public void StartMacro()
    {
        lock (_lock)
        {
            if (_macroRunning) return;
        }

        var cfg = ConfigOptionsProvider.GetOptions<MacroConfigsOptions>();
        string current = cfg.CurrentSkillConfig ?? "config1";
        lock (_lock) _currentSkillConfig = current;

        ColorPrinter.Blue($"[CombatMacro] StartMacro: current_skill_config={current} (reading from CONFIG)");
        LoadActiveMacroConfig();
        TriggerExtensionMainStartMacro();
        lock (_lock) _macroRunning = true;

        if (!HasMainFunctionThread())
            StartMacroFallback();

        try { OnMacroStart?.Invoke(); } catch { /* ignore */ }
    }

    /// <summary>
    /// Stop the combat macro. 1:1 with Python stop_macro: trigger extension stop, clear running, clear cache, stop fallback, on_macro_stop.
    /// </summary>
    public void StopMacro()
    {
        lock (_lock)
        {
            if (!_macroRunning) return;
        }

        ColorPrinter.Blue("[CombatMacro] StopMacro");

        TriggerExtensionMainStopMacro();
        lock (_lock) _macroRunning = false;
        ClearD3WindowCache();
        StopMacroFallback();

        try { OnMacroStop?.Invoke(); } catch { /* ignore */ }
    }

    /// <summary>Load active skill config into runtime. 1:1 Python get_macro_config_loader().load_active().</summary>
    private static void LoadActiveMacroConfig()
    {
        MacroConfigLoader.Instance.LoadActive();
    }

    /// <summary>Notify extension/main function thread to start macro. 1:1 Python trigger_extension_main_start_macro. Uses IEventHub from DotCore.Foundations.</summary>
    private void TriggerExtensionMainStartMacro()
    {
        _eventHub.Publish(AppEventIds.ExtensionMainStartMacro);
    }

    /// <summary>Notify extension to stop macro. 1:1 Python trigger_extension_main_stop_macro. Uses IEventHub from DotCore.Foundations.</summary>
    private void TriggerExtensionMainStopMacro()
    {
        _eventHub.Publish(AppEventIds.ExtensionMainStopMacro);
    }

    /// <summary>Whether a main function thread equivalent exists. 1:1 Python get_main_function_thread().</summary>
    private static bool HasMainFunctionThread()
    {
        return MainFunctionThreadRegistry.Instance.HasThread();
    }

    /// <summary>Start fallback macro loop when no main function thread. 1:1 Python get_thread_registry().start_macro_fallback.</summary>
    private void StartMacroFallback()
    {
        MacroFallbackRunner.Instance.Start(() => MacroRunning);
    }

    /// <summary>Stop fallback macro loop. 1:1 Python get_thread_registry().stop_macro_fallback.</summary>
    private static void StopMacroFallback()
    {
        MacroFallbackRunner.Instance.Stop();
    }

    /// <summary>Clear D3 window cache. 1:1 Python clear_d3_window_cache. Delegates to GameInterfaceData (D3CheckCore).</summary>
    private static void ClearD3WindowCache()
    {
        GameInterfaceData.Instance.ClearD3WindowCache();
    }
}
