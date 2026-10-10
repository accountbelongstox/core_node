// PY-REF: dotapps/d3d4tester/reference/py_d3check/providor/providor_index.py
using Microsoft.Extensions.Configuration;

namespace DotApps.d3d4tester.Config.Options;

/// <summary>Options for d3 section.</summary>
public sealed class D3Options
{
    [ConfigurationKeyName("d3_path")]
    public string D3Path { get; set; } = "";
}
