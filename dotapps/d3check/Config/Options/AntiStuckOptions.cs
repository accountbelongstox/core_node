using Microsoft.Extensions.Configuration;

namespace DotApps.d3check.Config.Options;

/// <summary>Options for anti_stuck section.</summary>
public sealed class AntiStuckOptions
{
    [ConfigurationKeyName("enabled")]
    public bool Enabled { get; set; } = true;
}
