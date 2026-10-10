// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/macro_config_loader.py
// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/macro_config_provider.py
using System.Collections.Generic;
using System.Text.Json;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Constants;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Config;

/// <summary>
/// Loads active macro config from CONFIG into memory. 1:1 with Python d3utils.macro_config_loader.MacroConfigLoader.
/// Call LoadActive() when CONFIG is ready and on config change; macro loop reads via GetCurrentConfigName / GetCurrentSkillConfig.
/// CONFIG is path-based and dynamic: macro_configs.skill_configs.{name}.skills.{skillKey}.{field}. To add a new skill row, add the skillKey to MacroSkillRunner.SkillKeys; new fields under each skill are read by path so no code change needed for new field names if CONFIG schema extends.
/// </summary>
public sealed class MacroConfigLoader
{
    /// <summary>Config names used when macro_configs.skill_configs is missing or empty.</summary>
    /// <summary>Skill config selected when none is stored (macro_configs.current_skill_config).</summary>
    public const string DefaultConfigName = "config1";
    public static readonly string[] DefaultConfigNames = { DefaultConfigName, "config2", "config3", "config4" };

    private readonly object _lock = new();
    private string _currentConfigName = DefaultConfigName;
    private string _previousLoggedName = "";
    private IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> _currentSkills = new Dictionary<string, IReadOnlyDictionary<string, string>>();

    public static MacroConfigLoader Instance { get; } = new();

    private MacroConfigLoader() { }

    /// <summary>Read active config from CONFIG and refresh cached bindings. Call from main thread. 1:1 Python load_active(). Call on every StartMacro and when current config dropdown changes.</summary>
    public void LoadActive()
    {
        var svc = D3D4TesterConfigService.Instance;
        string name = svc.GetValueSafe<string>(ConfigKeys.MacroConfigsCurrentSkillConfig, DefaultConfigName) ?? DefaultConfigName;
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
        string leftStrat = skills.TryGetValue(MacroSkillRunner.SkillLeftClick, out var l) && l.TryGetValue(MacroSkillSchema.FieldStrategy, out var ls) ? ls : "";
        string rightStrat = skills.TryGetValue(MacroSkillRunner.SkillRightClick, out var r) && r.TryGetValue(MacroSkillSchema.FieldStrategy, out var rs) ? rs : "";
        ColorPrinter.Gray($"[MacroConfigLoader] Loaded from CONFIG: config={name} left_click.strategy={leftStrat} right_click.strategy={rightStrat}");
    }

    /// <summary>Stored fields per skill as raw scalar text (JSON numbers included); missing fields are left out so the runner applies MacroSkillSchema defaults.</summary>
    private static Dictionary<string, IReadOnlyDictionary<string, string>> ReadSkills(string name)
    {
        var skills = new Dictionary<string, IReadOnlyDictionary<string, string>>();
        string basePath = $"{ConfigKeys.MacroConfigsSkillConfigs}.{name}.skills";
        foreach (var skillKey in MacroSkillRunner.SkillKeys)
        {
            var entry = new Dictionary<string, string>();
            foreach (var field in MacroSkillSchema.Fields)
            {
                var v = ConfigBinding.GetScalarText($"{basePath}.{skillKey}.{field}");
                if (v != null) entry[field] = v;
            }
            skills[skillKey] = entry;
        }
        return skills;
    }

    /// <summary>Config names = keys of macro_configs.skill_configs, else config1..config4. 1:1 Python main_functions_panel._create_config_selection.</summary>
    public static string[] GetConfigNames()
    {
        var raw = D3D4TesterConfigService.Instance.GetRawText(ConfigKeys.MacroConfigsSkillConfigs);
        if (string.IsNullOrWhiteSpace(raw)) return DefaultConfigNames;
        try
        {
            using var doc = JsonDocument.Parse(raw);
            if (doc.RootElement.ValueKind != JsonValueKind.Object) return DefaultConfigNames;
            var keys = doc.RootElement.EnumerateObject().Select(p => p.Name).ToArray();
            return keys.Length > 0 ? keys : DefaultConfigNames;
        }
        catch (JsonException)
        {
            return DefaultConfigNames;
        }
    }

    /// <summary>Per-config quick switch hotkey path (macro_configs.skill_configs.&lt;name&gt;.quick_switch).</summary>
    public static string QuickSwitchKey(string configName) =>
        $"{ConfigKeys.MacroConfigsSkillConfigs}.{configName}.{ConfigKeys.SkillConfigQuickSwitchField}";

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
