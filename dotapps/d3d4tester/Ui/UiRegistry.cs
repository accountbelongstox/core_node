// PY-REF: dotapps/d3d4tester/reference/py_d3check/share/ui_registry.py
// PY-REF: dotapps/d3d4tester/reference/py_d3check/ui/utils/app_root.py
using System.Windows;
using DotApps.d3d4tester.Ctl;

namespace DotApps.d3d4tester.Ui;

/// <summary>
/// App-scoped UI registry. Register main window; resolve root and page by key. Same contract as Python share.ui_registry.
/// Combat macro controller is registered so MainPage can bind Start/Stop combat macro button (1:1 Python on_ui_macro_start/on_ui_macro_stop).
/// </summary>
public static class UiRegistry
{
    private static Window? _root;
    private static IMainWindowHost? _mainHost;
    private static CombatMacroController? _combatMacroController;
    private static readonly Dictionary<string, object> _popups = new();
    private static readonly object _popupLock = new();

    public static void RegisterMainUi(Window root, IMainWindowHost mainHost)
    {
        _root = root;
        _mainHost = mainHost;
    }

    public static void UnregisterMainUi()
    {
        _root = null;
        _mainHost = null;
        _combatMacroController = null;
    }

    /// <summary>Register combat macro controller for UI button binding. Call from MainWindow after creating controller.</summary>
    public static void RegisterCombatMacroController(CombatMacroController? controller)
    {
        _combatMacroController = controller;
    }

    /// <summary>Get combat macro controller for Start/Stop button. 1:1 Python macro_controller.start_macro/stop_macro from UI.</summary>
    public static CombatMacroController? GetCombatMacroController() => _combatMacroController;

    public static Window? GetRoot() => _root;

    /// <summary>
    /// Get page by key. Returns the page content or null. Keys: main, rosbot, d4, calibration, log.
    /// </summary>
    public static object? GetPage(string key) => _mainHost?.GetPage(key);

    /// <summary>Register popup UI by key (AppConstants.PopupKey*). 1:1 Python register_popup.</summary>
    public static void RegisterPopup(string key, object instance)
    {
        lock (_popupLock) _popups[key] = instance;
    }

    /// <summary>Popup by key; null if not registered or closed. 1:1 Python get_popup.</summary>
    public static object? GetPopup(string key)
    {
        lock (_popupLock) return _popups.TryGetValue(key, out var v) ? v : null;
    }

    /// <summary>Unregister popup UI (call when closing). 1:1 Python unregister_popup.</summary>
    public static void UnregisterPopup(string key)
    {
        lock (_popupLock) _popups.Remove(key);
    }
}

/// <summary>
/// Implemented by the main window so the registry can resolve pages by key.
/// </summary>
public interface IMainWindowHost
{
    object? GetPage(string key);
}
