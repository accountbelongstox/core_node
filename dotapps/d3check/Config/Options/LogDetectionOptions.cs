using Microsoft.Extensions.Configuration;

namespace DotApps.d3check.Config.Options;

/// <summary>log_detection section: login_try trigger substring for screenshot callback. 1:1 Python get_config_section("log_detection").</summary>
public sealed class LogDetectionOptions
{
    [ConfigurationKeyName("login_try")]
    public string LoginTry { get; set; } = "";
}
