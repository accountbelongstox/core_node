// PY-REF: pyapps/d3-check/d3utils/macro_config_loader.py
using System.Collections.Generic;
using DotApps.d3d4tester.Constants;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Config;

/// <summary>
/// Loads active macro config from CONFIG into memory. 1:1 with Python d3utils.macro_config_loader.MacroConfigLoader.
/// Call LoadActive() when CONFIG is ready and on config change; macro loop reads via GetCurrentConfigName / GetCurrentSkillConfig.
/// CONFIG is path-based and dynamic: macro_configs.skill_configs.{name}.skills.{skillKey}.{field}. To add a new skill row, add the skillKey to the list in LoadActive() and to MacroSkillRunner.SkillOrder (and UI); new fields under each skill are read by path so no code change needed for new field names if CONFIG schema extends.
/// </summary>
public sealed class MacroConfigLoader
{
    private static readonly string[] SkillKeys = { "skill1", "skill2", "skill3", "skill4", "left_click", "right_click", "potion" };
    private static readonly string[] SkillFields = { "key", "strategy", "interval", "delay", "random_delay" };

    private readonly object _lock = new();
    private string _currentConfigName = "config1";
    private string _previousLoggedName = "";
    private IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> _currentSkills = new Dictionary<string, IReadOnlyDictionary<string, string>>();

    public static MacroConfigLoader Instance { get; } = new();

    private MacroConfigLoader() { }

    /// <summary>Read active config from CONFIG and refresh cached bindings. Call from main thread. 1:1 Python load_active(). Call on every StartMacro and when current config dropdown changes.</summary>
    public void LoadActive()
    {
        var svc = D3D4TesterConfigService.Instance;
        string name = svc.GetValueSafe<string>(ConfigKeys.MacroConfigsCurrentSkillConfig, "config1") ?? "config1";
        var skills = ReadSkills(name);
        lock (_lock)
        {
            _currentConfigName = name;
            _currentSkills = skills;
        }
        if (name != _previousLoggedName)
        {
            _previousLoggedName = name;
            ColorPrinter.Blue($"[MacroConfigLoader] Active config: {name}");
        }
        string leftStrat = skills.TryGetValue("left_click", out var l) && l.TryGetValue("strategy", out var ls) ? ls : "";
        string rightStrat = skills.TryGetValue("right_click", out var r) && r.TryGetValue("strategy", out var rs) ? rs : "";
        ColorPrinter.Gray($"[MacroConfigLoader] Loaded from CONFIG: config={name} left_click.strategy={leftStrat} right_click.strategy={rightStrat}");
    }

    /// <summary>Skill config for the given config name, read from CONFIG (not cached). 1:1 Python macro_config_provider.get_skill_config_by_name.</summary>
    public IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> GetSkillConfigByName(string configName) => ReadSkills(configName);

    private static Dictionary<string, IReadOnlyDictionary<string, string>> ReadSkills(string name)
    {
        var svc = D3D4TesterConfigService.Instance;
        var skills = new Dictionary<string, IReadOnlyDictionary<string, string>>();
        string basePath = $"macro_configs.skill_configs.{name}.skills";
        foreach (var skillKey in SkillKeys)
        {
            var entry = new Dictionary<string, string>();
            foreach (var field in SkillFields)
            {
                var v = svc.GetValueSafe<string>($"{basePath}.{skillKey}.{field}", "");
                if (v != null) entry[field] = v;
            }
            skills[skillKey] = entry;
        }
        return skills;
    }

    /// <summary>Active config name (config1..config4). 1:1 Python get_current_config_name().</summary>
    public string GetCurrentConfigName()
    {
        lock (_lock) return _currentConfigName;
    }

    /// <summary>Skill config for active config (skillKey -> field -> value). 1:1 Python get_current_skill_config().</summary>
    public IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> GetCurrentSkillConfig()
    {
        lock (_lock) return _currentSkills;
    }
}
