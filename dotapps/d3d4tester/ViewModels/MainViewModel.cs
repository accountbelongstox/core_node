// PY-REF: dotapps/d3d4tester/reference/py_d3check/ui/panels/main_functions_panel.py
using System.Collections.ObjectModel;
using System.Windows.Input;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Ui;
using DotApps.d3d4tester.ViewModels.Base;
using DotCore.Common;

namespace DotApps.d3d4tester.ViewModels;

/// <summary>
/// ViewModel for MainPage: skill table rows of the current skill config and the combat macro toggle.
/// Row order 1:1 Python main_functions_panel SKILL_TABLE_KEYS.
/// </summary>
public sealed class MainViewModel : BaseViewModel
{


    private string _currentConfigName = MacroConfigLoader.DefaultConfigName;

    public MainViewModel(II18nProvider? i18n)
    {
        CombatMacroToggleCommand = new RelayCommand(ExecuteCombatMacroToggle);
        foreach (var skillKey in MacroSkillRunner.SkillKeys)
            SkillRows.Add(new SkillRowViewModel(skillKey, () => _currentConfigName, i18n));
    }

    public ObservableCollection<SkillRowViewModel> SkillRows { get; } = new();

    public ICommand CombatMacroToggleCommand { get; }

    public string CurrentConfigName => _currentConfigName;

    /// <summary>Switch to a config and refresh rows in place (no save). 1:1 Python _update_skill_tabs_content.</summary>
    public void LoadSkillRows(string configName)
    {
        _currentConfigName = string.IsNullOrEmpty(configName) ? MacroConfigLoader.DefaultConfigName : configName;
        foreach (var row in SkillRows) row.Load(_currentConfigName);
    }

    public void NotifyI18nChanged()
    {
        foreach (var row in SkillRows) row.NotifyI18nChanged();
    }

    private static void ExecuteCombatMacroToggle() => UiRegistry.GetCombatMacroController()?.Toggle();
}
