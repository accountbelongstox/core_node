using System.Collections.ObjectModel;
using System.Windows.Input;
using DotApps.d3check.Config;
using DotApps.d3check.Constants;
using DotApps.d3check.Ui;
using DotApps.d3check.ViewModels.Base;
using DotCore.Common;
using DotCore.Foundations;

namespace DotApps.d3check.ViewModels;

/// <summary>
/// ViewModel for MainPage. Exposes SkillRows and CombatMacroToggleCommand.
/// Per .NET UI spec: ViewModels/[Feature]ViewModel.cs, [Action]Command.
/// </summary>
public sealed class MainViewModel : BaseViewModel
{
    private readonly D3CheckConfigService _configService;
    private readonly II18nProvider? _i18n;
    private string _currentConfigName = "config1";

    private static readonly string[] ConfigKeyNames = { "config1", "config2", "config3", "config4" };

    public MainViewModel(D3CheckConfigService configService, II18nProvider? i18n)
    {
        _configService = configService;
        _i18n = i18n;
        CombatMacroToggleCommand = new RelayCommand(ExecuteCombatMacroToggle);
    }

    public ObservableCollection<SkillRowViewModel> SkillRows { get; } = new();

    public ICommand CombatMacroToggleCommand { get; }

    /// <summary>Set current config name (used by SkillRowViewModel getCurrentConfig).</summary>
    public void SetCurrentConfig(string configName)
    {
        _currentConfigName = configName ?? "config1";
    }

    /// <summary>Load skill rows for the given config. Call after SetCurrentConfig and when config selection changes.</summary>
    public void LoadSkillRows(string configName)
    {
        SetCurrentConfig(configName);
        string Get(string skillKey, string field, string defaultValue)
            => _configService.GetValueSafe<string>($"macro_configs.skill_configs.{configName}.skills.{skillKey}.{field}", defaultValue) ?? defaultValue;

        string ConfigKey(string skillKey)
        {
            if (skillKey == "left_click" || skillKey == "right_click") return skillKey == "left_click" ? "LMB" : "RMB";
            return Get(skillKey, "key", "");
        }

        SkillRows.Clear();
        foreach (var skillKey in new[] { "skill1", "skill2", "skill3", "skill4", "left_click", "right_click", "potion" })
            SkillRows.Add(new SkillRowViewModel(
                skillKey,
                () => _currentConfigName,
                _configService,
                _i18n,
                key: ConfigKey(skillKey),
                strategy: Get(skillKey, "strategy", "continuous"),
                interval: Get(skillKey, "interval", "100"),
                delay: Get(skillKey, "delay", "0"),
                randomDelay: Get(skillKey, "random_delay", "0")));
    }

    private static void ExecuteCombatMacroToggle()
    {
        var controller = UiRegistry.GetCombatMacroController();
        controller?.Toggle();
    }
}
