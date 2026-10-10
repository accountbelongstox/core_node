// PY-REF: none (DOT-only)
using System.Collections.Generic;
using System.ComponentModel;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core.D4;
using DotApps.d3d4tester.Core.D4.Agent;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.ViewModels;
using DotApps.d3d4tester.Windows;
using DotCore.Foundations;
using DotCore.Utils;
using Microsoft.Win32;
using DotTheme = DotCore.UITheme;

namespace DotApps.d3d4tester.Pages.D4;

/// <summary>
/// D4 page sub-tab "Vision AI test": d4_agent settings (bound through ConfigBinding), start / stop, status tiles, annotated preview
/// and the agent log (view model messages plus the [D4Agent] ColorPrint lines while the view is shown).
/// </summary>
public partial class D4AgentView : UserControl
{
    private const int MaxBufferedLines = 500;
    private const int DrainIntervalMs = 100;
    private const string GlyphStart = "";
    private const string GlyphStop = "";

    private readonly D4AgentViewModel _viewModel = new();
    private readonly List<string> _logBuffer = new();
    private readonly object _logLock = new();
    private readonly DispatcherTimer _drainTimer;
    private bool _bound;

    public D4AgentView()
    {
        InitializeComponent();
        DataContext = _viewModel;
        _drainTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(DrainIntervalMs) };
        _drainTimer.Tick += (_, _) => DrainLog();
        _viewModel.LogRequested += AddLog;
        _viewModel.PropertyChanged += OnViewModelPropertyChanged;
        Loaded += OnLoaded;
        Unloaded += OnUnloaded;
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        RefreshI18n();
        BindControls();
        _viewModel.Attach();
        UpdateRunningVisuals();
        ColorPrinter.UnregisterCallback(OnColorPrintMessage);
        ColorPrinter.RegisterCallback(OnColorPrintMessage);
        _drainTimer.Start();
    }

    private void OnUnloaded(object sender, RoutedEventArgs e)
    {
        _drainTimer.Stop();
        _viewModel.Detach();
        ColorPrinter.UnregisterCallback(OnColorPrintMessage);
    }

    /// <summary>Called by the D4 page when the language changes.</summary>
    public void RefreshI18n()
    {
        LblTitle.Text = T(I18nKeys.D4AgentTitle);
        LblSubtitle.Text = T(I18nKeys.D4AgentSubtitle);
        TxtOpenOutput.Text = T(I18nKeys.D4AgentOpenOutput);
        TxtModelTest.Text = T(I18nKeys.D4AgentModelTest);
        LblSettingsTitle.Text = T(I18nKeys.D4AgentSettingsTitle);
        LblSource.Text = T(I18nKeys.D4AgentSource);
        LblVideoPath.Text = T(I18nKeys.D4AgentVideoPath);
        BtnBrowseVideo.Content = T(I18nKeys.D4AgentBrowse);
        LblFrameStep.Text = T(I18nKeys.D4AgentFrameStep);
        LblMode.Text = T(I18nKeys.D4AgentMode);
        LblModelPath.Text = T(I18nKeys.D4AgentModelPath);
        BtnBrowseModel.Content = T(I18nKeys.D4AgentBrowse);
        DotTheme.ControlAssist.SetPlaceholder(TxtModelPath, T(I18nKeys.D4AgentModelPathPlaceholder));
        LblConfidence.Text = T(I18nKeys.D4AgentConfidence);
        LblTargetFps.Text = T(I18nKeys.D4AgentTargetFps);
        LblLowHealth.Text = T(I18nKeys.D4AgentLowHealth);
        LblSkillKeys.Text = T(I18nKeys.D4AgentSkillKeys);
        TxtSkillKeys.ToolTip = T(I18nKeys.D4AgentSkillKeysTip);
        LblPotionKey.Text = T(I18nKeys.D4AgentPotionKey);
        ChkPickupLoot.Content = T(I18nKeys.D4AgentPickupLoot);
        ChkExplore.Content = T(I18nKeys.D4AgentExplore);
        LblDebugFrameEvery.Text = T(I18nKeys.D4AgentDebugFrameEvery);
        LblMaxMinutes.Text = T(I18nKeys.D4AgentMaxMinutes);
        ExpAdvanced.Header = T(I18nKeys.D4AgentAdvancedTitle);
        LblAdvancedTip.Text = T(I18nKeys.D4AgentAdvancedTip);
        LblSkillInterval.Text = T(I18nKeys.D4AgentSkillInterval);
        LblPotionCooldown.Text = T(I18nKeys.D4AgentPotionCooldown);
        LblMenuKey.Text = T(I18nKeys.D4AgentMenuKey);
        LblMinimapRotation.Text = T(I18nKeys.D4AgentMinimapRotation);
        LblWalkableValueMin.Text = T(I18nKeys.D4AgentWalkableValueMin);
        LblWalkableValueMax.Text = T(I18nKeys.D4AgentWalkableValueMax);
        LblWalkableSaturationMax.Text = T(I18nKeys.D4AgentWalkableSaturationMax);
        LblModelClasses.Text = T(I18nKeys.D4AgentModelClasses);
        LblStatusTitle.Text = T(I18nKeys.D4AgentStatusTitle);
        LblPreviewTitle.Text = T(I18nKeys.D4AgentPreviewTitle);
        LblPreviewEmpty.Text = T(I18nKeys.D4AgentPreviewEmpty);
        LblLogTitle.Text = T(I18nKeys.D4AgentLogTitle);
        TxtClearLog.Text = T(I18nKeys.D4AgentClearLog);
        FillCombo(CboSource, I18nKeys.D4AgentSourceLive, I18nKeys.D4AgentSourceVideo);
        FillCombo(CboMode, I18nKeys.D4AgentModeObserve, I18nKeys.D4AgentModeAct);
        _viewModel.RefreshI18n();
    }

    /// <summary>Combo items are the i18n texts in the order of the config values (index kept across a language switch).</summary>
    private static void FillCombo(ComboBox combo, params string[] keys)
    {
        int selected = combo.SelectedIndex;
        if (combo.Items.Count == keys.Length)
        {
            for (int i = 0; i < keys.Length; i++) combo.Items[i] = T(keys[i]);
        }
        else
        {
            combo.Items.Clear();
            foreach (var key in keys) combo.Items.Add(T(key));
        }
        if (selected >= 0) combo.SelectedIndex = selected;
    }

    private void BindControls()
    {
        if (_bound) return;
        _bound = true;
        var d = new D4AgentSettings();
        ConfigBinding.BindComboBox(CboSource, ConfigKeys.D4AgentSource, D4AgentConstants.Sources, d.Source);
        ConfigBinding.BindTextBox(TxtVideoPath, ConfigKeys.D4AgentVideoPath);
        ConfigBinding.BindIntTextBox(TxtFrameStep, ConfigKeys.D4AgentVideoFrameStep, 1, 120, d.VideoFrameStep);
        ConfigBinding.BindComboBox(CboMode, ConfigKeys.D4AgentMode, D4AgentConstants.Modes, d.Mode);
        ConfigBinding.BindTextBox(TxtModelPath, ConfigKeys.D4AgentModelPath);
        ConfigBinding.BindTextBox(TxtConfidence, ConfigKeys.D4AgentConfidence);
        ConfigBinding.BindTextBox(TxtTargetFps, ConfigKeys.D4AgentTargetFps);
        ConfigBinding.BindIntTextBox(TxtLowHealth, ConfigKeys.D4AgentLowHealthPercent, 0, 100, (int)Math.Round(d.LowHealthRatio * 100));
        ConfigBinding.BindTextBox(TxtSkillKeys, ConfigKeys.D4AgentSkillKeys);
        ConfigBinding.BindTextBox(TxtPotionKey, ConfigKeys.D4AgentPotionKey);
        ConfigBinding.BindCheckBox(ChkPickupLoot, ConfigKeys.D4AgentPickupLoot, d.PickupLoot);
        ConfigBinding.BindCheckBox(ChkExplore, ConfigKeys.D4AgentExplore, d.Explore);
        ConfigBinding.BindIntTextBox(TxtDebugFrameEvery, ConfigKeys.D4AgentDebugFrameEvery, 0, 100_000, d.DebugFrameEvery);
        ConfigBinding.BindIntTextBox(TxtMaxMinutes, ConfigKeys.D4AgentMaxMinutes, 0, 24 * 60, d.MaxMinutes);
        ConfigBinding.BindIntTextBox(TxtSkillInterval, ConfigKeys.D4AgentSkillMinIntervalMs, 0, 60_000, d.SkillMinIntervalMs);
        ConfigBinding.BindTextBox(TxtPotionCooldown, ConfigKeys.D4AgentPotionCooldownSec);
        ConfigBinding.BindTextBox(TxtMenuKey, ConfigKeys.D4AgentMenuCloseKey);
        ConfigBinding.BindTextBox(TxtMinimapRotation, ConfigKeys.D4AgentMinimapRotationDeg);
        ConfigBinding.BindIntTextBox(TxtWalkableValueMin, ConfigKeys.D4AgentWalkableValueMin, 0, 255, d.WalkableValueMin);
        ConfigBinding.BindIntTextBox(TxtWalkableValueMax, ConfigKeys.D4AgentWalkableValueMax, 0, 255, d.WalkableValueMax);
        ConfigBinding.BindIntTextBox(TxtWalkableSaturationMax, ConfigKeys.D4AgentWalkableSaturationMax, 0, 255, d.WalkableSaturationMax);
        TxtModelPath.LostFocus += (_, _) => _viewModel.RefreshModelStatus();
    }

    private void OnViewModelPropertyChanged(object? sender, PropertyChangedEventArgs e)
    {
        if (e.PropertyName is nameof(D4AgentViewModel.IsRunning) or nameof(D4AgentViewModel.Preview)) UpdateRunningVisuals();
    }

    private void UpdateRunningVisuals()
    {
        IconStartStop.Text = _viewModel.IsRunning ? GlyphStop : GlyphStart;
        LblPreviewEmpty.Visibility = _viewModel.Preview == null ? Visibility.Visible : Visibility.Collapsed;
    }

    private void BtnBrowseVideo_Click(object sender, RoutedEventArgs e)
    {
        var path = PickFile(I18nKeys.D4AgentVideoFilter, TxtVideoPath.Text);
        if (path == null) return;
        TxtVideoPath.Text = path;
        ConfigBinding.SaveString(ConfigKeys.D4AgentVideoPath, path);
    }

    private void BtnBrowseModel_Click(object sender, RoutedEventArgs e)
    {
        var path = PickFile(I18nKeys.D4AgentModelFilter, TxtModelPath.Text);
        if (path == null) return;
        TxtModelPath.Text = path;
        ConfigBinding.SaveString(ConfigKeys.D4AgentModelPath, path);
        _viewModel.RefreshModelStatus();
    }

    private static string? PickFile(string filterKey, string? current)
    {
        var dialog = new OpenFileDialog { Filter = T(filterKey), CheckFileExists = true };
        if (!string.IsNullOrWhiteSpace(current) && Path.GetDirectoryName(current) is { } dir && Directory.Exists(dir)) dialog.InitialDirectory = dir;
        return dialog.ShowDialog() == true ? dialog.FileName : null;
    }

    private void BtnOpenOutput_Click(object sender, RoutedEventArgs e)
    {
        var dir = Path.Combine(D4Constants.TmpDir, D4AgentConstants.OutputDirName);
        Directory.CreateDirectory(dir);
        ShellOpen.OpenDir(dir);
    }

    private void BtnModelTest_Click(object sender, RoutedEventArgs e) => ModelTestWindow.ShowSingle(Window.GetWindow(this), _viewModel.ResolvedModelPath);

    private void BtnClearLog_Click(object sender, RoutedEventArgs e) => TxtLog.Clear();

    private void AddLog(string message)
    {
        lock (_logLock)
        {
            _logBuffer.Add(message);
            if (_logBuffer.Count > MaxBufferedLines) _logBuffer.RemoveRange(0, _logBuffer.Count - MaxBufferedLines);
        }
    }

    /// <summary>Agent lines only; any thread.</summary>
    private void OnColorPrintMessage(string message, string colorType, string? logLevel)
    {
        if (message.Contains(D4AgentConstants.LogTag, StringComparison.Ordinal)) AddLog(message);
    }

    private void DrainLog()
    {
        List<string> copy;
        lock (_logLock)
        {
            if (_logBuffer.Count == 0) return;
            copy = new List<string>(_logBuffer);
            _logBuffer.Clear();
        }
        foreach (var line in copy) TxtLog.AppendText(line + "\n");
        TxtLog.ScrollToEnd();
    }

    private static string T(string key) => D3D4TesterI18n.Provider.GetUiText(key);
}
