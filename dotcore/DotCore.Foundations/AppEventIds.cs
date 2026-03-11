namespace DotCore.Foundations;

/// <summary>
/// Standard event ids for app lifecycle. Logic 1:1 with Python event_signals / providor.constants.common.
/// Apps subscribe and publish these; event center dispatches to main thread for UI events.
/// </summary>
public static class AppEventIds
{
    public const string AppExit = "app_exit";
    public const string AppRestart = "app_restart";
    public const string WindowShow = "window_show";
    public const string WindowMinimize = "window_minimize";
    public const string WindowMaximize = "window_maximize";
    public const string ExtensionMainStartMacro = "extension_main_start_macro";
    public const string ExtensionMainStopMacro = "extension_main_stop_macro";
    public const string ExtensionRosbotStart = "extension_rosbot_start";
    public const string ExtensionRosbotStop = "extension_rosbot_stop";
}
