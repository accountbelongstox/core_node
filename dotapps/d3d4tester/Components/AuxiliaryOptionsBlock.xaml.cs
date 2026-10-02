// PY-REF: pyapps/d3-check/ui/components/auxiliary_options_block.py
// PY-REF: pyapps/d3-check/timers/timer_manager.py
// PY-REF: pyapps/d3-check/timers/one_shot_tasks.py
using System.Windows;
using System.Windows.Controls;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Config.Options;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Ctl;
using DotApps.d3d4tester.I18n;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Components;

/// <summary>
/// Main tab right column: bag offset (one "t,l,b,r" input saved as four ints) + automation features in two columns.
/// A feature with a dropdown shows an empty checkbox (on/off) and a dropdown whose items read "feature option"; no extra label.
/// 1:1 Python ui/components/auxiliary_options_block.py.
/// </summary>
public partial class AuxiliaryOptionsBlock : UserControl
{
    private const string OptionSeparator = " ";

    private static readonly FeatureSpec[] Features =
    {
        new(I18nKeys.AuxiliaryBloodShardEnabled, ConfigKeys.AuxiliaryBloodShardEnabled, false,
            new MenuSpec(ConfigKeys.AuxiliaryBloodShardType, AuxiliaryFeatureOptions.BloodShardTypeValues, AuxiliaryFeatureOptions.BloodShardTypeDefault, new[]
            {
                I18nKeys.AuxBloodShardTypeWeapon, I18nKeys.AuxBloodShardTypeArmor, I18nKeys.AuxBloodShardTypeJewelry,
                I18nKeys.AuxBloodShardTypeHelmet, I18nKeys.AuxBloodShardTypeGloves, I18nKeys.AuxBloodShardTypeBoots,
            })),
        new(I18nKeys.AuxiliaryEnsureBattlenetNormal, ConfigKeys.BattlenetEnsureNormal, ConfigKeys.BattlenetEnsureNormalDefault, null),
        new(I18nKeys.AuxiliaryQuickPickupEnabled, ConfigKeys.AuxiliaryQuickPickupEnabled, false, null),
        new(I18nKeys.AuxiliaryBlacksmithEnabled, ConfigKeys.AuxiliaryBlacksmithEnabled, false, null),
        new(I18nKeys.AuxiliaryKanaiReforgeEnabled, ConfigKeys.AuxiliaryKanaiReforgeEnabled, false,
            new MenuSpec(ConfigKeys.AuxiliaryKanaiReforgeMode, AuxiliaryFeatureOptions.KanaiReforgeModeValues, AuxiliaryFeatureOptions.KanaiReforgeModeDefault, new[]
            {
                I18nKeys.AuxKanaiReforgeUntilAncient, I18nKeys.AuxKanaiReforgeDoubleCrit, I18nKeys.AuxKanaiReforgeDoubleCritAncient,
            })),
        new(I18nKeys.AuxiliaryKanaiUpgradeEnabled, ConfigKeys.AuxiliaryKanaiUpgradeEnabled, false, null),
        new(I18nKeys.AuxiliaryKanaiConvertEnabled, ConfigKeys.AuxiliaryKanaiConvertEnabled, false,
            new MenuSpec(ConfigKeys.AuxiliaryKanaiConvertMaterial, AuxiliaryFeatureOptions.KanaiConvertMaterialValues, AuxiliaryFeatureOptions.KanaiConvertMaterialDefault, new[]
            {
                I18nKeys.AuxKanaiConvertForgottenSoul, I18nKeys.AuxKanaiConvertVeiledCrystal, I18nKeys.AuxKanaiConvertArcaneDust,
            })),
        new(I18nKeys.AuxiliaryAutoSalvageEnabled, ConfigKeys.AuxiliaryAutoSalvageEnabled, false,
            new MenuSpec(ConfigKeys.AuxiliaryAutoSalvageKeep, AuxiliaryFeatureOptions.AutoSalvageKeepValues, AuxiliaryFeatureOptions.AutoSalvageKeepDefault, new[]
            {
                I18nKeys.AuxAutoSalvageKeepAncientPlus, I18nKeys.AuxAutoSalvageKeepPrimal,
            })),
        new(I18nKeys.AuxiliaryDropEquipmentEnabled, ConfigKeys.AuxiliaryDropEquipmentEnabled, false, null),
        new(I18nKeys.AuxiliarySoundFeedback, ConfigKeys.AuxiliarySoundFeedback, true, null),
        new(I18nKeys.AuxiliarySmartPause, ConfigKeys.AuxiliarySmartPause, true, null),
    };

    private readonly List<(FeatureSpec Spec, CheckBox Check, ComboBox? Combo)> _cells = new();
    private bool _built;

    public AuxiliaryOptionsBlock()
    {
        InitializeComponent();
        Loaded += OnLoaded;
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        if (_built) return;
        _built = true;
        BuildAutomationCells();
        ConfigBinding.BindOffsetTextBox(TxtBagOffset, OffsetInputHelper.BagOffset,
            ConfigKeys.UiAnalysisBagOffsetTop, ConfigKeys.UiAnalysisBagOffsetLeft, ConfigKeys.UiAnalysisBagOffsetBottom, ConfigKeys.UiAnalysisBagOffsetRight);
        RefreshI18n();
    }

    /// <summary>Re-read all labels and dropdown texts (call when the UI language changes).</summary>
    public void RefreshI18n()
    {
        var p = D3D4TesterI18n.Provider;
        LblBagOffsetTitle.Text = p.GetUiText(I18nKeys.AuxBagOffsetTitle);
        LblBagOffset.Text = p.GetUiText(I18nKeys.UiAuxiliaryPanelBagOffsetLabel);
        LblBagOffsetDesc.Text = p.GetUiText(I18nKeys.AuxBagOffsetDesc);
        LblAutomationTitle.Text = p.GetUiText(I18nKeys.AutomationOptions);
        TxtStartD3.Text = p.GetUiText(I18nKeys.ButtonAreaStartD3);
        foreach (var (spec, check, combo) in _cells)
        {
            var featureLabel = p.GetUiText(spec.LabelKey);
            if (combo == null || spec.Menu == null)
            {
                check.Content = featureLabel;
                continue;
            }
            check.ToolTip = featureLabel;
            for (int i = 0; i < combo.Items.Count && i < spec.Menu.ItemKeys.Length; i++)
                if (combo.Items[i] is ComboBoxItem item)
                    item.Content = featureLabel + OptionSeparator + p.GetUiText(spec.Menu.ItemKeys[i]);
        }
    }

    /// <summary>Ensure D3 runs from Battle.net without ROSBOT, off the UI thread. 1:1 Python button_area.start_d3 (submit_one_shot do_ensure_d3_running_from_battlenet_no_rosbot).</summary>
    private async void BtnStartD3_Click(object sender, RoutedEventArgs e)
    {
        BtnStartD3.IsEnabled = false;
        try
        {
            await Task.Run(LoginTryController.EnsureD3RunningFromBattlenetNoRosbot);
        }
        catch (Exception ex)
        {
            ColorPrinter.Red($"[AuxPanel] Start D3 failed: {ex.Message}");
        }
        finally
        {
            BtnStartD3.IsEnabled = true;
        }
    }

    private void BuildAutomationCells()
    {
        int rows = (Features.Length + 1) / 2;
        for (int r = 0; r < rows; r++)
            AutomationGrid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        for (int idx = 0; idx < Features.Length; idx++)
        {
            var spec = Features[idx];
            var cell = new DockPanel { Margin = new Thickness(0, 0, 0, 3), LastChildFill = true };
            Grid.SetRow(cell, idx / 2);
            Grid.SetColumn(cell, idx % 2 == 0 ? 0 : 2);
            var check = new CheckBox { VerticalAlignment = VerticalAlignment.Center };
            DockPanel.SetDock(check, Dock.Left);
            cell.Children.Add(check);
            ConfigBinding.BindCheckBox(check, spec.ConfigKey, spec.Default);
            ComboBox? combo = null;
            if (spec.Menu != null)
            {
                combo = new ComboBox { MinWidth = 120, VerticalAlignment = VerticalAlignment.Center };
                foreach (var _ in spec.Menu.Values) combo.Items.Add(new ComboBoxItem());
                cell.Children.Add(combo);
                ConfigBinding.BindComboBox(combo, spec.Menu.ConfigKey, spec.Menu.Values, spec.Menu.Default);
            }
            AutomationGrid.Children.Add(cell);
            _cells.Add((spec, check, combo));
        }
    }

    private sealed record MenuSpec(string ConfigKey, string[] Values, string Default, string[] ItemKeys);

    private sealed record FeatureSpec(string LabelKey, string ConfigKey, bool Default, MenuSpec? Menu);
}
