// PY-REF: dotapps/d3d4tester/reference/py_d3check/providor/providor_index.py
using Microsoft.Extensions.Configuration;

namespace DotApps.d3d4tester.Config.Options;

/// <summary>Options for battlenet section.</summary>
public sealed class BattlenetOptions
{
    [ConfigurationKeyName("battlenet_path")]
    public string BattlenetPath { get; set; } = "";

    [ConfigurationKeyName("timeout_restart")]
    public bool TimeoutRestart { get; set; } = true;
}
