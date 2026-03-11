using Microsoft.Extensions.Configuration;

namespace DotApps.d3check.Config.Options;

/// <summary>Options for d3 section.</summary>
public sealed class D3Options
{
    [ConfigurationKeyName("d3_path")]
    public string D3Path { get; set; } = "";
}
