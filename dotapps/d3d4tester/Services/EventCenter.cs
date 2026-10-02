using System.Media;
using System.Windows;
using System.Windows.Input;
using System.Windows.Threading;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Services;

/// <summary>Payload of AppEventIds.ExtensionRosbotStarted. 1:1 Python RosbotStartedPayload (success, error, ran_e_block).</summary>
public sealed record RosbotStartedPayload(bool Success, Exception? Error, bool RanEBlock);

/// <summary>
/// App event center over the DotCore IEventHub: components only trigger events; handlers registered here run window
/// lifecycle actions on the UI thread (show, minimize, maximize, exit, restart). Events triggered before the UI is ready
/// are queued by the hub and dispatched once RegisterMainThreadHandlers sets the dispatcher.
/// 1:1 Python d3utils/event_center.py.
/// </summary>
public static class EventCenter
{
    private const int MainExtensionPriority = 50;

    private static Window? _ui;
    private static bool _mainHandlersRegistered;

    /// <summary>Single app-wide event hub (CombatMacroController, flow and extension handlers subscribe/publish here).</summary>
    public static IEventHub Hub { get; } = new DefaultEventHub();

    /// <summary>
    /// Register main-thread handlers for exit/restart/show/minimize/maximize and dispatch pending events.
    /// Call once after the main window exists. 1:1 Python register_main_thread_handlers.
    /// </summary>
    public static void RegisterMainThreadHandlers(Window ui)
    {
        _ui = ui;
        if (!_mainHandlersRegistered)
        {
            _mainHandlersRegistered = true;
            Hub.Subscribe(AppEventIds.AppExit, OnExit);
            Hub.Subscribe(AppEventIds.AppRestart, OnRestart);
            Hub.Subscribe(AppEventIds.WindowShow, OnShow);
            Hub.Subscribe(AppEventIds.WindowMinimize, OnMinimize);
            Hub.Subscribe(AppEventIds.WindowMaximize, OnMaximize);
            Hub.Subscribe(AppEventIds.ExtensionMainStartMacro, OnMainStartMacro, MainExtensionPriority);
            Hub.Subscribe(AppEventIds.ExtensionMainStopMacro, OnMainStopMacro, MainExtensionPriority);
            ColorPrinter.Blue("[EventCenter] Main-thread handlers registered: exit/restart/show/minimize/maximize");
        }
        Hub.SetMainThreadDispatcher(new UiDispatcher(ui.Dispatcher));
    }

    /// <summary>Drop the window reference and the dispatcher (later main-thread events are queued, then discarded on exit).</summary>
    public static void UnregisterMainUi()
    {
        _ui = null;
        Hub.SetMainThreadDispatcher(null);
    }

    public static void TriggerAppExit() => Hub.PublishOnMainThread(AppEventIds.AppExit);

    public static void TriggerAppRestart() => Hub.PublishOnMainThread(AppEventIds.AppRestart);

    public static void TriggerWindowShow() => Hub.PublishOnMainThread(AppEventIds.WindowShow);

    public static void TriggerWindowMinimize() => Hub.PublishOnMainThread(AppEventIds.WindowMinimize);

    public static void TriggerWindowMaximize() => Hub.PublishOnMainThread(AppEventIds.WindowMaximize);

    public static void TriggerExtensionMainStartMacro() => Hub.Publish(AppEventIds.ExtensionMainStartMacro, null);

    public static void TriggerExtensionMainStopMacro() => Hub.Publish(AppEventIds.ExtensionMainStopMacro, null);

    /// <summary>Request ROSBOT start; the ROSBOT task processor subscribes to AppEventIds.ExtensionRosbotStart.</summary>
    public static void TriggerExtensionRosbotStart() => Hub.Publish(AppEventIds.ExtensionRosbotStart, null);

    /// <summary>Request ROSBOT stop; the ROSBOT task processor subscribes to AppEventIds.ExtensionRosbotStop.</summary>
    public static void TriggerExtensionRosbotStop() => Hub.Publish(AppEventIds.ExtensionRosbotStop, null);

    /// <summary>Completion of a ROSBOT start; UI subscribers receive a RosbotStartedPayload on the main thread.</summary>
    public static void TriggerExtensionRosbotStarted(bool success, Exception? error, bool ranEBlock) =>
        Hub.PublishOnMainThread(AppEventIds.ExtensionRosbotStarted, new RosbotStartedPayload(success, error, ranEBlock));

    public static void TriggerExtensionRosbotStopped() => Hub.PublishOnMainThread(AppEventIds.ExtensionRosbotStopped);

    /// <summary>Signal all extension workers to stop (ShutdownManager step 0). 1:1 Python trigger_extension_shutdown.</summary>
    public static void TriggerExtensionShutdown() => Hub.Publish(AppEventIds.ExtensionShutdown, null);

    /// <summary>
    /// Skill config switched (UI combo or HTTP bridge): beep when sound feedback is on.
    /// 1:1 Python Diablo3MacroUI._on_skill_config_switch + BottomBar.update_config_status (winsound.Beep(1000, 100)).
    /// </summary>
    public static void NotifySkillConfigSwitched(string configName)
    {
        bool sound = D3D4TesterConfigService.Instance.GetValueSafe(ConfigKeys.AuxiliarySoundFeedback, true);
        if (!sound) return;
        _ = Task.Run(() =>
        {
            try
            {
                if (OperatingSystem.IsWindows())
                    Console.Beep(ShellConstants.ConfigSwitchBeepFrequency, ShellConstants.ConfigSwitchBeepDurationMs);
                else
                    SystemSounds.Beep.Play();
            }
            catch (Exception ex)
            {
                ColorPrinter.Gray($"[DEBUG][EventCenter] Beep failed: {ex.Message}");
            }
        });
    }

    private static void OnExit(object? _)
    {
        if (ShutdownManager.IsShutdownRequested) return;
        ShutdownManager.RequestShutdown();
    }

    private static void OnRestart(object? _)
    {
        if (ShutdownManager.IsShutdownRequested) return;
        ShutdownManager.RequestRestart();
    }

    private static void OnShow(object? _)
    {
        var ui = _ui;
        if (ui == null) return;
        if (Mouse.Captured != null)
        {
            Mouse.Capture(null);
            ColorPrinter.Yellow("[UI] Released grab when showing window from tray");
        }
        ui.Show();
        if (ui.WindowState == WindowState.Minimized)
            ui.WindowState = WindowState.Normal;
        ui.Activate();
        ui.Focus();
    }

    private static void OnMinimize(object? _) => _ui?.Hide();

    private static void OnMaximize(object? _)
    {
        var ui = _ui;
        if (ui == null) return;
        ui.Show();
        ui.WindowState = ui.WindowState == WindowState.Maximized ? WindowState.Normal : WindowState.Maximized;
    }

    /// <summary>Forward to the main function thread; without one the CombatMacroController fallback runner already handles it.</summary>
    private static void OnMainStartMacro(object? _)
    {
        if (MainFunctionThreadRegistry.Instance.HasThread())
            ColorPrinter.Gray("[DEBUG][EventCenter] start_macro forwarded to main function thread");
    }

    private static void OnMainStopMacro(object? _)
    {
        if (MainFunctionThreadRegistry.Instance.HasThread())
            ColorPrinter.Gray("[DEBUG][EventCenter] stop_macro forwarded to main function thread");
    }

    /// <summary>Async UI dispatch (Python root.after(0, ...)); never blocks the publishing thread.</summary>
    private sealed class UiDispatcher : IMainThreadDispatcher
    {
        private readonly Dispatcher _dispatcher;
        public UiDispatcher(Dispatcher dispatcher) => _dispatcher = dispatcher;
        public void Invoke(Action action)
        {
            if (_dispatcher.HasShutdownStarted) return;
            _dispatcher.BeginInvoke(action);
        }
    }
}
