// PY-REF: none (DOT-only)
using System.Globalization;
using System.Windows;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core.Planner;
using DotApps.d3d4tester.I18n;

namespace DotApps.d3d4tester.Windows;

/// <summary>
/// Asked before a skill switch: which method to use. Plugin (ROSBOT running with CoreNodeBridge: exact skills / runes / passives and
/// level check) is preselected and only enabled when the plugin is live; image (no ROSBOT needed) always works. Shows the requirements.
/// </summary>
public partial class SkillSwitchDialog : Window
{
    public SkillSwitchMethod Method { get; private set; } = SkillSwitchMethod.Image;

    public SkillSwitchDialog(string target, bool pluginAvailable)
    {
        InitializeComponent();
        Title = T(I18nKeys.RosbotBridgeBuildSkillSwitchTitle);
        TxtTarget.Text = target;
        RadioPlugin.Content = T(I18nKeys.RosbotBridgeBuildSkillSwitchPlugin);
        TxtPluginDesc.Text = T(pluginAvailable ? I18nKeys.RosbotBridgeBuildSkillSwitchPluginDesc : I18nKeys.RosbotBridgeBuildSkillSwitchPluginOff);
        RadioImage.Content = T(I18nKeys.RosbotBridgeBuildSkillSwitchImage);
        TxtImageDesc.Text = T(I18nKeys.RosbotBridgeBuildSkillSwitchImageDesc);
        TxtRequirements.Text = string.Format(CultureInfo.InvariantCulture, T(I18nKeys.RosbotBridgeBuildSkillSwitchRequirements), D3SkillSwitcher.RequiredLevel);
        BtnStart.Content = T(I18nKeys.RosbotBridgeBuildSkillSwitchStart);
        BtnCancel.Content = T(I18nKeys.ButtonCancel);
        RadioPlugin.IsEnabled = pluginAvailable;
        RadioPlugin.IsChecked = pluginAvailable;
        RadioImage.IsChecked = !pluginAvailable;
    }

    private static string T(string key) => D3D4TesterI18n.Provider.GetUiText(key);

    private void BtnStart_Click(object sender, RoutedEventArgs e)
    {
        Method = RadioPlugin.IsChecked == true ? SkillSwitchMethod.Plugin : SkillSwitchMethod.Image;
        DialogResult = true;
    }
}
