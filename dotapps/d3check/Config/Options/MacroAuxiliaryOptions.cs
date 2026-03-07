using Microsoft.Extensions.Configuration;

namespace DotApps.d3check.Config.Options;

/// <summary>Options for macro_configs.auxiliary_config section (hotkeys, etc.).</summary>
public sealed class MacroAuxiliaryOptions
{
    [ConfigurationKeyName("macro_start_hotkey")]
    public string MacroStartHotkey { get; set; } = "F2";

    [ConfigurationKeyName("assistant_hotkey")]
    public string AssistantHotkey { get; set; } = "F3";

    [ConfigurationKeyName("animation_speed")]
    public string AnimationSpeed { get; set; } = "Medium";

    [ConfigurationKeyName("game_language")]
    public string GameLanguage { get; set; } = "English";

    [ConfigurationKeyName("smart_pause")]
    public bool SmartPause { get; set; }

    [ConfigurationKeyName("blood_shard")]
    public bool BloodShard { get; set; }

    [ConfigurationKeyName("blacksmith")]
    public bool Blacksmith { get; set; } = true;
}
