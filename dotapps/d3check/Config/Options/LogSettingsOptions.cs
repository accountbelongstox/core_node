using Microsoft.Extensions.Configuration;

namespace DotApps.d3check.Config.Options;

/// <summary>Options for log_settings section.</summary>
public sealed class LogSettingsOptions
{
    [ConfigurationKeyName("show_debug_logs")]
    public bool ShowDebugLogs { get; set; } = true;

    [ConfigurationKeyName("auto_scroll")]
    public bool AutoScroll { get; set; } = true;

    [ConfigurationKeyName("log_level")]
    public string LogLevel { get; set; } = "INFO";
}
