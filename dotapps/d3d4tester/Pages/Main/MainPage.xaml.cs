// PY-REF: pyapps/d3-check/ui/panels/main_functions_panel.py
using System.Windows;
using System.Windows.Controls;
using DotApps.d3d4tester.Components;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Services;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.ViewModels;
using DotCore.Foundations;
using DotCore.Utils;

namespace DotApps.d3d4tester.Pages.Main;

/// <summary>
/// Main tab, two sub-tabs: skill config selection + skill table, auxiliary options, hotkeys and bottom options; ROSBOT paths and bot settings.
/// 1:1 Python ui/panels/main_functions_panel.py (animation speed / game language rows are removed there, so not shown here).
/// </summary>
public partial class MainPage : UserControl
{
    private readonly Action<string?> _onConfigChangedHandler;
    private string[] _configKeys = MacroConfigLoader.DefaultConfigNames;
    private bool _loading = true;
    private bool _bound;

    public MainPage()
    {
        InitializeComponent();
        DataContext = new MainViewModel(D3D4TesterI18n.Provider);
        _onConfigChangedHandler = OnConfigChanged;
        Loaded += OnLoaded;
        Unloaded += (_, _) => D3D4TesterConfigChangeHub.Notifier.Unsubscribe(_onConfigChangedHandler);
    }

    private MainViewModel ViewModel => (MainViewModel)DataContext;

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        _loading = true;
        _configKeys = MacroConfigLoader.GetConfigNames();
        var current = ConfigBinding.GetValue(ConfigKeys.MacroConfigsCurrentSkillConfig, _configKeys[0]) ?? _configKeys[0];
        if (Array.IndexOf(_configKeys, current) < 0) current = _configKeys[0];
        RefreshI18n();
        CboConfig.SelectedIndex = Array.IndexOf(_configKeys, current);
        ViewModel.LoadSkillRows(current);
        TxtCurrentConfig.Text = ConfigDisplayName(current);
        LoadHotkeys();
        if (!_bound)
        {
            _bound = true;
            CboConfig.SelectionChanged += OnConfigSelectionChanged;
            TxtMacroStartHotkey.HotkeyCaptured += (_, hotkey) => ConfigBinding.SetValue(ConfigKeys.AuxiliaryMacroStartHotkey, hotkey);
            TxtAssistantHotkey.HotkeyCaptured += (_, hotkey) => ConfigBinding.SetValue(ConfigKeys.AuxiliaryAssistantHotkey, hotkey);
            TxtQuickSwitch.HotkeyCaptured += (_, hotkey) => SaveQuickSwitch(hotkey);
            ConfigBinding.BindCheckBox(ChkPlaySoundOnSwitch, ConfigKeys.AuxiliarySoundFeedback, true);
            ConfigBinding.BindCheckBox(ChkSmartPauseBar, ConfigKeys.AuxiliarySmartPause, true);
            ConfigBinding.BindCheckBox(ChkCustomStand, ConfigKeys.AuxiliaryUseCustomStandKey, false);
            ConfigBinding.BindTextBox(TxtCustomStandKey, ConfigKeys.AuxiliaryCustomStandKey, AppConstants.DefaultCustomStandKey);
        }
        D3D4TesterConfigChangeHub.Notifier.Unsubscribe(_onConfigChangedHandler);
        D3D4TesterConfigChangeHub.Notifier.Subscribe(_onConfigChangedHandler);
        _loading = false;
    }

    /// <summary>Re-read all texts (called from MainWindow when the language changes).</summary>
    public void RefreshI18n()
    {
        var p = D3D4TesterI18n.Provider;
        TabSkills.Header = p.GetUiText(I18nKeys.SkillConfigTitle);
        TabRosbot.Header = p.GetUiText(I18nKeys.TabsRosbotExtension);
        LblSkillConfigTitle.Text = p.GetUiText(I18nKeys.SkillConfigTitle);
        LblCurrentConfig.Text = p.GetUiText(I18nKeys.MainFunctionsPanelCurrentConfig);
        LblSkill.Text = p.GetUiText(I18nKeys.SkillConfigSkill);
        LblKey.Text = p.GetUiText(I18nKeys.SkillConfigKey);
        LblStrategy.Text = p.GetUiText(I18nKeys.SkillConfigStrategy);
        LblInterval.Text = p.GetUiText(I18nKeys.SkillConfigInterval);
        LblDelay.Text = p.GetUiText(I18nKeys.SkillConfigDelay);
        LblRandom.Text = p.GetUiText(I18nKeys.SkillConfigRandomDelay);
        LblHotkeysTitle.Text = p.GetUiText(I18nKeys.MainFunctionsPanelAdditionalSettings);
        LblMacroStartHotkey.Text = p.GetUiText(I18nKeys.MainFunctionsPanelMacroStartHotkeyLabel);
        LblAssistantHotkey.Text = p.GetUiText(I18nKeys.MainFunctionsPanelMacroPauseHotkeyLabel);
        LblQuickSwitch.Text = p.GetUiText(I18nKeys.AdditionalSettingsQuickSwitch);
        BtnCombatMacroToggle.Content = p.GetUiText(I18nKeys.MainFunctionsPanelCombatMacroToggleButton);
        ChkPlaySoundOnSwitch.Content = p.GetUiText(I18nKeys.OptionsPlaySoundOnSwitch);
        ChkSmartPauseBar.Content = p.GetUiText(I18nKeys.OptionsSmartPause);
        ChkCustomStand.Content = p.GetUiText(I18nKeys.OptionsUseCustomStandKey);

        string[] strategyKeys =
        {
            I18nKeys.SkillConfigStrategiesContinuous, I18nKeys.SkillConfigStrategiesSingle,
            I18nKeys.SkillConfigStrategiesHold, I18nKeys.SkillConfigStrategiesIgnore,
        };
        for (int i = 0; i < strategyKeys.Length && i < SkillRowViewModel.StrategyOptions.Count; i++)
            SkillRowViewModel.StrategyOptions[i].Display = p.GetUiText(strategyKeys[i]);
        ViewModel.NotifyI18nChanged();

        bool wasLoading = _loading;
        _loading = true;
        int selected = CboConfig.SelectedIndex;
        CboConfig.Items.Clear();
        foreach (var key in _configKeys) CboConfig.Items.Add(ConfigDisplayName(key));
        if (selected >= 0 && selected < CboConfig.Items.Count) CboConfig.SelectedIndex = selected;
        _loading = wasLoading;
        TxtCurrentConfig.Text = ConfigDisplayName(ViewModel.CurrentConfigName);

        AuxOptions.RefreshI18n();
        RosbotSettings.RefreshI18n();
        foreach (var box in new[] { TxtMacroStartHotkey, TxtAssistantHotkey, TxtQuickSwitch }) box.RefreshI18n();
    }

    /// <summary>Reload the ROSBOT path fields after a path scan or update wrote the config directly.</summary>
    public void RefreshRosbotPaths() => RosbotSettings.RefreshPathFromConfig();

    private static string ConfigDisplayName(string configKey) =>
        D3D4TesterI18n.Provider.GetUiText(I18nKeys.ConfigTabsPrefix + configKey, configKey);

    private void LoadHotkeys()
    {
        TxtMacroStartHotkey.Hotkey = HotkeyUtil.NormalizeCanonical(ConfigBinding.GetValue(ConfigKeys.AuxiliaryMacroStartHotkey, ""));
        TxtAssistantHotkey.Hotkey = HotkeyUtil.NormalizeCanonical(ConfigBinding.GetValue(ConfigKeys.AuxiliaryAssistantHotkey, ""));
        LoadQuickSwitch(ViewModel.CurrentConfigName);
    }

    private void OnConfigChanged(string? keyPath)
    {
        if (_loading || string.IsNullOrEmpty(keyPath)) return;
        bool currentChanged = keyPath == ConfigKeys.MacroConfigsCurrentSkillConfig;
        if (!currentChanged && !keyPath.StartsWith(ConfigKeys.HotkeyConfigPathAuxiliary, StringComparison.OrdinalIgnoreCase)) return;
        if (!Dispatcher.CheckAccess())
        {
            Dispatcher.BeginInvoke(() => OnConfigChanged(keyPath));
            return;
        }
        if (currentChanged)
        {
            ShowCurrentConfig();
            return;
        }
        TxtMacroStartHotkey.Hotkey = HotkeyUtil.NormalizeCanonical(ConfigBinding.GetValue(ConfigKeys.AuxiliaryMacroStartHotkey, ""));
        TxtAssistantHotkey.Hotkey = HotkeyUtil.NormalizeCanonical(ConfigBinding.GetValue(ConfigKeys.AuxiliaryAssistantHotkey, ""));
    }

    /// <summary>1:1 Python _on_config_combo_select / _on_config_changed_with_key; the switch itself goes through SkillConfigSwitcher (UI follows via the change hub).</summary>
    private void OnConfigSelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (_loading) return;
        int idx = CboConfig.SelectedIndex;
        if (idx < 0 || idx >= _configKeys.Length) return;
        SkillConfigSwitcher.Switch(_configKeys[idx], nameof(MainPage));
    }

    /// <summary>Show the active config (combo, skill rows, quick switch, label) after any switch: combo, quick switch hotkey or HTTP bridge.</summary>
    private void ShowCurrentConfig()
    {
        var name = ConfigBinding.GetValue(ConfigKeys.MacroConfigsCurrentSkillConfig, _configKeys[0]) ?? _configKeys[0];
        int idx = Array.IndexOf(_configKeys, name);
        if (idx < 0 || name == ViewModel.CurrentConfigName) return;
        _loading = true;
        CboConfig.SelectedIndex = idx;
        _loading = false;
        ViewModel.LoadSkillRows(name);
        LoadQuickSwitch(name);
        TxtCurrentConfig.Text = ConfigDisplayName(name);
    }

    private void LoadQuickSwitch(string configName) =>
        TxtQuickSwitch.Hotkey = ConfigBinding.GetValue(QuickSwitchKey(configName), AppConstants.DefaultQuickSwitchHotkey) ?? AppConstants.DefaultQuickSwitchHotkey;

    /// <summary>Per-config hotkey. 1:1 Python _on_skill_changed('quick_switch', value).</summary>
    private void SaveQuickSwitch(string hotkey)
    {
        ConfigBinding.SetValue(QuickSwitchKey(ViewModel.CurrentConfigName), hotkey);
        ColorPrinter.Green($"[MainFunctionsPanel] {ConfigKeys.SkillConfigQuickSwitchField} updated to: {hotkey}");
    }

    private static string QuickSwitchKey(string configName) => MacroConfigLoader.QuickSwitchKey(configName);
}
