using System;
using System.Windows;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Services;
using DotCore.UITheme;

namespace DotApps.d3d4tester;

/// <summary>
/// Application entry. 1:1 with pyapps/d3-check/main.py GUI mode (no --http-bridge-only).
/// Python: main() -> _run_gui_and_bridge() -> sys_init.initialize_system(gui_mode=True) -> i18n load -> D3MacroController() -> HTTPBridgeController.start() -> controller.run() [Tk mainloop].
/// DOT: App_Startup -> Load config -> MainWindow.Show(). WPF message loop (Application.Run) keeps the app alive; no explicit while loop. MainWindow.OnLoaded starts _statePollTimer (100ms) and _bnOnlyFlowTimer (2s when EnsureBattlenetOnlyEnabled) for status/BN-only tick.
/// </summary>
public partial class App : Application
{
    private void App_Startup(object sender, StartupEventArgs e)
    {
        D3D4TesterConfigService.Instance.Load();
        ConfigOptionsProvider.Initialize();
        ThemeService.Instance.ApplySaved();
        Exit += App_Exit;
        var main = new MainWindow();
        main.Show();
    }

    private static void App_Exit(object sender, ExitEventArgs e)
    {
        D3D4TesterConfigService.Instance.FlushPendingSave();
    }

    /// <summary>Fluent 2 theme switch: true = dark, false = light. Persists the choice.</summary>
    public static void SetTheme(bool dark) => ThemeService.Instance.SetTheme(dark ? ThemeVariant.Dark : ThemeVariant.Light);
}
