// PY-REF: pyapps/d3-check/ui/components/auxiliary_options_block.py
using DotApps.d3d4tester.Constants;
using Microsoft.Extensions.Configuration;

namespace DotApps.d3d4tester.Config.Options;

/// <summary>Options for macro_configs.auxiliary_config section. Feature entries are dicts {enabled, ...}; 1:1 Python auxiliary_options_block schema.</summary>
public sealed class MacroAuxiliaryOptions
{
    [ConfigurationKeyName("macro_start_hotkey")]
    public string MacroStartHotkey { get; set; } = AppConstants.DefaultMacroStartHotkey;

    [ConfigurationKeyName("assistant_hotkey")]
    public string AssistantHotkey { get; set; } = AppConstants.DefaultAssistantHotkey;

    [ConfigurationKeyName("animation_speed")]
    public string AnimationSpeed { get; set; } = "Medium";

    [ConfigurationKeyName("game_language")]
    public string GameLanguage { get; set; } = "English";

    [ConfigurationKeyName("smart_pause")]
    public bool SmartPause { get; set; } = true;

    [ConfigurationKeyName("sound_feedback")]
    public bool SoundFeedback { get; set; } = true;

    [ConfigurationKeyName("blood_shard")]
    public AuxiliaryFeatureOptions BloodShard { get; set; } = new() { Type = AuxiliaryFeatureOptions.BloodShardTypeDefault };

    [ConfigurationKeyName("quick_pickup")]
    public AuxiliaryFeatureOptions QuickPickup { get; set; } = new();

    [ConfigurationKeyName("blacksmith")]
    public AuxiliaryFeatureOptions Blacksmith { get; set; } = new();

    [ConfigurationKeyName("kanai_reforge")]
    public AuxiliaryFeatureOptions KanaiReforge { get; set; } = new() { Mode = AuxiliaryFeatureOptions.KanaiReforgeModeDefault };

    [ConfigurationKeyName("kanai_upgrade")]
    public AuxiliaryFeatureOptions KanaiUpgrade { get; set; } = new();

    [ConfigurationKeyName("kanai_convert")]
    public AuxiliaryFeatureOptions KanaiConvert { get; set; } = new() { Material = AuxiliaryFeatureOptions.KanaiConvertMaterialDefault };

    [ConfigurationKeyName("auto_salvage")]
    public AuxiliaryFeatureOptions AutoSalvage { get; set; } = new() { Keep = AuxiliaryFeatureOptions.AutoSalvageKeepDefault };

    [ConfigurationKeyName("drop_equipment")]
    public AuxiliaryFeatureOptions DropEquipment { get; set; } = new();
}

/// <summary>One auxiliary feature dict: enabled + optional dropdown value (type / mode / material / keep). 1:1 Python auxiliary_options_block menu_config.</summary>
public sealed class AuxiliaryFeatureOptions
{
    public static readonly string[] BloodShardTypeValues = { "weapon", "armor", "jewelry", "helmet", "gloves", "boots" };
    public static readonly string[] KanaiReforgeModeValues = { "until_ancient", "double_crit", "double_crit_ancient" };
    public static readonly string[] KanaiConvertMaterialValues = { "forgotten_soul", "veiled_crystal", "arcane_dust" };
    public static readonly string[] AutoSalvageKeepValues = { "keep_ancient_plus", "keep_primal" };
    public const string BloodShardTypeDefault = "weapon";
    public const string KanaiReforgeModeDefault = "until_ancient";
    public const string KanaiConvertMaterialDefault = "forgotten_soul";
    public const string AutoSalvageKeepDefault = "keep_ancient_plus";

    [ConfigurationKeyName("enabled")]
    public bool Enabled { get; set; }

    [ConfigurationKeyName("type")]
    public string? Type { get; set; }

    [ConfigurationKeyName("mode")]
    public string? Mode { get; set; }

    [ConfigurationKeyName("material")]
    public string? Material { get; set; }

    [ConfigurationKeyName("keep")]
    public string? Keep { get; set; }

    [ConfigurationKeyName("debug_only")]
    public bool DebugOnly { get; set; }
}
