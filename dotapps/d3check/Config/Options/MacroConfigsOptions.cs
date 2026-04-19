using Microsoft.Extensions.Configuration;

namespace DotApps.d3check.Config.Options;

/// <summary>Options for macro_configs section (current_skill_config).</summary>
public sealed class MacroConfigsOptions
{
    [ConfigurationKeyName("current_skill_config")]
    public string CurrentSkillConfig { get; set; } = "config1";
}
