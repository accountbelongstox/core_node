using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using DotApps.d3check.ViewModels;
using DotApps.d3check.Config;
using DotApps.d3check.Constants;
using DotApps.d3check.I18n;
using DotCore.Utils;

namespace DotApps.d3check.Pages.Main;

public partial class MainPage : UserControl
{
    private bool _loading = true;
    private const string Config1 = "config1";
    private static readonly string[] ConfigKeyNames = { "config1", "config2", "config3", "config4" };
    private string[] _configDisplayValues = Array.Empty<string>();
    private readonly Action<string?> _onConfigChangedHandler;
    private static readonly string[] AnimationValues = { "Slow", "Medium", "Fast" };

    public MainPage()
    {
        InitializeComponent();
        DataContext = new MainViewModel(D3CheckConfigService.Instance, D3CheckI18n.Provider);
        _onConfigChangedHandler = OnConfigChanged;
        Loaded += OnLoaded;
        Unloaded += OnUnloaded;
    }

    private MainViewModel ViewModel => (MainViewModel)DataContext;

    private string CurrentConfigName
    {
        get
        {
            var idx = CboConfig.SelectedIndex;
            if (idx >= 0 && idx < ConfigKeyNames.Length) return ConfigKeyNames[idx];
            return Config1;
        }
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        var svc = D3CheckConfigService.Instance;
        RefreshI18n();
        CboConfig.SelectionChanged += OnConfigSelectionChanged;
        var current = svc.GetValueSafe<string>(ConfigKeys.MacroConfigsCurrentSkillConfig, Config1) ?? Config1;
        var configIndex = Array.IndexOf(ConfigKeyNames, current);
        if (configIndex < 0) configIndex = 0;
        if (_configDisplayValues.Length > 0)
        {
            CboConfig.Items.Clear();
            foreach (var d in _configDisplayValues) CboConfig.Items.Add(d);
            CboConfig.SelectedIndex = configIndex;
            TxtCurrentConfig.Text = _configDisplayValues[configIndex];
        }
        ViewModel.SetCurrentConfig(current);
        ViewModel.LoadSkillRows(current);

        TxtMacroStartHotkey.Text = svc.GetValueSafe<string>(ConfigKeys.AuxiliaryMacroStartHotkey, "F2") ?? "F2";
        TxtAssistantHotkey.Text = svc.GetValueSafe<string>(ConfigKeys.AuxiliaryAssistantHotkey, "F3") ?? "F3";
        LoadQuickSwitch(current);
        var speed = svc.GetValueSafe<string>(ConfigKeys.AuxiliaryAnimationSpeed, "Medium") ?? "Medium";
        var speedIndex = Array.IndexOf(AnimationValues, speed);
        if (speedIndex < 0) speedIndex = 1;
        CboAnimationSpeed.SelectedIndex = speedIndex;
        CboGameLanguage.Items.Clear();
        CboGameLanguage.Items.Add("Simplified");
        CboGameLanguage.Items.Add("Traditional");
        CboGameLanguage.Items.Add("English");
        var lang = svc.GetValueSafe<string>(ConfigKeys.AuxiliaryGameLanguage, "English") ?? "English";
        CboGameLanguage.SelectedItem = lang;
        TxtBagOffset.Text = svc.GetValueSafe<string>(ConfigKeys.UiAnalysisBagOffset, "") ?? "";
        ChkBloodShard.IsChecked = svc.GetValueSafe<bool?>(ConfigKeys.AuxiliaryBloodShard, false) ?? false;
        ChkQuickPickup.IsChecked = svc.GetValueSafe<bool?>(ConfigKeys.AuxiliaryQuickPickup, false) ?? false;
        ChkBlacksmith.IsChecked = svc.GetValueSafe<bool?>(ConfigKeys.AuxiliaryBlacksmith, false) ?? false;
        ChkKanaiReforge.IsChecked = svc.GetValueSafe<bool?>(ConfigKeys.AuxiliaryKanaiReforge, false) ?? false;
        ChkKanaiUpgrade.IsChecked = svc.GetValueSafe<bool?>(ConfigKeys.AuxiliaryKanaiUpgrade, false) ?? false;
        ChkKanaiConvert.IsChecked = svc.GetValueSafe<bool?>(ConfigKeys.AuxiliaryKanaiConvert, false) ?? false;
        ChkAutoSalvage.IsChecked = svc.GetValueSafe<bool?>(ConfigKeys.AuxiliaryAutoSalvage, false) ?? false;
        ChkDropEquipment.IsChecked = svc.GetValueSafe<bool?>(ConfigKeys.AuxiliaryDropEquipment, false) ?? false;
        ChkPlaySoundOnSwitch.IsChecked = svc.GetValueSafe<bool?>(ConfigKeys.AuxiliarySoundFeedback, true) ?? true;
        ChkSmartPauseBar.IsChecked = svc.GetValueSafe<bool?>(ConfigKeys.AuxiliarySmartPause, true) ?? true;
        ChkCustomStand.IsChecked = svc.GetValueSafe<bool?>("macro_configs.auxiliary_config.use_custom_stand_key", false) ?? false;
        TxtCustomStandKey.Text = svc.GetValueSafe<string>("macro_configs.auxiliary_config.custom_stand_key", "Shift") ?? "Shift";
        _loading = false;

        TxtMacroStartHotkey.LostFocus += (_, _) => { if (!_loading) SaveAuxiliaryHotkey(ConfigKeys.AuxiliaryMacroStartHotkey, TxtMacroStartHotkey.Text?.Trim() ?? ""); };
        TxtAssistantHotkey.LostFocus += (_, _) => { if (!_loading) SaveAuxiliaryHotkey(ConfigKeys.AuxiliaryAssistantHotkey, TxtAssistantHotkey.Text?.Trim() ?? ""); };
        D3CheckConfigChangeHub.Notifier.Subscribe(_onConfigChangedHandler);
        TxtQuickSwitch.LostFocus += (_, _) => { if (!_loading) SaveQuickSwitch(); };
        CboAnimationSpeed.SelectionChanged += (_, _) =>
        {
            if (!_loading && CboAnimationSpeed.SelectedIndex >= 0 && CboAnimationSpeed.SelectedIndex < AnimationValues.Length)
                SaveComboBox(ConfigKeys.AuxiliaryAnimationSpeed, AnimationValues[CboAnimationSpeed.SelectedIndex]);
        };
        CboGameLanguage.SelectionChanged += (_, _) => { if (!_loading) SaveComboBox(ConfigKeys.AuxiliaryGameLanguage, CboGameLanguage.SelectedItem?.ToString()); };
        TxtBagOffset.LostFocus += (_, _) => { if (!_loading) SaveString(ConfigKeys.UiAnalysisBagOffset, TxtBagOffset.Text); };
        TxtCustomStandKey.LostFocus += (_, _) => { if (!_loading) SaveString("macro_configs.auxiliary_config.custom_stand_key", TxtCustomStandKey.Text); };
        ChkBloodShard.Checked += (_, _) => { if (!_loading) SaveCheckbox(ConfigKeys.AuxiliaryBloodShard, true); };
        ChkBloodShard.Unchecked += (_, _) => { if (!_loading) SaveCheckbox(ConfigKeys.AuxiliaryBloodShard, false); };
        ChkQuickPickup.Checked += (_, _) => { if (!_loading) SaveCheckbox(ConfigKeys.AuxiliaryQuickPickup, true); };
        ChkQuickPickup.Unchecked += (_, _) => { if (!_loading) SaveCheckbox(ConfigKeys.AuxiliaryQuickPickup, false); };
        ChkBlacksmith.Checked += (_, _) => { if (!_loading) SaveCheckbox(ConfigKeys.AuxiliaryBlacksmith, true); };
        ChkBlacksmith.Unchecked += (_, _) => { if (!_loading) SaveCheckbox(ConfigKeys.AuxiliaryBlacksmith, false); };
        ChkKanaiReforge.Checked += (_, _) => { if (!_loading) SaveCheckbox(ConfigKeys.AuxiliaryKanaiReforge, true); };
        ChkKanaiReforge.Unchecked += (_, _) => { if (!_loading) SaveCheckbox(ConfigKeys.AuxiliaryKanaiReforge, false); };
        ChkKanaiUpgrade.Checked += (_, _) => { if (!_loading) SaveCheckbox(ConfigKeys.AuxiliaryKanaiUpgrade, true); };
        ChkKanaiUpgrade.Unchecked += (_, _) => { if (!_loading) SaveCheckbox(ConfigKeys.AuxiliaryKanaiUpgrade, false); };
        ChkKanaiConvert.Checked += (_, _) => { if (!_loading) SaveCheckbox(ConfigKeys.AuxiliaryKanaiConvert, true); };
        ChkKanaiConvert.Unchecked += (_, _) => { if (!_loading) SaveCheckbox(ConfigKeys.AuxiliaryKanaiConvert, false); };
        ChkAutoSalvage.Checked += (_, _) => { if (!_loading) SaveCheckbox(ConfigKeys.AuxiliaryAutoSalvage, true); };
        ChkAutoSalvage.Unchecked += (_, _) => { if (!_loading) SaveCheckbox(ConfigKeys.AuxiliaryAutoSalvage, false); };
        ChkDropEquipment.Checked += (_, _) => { if (!_loading) SaveCheckbox(ConfigKeys.AuxiliaryDropEquipment, true); };
        ChkDropEquipment.Unchecked += (_, _) => { if (!_loading) SaveCheckbox(ConfigKeys.AuxiliaryDropEquipment, false); };
        ChkPlaySoundOnSwitch.Checked += (_, _) => { if (!_loading) SaveCheckbox(ConfigKeys.AuxiliarySoundFeedback, true); };
        ChkPlaySoundOnSwitch.Unchecked += (_, _) => { if (!_loading) SaveCheckbox(ConfigKeys.AuxiliarySoundFeedback, false); };
        ChkSmartPauseBar.Checked += (_, _) => { if (!_loading) SaveCheckbox(ConfigKeys.AuxiliarySmartPause, true); };
        ChkSmartPauseBar.Unchecked += (_, _) => { if (!_loading) SaveCheckbox(ConfigKeys.AuxiliarySmartPause, false); };
        ChkCustomStand.Checked += (_, _) => { if (!_loading) SaveCheckbox("macro_configs.auxiliary_config.use_custom_stand_key", true); };
        ChkCustomStand.Unchecked += (_, _) => { if (!_loading) SaveCheckbox("macro_configs.auxiliary_config.use_custom_stand_key", false); };
    }

    private void OnUnloaded(object sender, RoutedEventArgs e)
    {
        D3CheckConfigChangeHub.Notifier.Unsubscribe(_onConfigChangedHandler);
    }

    public void RefreshI18n()
    {
        var p = D3CheckI18n.Provider;
        _configDisplayValues = new[]
        {
            p.GetUiText(I18nKeys.ConfigTabsConfig1),
            p.GetUiText(I18nKeys.ConfigTabsConfig2),
            p.GetUiText(I18nKeys.ConfigTabsConfig3),
            p.GetUiText(I18nKeys.ConfigTabsConfig4)
        };
        if (LblCurrentConfig != null) LblCurrentConfig.Text = p.GetUiText(I18nKeys.MainFunctionsPanelCurrentConfig) + ": ";
        if (LblSkill != null) LblSkill.Text = p.GetUiText(I18nKeys.SkillTableSkill);
        if (LblKey != null) LblKey.Text = p.GetUiText(I18nKeys.SkillTableKey);
        if (LblStrategy != null) LblStrategy.Text = p.GetUiText(I18nKeys.SkillTableStrategy);
        SkillRowViewModel.StrategyDisplayNames.Clear();
        SkillRowViewModel.StrategyDisplayNames.Add(p.GetUiText(I18nKeys.SkillConfigStrategiesContinuous));
        SkillRowViewModel.StrategyDisplayNames.Add(p.GetUiText(I18nKeys.SkillConfigStrategiesSingle));
        SkillRowViewModel.StrategyDisplayNames.Add(p.GetUiText(I18nKeys.SkillConfigStrategiesHold));
        SkillRowViewModel.StrategyDisplayNames.Add(p.GetUiText(I18nKeys.SkillConfigStrategiesIgnore));
        if (LblInterval != null) LblInterval.Text = p.GetUiText(I18nKeys.SkillTableInterval);
        if (LblDelay != null) LblDelay.Text = p.GetUiText(I18nKeys.SkillTableDelay);
        if (LblRandom != null) LblRandom.Text = p.GetUiText(I18nKeys.SkillTableRandom);
        if (LblBagOffset != null) LblBagOffset.Text = p.GetUiText(I18nKeys.UiAuxiliaryPanelBagOffsetLabel);
        if (LblAutomationOptions != null) LblAutomationOptions.Text = p.GetUiText(I18nKeys.AutomationOptions);
        if (ChkBloodShard != null) ChkBloodShard.Content = p.GetUiText(I18nKeys.AuxiliaryBloodShardEnabled);
        if (ChkQuickPickup != null) ChkQuickPickup.Content = p.GetUiText(I18nKeys.AuxiliaryQuickPickupEnabled);
        if (ChkBlacksmith != null) ChkBlacksmith.Content = p.GetUiText(I18nKeys.AuxiliaryBlacksmithEnabled);
        if (ChkKanaiReforge != null) ChkKanaiReforge.Content = p.GetUiText(I18nKeys.AuxiliaryKanaiReforgeEnabled);
        if (ChkKanaiUpgrade != null) ChkKanaiUpgrade.Content = p.GetUiText(I18nKeys.AuxiliaryKanaiUpgradeEnabled);
        if (ChkKanaiConvert != null) ChkKanaiConvert.Content = p.GetUiText(I18nKeys.AuxiliaryKanaiConvertEnabled);
        if (ChkAutoSalvage != null) ChkAutoSalvage.Content = p.GetUiText(I18nKeys.AuxiliaryAutoSalvageEnabled);
        if (ChkDropEquipment != null) ChkDropEquipment.Content = p.GetUiText(I18nKeys.AuxiliaryDropEquipmentEnabled);
        if (LblMacroStartHotkey != null) LblMacroStartHotkey.Text = p.GetUiText(I18nKeys.MainFunctionsPanelMacroStartHotkeyLabel);
        if (LblAssistantHotkey != null) LblAssistantHotkey.Text = p.GetUiText(I18nKeys.MainFunctionsPanelMacroPauseHotkeyLabel);
        if (BtnCombatMacroToggle != null) BtnCombatMacroToggle.Content = p.GetUiText(I18nKeys.MainFunctionsPanelCombatMacroToggleButton);
        if (LblQuickSwitch != null) LblQuickSwitch.Text = p.GetUiText(I18nKeys.MainFunctionsPanelQuickSwitch) + ":";
        if (LblAnimation != null) LblAnimation.Text = p.GetUiText(I18nKeys.MainFunctionsPanelAnimationSpeedLabel);
        if (LblLanguage != null) LblLanguage.Text = p.GetUiText(I18nKeys.MainFunctionsPanelGameLanguageLabel);
        if (ChkPlaySoundOnSwitch != null) ChkPlaySoundOnSwitch.Content = p.GetUiText(I18nKeys.AuxiliaryPlaySoundOnSwitch);
        if (ChkSmartPauseBar != null) ChkSmartPauseBar.Content = p.GetUiText(I18nKeys.AuxiliarySmartPause);
        if (ChkCustomStand != null) ChkCustomStand.Content = p.GetUiText(I18nKeys.OptionsCustomStandKey);
        if (CboAnimationSpeed != null)
        {
            var prevIdx = CboAnimationSpeed.SelectedIndex;
            CboAnimationSpeed.Items.Clear();
            CboAnimationSpeed.Items.Add(p.GetUiText(I18nKeys.MainFunctionsPanelAnimationSpeedSlow));
            CboAnimationSpeed.Items.Add(p.GetUiText(I18nKeys.MainFunctionsPanelAnimationSpeedMedium));
            CboAnimationSpeed.Items.Add(p.GetUiText(I18nKeys.MainFunctionsPanelAnimationSpeedFast));
            if (prevIdx >= 0 && prevIdx < 3) CboAnimationSpeed.SelectedIndex = prevIdx;
        }
        foreach (var row in ViewModel.SkillRows)
            row.NotifyDisplayNameChanged();
    }

    private void OnConfigChanged(string? keyPath)
    {
        if (string.IsNullOrEmpty(keyPath) || !keyPath.StartsWith(ConfigKeys.HotkeyConfigPathAuxiliary, StringComparison.OrdinalIgnoreCase)) return;
        if (_loading || TxtMacroStartHotkey == null || TxtAssistantHotkey == null) return;
        var svc = D3CheckConfigService.Instance;
        TxtMacroStartHotkey.Text = svc.GetValueSafe<string>(ConfigKeys.AuxiliaryMacroStartHotkey, "F2") ?? "F2";
        TxtAssistantHotkey.Text = svc.GetValueSafe<string>(ConfigKeys.AuxiliaryAssistantHotkey, "F3") ?? "F3";
    }

    private void HotkeyBox_PreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (sender is not TextBox box) return;
        bool isMacroStart = (box == TxtMacroStartHotkey);
        string configKey = isMacroStart ? ConfigKeys.AuxiliaryMacroStartHotkey : ConfigKeys.AuxiliaryAssistantHotkey;
        if (e.Key == Key.Escape || e.Key == Key.Delete)
        {
            e.Handled = true;
            box.Text = "";
            SaveAuxiliaryHotkey(configKey, "");
            return;
        }
        string? canonical = BuildCanonicalHotkey(e.Key, e.SystemKey, Keyboard.Modifiers);
        if (canonical == null) { e.Handled = true; return; }
        e.Handled = true;
        box.Text = canonical;
        if (!_loading) SaveAuxiliaryHotkey(configKey, canonical);
    }

    private static bool IsModifierKey(Key key) =>
        key == Key.LeftCtrl || key == Key.RightCtrl || key == Key.LeftShift || key == Key.RightShift
        || key == Key.LeftAlt || key == Key.RightAlt || key == Key.LWin || key == Key.RWin;

    private static string? BuildCanonicalHotkey(Key key, Key systemKey, ModifierKeys modifiers)
    {
        Key mainKey = (key != Key.System) ? key : systemKey;
        if (mainKey == Key.Escape || mainKey == Key.Delete || IsModifierKey(mainKey)) return null;
        var parts = new List<string>();
        if ((modifiers & ModifierKeys.Control) != 0) parts.Add("ctrl");
        if ((modifiers & ModifierKeys.Shift) != 0) parts.Add("shift");
        if ((modifiers & ModifierKeys.Alt) != 0) parts.Add("alt");
        if ((modifiers & ModifierKeys.Windows) != 0) parts.Add("win");
        string main = mainKey switch
        {
            Key.Space => "space", Key.Enter => "enter", Key.Tab => "tab", Key.Back => "backspace",
            Key.F1 => "f1", Key.F2 => "f2", Key.F3 => "f3", Key.F4 => "f4", Key.F5 => "f5",
            Key.F6 => "f6", Key.F7 => "f7", Key.F8 => "f8", Key.F9 => "f9", Key.F10 => "f10", Key.F11 => "f11", Key.F12 => "f12",
            Key.Left => "left", Key.Right => "right", Key.Up => "up", Key.Down => "down",
            Key.Home => "home", Key.End => "end", Key.Prior => "pageup", Key.Next => "pagedown", Key.Insert => "ins",
            _ when mainKey >= Key.A && mainKey <= Key.Z => ((char)('a' + (mainKey - Key.A))).ToString(),
            _ when mainKey >= Key.D0 && mainKey <= Key.D9 => ((char)('0' + (mainKey - Key.D0))).ToString(),
            _ when mainKey >= Key.NumPad0 && mainKey <= Key.NumPad9 => ((char)('0' + (mainKey - Key.NumPad0))).ToString(),
            _ => mainKey.ToString().ToLowerInvariant()
        };
        parts.Add(main);
        return HotkeyUtil.NormalizeCanonical(string.Join("+", parts));
    }

    private void OnConfigSelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (e.AddedItems.Count == 0) return;
        var idx = CboConfig.SelectedIndex;
        if (idx < 0 || idx >= ConfigKeyNames.Length) return;
        var name = ConfigKeyNames[idx];
        if (_configDisplayValues.Length > idx) TxtCurrentConfig.Text = _configDisplayValues[idx];
        D3CheckConfigService.Instance.SetValueAsync(ConfigKeys.MacroConfigsCurrentSkillConfig, name);
        D3CheckConfigService.Instance.QueueSave();
        ViewModel.LoadSkillRows(name);
        MacroConfigLoader.Instance.LoadActive();
        LoadQuickSwitch(name);
    }

    private void LoadQuickSwitch(string configName)
    {
        TxtQuickSwitch.Text = D3CheckConfigService.Instance.GetValueSafe<string>($"macro_configs.skill_configs.{configName}.quick_switch", "F1") ?? "F1";
    }

    private void SaveQuickSwitch()
    {
        var name = CurrentConfigName;
        D3CheckConfigService.Instance.SetValueAsync($"macro_configs.skill_configs.{name}.quick_switch", TxtQuickSwitch.Text ?? "F1");
        D3CheckConfigService.Instance.QueueSave();
    }

    private static void SaveComboBox(string key, string? value)
    {
        if (value == null) return;
        D3CheckConfigService.Instance.SetValueAsync(key, value);
        D3CheckConfigService.Instance.QueueSave();
    }

    private static void SaveString(string key, string value)
    {
        D3CheckConfigService.Instance.SetValueAsync(key, value ?? "");
        D3CheckConfigService.Instance.QueueSave();
    }

    private static void SaveAuxiliaryHotkey(string key, string value)
    {
        SaveString(key, value);
        Config.D3CheckConfigChangeHub.Notify(ConfigKeys.HotkeyConfigPathAuxiliary);
    }

    private static void SaveCheckbox(string key, bool value)
    {
        D3CheckConfigService.Instance.SetValueAsync(key, value);
        D3CheckConfigService.Instance.QueueSave();
    }
}
