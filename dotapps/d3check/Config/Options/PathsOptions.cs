using Microsoft.Extensions.Configuration;

namespace DotApps.d3check.Config.Options;

/// <summary>Options for paths section (downloads_dir, tampermonkey_script).</summary>
public sealed class PathsOptions
{
    [ConfigurationKeyName("downloads_dir")]
    public string DownloadsDir { get; set; } = "";

    [ConfigurationKeyName("tampermonkey_script")]
    public string TampermonkeyScript { get; set; } = "";
}
