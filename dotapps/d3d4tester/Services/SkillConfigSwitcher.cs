// PY-REF: dotapps/d3d4tester/reference/py_d3check/ui/panels/main_functions_panel.py
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotCore.Foundations;
using DotCore.Utils;

namespace DotApps.d3d4tester.Services;

/// <summary>
/// Single path that switches the active skill config (main page combo, quick switch hotkey, HTTP bridge):
/// write macro_configs.current_skill_config (the change hub reloads the macro and refreshes the main page), then beep.
/// </summary>
public static class SkillConfigSwitcher
{
    private const string LogTag = "[SkillConfigSwitcher]";

    /// <summary>Switch to configName; false when unknown or already active.</summary>
    public static bool Switch(string configName, string source)
    {
        var names = MacroConfigLoader.GetConfigNames();
        if (Array.IndexOf(names, configName) < 0)
        {
            ColorPrinter.Yellow($"{LogTag} Unknown config '{configName}' ({source})");
            return false;
        }
        if (Current() == configName) return false;
        ConfigBinding.SetValue(ConfigKeys.MacroConfigsCurrentSkillConfig, configName);
        ColorPrinter.Green($"{LogTag} Configuration changed to: {configName} ({source})");
        EventCenter.NotifySkillConfigSwitched(configName);
        return true;
    }

    /// <summary>Quick switch hotkey: configs sharing this hotkey form a ring; switch to the one after the active config (or the first).</summary>
    public static void SwitchByQuickSwitchHotkey(string hotkey)
    {
        var group = MacroConfigLoader.GetConfigNames().Where(n => string.Equals(QuickSwitchHotkey(n), hotkey, StringComparison.OrdinalIgnoreCase)).ToList();
        if (group.Count == 0) return;
        int idx = group.IndexOf(Current());
        Switch(group[(idx + 1) % group.Count], "quick switch " + hotkey);
    }

    /// <summary>Quick switch hotkey of a config, canonical form; default when unset.</summary>
    public static string QuickSwitchHotkey(string configName) =>
        HotkeyUtil.NormalizeCanonical(ConfigBinding.GetValue(MacroConfigLoader.QuickSwitchKey(configName), AppConstants.DefaultQuickSwitchHotkey) ?? AppConstants.DefaultQuickSwitchHotkey);

    private static string Current() =>
        ConfigBinding.GetValue(ConfigKeys.MacroConfigsCurrentSkillConfig, MacroConfigLoader.DefaultConfigName) ?? MacroConfigLoader.DefaultConfigName;
}
