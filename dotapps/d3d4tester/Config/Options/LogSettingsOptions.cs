// PY-REF: pyapps/d3-check/providor/providor_index.py
using Microsoft.Extensions.Configuration;

namespace DotApps.d3d4tester.Config.Options;

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
