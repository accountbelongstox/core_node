using System;
using System.IO;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using DotApps.d3check.Config.Options;

namespace DotApps.d3check.Config;

/// <summary>
/// Provides IOptions&lt;T&gt; bound from the user config file. Call Initialize() after D3CheckConfigService.Load().
/// Call Reload() after config file is saved to refresh options. No raw Configuration["Key"] in app code.
/// </summary>
public static class ConfigOptionsProvider
{
    private static IServiceProvider? _provider;
    private static readonly object _lock = new();

    /// <summary>Build IConfiguration from user config file and register all options. Call once at startup after Load().</summary>
    public static void Initialize()
    {
        lock (_lock)
        {
            var path = ConfigPaths.ConfigUserPath;
            var builder = new ConfigurationBuilder();
            if (File.Exists(path))
                builder.AddJsonFile(path, optional: false, reloadOnChange: false);
            var config = builder.Build();

            var services = new ServiceCollection();
            services.AddOptions();
            BindAndConfigure<UiSettingsOptions>(services, config, "ui_settings");
            BindAndConfigure<RosSettingsOptions>(services, config, "ros_settings");
            BindAndConfigure<BattlenetOptions>(services, config, "battlenet");
            BindAndConfigure<D3Options>(services, config, "d3");
            BindAndConfigure<LogSettingsOptions>(services, config, "log_settings");
            BindAndConfigure<CoordCalibrationOptions>(services, config, "coord_calibration");
            BindAndConfigure<RosbotOptions>(services, config, "rosbot");
            BindAndConfigure<MacroAuxiliaryOptions>(services, config, "macro_configs:auxiliary_config");
            BindAndConfigure<AntiStuckOptions>(services, config, "anti_stuck");
            BindAndConfigure<PathsOptions>(services, config, "paths");
            BindAndConfigure<MacroConfigsOptions>(services, config, "macro_configs");

            _provider = services.BuildServiceProvider();
        }
    }

    private static void BindAndConfigure<T>(IServiceCollection services, IConfiguration config, string sectionKey) where T : class, new()
    {
        IConfigurationSection section = sectionKey.Contains(':')
            ? config.GetSection(sectionKey.Split(':')[0]).GetSection(sectionKey.Split(':')[1])
            : config.GetSection(sectionKey);
        var instance = new T();
        section.Bind(instance);
        services.AddSingleton(Microsoft.Extensions.Options.Options.Create(instance));
    }

    /// <summary>Re-read config file and rebuild options. Call after D3CheckConfigService save (e.g. FlushPendingSave or after SetValueAsync).</summary>
    public static void Reload()
    {
        lock (_lock)
        {
            _provider = null;
            Initialize();
        }
    }

    /// <summary>Get options by type. Returns default-initialized T if not initialized or section missing.</summary>
    public static T GetOptions<T>() where T : class, new()
    {
        lock (_lock)
        {
            if (_provider == null)
                return new T();
            return _provider.GetService<IOptions<T>>()?.Value ?? new T();
        }
    }
}

