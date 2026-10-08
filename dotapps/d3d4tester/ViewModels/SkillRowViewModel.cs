// PY-REF: pyapps/d3-check/ui/panels/main_functions_panel.py
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Globalization;
using System.Runtime.CompilerServices;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotCore.Common;
using DotCore.Foundations;

namespace DotApps.d3d4tester.ViewModels;

/// <summary>
/// One skill row of the main page table (skill1-4, left_click, right_click, potion).
/// Saves to macro_configs.skill_configs.{config}.skills.{skillKey}.key|strategy|interval|delay|random_delay; numbers are saved as ints.
/// Mouse rows have no key binding and show a fixed i18n label. 1:1 Python main_functions_panel _create_skill_config_row / _on_skill_param_changed.
/// </summary>
public sealed class SkillRowViewModel : INotifyPropertyChanged
{
    public const string SkillLeftClick = MacroSkillRunner.SkillLeftClick;
    public const string SkillRightClick = MacroSkillRunner.SkillRightClick;
    public const string SkillPotion = MacroSkillRunner.SkillPotion;
    public const int NumberMin = 0;
    public const int NumberMax = 10000;
    private const string FieldKey = MacroSkillSchema.FieldKey;
    private const string FieldStrategy = MacroSkillSchema.FieldStrategy;
    private const string FieldInterval = MacroSkillSchema.FieldInterval;
    private const string FieldDelay = MacroSkillSchema.FieldDelay;
    private const string FieldRandomDelay = MacroSkillSchema.FieldRandomDelay;

    private readonly Func<string> _getCurrentConfig;
    private readonly II18nProvider? _i18n;

    private string _key = "";
    private string _strategy = MacroSkillSchema.StrategyContinuous;
    private int _interval = MacroSkillSchema.IntervalDefault;
    private int _delay = MacroSkillSchema.DelayDefault;
    private int _randomDelay = MacroSkillSchema.RandomDelayDefault;

    /// <summary>English keys for config (1:1 Python).</summary>
    public static IReadOnlyList<string> StrategyOptionValues => MacroSkillSchema.StrategyValues;

    /// <summary>
    /// Strategy dropdown items (value + i18n display), shared by every row. Created once and never cleared: a language change only
    /// updates Display (MainPage.RefreshI18n), so each ComboBox keeps its SelectedValue (= Strategy).
    /// </summary>
    public static ObservableCollection<StrategyOption> StrategyOptions { get; } = new(StrategyOptionValues.Select(v => new StrategyOption(v)));

    public SkillRowViewModel(string skillKey, Func<string> getCurrentConfig, II18nProvider? i18n)
    {
        SkillKey = skillKey;
        _getCurrentConfig = getCurrentConfig;
        _i18n = i18n;
    }

    public string SkillKey { get; }

    public string DisplayName => _i18n?.GetUiText(I18nKeys.SkillTableSkillDisplayKey(SkillKey)) ?? SkillKey;

    public bool IsKeyEditable => !IsMouseRow(SkillKey);

    /// <summary>Fixed key label for mouse rows (skill_table.key_left_click / key_right_click).</summary>
    public string KeyLabel => IsKeyEditable ? "" : _i18n?.GetUiText(I18nKeys.SkillTableKeyLabel(SkillKey)) ?? SkillKey;

    public string Key
    {
        get => _key;
        set
        {
            if (!IsKeyEditable) return;
            if (SetField(ref _key, value ?? "")) Save(FieldKey, _key);
        }
    }

    /// <summary>Strategy value (continuous / single / hold / ignore), bound to the dropdown SelectedValue.</summary>
    public string Strategy
    {
        get => _strategy;
        set
        {
            if (string.IsNullOrEmpty(value) || value == _strategy || !StrategyOptionValues.Contains(value)) return;
            _strategy = value;
            OnPropertyChanged();
            Save(FieldStrategy, _strategy);
        }
    }

    public string Interval
    {
        get => _interval.ToString(CultureInfo.InvariantCulture);
        set => SetNumber(ref _interval, value, FieldInterval);
    }

    public string Delay
    {
        get => _delay.ToString(CultureInfo.InvariantCulture);
        set => SetNumber(ref _delay, value, FieldDelay);
    }

    public string RandomDelay
    {
        get => _randomDelay.ToString(CultureInfo.InvariantCulture);
        set => SetNumber(ref _randomDelay, value, FieldRandomDelay);
    }

    /// <summary>
    /// Load values for the current config without saving. Missing rows use Python defaults:
    /// mouse rows and potion {key "" / "Q", strategy ignore, interval 100, delay 0, random 0}; skills {strategy continuous}.
    /// </summary>
    public void Load(string configName)
    {
        string basePath = $"{ConfigKeys.MacroConfigsSkillConfigs}.{configName}.skills.{SkillKey}";
        bool exists = D3D4TesterConfigService.Instance.GetRawText(basePath) != null;
        string defaultStrategy = MacroSkillSchema.DefaultStrategy(SkillKey, exists);
        string defaultKey = MacroSkillSchema.DefaultKey(SkillKey);
        var key = ConfigBinding.GetValue(basePath + "." + FieldKey, defaultKey);
        _key = string.IsNullOrEmpty(key) ? defaultKey : key;
        _strategy = MacroSkillSchema.NormalizeStrategy(ConfigBinding.GetValue(basePath + "." + FieldStrategy, defaultStrategy), defaultStrategy);
        _interval = ReadNumber(basePath + "." + FieldInterval, MacroSkillSchema.IntervalDefault);
        _delay = ReadNumber(basePath + "." + FieldDelay, MacroSkillSchema.DelayDefault);
        _randomDelay = ReadNumber(basePath + "." + FieldRandomDelay, MacroSkillSchema.RandomDelayDefault);
        OnPropertyChanged(string.Empty);
    }

    public void NotifyI18nChanged()
    {
        OnPropertyChanged(nameof(DisplayName));
        OnPropertyChanged(nameof(KeyLabel));
        OnPropertyChanged(nameof(Strategy));
    }

    private static bool IsMouseRow(string skillKey) => MacroSkillSchema.IsMouseRow(skillKey);

    private static int ReadNumber(string keyPath, int defaultValue) => ConfigBinding.GetIntValue(keyPath, int.MinValue, int.MaxValue, defaultValue);

    /// <summary>Invalid text -> 0, clamp to the spinbox range 0..10000. 1:1 Python _parse_int_from_ui + Spinbox(from_=0, to=10000).</summary>
    private void SetNumber(ref int field, string? text, string configField, [CallerMemberName] string? propertyName = null)
    {
        int v = ConfigBinding.ParseInt(text, NumberMin, NumberMax, 0);
        if (field == v)
        {
            OnPropertyChanged(propertyName);
            return;
        }
        field = v;
        OnPropertyChanged(propertyName);
        Save(configField, v);
    }

    private void Save(string field, object value)
    {
        var configName = _getCurrentConfig();
        if (string.IsNullOrEmpty(configName)) return;
        ConfigBinding.SetValue($"{ConfigKeys.MacroConfigsSkillConfigs}.{configName}.skills.{SkillKey}.{field}", value);
        ColorPrinter.Blue($"[MainFunctionsPanel] {SkillKey}.{field} updated to: {value}");
    }

    private bool SetField<T>(ref T field, T value, [CallerMemberName] string? propertyName = null)
    {
        if (EqualityComparer<T>.Default.Equals(field, value)) return false;
        field = value;
        OnPropertyChanged(propertyName);
        return true;
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    private void OnPropertyChanged([CallerMemberName] string? propertyName = null)
        => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
}

/// <summary>One strategy dropdown item: config value and its i18n display text.</summary>
public sealed class StrategyOption : INotifyPropertyChanged
{
    private string _display;

    public StrategyOption(string value)
    {
        Value = value;
        _display = value;
    }

    public string Value { get; }

    public string Display
    {
        get => _display;
        set
        {
            if (_display == value) return;
            _display = value;
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(Display)));
        }
    }

    public event PropertyChangedEventHandler? PropertyChanged;
}
