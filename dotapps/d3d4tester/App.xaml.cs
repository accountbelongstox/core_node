// PY-REF: pyapps/d3-check/main.py
// PY-REF: pyapps/d3-check/d3utils/system_initializer.py
using System;
using System.Runtime.InteropServices;
using System.Windows;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Ctl;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.Services;
using DotApps.d3d4tester.Ui;
using DotCore.Foundations;
using DotCore.Infrastructure.Http;
using DotCore.UITheme;

namespace DotApps.d3d4tester;

/// <summary>
/// Application entry. 1:1 with pyapps/d3-check/main.py: default = GUI + HTTP bridge on 127.0.0.1:8765;
/// --http-bridge-only [--host H] [--port P] = bridge without GUI. Python: initialize_system -> i18n -> controller ->
/// HTTPBridgeController.start -> controller.run; exit/restart go through ShutdownManager (restart after cleanup in App_Exit).
/// </summary>
public partial class App : Application
{
    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    private static extern int SetCurrentProcessExplicitAppUserModelID(string appId);

    private const string AppLogFilePrefix = "d3d4tester";

    private void App_Startup(object sender, StartupEventArgs e)
    {
        var (bridgeOnly, host, port) = ParseArgs(e.Args);
        SetAppUserModelId();
        Exit += App_Exit;
        ColorPrinter.EnableFileLog(ConfigPaths.LogDirectory, AppLogFilePrefix);
        if (!SystemInitializer.Initialize(guiMode: !bridgeOnly))
        {
            ColorPrinter.Red("[MAIN] System initialization failed, exiting...");
            Shutdown(1);
            return;
        }
        D3D4TesterI18n.EnsureInitialized();

        if (bridgeOnly)
        {
            ColorPrinter.Blue("[MAIN] D3D4Tester - HTTP Bridge Only (no GUI)");
            ShutdownMode = ShutdownMode.OnExplicitShutdown;
            var controller = new CombatMacroController(EventCenter.Hub);
            if (D3D4TesterHttpBridge.StartShared(() => controller, host, port) == null)
                Shutdown(1);
            else
                ColorPrinter.Green($"[MAIN] HTTP bridge started on http://{host}:{port} (DOT client can connect)");
            return;
        }

        ThemeService.Instance.ApplySaved();
        var main = new MainWindow();
        MainWindow = main;
        main.Show();
        if (D3D4TesterHttpBridge.StartShared(UiRegistry.GetCombatMacroController, host, port) != null)
            ColorPrinter.Green($"[MAIN] HTTP bridge started on http://{host}:{port}");
    }

    private static void App_Exit(object sender, ExitEventArgs e)
    {
        D3D4TesterHttpBridge.StopShared();
        D3D4TesterConfigService.Instance.FlushPendingSave();
        ShutdownManager.StartRestartedProcessIfRequested();
    }

    /// <summary>Fluent 2 theme switch: true = dark, false = light. Persists the choice.</summary>
    public static void SetTheme(bool dark) => ThemeService.Instance.SetTheme(dark ? ThemeVariant.Dark : ThemeVariant.Light);

    /// <summary>Parse --http-bridge-only / --host / --port (defaults 127.0.0.1:8765). 1:1 Python _parse_args.</summary>
    private static (bool BridgeOnly, string Host, int Port) ParseArgs(string[] args)
    {
        bool bridgeOnly = false;
        string host = LocalJsonHttpHost.DefaultHost;
        int port = LocalJsonHttpHost.DefaultPort;
        for (int i = 0; i < args.Length; i++)
        {
            string a = args[i];
            if (string.Equals(a, ShellConstants.ArgHttpBridgeOnly, StringComparison.OrdinalIgnoreCase))
                bridgeOnly = true;
            else if (string.Equals(a, ShellConstants.ArgHost, StringComparison.OrdinalIgnoreCase) && i + 1 < args.Length)
                host = args[++i];
            else if (string.Equals(a, ShellConstants.ArgPort, StringComparison.OrdinalIgnoreCase) && i + 1 < args.Length && int.TryParse(args[i + 1], out var p))
            {
                port = p;
                i++;
            }
        }
        return (bridgeOnly, host, port);
    }

    /// <summary>Taskbar grouping / icon identity. 1:1 Python set_windows_app_user_model_id("pycore.d3check.1.0").</summary>
    private static void SetAppUserModelId()
    {
        try { SetCurrentProcessExplicitAppUserModelID(ShellConstants.AppUserModelId); }
        catch (DllNotFoundException) { }
        catch (EntryPointNotFoundException) { }
    }
}
