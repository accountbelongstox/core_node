// PY-REF: dotapps/d3d4tester/reference/py_d3check/ui/components/auxiliary_options_block.py
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core.Assistant;
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
    public string AnimationSpeed { get; set; } = AssistantTiming.SpeedMedium;

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

    /// <summary>Current auxiliary options read live through ConfigBinding (ConfigOptionsProvider lags after writes); missing keys keep the defaults above.</summary>
    public static MacroAuxiliaryOptions ReadLive()
    {
        var d = new MacroAuxiliaryOptions();
        return new MacroAuxiliaryOptions
        {
            MacroStartHotkey = ConfigBinding.GetValue(ConfigKeys.AuxiliaryMacroStartHotkey, d.MacroStartHotkey) ?? d.MacroStartHotkey,
            AssistantHotkey = ConfigBinding.GetValue(ConfigKeys.AuxiliaryAssistantHotkey, d.AssistantHotkey) ?? d.AssistantHotkey,
            AnimationSpeed = ConfigBinding.GetValue(ConfigKeys.AuxiliaryAnimationSpeed, d.AnimationSpeed) ?? d.AnimationSpeed,
            SmartPause = ConfigBinding.GetValue(ConfigKeys.AuxiliarySmartPause, d.SmartPause),
            SoundFeedback = ConfigBinding.GetValue(ConfigKeys.AuxiliarySoundFeedback, d.SoundFeedback),
            BloodShard = AuxiliaryFeatureOptions.ReadLive(ConfigKeys.AuxiliaryBloodShard, d.BloodShard),
            QuickPickup = AuxiliaryFeatureOptions.ReadLive(ConfigKeys.AuxiliaryQuickPickup, d.QuickPickup),
            Blacksmith = AuxiliaryFeatureOptions.ReadLive(ConfigKeys.AuxiliaryBlacksmith, d.Blacksmith),
            KanaiReforge = AuxiliaryFeatureOptions.ReadLive(ConfigKeys.AuxiliaryKanaiReforge, d.KanaiReforge),
            KanaiUpgrade = AuxiliaryFeatureOptions.ReadLive(ConfigKeys.AuxiliaryKanaiUpgrade, d.KanaiUpgrade),
            KanaiConvert = AuxiliaryFeatureOptions.ReadLive(ConfigKeys.AuxiliaryKanaiConvert, d.KanaiConvert),
            AutoSalvage = AuxiliaryFeatureOptions.ReadLive(ConfigKeys.AuxiliaryAutoSalvage, d.AutoSalvage),
            DropEquipment = AuxiliaryFeatureOptions.ReadLive(ConfigKeys.AuxiliaryDropEquipment, d.DropEquipment),
        };
    }
}

/// <summary>One auxiliary feature dict: enabled + optional dropdown value (type / mode / material / keep). 1:1 Python auxiliary_options_block menu_config.</summary>
public sealed class AuxiliaryFeatureOptions
{
    public static readonly string[] BloodShardTypeValues = { "weapon", "armor", "jewelry", "helmet", "gloves", "boots" };
    public static readonly string[] KanaiReforgeModeValues = DotApps.d3d4tester.Core.Kanai.KanaiRecipeHelper.ReforgeModes;
    public static readonly string[] KanaiConvertMaterialValues = DotApps.d3d4tester.Core.Kanai.KanaiRecipeHelper.ConvertMaterials;
    public static readonly string[] AutoSalvageKeepValues = { "keep_ancient_plus", "keep_primal" };
    public const string BloodShardTypeDefault = "weapon";
    public const string KanaiReforgeModeDefault = DotApps.d3d4tester.Core.Kanai.KanaiRecipeHelper.ModeUntilAncient;
    public const string KanaiConvertMaterialDefault = DotApps.d3d4tester.Core.Kanai.KanaiRecipeHelper.MaterialForgottenSoul;
    public const string AutoSalvageKeepDefault = DotApps.d3d4tester.Core.Blacksmith.BlacksmithHandler.KeepAncientPlus;

    private const string FieldType = "type";
    private const string FieldMode = "mode";
    private const string FieldMaterial = "material";
    private const string FieldKeep = "keep";
    private const string FieldDebugOnly = "debug_only";

    [ConfigurationKeyName(ConfigKeys.AuxiliaryFeatureEnabledField)]
    public bool Enabled { get; set; }

    [ConfigurationKeyName(FieldType)]
    public string? Type { get; set; }

    [ConfigurationKeyName(FieldMode)]
    public string? Mode { get; set; }

    [ConfigurationKeyName(FieldMaterial)]
    public string? Material { get; set; }

    [ConfigurationKeyName(FieldKeep)]
    public string? Keep { get; set; }

    [ConfigurationKeyName(FieldDebugOnly)]
    public bool DebugOnly { get; set; }

    /// <summary>One feature dict (section = ConfigKeys.Auxiliary* section path) read live through ConfigBinding; missing fields keep defaults.</summary>
    public static AuxiliaryFeatureOptions ReadLive(string section, AuxiliaryFeatureOptions defaults) => new()
    {
        Enabled = ConfigBinding.GetValue($"{section}.{ConfigKeys.AuxiliaryFeatureEnabledField}", defaults.Enabled),
        Type = ConfigBinding.GetValue($"{section}.{FieldType}", defaults.Type),
        Mode = ConfigBinding.GetValue($"{section}.{FieldMode}", defaults.Mode),
        Material = ConfigBinding.GetValue($"{section}.{FieldMaterial}", defaults.Material),
        Keep = ConfigBinding.GetValue($"{section}.{FieldKeep}", defaults.Keep),
        DebugOnly = ConfigBinding.GetValue($"{section}.{FieldDebugOnly}", defaults.DebugOnly),
    };
}
