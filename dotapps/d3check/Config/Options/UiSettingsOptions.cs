using Microsoft.Extensions.Configuration;

namespace DotApps.d3check.Config.Options;

/// <summary>Options for ui_settings section. Bound via IOptions&lt;UiSettingsOptions&gt;.</summary>
public sealed class UiSettingsOptions
{
    [ConfigurationKeyName("window_geometry")]
    public string WindowGeometry { get; set; } = "";

    [ConfigurationKeyName("app_icon")]
    public string AppIcon { get; set; } = "";

    [ConfigurationKeyName("current_language")]
    public string CurrentLanguage { get; set; } = "en";

    [ConfigurationKeyName("skip_taskbar_win32_fix")]
    public bool SkipTaskbarWin32Fix { get; set; }
}
