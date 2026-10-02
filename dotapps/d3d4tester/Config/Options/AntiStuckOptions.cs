// PY-REF: pyapps/d3-check/providor/providor_index.py
using Microsoft.Extensions.Configuration;

namespace DotApps.d3d4tester.Config.Options;

/// <summary>Options for anti_stuck section.</summary>
public sealed class AntiStuckOptions
{
    [ConfigurationKeyName("enabled")]
    public bool Enabled { get; set; } = true;
}
