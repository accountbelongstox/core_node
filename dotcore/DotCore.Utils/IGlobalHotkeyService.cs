namespace DotCore.Utils;

/// <summary>
/// Global hotkey registration: register by id and canonical hotkey string; callback invoked when key is pressed.
/// Logic 1:1 with Python hotkey_registry + global_hotkey_manager: register/unregister, rebind on config change.
/// App reads hotkey from config (e.g. macro_configs.auxiliary_config.macro_start_hotkey), normalizes with HotkeyUtil,
/// then Register("combat", key, callback). On config change, Unregister then Register with new key.
/// </summary>
public interface IGlobalHotkeyService
{
    /// <summary>
    /// Registers a hotkey. If id was already registered, replaces it. Hotkey must be canonical (use HotkeyUtil.NormalizeCanonical).
    /// Callback is invoked on the main thread when the hotkey is pressed.
    /// </summary>
    /// <returns>True if registered successfully.</returns>
    bool Register(string id, string hotkeyCanonical, Action callback);

    /// <summary>
    /// Unregisters the hotkey for the given id.
    /// </summary>
    bool Unregister(string id);

    /// <summary>
    /// Unregisters all hotkeys (e.g. on shutdown). Logic 1:1 with Python unregister_all_auxiliary_hotkeys.
    /// </summary>
    void UnregisterAll();
}
