using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using DotApps.d3check.Config;
using DotApps.d3check.Constants;
using DotCore.Common;

namespace DotApps.d3check.ViewModels;

/// <summary>
/// One skill row for the main page table. Reusable for all 7 rows (skill1-4, left_click, right_click, potion).
/// Loads from and saves to config: macro_configs.skill_configs.{configName}.skills.{skillKey}.key|strategy|interval|delay|random_delay.
/// DisplayName uses i18n when provider is set. Strategy: stored as English key (continuous/single/hold/ignore); UI shows i18n via StrategyDisplayNames.
/// Per .NET UI spec: ViewModels/[Feature]ViewModel.cs.
/// </summary>
public sealed class SkillRowViewModel : INotifyPropertyChanged
{
    private readonly Func<string> _getCurrentConfig;
    private readonly D3CheckConfigService _configService;
    private readonly II18nProvider? _i18n;
    private bool _suppressSave;

    private string _key = "";
    private string _strategy = "continuous";
    private string _interval = "100";
    private string _delay = "0";
    private string _randomDelay = "0";

    /// <summary>English keys for config (1:1 Python). Order must match StrategyDisplayNames.</summary>
    public static string[] StrategyOptionValues { get; } = { "continuous", "single", "hold", "ignore" };

    /// <summary>Display names for Strategy dropdown (i18n). Populated by MainPage.RefreshI18n in same order as StrategyOptionValues.</summary>
    public static ObservableCollection<string> StrategyDisplayNames { get; } = new();

    public string SkillKey { get; }

    public string DisplayName => _i18n != null
        ? _i18n.GetUiText(I18nKeys.SkillTableSkillDisplayKey(SkillKey))
        : (SkillKey switch
        {
            "skill1" => "skill1",
            "skill2" => "skill2",
            "skill3" => "skill3",
            "skill4" => "skill4",
            "left_click" => "Left click",
            "right_click" => "Right click",
            "potion" => "potion",
            _ => SkillKey
        });

    public void NotifyDisplayNameChanged() => OnPropertyChanged(nameof(DisplayName));

    public bool IsKeyEditable => SkillKey is not "left_click" and not "right_click";

    public string KeyDisplay => SkillKey == "left_click" ? "LMB" : SkillKey == "right_click" ? "RMB" : _key;

    public string Key
    {
        get => SkillKey == "left_click" ? "LMB" : SkillKey == "right_click" ? "RMB" : _key;
        set
        {
            if (SkillKey is "left_click" or "right_click") return;
            if (SetField(ref _key, value ?? "")) SaveSkillField("key", _key);
        }
    }

    public string Strategy
    {
        get => _strategy;
        set
        {
            var v = NormalizeStrategy(value ?? "continuous");
            if (SetField(ref _strategy, v))
            {
                SaveSkillField("strategy", _strategy);
                OnPropertyChanged(nameof(StrategyIndex));
            }
        }
    }

    /// <summary>Index into StrategyOptionValues / StrategyDisplayNames for ComboBox binding. Two-way: set updates Strategy.</summary>
    public int StrategyIndex
    {
        get
        {
            var i = Array.IndexOf(StrategyOptionValues, _strategy);
            return i >= 0 ? i : 0;
        }
        set
        {
            if (value >= 0 && value < StrategyOptionValues.Length && StrategyOptionValues[value] != _strategy)
                Strategy = StrategyOptionValues[value];
        }
    }

    private static string NormalizeStrategy(string s)
    {
        var v = (s ?? "").Trim().ToLowerInvariant();
        if (v == "drag" || v == "disabled") return "ignore";
        return Array.IndexOf(StrategyOptionValues, v) >= 0 ? v : "continuous";
    }

    public string Interval
    {
        get => _interval;
        set { if (SetField(ref _interval, value ?? "100")) SaveSkillField("interval", _interval); }
    }

    public string Delay
    {
        get => _delay;
        set { if (SetField(ref _delay, value ?? "0")) SaveSkillField("delay", _delay); }
    }

    public string RandomDelay
    {
        get => _randomDelay;
        set { if (SetField(ref _randomDelay, value ?? "0")) SaveSkillField("random_delay", _randomDelay); }
    }

    public SkillRowViewModel(
        string skillKey,
        Func<string> getCurrentConfig,
        D3CheckConfigService configService,
        II18nProvider? i18n = null,
        string key = "",
        string strategy = "continuous",
        string interval = "100",
        string delay = "0",
        string randomDelay = "0")
    {
        SkillKey = skillKey;
        _getCurrentConfig = getCurrentConfig;
        _configService = configService;
        _i18n = i18n;
        _suppressSave = true;
        _key = key;
        _strategy = strategy;
        _interval = interval;
        _delay = delay;
        _randomDelay = randomDelay;
        _suppressSave = false;
    }

    private string SkillPath(string configName, string field)
        => $"macro_configs.skill_configs.{configName}.skills.{SkillKey}.{field}";

    private void SaveSkillField(string field, object value)
    {
        if (_suppressSave) return;
        if (field == "key" && (SkillKey == "left_click" || SkillKey == "right_click")) return;
        var configName = _getCurrentConfig();
        if (string.IsNullOrEmpty(configName)) return;
        _configService.SetValueAsync(SkillPath(configName, field), value);
        _configService.QueueSave();
    }

    private bool SetField<T>(ref T field, T value, [CallerMemberName] string? propertyName = null)
    {
        if (EqualityComparer<T>.Default.Equals(field, value)) return false;
        field = value;
        OnPropertyChanged(propertyName);
        if (propertyName == nameof(Key)) OnPropertyChanged(nameof(KeyDisplay));
        return true;
    }

    public event PropertyChangedEventHandler? PropertyChanged;
    private void OnPropertyChanged([CallerMemberName] string? propertyName = null)
        => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
}
