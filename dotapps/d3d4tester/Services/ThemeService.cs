using System;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Config.Options;
using DotApps.d3d4tester.Constants;
using DotCore.UITheme;

namespace DotApps.d3d4tester.Services;

/// <summary>
/// App theme: registers the app palette dictionaries with DotCore ThemeManager, restores the saved theme
/// (ui_settings.theme, default dark) and persists changes.
/// </summary>
public sealed class ThemeService
{
    private const string DarkThemeUri = "pack://application:,,,/d3d4tester;component/Assets/Styles/Themes/Dark.xaml";
    private const string LightThemeUri = "pack://application:,,,/d3d4tester;component/Assets/Styles/Themes/Light.xaml";

    public static ThemeService Instance { get; } = new();

    private ThemeService()
    {
        ThemeManager.Configure(new Uri(DarkThemeUri, UriKind.Absolute), new Uri(LightThemeUri, UriKind.Absolute));
    }

    public ThemeVariant Current => ThemeManager.CurrentVariant;

    /// <summary>Raised after the theme changed.</summary>
    public event EventHandler<ThemeVariant>? ThemeChanged
    {
        add => ThemeManager.ThemeChanged += value;
        remove => ThemeManager.ThemeChanged -= value;
    }

    /// <summary>Applies the theme saved in config. Call once at startup after config is loaded.</summary>
    public void ApplySaved()
    {
        var saved = ConfigOptionsProvider.GetOptions<UiSettingsOptions>().Theme;
        ThemeManager.Apply(ThemeVariantNames.Parse(saved));
    }

    /// <summary>Applies and persists the theme.</summary>
    public void SetTheme(ThemeVariant mode)
    {
        ThemeManager.Apply(mode);
        D3D4TesterConfigService.Instance.SetValueAsync(ConfigKeys.UiSettingsTheme, ThemeVariantNames.ToName(mode));
        D3D4TesterConfigService.Instance.QueueSave();
    }

    /// <summary>Switches dark/light, persists, and returns the new mode.</summary>
    public ThemeVariant Toggle()
    {
        var next = Current == ThemeVariant.Dark ? ThemeVariant.Light : ThemeVariant.Dark;
        SetTheme(next);
        return next;
    }
}
