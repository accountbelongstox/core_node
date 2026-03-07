using Microsoft.Extensions.Configuration;

namespace DotApps.d3check.Config.Options;

/// <summary>Options for battlenet section.</summary>
public sealed class BattlenetOptions
{
    [ConfigurationKeyName("battlenet_path")]
    public string BattlenetPath { get; set; } = "";

    [ConfigurationKeyName("timeout_restart")]
    public bool TimeoutRestart { get; set; } = true;
}
