using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Globalization;
using System.Runtime.CompilerServices;
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
    public const string SkillLeftClick = "left_click";
    public const string SkillRightClick = "right_click";
    public const string SkillPotion = "potion";
    public const int NumberMin = 0;
    public const int NumberMax = 10000;
    public const int IntervalDefault = 100;
    public const string PotionDefaultKey = "Q";
    private const string FieldKey = "key";
    private const string FieldStrategy = "strategy";
    private const string FieldInterval = "interval";
    private const string FieldDelay = "delay";
    private const string FieldRandomDelay = "random_delay";
    private const string StrategyContinuous = "continuous";
    private const string StrategyIgnore = "ignore";

    private readonly Func<string> _getCurrentConfig;
    private readonly II18nProvider? _i18n;

    private string _key = "";
    private string _strategy = StrategyContinuous;
    private int _interval = IntervalDefault;
    private int _delay;
    private int _randomDelay;

    /// <summary>English keys for config (1:1 Python). Order must match StrategyDisplayNames.</summary>
    public static string[] StrategyOptionValues { get; } = { StrategyContinuous, "single", "hold", StrategyIgnore };

    /// <summary>Display names for the Strategy dropdown (i18n), same order as StrategyOptionValues. Populated by MainPage.RefreshI18n.</summary>
    public static ObservableCollection<string> StrategyDisplayNames { get; } = new();

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

    public int StrategyIndex
    {
        get
        {
            var i = Array.IndexOf(StrategyOptionValues, _strategy);
            return i >= 0 ? i : 0;
        }
        set
        {
            if (value < 0 || value >= StrategyOptionValues.Length || StrategyOptionValues[value] == _strategy) return;
            _strategy = StrategyOptionValues[value];
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
        string defaultStrategy = !exists && (IsMouseRow(SkillKey) || SkillKey == SkillPotion) ? StrategyIgnore : StrategyContinuous;
        string defaultKey = SkillKey == SkillPotion ? PotionDefaultKey : "";
        var key = ConfigBinding.GetValue(basePath + "." + FieldKey, defaultKey);
        _key = string.IsNullOrEmpty(key) ? defaultKey : key;
        _strategy = NormalizeStrategy(ConfigBinding.GetValue(basePath + "." + FieldStrategy, defaultStrategy));
        _interval = ReadNumber(basePath + "." + FieldInterval, IntervalDefault);
        _delay = ReadNumber(basePath + "." + FieldDelay, 0);
        _randomDelay = ReadNumber(basePath + "." + FieldRandomDelay, 0);
        OnPropertyChanged(string.Empty);
    }

    public void NotifyI18nChanged()
    {
        OnPropertyChanged(nameof(DisplayName));
        OnPropertyChanged(nameof(KeyLabel));
        OnPropertyChanged(nameof(StrategyIndex));
    }

    private static bool IsMouseRow(string skillKey) => skillKey is SkillLeftClick or SkillRightClick;

    private static string NormalizeStrategy(string? s)
    {
        var v = (s ?? "").Trim().ToLowerInvariant();
        if (v == "drag" || v == "disabled") return StrategyIgnore;
        return Array.IndexOf(StrategyOptionValues, v) >= 0 ? v : StrategyContinuous;
    }

    private static int ReadNumber(string keyPath, int defaultValue) =>
        ConfigBinding.ParseInt(D3D4TesterConfigService.Instance.GetRawText(keyPath)?.Trim().Trim('"'), int.MinValue, int.MaxValue, defaultValue);

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
