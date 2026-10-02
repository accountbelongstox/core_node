// PY-REF: pyapps/d3-check/ui/panels/main_functions_panel.py
using System.Text.Json;
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
/// Main tab: skill config selection + skill table, auxiliary options, hotkeys and bottom options.
/// 1:1 Python ui/panels/main_functions_panel.py (animation speed / game language rows are removed there, so not shown here).
/// </summary>
public partial class MainPage : UserControl
{
    private const string CustomStandKeyDefault = "Shift";
    private static readonly string[] DefaultConfigKeys = { "config1", "config2", "config3", "config4" };

    private readonly Action<string?> _onConfigChangedHandler;
    private string[] _configKeys = DefaultConfigKeys;
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
        _configKeys = ReadConfigKeys();
        var current = ConfigBinding.GetValue(ConfigKeys.MacroConfigsCurrentSkillConfig, DefaultConfigKeys[0]) ?? DefaultConfigKeys[0];
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
            ConfigBinding.BindTextBox(TxtCustomStandKey, ConfigKeys.AuxiliaryCustomStandKey, CustomStandKeyDefault);
        }
        D3D4TesterConfigChangeHub.Notifier.Unsubscribe(_onConfigChangedHandler);
        D3D4TesterConfigChangeHub.Notifier.Subscribe(_onConfigChangedHandler);
        _loading = false;
    }

    /// <summary>Re-read all texts (called from MainWindow when the language changes).</summary>
    public void RefreshI18n()
    {
        var p = D3D4TesterI18n.Provider;
        LblSkillConfigTitle.Text = p.GetUiText(I18nKeys.SkillConfigTitle);
        LblCurrentConfig.Text = p.GetUiText(I18nKeys.MainFunctionsPanelCurrentConfig);
        LblSkill.Text = p.GetUiText(I18nKeys.SkillTableSkill);
        LblKey.Text = p.GetUiText(I18nKeys.SkillTableKey);
        LblStrategy.Text = p.GetUiText(I18nKeys.SkillTableStrategy);
        LblInterval.Text = p.GetUiText(I18nKeys.SkillTableInterval);
        LblDelay.Text = p.GetUiText(I18nKeys.SkillTableDelay);
        LblRandom.Text = p.GetUiText(I18nKeys.SkillTableRandom);
        LblHotkeysTitle.Text = p.GetUiText(I18nKeys.MainFunctionsPanelAdditionalSettings);
        LblMacroStartHotkey.Text = p.GetUiText(I18nKeys.MainFunctionsPanelMacroStartHotkeyLabel);
        LblAssistantHotkey.Text = p.GetUiText(I18nKeys.MainFunctionsPanelMacroPauseHotkeyLabel);
        LblQuickSwitch.Text = p.GetUiText(I18nKeys.AdditionalSettingsQuickSwitch);
        BtnCombatMacroToggle.Content = p.GetUiText(I18nKeys.MainFunctionsPanelCombatMacroToggleButton);
        ChkPlaySoundOnSwitch.Content = p.GetUiText(I18nKeys.AuxiliaryPlaySoundOnSwitch);
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
        foreach (var box in new[] { TxtMacroStartHotkey, TxtAssistantHotkey, TxtQuickSwitch }) box.RefreshI18n();
    }

    /// <summary>Config keys = keys of macro_configs.skill_configs, else config1..config4. 1:1 Python _create_config_selection.</summary>
    private static string[] ReadConfigKeys()
    {
        var raw = D3D4TesterConfigService.Instance.GetRawText(ConfigKeys.MacroConfigsSkillConfigs);
        if (string.IsNullOrWhiteSpace(raw)) return DefaultConfigKeys;
        try
        {
            using var doc = JsonDocument.Parse(raw);
            if (doc.RootElement.ValueKind != JsonValueKind.Object) return DefaultConfigKeys;
            var keys = doc.RootElement.EnumerateObject().Select(p => p.Name).ToArray();
            return keys.Length > 0 ? keys : DefaultConfigKeys;
        }
        catch (JsonException)
        {
            return DefaultConfigKeys;
        }
    }

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
        if (_loading || string.IsNullOrEmpty(keyPath) || !keyPath.StartsWith(ConfigKeys.HotkeyConfigPathAuxiliary, StringComparison.OrdinalIgnoreCase)) return;
        if (!Dispatcher.CheckAccess())
        {
            Dispatcher.BeginInvoke(() => OnConfigChanged(keyPath));
            return;
        }
        TxtMacroStartHotkey.Hotkey = HotkeyUtil.NormalizeCanonical(ConfigBinding.GetValue(ConfigKeys.AuxiliaryMacroStartHotkey, ""));
        TxtAssistantHotkey.Hotkey = HotkeyUtil.NormalizeCanonical(ConfigBinding.GetValue(ConfigKeys.AuxiliaryAssistantHotkey, ""));
    }

    /// <summary>1:1 Python _on_config_combo_select / _on_config_changed_with_key.</summary>
    private void OnConfigSelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (_loading) return;
        int idx = CboConfig.SelectedIndex;
        if (idx < 0 || idx >= _configKeys.Length) return;
        var name = _configKeys[idx];
        ConfigBinding.SetValue(ConfigKeys.MacroConfigsCurrentSkillConfig, name);
        if (name == ViewModel.CurrentConfigName) return;
        ViewModel.LoadSkillRows(name);
        LoadQuickSwitch(name);
        TxtCurrentConfig.Text = ConfigDisplayName(name);
        MacroConfigLoader.Instance.LoadActive();
        ColorPrinter.Green($"[MainFunctionsPanel] Configuration changed to: {name}");
        EventCenter.NotifySkillConfigSwitched(name);
    }

    private void LoadQuickSwitch(string configName) =>
        TxtQuickSwitch.Hotkey = ConfigBinding.GetValue(QuickSwitchKey(configName), AppConstants.DefaultQuickSwitchHotkey) ?? AppConstants.DefaultQuickSwitchHotkey;

    /// <summary>Per-config hotkey. 1:1 Python _on_skill_changed('quick_switch', value).</summary>
    private void SaveQuickSwitch(string hotkey)
    {
        ConfigBinding.SetValue(QuickSwitchKey(ViewModel.CurrentConfigName), hotkey);
        ColorPrinter.Green($"[MainFunctionsPanel] {ConfigKeys.SkillConfigQuickSwitchField} updated to: {hotkey}");
    }

    private static string QuickSwitchKey(string configName) =>
        $"{ConfigKeys.MacroConfigsSkillConfigs}.{configName}.{ConfigKeys.SkillConfigQuickSwitchField}";
}
