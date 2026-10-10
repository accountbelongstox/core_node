// PY-REF: pyapps/d3-check/providor/providor_index.py
using Microsoft.Extensions.Configuration;

namespace DotApps.d3d4tester.Config.Options;

/// <summary>Options for paths section (downloads_dir).</summary>
public sealed class PathsOptions
{
    [ConfigurationKeyName("downloads_dir")]
    public string DownloadsDir { get; set; } = "";
}
