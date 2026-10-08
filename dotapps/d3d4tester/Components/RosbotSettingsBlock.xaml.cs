// PY-REF: pyapps/d3-check/ui/panels/rosbot_extension_panel.py
using System.IO;
using System.Windows;
using System.Windows.Controls;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.I18n;
using Microsoft.Win32;

namespace DotApps.d3d4tester.Components;

/// <summary>
/// ROSBOT paths (ROSBOT folder, Battle.net, D3) and bot settings, hosted on the Main tab.
/// 1:1 Python ui/panels/rosbot_extension_panel.py (_create_path_settings, _create_bot_settings).
/// </summary>
public partial class RosbotSettingsBlock : UserControl
{
    private const int SettingMin = 1;
    private const int SettingMax = 120;

    private bool _bound;

    public RosbotSettingsBlock()
    {
        InitializeComponent();
        Loaded += OnLoaded;
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        D3D4TesterI18n.EnsureInitialized();
        if (!_bound)
        {
            _bound = true;
            BindSettings();
        }
        RefreshI18n();
    }

    /// <summary>Bind every setting to its config key (1:1 Python ROSBOT_PANEL_CONFIG_KEYS defaults and spinbox ranges 1..120).</summary>
    private void BindSettings()
    {
        ConfigBinding.BindTextBox(TxtRosDirectory, ConfigKeys.RosSettingsRosDirectory);
        ConfigBinding.BindTextBox(TxtBattlenetPath, ConfigKeys.BattlenetPath);
        ConfigBinding.BindTextBox(TxtD3Path, ConfigKeys.D3Path);
        ConfigBinding.BindCheckBox(ChkAutoEnableLatestRos, ConfigKeys.RosSettingsAutoEnableLatestRos, true);
        ConfigBinding.BindCheckBox(ChkBluePortalPriority, ConfigKeys.RosbotBluePortalPriority);
        ConfigBinding.BindCheckBox(ChkFirstbornBlueGateReuse, ConfigKeys.RosbotFirstbornBlueGateReuse);
        ConfigBinding.BindCheckBox(ChkPickupBloodShards, ConfigKeys.RosbotPickupBloodShards);
        ConfigBinding.BindCheckBox(ChkSmartEcho, ConfigKeys.RosbotSmartEcho);
        ConfigBinding.BindIntTextBox(TxtSmartEchoWaitSeconds, ConfigKeys.RosbotSmartEchoWaitSeconds, SettingMin, SettingMax, RosbotConstants.RosbotSmartEchoWaitSecondsDefault);
        ConfigBinding.BindCheckBox(ChkTestMode, ConfigKeys.RosbotTestMode);
        ConfigBinding.BindIntTextBox(TxtTestTimeoutMinutes, ConfigKeys.RosbotTestTimeoutMinutes, SettingMin, SettingMax, RosbotConstants.RosbotTestTimeoutMinutesDefault);
        ConfigBinding.BindCheckBox(ChkPreventStuck, ConfigKeys.RosbotPreventStuck);
    }

    public void RefreshI18n()
    {
        var p = D3D4TesterI18n.Provider;
        LblPathSettings.Text = p.GetUiText(I18nKeys.RosbotPathSettings);
        LblRosbotPath.Text = p.GetUiText(I18nKeys.RosbotRosbotPath);
        LblBattlenetPath.Text = p.GetUiText(I18nKeys.RosbotBattlenetPath);
        LblD3Path.Text = p.GetUiText(I18nKeys.RosbotD3Path);
        BtnBrowseRosbot.ToolTip = p.GetUiText(I18nKeys.RosbotSelectRosbotDirectory);
        BtnBrowseBattlenet.ToolTip = p.GetUiText(I18nKeys.RosbotSelectBattlenetExecutable);
        BtnBrowseD3.ToolTip = p.GetUiText(I18nKeys.RosbotSelectD3Executable);
        LblBotSettings.Text = p.GetUiText(I18nKeys.RosbotBotSettings);
        ChkAutoEnableLatestRos.Content = p.GetUiText(I18nKeys.RosbotAutoEnableLatestRos);
        ChkBluePortalPriority.Content = p.GetUiText(I18nKeys.RosbotBluePortalPriority);
        ChkFirstbornBlueGateReuse.Content = p.GetUiText(I18nKeys.RosbotFirstbornBlueGateReuse);
        ChkPickupBloodShards.Content = p.GetUiText(I18nKeys.RosbotPickupBloodShards);
        ChkSmartEcho.Content = p.GetUiText(I18nKeys.RosbotSmartEcho);
        LblSeconds.Text = p.GetUiText(I18nKeys.RosbotSeconds);
        ChkTestMode.Content = p.GetUiText(I18nKeys.RosbotTestMode);
        LblMinutes.Text = p.GetUiText(I18nKeys.RosbotMinutes);
        ChkPreventStuck.Content = p.GetUiText(I18nKeys.RosbotPreventStuck);
    }

    /// <summary>Reload path fields from config (after path scan or update writes config directly).</summary>
    public void RefreshPathFromConfig()
    {
        TxtRosDirectory.Text = ConfigBinding.GetValue(ConfigKeys.RosSettingsRosDirectory, "") ?? "";
        TxtBattlenetPath.Text = ConfigBinding.GetValue(ConfigKeys.BattlenetPath, "") ?? "";
        TxtD3Path.Text = ConfigBinding.GetValue(ConfigKeys.D3Path, "") ?? "";
    }

    /// <summary>
    /// Pick the ROSBOT folder. Fixes Python bug: _browse_rosbot_path stored an .exe path into ros_settings.ros_directory.
    /// </summary>
    private void BtnBrowseRosbot_Click(object sender, RoutedEventArgs e)
    {
        var current = (TxtRosDirectory.Text ?? "").Trim();
        var dlg = new OpenFolderDialog { Title = D3D4TesterI18n.Provider.GetUiText(I18nKeys.RosbotSelectRosbotDirectory) };
        if (Directory.Exists(current)) dlg.InitialDirectory = current;
        if (dlg.ShowDialog(Window.GetWindow(this)) == true)
            ConfigBinding.SetValue(ConfigKeys.RosSettingsRosDirectory, dlg.FolderName);
    }

    private void BtnBrowseBattlenet_Click(object sender, RoutedEventArgs e) =>
        BrowseExecutable(TxtBattlenetPath, ConfigKeys.BattlenetPath, I18nKeys.RosbotSelectBattlenetExecutable);

    private void BtnBrowseD3_Click(object sender, RoutedEventArgs e) =>
        BrowseExecutable(TxtD3Path, ConfigKeys.D3Path, I18nKeys.RosbotSelectD3Executable);

    /// <summary>Pick an .exe; start in the folder of the current value when it exists. 1:1 Python _browse_battlenet_path / _browse_d3_path.</summary>
    private void BrowseExecutable(TextBox source, string configKey, string titleKey)
    {
        var p = D3D4TesterI18n.Provider;
        var current = (source.Text ?? "").Trim();
        var dlg = new OpenFileDialog
        {
            Title = p.GetUiText(titleKey),
            Filter = $"{p.GetUiText(I18nKeys.RosbotExecutableFiles)} (*.exe)|*.exe|{p.GetUiText(I18nKeys.RosbotAllFiles)} (*.*)|*.*",
        };
        var dir = File.Exists(current) ? Path.GetDirectoryName(current) : null;
        if (!string.IsNullOrEmpty(dir)) dlg.InitialDirectory = dir;
        if (dlg.ShowDialog(Window.GetWindow(this)) == true)
            ConfigBinding.SetValue(configKey, dlg.FileName);
    }
}
