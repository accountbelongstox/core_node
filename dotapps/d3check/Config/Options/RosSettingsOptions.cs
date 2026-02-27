using Microsoft.Extensions.Configuration;

namespace DotApps.d3check.Config.Options;

/// <summary>Options for ros_settings section.</summary>
public sealed class RosSettingsOptions
{
    [ConfigurationKeyName("ros_directory")]
    public string RosDirectory { get; set; } = "";

    [ConfigurationKeyName("battlenet_region_cache")]
    public string BattlenetRegionCache { get; set; } = "";

    [ConfigurationKeyName("auto_enable_latest_ros")]
    public bool AutoEnableLatestRos { get; set; } = true;
}
