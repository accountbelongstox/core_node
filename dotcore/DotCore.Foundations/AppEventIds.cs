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
    public const string ExtensionShutdown = "extension_shutdown";
    /// <summary>Payload: (success, error, ranEBlock) from the D3 extension login check.</summary>
    public const string ExtensionRosbotStarted = "extension_rosbot_started";
    public const string ExtensionRosbotStopped = "extension_rosbot_stopped";
    /// <summary>Payload: one new log line (string).</summary>
    public const string LogLine = "log_line";
    /// <summary>Payload: single string (path, last_modified, is_timeout).</summary>
    public const string LogMonitorInit = "log_monitor_init";
}
