// PY-REF: none (DOT-only)
using System.Collections.ObjectModel;
using System.Globalization;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Monitor;
using DotApps.d3d4tester.Ctl;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.Services.Monitor;
using DotApps.d3d4tester.Windows;
using DotCore.Utils;
using Microsoft.Win32;

namespace DotApps.d3d4tester.Pages.Monitor;

/// <summary>
/// Monitor tab: the RBAssist features merged into the app. Status (monitoring = ROSBOT flow, D3 / ROSBOT, log and history idle, restarts,
/// counters, game speed), crash recovery, D3 window and process tuning, screenshots, notifications, external tools and probe thresholds,
/// the trigger list with its editor, and the monitor log. Settings bind to monitor.* through ConfigBinding; options that already existed
/// (log-timeout switch and minutes, startup shortcut) stay on the ROSBOT tab.
/// </summary>
public partial class MonitorPage : UserControl
{
    private const string StyleSuccessButton = "SuccessButtonStyle";
    private const string StyleDangerButton = "DangerButtonStyle";
    private const string StyleChip = "StatusChipStyle";
    private const string StyleChipSuccess = "StatusChipSuccessStyle";
    private const string StyleChipWarning = "StatusChipWarningStyle";
    private const string StyleFieldLabel = "FieldLabelTextStyle";
    private const string StyleMuted = "MutedTextStyle";
    private const string StyleIconButton = "IconButtonStyle";
    private const string GlyphBrowse = "";
    private const string GlyphOpenFolder = "";
    private const string IdleUnknown = "-";
    private const string CounterSeparator = " · ";
    private const int MemoryMbMin = 512;
    private const int MemoryMbMax = 262144;
    private const int ShrinkMaxWidth = 7680;
    private const int ShrinkMaxHeight = 4320;
    private const int KeepMax = 9999;
    private const int MinutesMax = 999;
    private const int ProbeMax = 1000000;
    private static readonly TimeSpan StatusInterval = TimeSpan.FromSeconds(1);

    private readonly DispatcherTimer _statusTimer;
    private readonly ObservableCollection<TriggerRow> _rows = new();
    private readonly List<ShotRow> _shotRows = new();
    private bool _bound;

    public MonitorPage()
    {
        InitializeComponent();
        ListTriggers.ItemsSource = _rows;
        foreach (var kind in MonitorScreenshotKinds.All)
        {
            var row = new ShotRow(kind);
            _shotRows.Add(row);
            PanelShots.Children.Add(row.Root);
        }
        _statusTimer = new DispatcherTimer { Interval = StatusInterval };
        _statusTimer.Tick += (_, _) => UpdateStatus();
        Loaded += OnLoaded;
        Unloaded += OnUnloaded;
    }

    private static string T(string key) => D3D4TesterI18n.Provider.GetUiText(key);

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        D3D4TesterI18n.EnsureInitialized();
        RefreshI18n();
        if (!_bound)
        {
            _bound = true;
            BindSettings();
        }
        TxtMonitorLog.Text = string.Join(Environment.NewLine, MonitorLog.Snapshot()) + Environment.NewLine;
        TxtMonitorLog.ScrollToEnd();
        MonitorLog.LineAdded -= OnMonitorLogLine;
        MonitorLog.LineAdded += OnMonitorLogLine;
        _statusTimer.Start();
        UpdateStatus();
    }

    private void OnUnloaded(object sender, RoutedEventArgs e)
    {
        _statusTimer.Stop();
        MonitorLog.LineAdded -= OnMonitorLogLine;
    }

    /// <summary>All labels, combo display lists, trigger names and status from i18n (Loaded and language change).</summary>
    public void RefreshI18n()
    {
        LblStatusTitle.Text = T(I18nKeys.MonitorStatusTitle);
        BtnImportRbAssist.Content = T(I18nKeys.MonitorImportRbAssist);
        TxtLogsWarning.Text = T(I18nKeys.MonitorLogsDisabledWarning);

        LblRecoveryTitle.Text = T(I18nKeys.MonitorRecoveryTitle);
        ChkRestartOnErrorPopup.Content = T(I18nKeys.MonitorRestartOnErrorPopup);
        ChkCloseTeamViewer.Content = T(I18nKeys.MonitorCloseTeamViewer);
        LblTimeoutMode.Text = T(I18nKeys.MonitorLogTimeoutMode);
        TxtTimeoutHint.Text = T(I18nKeys.MonitorTimeoutModeHint);
        ChkD3Memory.Content = T(I18nKeys.MonitorD3MemoryRestart);
        LblMb.Text = T(I18nKeys.MonitorMb);
        ChkRestartBattlenet.Content = T(I18nKeys.MonitorRestartBattlenet);
        ChkAutoStart.Content = T(I18nKeys.MonitorAutoStart);
        ChkArchiveRollover.Content = T(I18nKeys.MonitorArchiveRollover);

        LblWindowTitle.Text = T(I18nKeys.MonitorWindowTitle);
        ChkD3Shrink.Content = T(I18nKeys.MonitorD3Shrink);
        BtnShrinkNow.Content = T(I18nKeys.MonitorApplyNow);
        ChkForceSequence.Content = T(I18nKeys.MonitorForceSequence);
        ChkTuning.Content = T(I18nKeys.MonitorTuningEnabled);
        LblD3Priority.Text = T(I18nKeys.MonitorD3Priority);
        LblRosbotPriority.Text = T(I18nKeys.MonitorRosbotPriority);
        LblD3Cpus.Text = T(I18nKeys.MonitorD3Cpus);
        LblRosbotCpus.Text = T(I18nKeys.MonitorRosbotCpus);
        TxtCpusHint.Text = string.Format(CultureInfo.InvariantCulture, T(I18nKeys.MonitorCpusHint), Environment.ProcessorCount);
        BtnApplyTuning.Content = T(I18nKeys.MonitorApplyNow);

        LblScreenshotsTitle.Text = T(I18nKeys.MonitorScreenshotsTitle);
        RadioCropFull.Content = T(I18nKeys.MonitorCropFull);
        RadioCropCustom.Content = T(I18nKeys.MonitorCropCustom);
        foreach (var row in _shotRows) row.RefreshText();

        LblNotifyTitle.Text = T(I18nKeys.MonitorNotifyTitle);
        LblPushPlus.Text = T(I18nKeys.MonitorPushPlusToken);
        LblTelegramToken.Text = T(I18nKeys.MonitorTelegramToken);
        LblTelegramChat.Text = T(I18nKeys.MonitorTelegramChat);
        LblDiscord.Text = T(I18nKeys.MonitorDiscordWebhook);
        LblProwl.Text = T(I18nKeys.MonitorProwlKey);
        ChkNotifyOnRestart.Content = T(I18nKeys.MonitorNotifyOnRestart);
        BtnNotifyTest.Content = T(I18nKeys.MonitorNotifyTest);
        TxtSecretHint.Text = T(I18nKeys.MonitorSecretHint);

        LblToolsTitle.Text = T(I18nKeys.MonitorToolsTitle);
        LblSpeedBridge.Text = T(I18nKeys.MonitorSpeedBridge);
        LblTcpReset.Text = T(I18nKeys.MonitorTcpReset);
        TxtToolsHint.Text = T(I18nKeys.MonitorToolsHint);
        LblProbeFight.Text = T(I18nKeys.MonitorProbeFight);
        LblProbeTownPortal.Text = T(I18nKeys.MonitorProbeTownPortal);
        LblProbeUrshi.Text = T(I18nKeys.MonitorProbeUrshi);
        LblProbeFinish.Text = T(I18nKeys.MonitorProbeFinishIllusion);
        LblProbeFind.Text = T(I18nKeys.MonitorProbeFindIllusion);
        LblPortalKeys.Text = T(I18nKeys.MonitorPortalKeys);

        LblTriggersTitle.Text = T(I18nKeys.MonitorTriggersTitle);
        TxtTriggersInfo.Text = T(I18nKeys.MonitorTriggersInfo);
        ColEvent.Header = T(I18nKeys.MonitorColEvent);
        ColEventArg.Header = T(I18nKeys.MonitorColEventArg);
        ColAction.Header = T(I18nKeys.MonitorColAction);
        ColActionArg.Header = T(I18nKeys.MonitorColActionArg);
        ColEnabled.Header = T(I18nKeys.MonitorColEnabled);
        ColLog.Header = T(I18nKeys.MonitorColLog);
        BtnNewTrigger.Content = T(I18nKeys.MonitorNew);
        BtnEditTrigger.Content = T(I18nKeys.MonitorEdit);
        BtnToggleTrigger.Content = T(I18nKeys.MonitorToggle);
        BtnRunTrigger.Content = T(I18nKeys.MonitorRun);
        BtnDeleteTrigger.Content = T(I18nKeys.MonitorDelete);
        BtnImportTriggers.Content = T(I18nKeys.MonitorImport);
        BtnExportTriggers.Content = T(I18nKeys.MonitorExport);
        LblLogTitle.Text = T(I18nKeys.MonitorLogTitle);
        BtnClearLog.Content = T(I18nKeys.MonitorClear);

        FillCombo(CmbTimeoutMode, MonitorLogTimeoutModes.All.Select(m => T(I18nKeys.MonitorTimeoutModePrefix + m)));
        var priorities = ProcessTuning.PriorityNames.Select(n => T(I18nKeys.MonitorPriorityPrefix + n)).ToList();
        FillCombo(CmbD3Priority, priorities);
        FillCombo(CmbRosbotPriority, priorities);
        FillCombo(CmbRestartChannel, MonitorNotifyChannels.Values.Select(TriggerCatalog.ChannelName));
        ReloadTriggers();
        UpdateStatus();
    }

    /// <summary>Replace display items keeping the selected index (BindComboBox maps index to the config value).</summary>
    private static void FillCombo(ComboBox combo, IEnumerable<string> items)
    {
        int index = combo.SelectedIndex;
        combo.ItemsSource = items.ToList();
        if (index >= 0) combo.SelectedIndex = index;
    }

    private void BindSettings()
    {
        ConfigBinding.BindCheckBox(ChkRestartOnErrorPopup, ConfigKeys.MonitorRestartOnErrorPopup);
        ConfigBinding.BindCheckBox(ChkCloseTeamViewer, ConfigKeys.MonitorCloseTeamViewerPopups);
        ConfigBinding.BindComboBox(CmbTimeoutMode, ConfigKeys.MonitorLogTimeoutMode, MonitorLogTimeoutModes.All, MonitorLogTimeoutModes.LogOnly);
        ConfigBinding.BindCheckBox(ChkD3Memory, ConfigKeys.MonitorD3MemoryRestart);
        ConfigBinding.BindIntTextBox(TxtD3MemoryMb, ConfigKeys.MonitorD3MemoryLimitMb, MemoryMbMin, MemoryMbMax, MonitorSettings.D3MemoryLimitMbDefault);
        ConfigBinding.BindCheckBox(ChkRestartBattlenet, ConfigKeys.MonitorRestartBattlenetOnRestart);
        ConfigBinding.BindCheckBox(ChkAutoStart, ConfigKeys.MonitorAutoStartOnLaunch);
        ConfigBinding.BindCheckBox(ChkArchiveRollover, ConfigKeys.MonitorArchiveLogRollover);

        ConfigBinding.BindCheckBox(ChkD3Shrink, ConfigKeys.MonitorD3ShrinkOnStart);
        ConfigBinding.BindIntTextBox(TxtShrinkWidth, ConfigKeys.MonitorD3ShrinkWidth, MonitorSettings.D3ShrinkMinWidth, ShrinkMaxWidth, MonitorSettings.D3ShrinkWidthDefault);
        ConfigBinding.BindIntTextBox(TxtShrinkHeight, ConfigKeys.MonitorD3ShrinkHeight, MonitorSettings.D3ShrinkMinHeight, ShrinkMaxHeight, MonitorSettings.D3ShrinkHeightDefault);
        ConfigBinding.BindCheckBox(ChkForceSequence, ConfigKeys.MonitorForceSequence);
        ConfigBinding.BindTextBox(TxtSequenceName, ConfigKeys.MonitorForceSequenceName);
        ConfigBinding.BindCheckBox(ChkTuning, ConfigKeys.MonitorTuningEnabled);
        ChkTuning.Checked += OnTuningChecked;
        ChkTuning.Checked += (_, _) => GridTuning.IsEnabled = true;
        ChkTuning.Unchecked += (_, _) => GridTuning.IsEnabled = false;
        GridTuning.IsEnabled = ChkTuning.IsChecked == true;
        ConfigBinding.BindComboBox(CmbD3Priority, ConfigKeys.MonitorTuningD3Priority, ProcessTuning.PriorityNames, ProcessTuning.PriorityNormal);
        ConfigBinding.BindComboBox(CmbRosbotPriority, ConfigKeys.MonitorTuningRosbotPriority, ProcessTuning.PriorityNames, ProcessTuning.PriorityNormal);
        ConfigBinding.BindTextBox(TxtD3Cpus, ConfigKeys.MonitorTuningD3Cpus);
        ConfigBinding.BindTextBox(TxtRosbotCpus, ConfigKeys.MonitorTuningRosbotCpus);

        foreach (var row in _shotRows) row.Bind();
        bool custom = MonitorSettings.GetBool(ConfigKeys.MonitorScreenshotCropCustom);
        RadioCropCustom.IsChecked = custom;
        RadioCropFull.IsChecked = !custom;
        RadioCropCustom.Checked += (_, _) => ConfigBinding.SetValue(ConfigKeys.MonitorScreenshotCropCustom, true);
        RadioCropFull.Checked += (_, _) => ConfigBinding.SetValue(ConfigKeys.MonitorScreenshotCropCustom, false);
        ConfigBinding.BindTextBox(TxtCrop, ConfigKeys.MonitorScreenshotCrop, MonitorSettings.CropDefault);

        BindSecret(PwdPushPlus, ConfigKeys.MonitorNotifyPushPlusToken);
        BindSecret(PwdTelegramToken, ConfigKeys.MonitorNotifyTelegramToken);
        BindSecret(PwdDiscord, ConfigKeys.MonitorNotifyDiscordWebhook);
        BindSecret(PwdProwl, ConfigKeys.MonitorNotifyProwlApiKey);
        ConfigBinding.BindTextBox(TxtTelegramChat, ConfigKeys.MonitorNotifyTelegramChatId);
        ConfigBinding.BindCheckBox(ChkNotifyOnRestart, ConfigKeys.MonitorNotifyOnRestart);
        ConfigBinding.BindComboBox(CmbRestartChannel, ConfigKeys.MonitorNotifyRestartChannel, MonitorNotifyChannels.Values, MonitorNotifyChannels.All);

        ConfigBinding.BindTextBox(TxtSpeedBridge, ConfigKeys.MonitorToolsSpeedBridgePath);
        ConfigBinding.BindTextBox(TxtTcpReset, ConfigKeys.MonitorToolsTcpResetPath);
        ConfigBinding.BindIntTextBox(TxtProbeFight, ConfigKeys.MonitorProbeFight, 0, ProbeMax, MonitorSettings.FightThresholdDefault);
        ConfigBinding.BindIntTextBox(TxtProbeTownPortal, ConfigKeys.MonitorProbeTownPortal, 0, ProbeMax, MonitorSettings.TownPortalThresholdDefault);
        ConfigBinding.BindTextBox(TxtProbeUrshi, ConfigKeys.MonitorProbeUrshi, MonitorSettings.UrshiDefault);
        ConfigBinding.BindTextBox(TxtProbeFinish, ConfigKeys.MonitorProbeFinishIllusion, MonitorSettings.FinishIllusionDefault);
        ConfigBinding.BindTextBox(TxtProbeFind, ConfigKeys.MonitorProbeFindIllusion, MonitorSettings.FindIllusionDefault);
        ConfigBinding.BindTextBox(TxtPortalKeys, ConfigKeys.MonitorProbePortalKeys);
    }

    private static void BindSecret(PasswordBox box, string key)
    {
        box.Password = MonitorSettings.GetSecret(key);
        box.LostFocus += (_, _) =>
        {
            if (box.Password != MonitorSettings.GetSecret(key))
                MonitorSettings.SetSecret(key, box.Password.Trim());
        };
    }

    /// <summary>RBAssist SHOWADVANCED: confirm the risk before enabling process tuning.</summary>
    private void OnTuningChecked(object sender, RoutedEventArgs e)
    {
        if (!IsLoaded) return;
        var answer = MessageBox.Show(Window.GetWindow(this), T(I18nKeys.MonitorTuningWarning), T(I18nKeys.MonitorTuningWarningTitle),
            MessageBoxButton.YesNo, MessageBoxImage.Warning);
        if (answer != MessageBoxResult.Yes) ChkTuning.IsChecked = false;
    }

    private void UpdateStatus()
    {
        var st = MonitorService.Instance.GetStatus();
        bool flow = GameInterfaceData.Instance.GetStateSnapshot().RosbotFlowMasterEnabled;
        TxtMonitoring.Text = T(flow ? I18nKeys.MonitorMonitoringOn : I18nKeys.MonitorMonitoringOff);
        ChipMonitoring.SetResourceReference(StyleProperty, flow ? StyleChipSuccess : StyleChip);
        TxtD3.Text = T(st.D3Running ? I18nKeys.MonitorD3Running : I18nKeys.MonitorD3NotRunning);
        ChipD3.SetResourceReference(StyleProperty, st.D3Running ? StyleChipSuccess : StyleChip);
        TxtRosbot.Text = T(st.RosbotOnline ? I18nKeys.MonitorRosbotRunning : I18nKeys.MonitorRosbotNotRunning);
        ChipRosbot.SetResourceReference(StyleProperty, st.RosbotOnline ? StyleChipSuccess : StyleChip);
        TxtLogIdle.Text = string.Format(CultureInfo.InvariantCulture, T(I18nKeys.MonitorLogIdle), FormatIdle(st.LogIdleSec));
        TxtHistoryIdle.Text = string.Format(CultureInfo.InvariantCulture, T(I18nKeys.MonitorHistoryIdle), FormatIdle(st.HistoryIdleSec));
        TxtRestarts.Text = string.Format(CultureInfo.InvariantCulture, T(I18nKeys.MonitorRestarts), st.Restarts);
        TxtCounters.Text = string.Format(CultureInfo.InvariantCulture, T(I18nKeys.MonitorCounters), st.Deaths, st.Fails, st.Runs);
        ChipSpeed.Visibility = st.SpeedFactor == null ? Visibility.Collapsed : Visibility.Visible;
        TxtSpeed.Text = string.Format(CultureInfo.InvariantCulture, T(I18nKeys.MonitorSpeed), st.SpeedFactor)
            + (st.InCombat ? CounterSeparator + T(I18nKeys.MonitorCombat) : "");
        ChipSpeed.SetResourceReference(StyleProperty, st.InCombat ? StyleChipWarning : StyleChip);
        TxtLastLog.Text = st.LastLogLine.Length == 0 ? "" : $"{T(I18nKeys.MonitorLastLog)}: {st.LastLogLine}";
        ChipLogsWarning.Visibility = st.LogsDisabled ? Visibility.Visible : Visibility.Collapsed;
        BtnToggleMonitoring.Content = T(flow ? I18nKeys.MonitorStopMonitoring : I18nKeys.MonitorStartMonitoring);
        BtnToggleMonitoring.SetResourceReference(StyleProperty, flow ? StyleDangerButton : StyleSuccessButton);
    }

    private static string FormatIdle(double sec) => sec < 0 ? IdleUnknown : sec.ToString("0", CultureInfo.InvariantCulture);

    private void OnMonitorLogLine(string line)
    {
        if (!Dispatcher.CheckAccess())
        {
            Dispatcher.BeginInvoke(DispatcherPriority.Background, () => OnMonitorLogLine(line));
            return;
        }
        TxtMonitorLog.AppendText(line + Environment.NewLine);
        TxtMonitorLog.ScrollToEnd();
    }

    private void BtnToggleMonitoring_Click(object sender, RoutedEventArgs e)
    {
        RosbotTaskProcessor.Instance.ToggleFlow();
        UpdateStatus();
    }

    private void BtnImportRbAssist_Click(object sender, RoutedEventArgs e)
    {
        string? initial = RbAssistSettingsImporter.FindDefaultSettingsFile();
        var dlg = new OpenFileDialog
        {
            Title = T(I18nKeys.MonitorImportRbAssist),
            Filter = T(I18nKeys.MonitorImportRbAssistFilter),
            FileName = RbAssistSettingsImporter.SettingsFileName,
            InitialDirectory = initial != null ? Path.GetDirectoryName(initial) ?? "" : ""
        };
        if (dlg.ShowDialog(Window.GetWindow(this)) != true) return;
        var result = RbAssistSettingsImporter.Import(dlg.FileName);
        ReloadTriggers();
        MessageBox.Show(Window.GetWindow(this),
            string.Format(CultureInfo.InvariantCulture, T(I18nKeys.MonitorImportRbAssistDone), result.Settings, result.Triggers, result.SkippedTriggers),
            T(I18nKeys.MonitorImportRbAssist), MessageBoxButton.OK, MessageBoxImage.Information);
    }

    private void BtnShrinkNow_Click(object sender, RoutedEventArgs e) => _ = Task.Run(GameWindowActions.ShrinkD3);

    private void BtnApplyTuning_Click(object sender, RoutedEventArgs e) => _ = Task.Run(MonitorService.Instance.ApplyTuningNow);

    private async void BtnNotifyTest_Click(object sender, RoutedEventArgs e)
    {
        BtnNotifyTest.IsEnabled = false;
        try
        {
            string channel = MonitorSettings.GetString(ConfigKeys.MonitorNotifyRestartChannel, MonitorNotifyChannels.All);
            await NotificationService.SendAsync(channel, T(I18nKeys.MainWindowTitle), T(I18nKeys.MonitorNotifyTestMessage));
        }
        finally
        {
            BtnNotifyTest.IsEnabled = true;
        }
    }

    private void BtnBrowseSpeedBridge_Click(object sender, RoutedEventArgs e) => BrowseExe(TxtSpeedBridge, ConfigKeys.MonitorToolsSpeedBridgePath);

    private void BtnBrowseTcpReset_Click(object sender, RoutedEventArgs e) => BrowseExe(TxtTcpReset, ConfigKeys.MonitorToolsTcpResetPath);

    private void BrowseExe(TextBox box, string key)
    {
        var dlg = new OpenFileDialog { CheckFileExists = true, FileName = box.Text };
        if (dlg.ShowDialog(Window.GetWindow(this)) != true) return;
        box.Text = dlg.FileName;
        ConfigBinding.SaveString(key, dlg.FileName);
    }

    private void ReloadTriggers()
    {
        int selected = ListTriggers.SelectedIndex;
        _rows.Clear();
        string yes = T(I18nKeys.MonitorYes), no = T(I18nKeys.MonitorNo);
        foreach (var t in TriggerEngine.Instance.Triggers)
        {
            _rows.Add(new TriggerRow(
                TriggerCatalog.EventName(t.Event), TriggerCatalog.EventArgSummary(t),
                TriggerCatalog.ActionName(t.Action), TriggerCatalog.ActionArgSummary(t),
                t.Enabled ? yes : no, t.Log ? yes : no));
        }
        if (selected >= 0 && selected < _rows.Count) ListTriggers.SelectedIndex = selected;
    }

    private void EditTrigger(int index)
    {
        var list = TriggerEngine.Instance.Triggers.ToList();
        bool isNew = index < 0 || index >= list.Count;
        var dlg = new TriggerEditDialog(isNew ? null : list[index]) { Owner = Window.GetWindow(this) };
        if (dlg.ShowDialog() != true) return;
        if (isNew) list.Add(dlg.Result);
        else list[index] = dlg.Result;
        TriggerEngine.Instance.Save(list);
        ReloadTriggers();
        ListTriggers.SelectedIndex = isNew ? list.Count - 1 : index;
    }

    private void BtnNewTrigger_Click(object sender, RoutedEventArgs e) => EditTrigger(-1);

    private void BtnEditTrigger_Click(object sender, RoutedEventArgs e)
    {
        if (ListTriggers.SelectedIndex >= 0) EditTrigger(ListTriggers.SelectedIndex);
    }

    private void ListTriggers_MouseDoubleClick(object sender, MouseButtonEventArgs e)
    {
        if (ListTriggers.SelectedIndex >= 0) EditTrigger(ListTriggers.SelectedIndex);
    }

    private void BtnToggleTrigger_Click(object sender, RoutedEventArgs e)
    {
        int index = ListTriggers.SelectedIndex;
        var list = TriggerEngine.Instance.Triggers.ToList();
        if (index < 0 || index >= list.Count) return;
        list[index].Enabled = !list[index].Enabled;
        TriggerEngine.Instance.Save(list);
        ReloadTriggers();
    }

    private void BtnRunTrigger_Click(object sender, RoutedEventArgs e)
    {
        int index = ListTriggers.SelectedIndex;
        var list = TriggerEngine.Instance.Triggers;
        if (index >= 0 && index < list.Count) TriggerEngine.Instance.Enqueue(list[index]);
    }

    private void BtnDeleteTrigger_Click(object sender, RoutedEventArgs e)
    {
        int index = ListTriggers.SelectedIndex;
        var list = TriggerEngine.Instance.Triggers.ToList();
        if (index < 0 || index >= list.Count) return;
        var answer = MessageBox.Show(Window.GetWindow(this), T(I18nKeys.MonitorDeleteConfirm), T(I18nKeys.MonitorDelete),
            MessageBoxButton.YesNo, MessageBoxImage.Question);
        if (answer != MessageBoxResult.Yes) return;
        list.RemoveAt(index);
        TriggerEngine.Instance.Save(list);
        ReloadTriggers();
    }

    /// <summary>Import trigger rows from the clipboard (one per line: our JSON or RBAssist strings).</summary>
    private void BtnImportTriggers_Click(object sender, RoutedEventArgs e)
    {
        var answer = MessageBox.Show(Window.GetWindow(this), T(I18nKeys.MonitorImportPrompt), T(I18nKeys.MonitorImportPromptTitle),
            MessageBoxButton.OKCancel, MessageBoxImage.Question);
        if (answer != MessageBoxResult.OK) return;
        string text = Clipboard.ContainsText() ? Clipboard.GetText() : "";
        var (added, skipped) = RbAssistSettingsImporter.ImportTriggers(text.Split('\n'));
        ReloadTriggers();
        MessageBox.Show(Window.GetWindow(this), string.Format(CultureInfo.InvariantCulture, T(I18nKeys.MonitorImportResult), added, skipped),
            T(I18nKeys.MonitorImportPromptTitle), MessageBoxButton.OK, MessageBoxImage.Information);
    }

    /// <summary>Copy the selected trigger (or all when none is selected) to the clipboard, one JSON line each.</summary>
    private void BtnExportTriggers_Click(object sender, RoutedEventArgs e)
    {
        var list = TriggerEngine.Instance.Triggers;
        int index = ListTriggers.SelectedIndex;
        var export = index >= 0 && index < list.Count ? new[] { list[index] } : list;
        if (export.Count == 0) return;
        Clipboard.SetText(string.Join(Environment.NewLine, export.Select(t => t.ToJson())));
        MessageBox.Show(Window.GetWindow(this), T(I18nKeys.MonitorExportDone), T(I18nKeys.MonitorExport), MessageBoxButton.OK, MessageBoxImage.Information);
    }

    private void BtnClearLog_Click(object sender, RoutedEventArgs e)
    {
        MonitorLog.Clear();
        TxtMonitorLog.Clear();
    }

    private sealed record TriggerRow(string EventName, string EventArgs, string ActionName, string ActionArgs, string EnabledText, string LogText);

    /// <summary>Screenshot settings row for one kind: enable (+ period for periodic), folder with browse / open, keep count.</summary>
    private sealed class ShotRow
    {
        private readonly string _kind;
        private readonly CheckBox _enabled = new() { VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(0, 0, 8, 0) };
        private readonly TextBox? _minutes;
        private readonly TextBlock? _minutesLabel;
        private readonly TextBlock _saveTo = new() { VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(20, 0, 12, 0) };
        private readonly TextBox _dir = new() { Margin = new Thickness(0, 0, 8, 0) };
        private readonly Button _browse = new() { Content = GlyphBrowse, Margin = new Thickness(0, 0, 4, 0) };
        private readonly Button _open = new() { Content = GlyphOpenFolder };
        private readonly TextBlock _keep = new() { VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(20, 0, 8, 0) };
        private readonly TextBox _keepCount = new() { Width = 52, TextAlignment = TextAlignment.Right, VerticalAlignment = VerticalAlignment.Center };
        private readonly TextBlock _keepHint = new() { VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(4, 0, 0, 0) };

        public StackPanel Root { get; } = new() { Margin = new Thickness(0, 0, 0, 10) };

        public ShotRow(string kind)
        {
            _kind = kind;
            var head = new WrapPanel { Margin = new Thickness(0, 0, 0, 4) };
            head.Children.Add(_enabled);
            if (kind == MonitorScreenshotKinds.Periodic)
            {
                _minutes = new TextBox { Width = 52, TextAlignment = TextAlignment.Right, VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(0, 0, 4, 0) };
                _minutesLabel = new TextBlock { VerticalAlignment = VerticalAlignment.Center };
                _minutesLabel.SetResourceReference(StyleProperty, StyleMuted);
                head.Children.Add(_minutes);
                head.Children.Add(_minutesLabel);
            }
            Root.Children.Add(head);

            var dirRow = new DockPanel { Margin = new Thickness(0, 0, 0, 4) };
            _saveTo.SetResourceReference(StyleProperty, StyleFieldLabel);
            _browse.SetResourceReference(StyleProperty, StyleIconButton);
            _open.SetResourceReference(StyleProperty, StyleIconButton);
            DockPanel.SetDock(_saveTo, Dock.Left);
            DockPanel.SetDock(_open, Dock.Right);
            DockPanel.SetDock(_browse, Dock.Right);
            dirRow.Children.Add(_saveTo);
            dirRow.Children.Add(_open);
            dirRow.Children.Add(_browse);
            dirRow.Children.Add(_dir);
            Root.Children.Add(dirRow);

            var keepRow = new StackPanel { Orientation = Orientation.Horizontal };
            _keep.SetResourceReference(StyleProperty, StyleFieldLabel);
            _keepHint.SetResourceReference(StyleProperty, StyleMuted);
            keepRow.Children.Add(_keep);
            keepRow.Children.Add(_keepCount);
            keepRow.Children.Add(_keepHint);
            Root.Children.Add(keepRow);

            _browse.Click += (_, _) =>
            {
                var dlg = new OpenFolderDialog { Title = _saveTo.Text, InitialDirectory = MonitorSettings.ScreenshotDir(_kind) };
                if (dlg.ShowDialog(Window.GetWindow(Root)) != true) return;
                _dir.Text = dlg.FolderName;
                ConfigBinding.SaveString(ConfigKeys.MonitorScreenshotKey(_kind, ConfigKeys.MonitorScreenshotDirSuffix), dlg.FolderName);
            };
            _open.Click += (_, _) =>
            {
                string dir = MonitorSettings.ScreenshotDir(_kind);
                Directory.CreateDirectory(dir);
                ShellOpen.OpenDir(dir);
            };
        }

        public void Bind()
        {
            ConfigBinding.BindCheckBox(_enabled, ConfigKeys.MonitorScreenshotKey(_kind, ConfigKeys.MonitorScreenshotEnabledSuffix));
            ConfigBinding.BindTextBox(_dir, ConfigKeys.MonitorScreenshotKey(_kind, ConfigKeys.MonitorScreenshotDirSuffix));
            ConfigBinding.BindIntTextBox(_keepCount, ConfigKeys.MonitorScreenshotKey(_kind, ConfigKeys.MonitorScreenshotKeepSuffix), 0, KeepMax, 0);
            if (_minutes != null)
                ConfigBinding.BindIntTextBox(_minutes, ConfigKeys.MonitorScreenshotPeriodicMinutes, 1, MinutesMax, MonitorSettings.PeriodicMinutesDefault);
        }

        public void RefreshText()
        {
            _enabled.Content = D3D4TesterI18n.Provider.GetUiText(I18nKeys.MonitorShotPrefix + _kind);
            if (_minutesLabel != null) _minutesLabel.Text = T(I18nKeys.MonitorMinutes);
            _saveTo.Text = T(I18nKeys.MonitorSaveTo);
            _keep.Text = T(I18nKeys.MonitorKeep);
            _keepHint.Text = T(I18nKeys.MonitorKeepHint);
            _browse.ToolTip = T(I18nKeys.MonitorBrowse);
            _open.ToolTip = T(I18nKeys.MonitorOpenFolder);
            _dir.ToolTip = string.Format(CultureInfo.InvariantCulture, T(I18nKeys.MonitorDefaultDir), MonitorSettings.DefaultScreenshotDir(_kind));
        }
    }
}
