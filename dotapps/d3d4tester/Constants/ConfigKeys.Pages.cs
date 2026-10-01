namespace DotApps.d3d4tester.Constants;

/// <summary>Config keys used by Main/Rosbot/RunLog pages and the coordinate picker.</summary>
public static partial class ConfigKeys
{
    public const string AuxiliaryUseCustomStandKey = MacroConfigsAuxiliaryConfig + ".use_custom_stand_key";
    public const string AuxiliaryCustomStandKey = MacroConfigsAuxiliaryConfig + ".custom_stand_key";
    /// <summary>Per-config hotkey field under macro_configs.skill_configs.{name}. 1:1 Python PER_CONFIG_HOTKEY_SPEC.</summary>
    public const string SkillConfigQuickSwitchField = "quick_switch";
}
