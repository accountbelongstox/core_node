using System.Collections.Generic;
using DotApps.d3check.Config;
using DotApps.d3check.Config.Options;
using DotApps.d3check.Constants;
using DotApps.d3check.Core;
using DotCore.Foundations;
using DotCore.Utils;

namespace DotApps.d3check.Hotkeys;

/// <summary>
/// Binds macro_configs.auxiliary_config hotkeys (assistant_hotkey, macro_start_hotkey) to IGlobalHotkeyService.
/// Subscribes to config change; on auxiliary_config change, reregisters. Logic 1:1 with Python hotkey_registry:
/// register assistant then combat; skip rebind when key unchanged; on new key register failure rollback to old key.
/// </summary>
public sealed class D3CheckHotkeyBinder
{
    private readonly IGlobalHotkeyService _service;
    private Action? _combatCallback;
    private Action? _assistantCallback;
    private IAssistantExecutionState? _assistantState;
    /// <summary>Current hotkey per id for skip-if-unchanged and rollback. Keys: "assistant", "combat".</summary>
    private readonly Dictionary<string, string> _currentHotkey = new(StringComparer.OrdinalIgnoreCase);

    public D3CheckHotkeyBinder(IGlobalHotkeyService service)
    {
        _service = service;
        D3CheckConfigChangeHub.Notifier.Subscribe(OnConfigChanged);
    }

    /// <summary>
    /// Sets callback for combat (macro start/stop) hotkey. Call before Initialize.
    /// </summary>
    public void SetCombatCallback(Action callback) => _combatCallback = callback;

    /// <summary>
    /// Sets callback for assistant hotkey. Call before Initialize.
    /// </summary>
    public void SetAssistantCallback(Action callback) => _assistantCallback = callback;

    /// <summary>
    /// Sets state provider for assistant hotkey. When set, the registered assistant callback
    /// uses get_assistant_state / set_assistant_should_stop / can_start_assistant (1:1 Python hotkey_registry 96-111).
    /// Call before Initialize.
    /// </summary>
    public void SetAssistantStateProvider(IAssistantExecutionState? stateProvider) => _assistantState = stateProvider;

    /// <summary>
    /// Registers assistant and combat hotkeys from config. Call after window handle is valid.
    /// Order 1:1 with Python initialize_hotkeys: assistant first, then combat.
    /// </summary>
    public void Initialize()
    {
        ReregisterAuxiliary();
    }

    /// <summary>
    /// Unregisters all and unsubscribes. Call on shutdown. Logic 1:1 with unregister_all_auxiliary_hotkeys.
    /// </summary>
    public void Shutdown()
    {
        D3CheckConfigChangeHub.Notifier.Unsubscribe(OnConfigChanged);
        _service.UnregisterAll();
        _currentHotkey.Clear();
    }

    private void OnConfigChanged(string? keyPath)
    {
        if (string.IsNullOrEmpty(keyPath)) return;
        if (keyPath.StartsWith(ConfigKeys.HotkeyConfigPathAuxiliary, StringComparison.OrdinalIgnoreCase))
            ReregisterAuxiliary();
    }

    /// <summary>
    /// Rebind assistant then combat from config. 1:1 with Python reregister_assistant_hotkey / reregister_combat_hotkey:
    /// not registered + new non-empty -> register; registered + new empty -> unregister only; old == new -> skip;
    /// else unregister old, register new; on new fail re-register old (rollback).
    /// </summary>
    private void ReregisterAuxiliary()
    {
        var opts = ConfigOptionsProvider.GetOptions<MacroAuxiliaryOptions>();
        var assistantNew = HotkeyUtil.NormalizeCanonical(opts.AssistantHotkey ?? "F3");
        var combatNew = HotkeyUtil.NormalizeCanonical(opts.MacroStartHotkey ?? "F2");

        ReregisterOne("assistant", assistantNew, BuildAssistantCallback());
        ReregisterOne("combat", combatNew, BuildCombatCallback());
    }

    /// <summary>
    /// Builds the combat hotkey callback. 1:1 with Python combat_hotkey_callback (hotkey_registry 195-201):
    /// if callback set then log and invoke; else log "Combat: Callback not set (controller not ready)".
    /// </summary>
    private Action BuildCombatCallback()
    {
        var cb = _combatCallback;
        return () =>
        {
            if (cb != null)
            {
                ColorPrinter.Blue("[HOTKEY] Combat: Toggle macro...");
                cb();
            }
            else
                ColorPrinter.Yellow("[HOTKEY] Combat: Callback not set (controller not ready)");
        };
    }

    /// <summary>
    /// Builds the assistant hotkey callback. 1:1 with Python assistant_hotkey_callback (hotkey_registry 96-111):
    /// if is_running then set_should_stop(True); else if can_start and callback set then invoke; else log.
    /// </summary>
    private Action BuildAssistantCallback()
    {
        var state = _assistantState;
        var runAssistant = _assistantCallback;
        return () =>
        {
            if (state != null)
            {
                if (state.IsRunning)
                {
                    ColorPrinter.Yellow("[HOTKEY] Assistant: Requesting stop...");
                    state.SetShouldStop(true);
                    return;
                }
                if (state.CanStart())
                {
                    if (runAssistant != null)
                    {
                        ColorPrinter.Blue("[HOTKEY] Assistant: Starting auto use interface function...");
                        runAssistant();
                    }
                    else
                        ColorPrinter.Yellow("[HOTKEY] Assistant: Callback not set (controller not ready)");
                }
                else
                    ColorPrinter.Yellow("[HOTKEY] Assistant: Cannot start - execution disabled");
            }
            else
                runAssistant?.Invoke();
        };
    }

    private void ReregisterOne(string id, string newHotkey, Action callback)
    {
        bool wasRegistered = _currentHotkey.TryGetValue(id, out var oldHotkey);
        if (!wasRegistered)
        {
            if (string.IsNullOrEmpty(newHotkey)) return;
            if (_service.Register(id, newHotkey, callback))
            {
                _currentHotkey[id] = newHotkey;
                ColorPrinter.Gray($"[HOTKEY] Registered id={id} key={newHotkey}");
            }
            return;
        }
        if (string.IsNullOrEmpty(newHotkey))
        {
            _service.Unregister(id);
            _currentHotkey.Remove(id);
            return;
        }
        if (string.Equals(oldHotkey, newHotkey, StringComparison.OrdinalIgnoreCase)) return;
        _service.Unregister(id);
        if (_service.Register(id, newHotkey, callback))
        {
            _currentHotkey[id] = newHotkey;
            ColorPrinter.Gray($"[HOTKEY] Registered id={id} key={newHotkey}");
            return;
        }
        if (_service.Register(id, oldHotkey!, callback))
            _currentHotkey[id] = oldHotkey!;
    }
}
