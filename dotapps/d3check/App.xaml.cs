using System;
using System.Windows;
using DotApps.d3check.Config;

namespace DotApps.d3check;

/// <summary>
/// Application entry. 1:1 with pyapps/d3-check/main.py GUI mode (no --http-bridge-only).
/// Python: main() -> _run_gui_and_bridge() -> sys_init.initialize_system(gui_mode=True) -> i18n load -> D3MacroController() -> HTTPBridgeController.start() -> controller.run() [Tk mainloop].
/// DOT: App_Startup -> Load config -> MainWindow.Show(). WPF message loop (Application.Run) keeps the app alive; no explicit while loop. MainWindow.OnLoaded starts _statePollTimer (100ms) and _bnOnlyFlowTimer (2s when EnsureBattlenetOnlyEnabled) for status/BN-only tick.
/// </summary>
public partial class App : Application
{
    private const int ThemeDictionaryIndex = 3;

    private void App_Startup(object sender, StartupEventArgs e)
    {
        D3CheckConfigService.Instance.Load();
        ConfigOptionsProvider.Initialize();
        Exit += App_Exit;
        var main = new MainWindow();
        main.Show();
    }

    private static void App_Exit(object sender, ExitEventArgs e)
    {
        D3CheckConfigService.Instance.FlushPendingSave();
    }

    /// <summary>Fluent 2 theme switch: true = dark, false = light. MergedDictionaries index 3 = theme.</summary>
    public static void SetTheme(bool dark)
    {
        var uri = dark
            ? new Uri("/d3check;component/Assets/Styles/Themes/Dark.xaml", UriKind.Relative)
            : new Uri("/d3check;component/Assets/Styles/Themes/Light.xaml", UriKind.Relative);
        var dict = Current.Resources.MergedDictionaries;
        if (ThemeDictionaryIndex < dict.Count)
            dict[ThemeDictionaryIndex] = new ResourceDictionary { Source = uri };
    }
}
