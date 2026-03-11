using System.Windows;
using DotApps.d3check.Ctl;

namespace DotApps.d3check.Ui;

/// <summary>
/// App-scoped UI registry. Register main window; resolve root and page by key. Same contract as Python share.ui_registry.
/// Combat macro controller is registered so MainPage can bind Start/Stop combat macro button (1:1 Python on_ui_macro_start/on_ui_macro_stop).
/// </summary>
public static class UiRegistry
{
    private static Window? _root;
    private static IMainWindowHost? _mainHost;
    private static CombatMacroController? _combatMacroController;

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
}

/// <summary>
/// Implemented by the main window so the registry can resolve pages by key.
/// </summary>
public interface IMainWindowHost
{
    object? GetPage(string key);
}
