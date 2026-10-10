// PY-REF: dotapps/d3d4tester/reference/py_d3check/providor/providor_index.py
using Microsoft.Extensions.Configuration;

namespace DotApps.d3d4tester.Config.Options;

/// <summary>Options for macro_configs section (current_skill_config).</summary>
public sealed class MacroConfigsOptions
{
    [ConfigurationKeyName("current_skill_config")]
    public string CurrentSkillConfig { get; set; } = MacroConfigLoader.DefaultConfigName;
}
