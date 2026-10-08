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
using DotApps.d3d4tester.StatusBar;
using DotApps.d3d4tester.Ui;
using DotCore.Utils;
using Microsoft.Win32;

namespace DotApps.d3d4tester.Pages.Monitor;

/// <summary>
/// Monitor tab: the RBAssist features merged into the app, shown without scrolling: a status strip (monitoring = ROSBOT flow, D3 / ROSBOT,
/// log and history idle, restarts, counters, game speed) with the ROSBOT control buttons on top, then one sub-tab each for crash recovery (incl. the ROSBOT log-timeout switch and minutes, startup shortcut),
/// D3 window and process tuning, screenshots, notifications, external tools and probe thresholds, ROSBOT license keys (the active one
/// is written to RoS-BoT.ini before every ROSBOT start), the trigger list with its editor,
/// and the logs (monitor log + ROSBOT log). Settings bind to monitor.* (ROSBOT options to their own keys) through ConfigBinding.
/// </summary>
public partial class MonitorPage : UserControl
{
    private const string StyleSuccessButton = "SuccessButtonStyle";
    private const string StyleDangerButton = "DangerButtonStyle";
    private const string StyleWarningButton = "WarningButtonStyle";
    private const string StyleChip = D3StatusBarDisplayBuilder.ChipNeutralStyleKey;
    private const string StyleChipSuccess = D3StatusBarDisplayBuilder.ChipSuccessStyleKey;
    private const string StyleChipWarning = D3StatusBarDisplayBuilder.ChipWarningStyleKey;
    private const string StyleFieldLabel = "FieldLabelTextStyle";
    private const string StyleMuted = "MutedTextStyle";
    private const string StyleIconButton = "IconButtonStyle";
    private const string GlyphBrowse = "";
    private const string GlyphOpenFolder = "";
    private const string IdleUnknown = "-";
    private const string CounterSeparator = AppConstants.DisplaySeparator;
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
        TxtMonitorLog.Loaded += (_, _) => TxtMonitorLog.ScrollToEnd();
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
        LogTextBoxHelper.SetText(TxtMonitorLog, string.Join(Environment.NewLine, MonitorLog.Snapshot()) + Environment.NewLine);
        TxtMonitorLog.ScrollToEnd();
        MonitorLog.LineAdded -= OnMonitorLogLine;
        MonitorLog.LineAdded += OnMonitorLogLine;
        RosbotKeyService.Applied -= OnRosbotKeyApplied;
        RosbotKeyService.Applied += OnRosbotKeyApplied;
        _statusTimer.Start();
        UpdateStatus();
    }

    private void OnUnloaded(object sender, RoutedEventArgs e)
    {
        _statusTimer.Stop();
        MonitorLog.LineAdded -= OnMonitorLogLine;
        RosbotKeyService.Applied -= OnRosbotKeyApplied;
    }

    /// <summary>All labels, combo display lists, trigger names and status from i18n (Loaded and language change).</summary>
    public void RefreshI18n()
    {
        BtnImportRbAssist.Content = T(I18nKeys.MonitorImportRbAssist);
        TxtLogsWarning.Text = T(I18nKeys.MonitorLogsDisabledWarning);

        NavGroupRun.Header = T(I18nKeys.MonitorNavRun);
        NavGroupAutomation.Header = T(I18nKeys.MonitorNavAutomation);
        NavGroupEnvironment.Header = T(I18nKeys.MonitorNavEnvironment);
        NavGroupDevelopment.Header = T(I18nKeys.MonitorNavDevelopment);
        TabBridge.Header = T(I18nKeys.MonitorGameData);
        TabDecompile.Header = T(I18nKeys.DecompileToolsTitle);
        BridgePanel.RefreshI18n();
        if (DecompileTools.IsLoaded) DecompileTools.RefreshI18n();

        TabRecovery.Header = T(I18nKeys.MonitorRecoveryTitle);
        ChkRestartOnErrorPopup.Content = T(I18nKeys.MonitorRestartOnErrorPopup);
        ChkCloseTeamViewer.Content = T(I18nKeys.MonitorCloseTeamViewer);
        LblTimeoutMode.Text = T(I18nKeys.MonitorLogTimeoutMode);
        TxtTimeoutHint.Text = T(I18nKeys.MonitorTimeoutModeHint);
        ChkD3Memory.Content = T(I18nKeys.MonitorD3MemoryRestart);
        LblMb.Text = T(I18nKeys.MonitorMb);
        ChkRestartBattlenet.Content = T(I18nKeys.MonitorRestartBattlenet);
        ChkAutoStart.Content = T(I18nKeys.MonitorAutoStart);
        ChkTimeoutRestart.Content = T(I18nKeys.RosbotTimeoutRestart);
        LblTimeoutMinutes.Text = T(I18nKeys.RosbotMinutes);
        ChkStartup.Content = T(I18nKeys.RosbotStartup);
        RosbotControl.RefreshI18n();
        RosbotLog.RefreshI18n();
        ChkArchiveRollover.Content = T(I18nKeys.MonitorArchiveRollover);
        LblBridgeTeleport.Text = T(I18nKeys.MonitorBridgeTeleportLabel);
        TxtBridgeTeleport.ToolTip = T(I18nKeys.MonitorBridgeTeleportHint);

        TabWindow.Header = T(I18nKeys.MonitorWindowTitle);
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

        TabScreenshots.Header = T(I18nKeys.MonitorScreenshotsTitle);
        RadioCropFull.Content = T(I18nKeys.MonitorCropFull);
        RadioCropCustom.Content = T(I18nKeys.MonitorCropCustom);
        foreach (var row in _shotRows) row.RefreshText();

        TabNotify.Header = T(I18nKeys.MonitorNotifyTitle);
        LblPushPlus.Text = T(I18nKeys.MonitorPushPlusToken);
        LblTelegramToken.Text = T(I18nKeys.MonitorTelegramToken);
        LblTelegramChat.Text = T(I18nKeys.MonitorTelegramChat);
        LblDiscord.Text = T(I18nKeys.MonitorDiscordWebhook);
        LblProwl.Text = T(I18nKeys.MonitorProwlKey);
        ChkNotifyOnRestart.Content = T(I18nKeys.MonitorNotifyOnRestart);
        BtnNotifyTest.Content = T(I18nKeys.MonitorNotifyTest);
        TxtSecretHint.Text = T(I18nKeys.MonitorSecretHint);

        TabTools.Header = T(I18nKeys.MonitorToolsTitle);
        LblSpeedBridge.Text = T(I18nKeys.MonitorSpeedBridge);
        LblTcpReset.Text = T(I18nKeys.MonitorTcpReset);
        TxtToolsHint.Text = T(I18nKeys.MonitorToolsHint);
        LblProbeFight.Text = T(I18nKeys.MonitorProbeFight);
        LblProbeTownPortal.Text = T(I18nKeys.MonitorProbeTownPortal);
        LblProbeUrshi.Text = T(I18nKeys.MonitorProbeUrshi);
        LblProbeFinish.Text = T(I18nKeys.MonitorProbeFinishIllusion);
        LblProbeFind.Text = T(I18nKeys.MonitorProbeFindIllusion);
        LblPortalKeys.Text = T(I18nKeys.MonitorPortalKeys);

        TabRosbotKey.Header = T(I18nKeys.MonitorRosbotKeyTab);
        LblRosbotKeys.Text = T(I18nKeys.MonitorRosbotKeyKeys);
        BtnRosbotKeyActive.Content = T(I18nKeys.MonitorRosbotKeySetActive);
        BtnRosbotKeyRemove.Content = T(I18nKeys.MonitorRosbotKeyRemove);
        ChkRosbotKeyWrite.Content = T(I18nKeys.MonitorRosbotKeyWriteBeforeStart);
        LblRosbotKeyNew.Text = T(I18nKeys.MonitorRosbotKeyNewKey);
        BtnRosbotKeyAdd.Content = T(I18nKeys.MonitorRosbotKeyAdd);
        BtnRosbotKeyApply.Content = T(I18nKeys.MonitorRosbotKeyApplyNow);
        TxtRosbotKeyHint.Text = T(I18nKeys.MonitorRosbotKeyHint);
        ReloadRosbotKeys();
        TabTriggers.Header = T(I18nKeys.MonitorTriggersTitle);
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
        TabLogs.Header = T(I18nKeys.TabsLog);
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
        ConfigBinding.BindCheckBox(ChkTimeoutRestart, ConfigKeys.BattlenetTimeoutRestart, true);
        ConfigBinding.BindIntTextBox(TxtTimeoutMinutes, ConfigKeys.RosbotTimeoutMinutes, RosbotConstants.RosbotLogTimeoutMinutesMin, RosbotConstants.RosbotLogTimeoutMinutesMax, RosbotConstants.RosbotLogTimeoutMinutesDefault);
        ConfigBinding.BindCheckBox(ChkStartup, ConfigKeys.RosbotStartup);
        ConfigBinding.BindCheckBox(ChkArchiveRollover, ConfigKeys.MonitorArchiveLogRollover);
        ConfigBinding.BindTextBox(TxtBridgeTeleport, ConfigKeys.BridgeTeleportUiSequence, "");

        ConfigBinding.BindCheckBox(ChkD3Shrink, ConfigKeys.MonitorD3ShrinkOnStart);
        ConfigBinding.BindIntTextBox(TxtShrinkWidth, ConfigKeys.MonitorD3ShrinkWidth, MonitorSettings.D3ShrinkMinWidth, ShrinkMaxWidth, MonitorSettings.D3ShrinkWidthDefault);
        ConfigBinding.BindIntTextBox(TxtShrinkHeight, ConfigKeys.MonitorD3ShrinkHeight, MonitorSettings.D3ShrinkMinHeight, ShrinkMaxHeight, MonitorSettings.D3ShrinkHeightDefault);
        ConfigBinding.BindCheckBox(ChkForceSequence, ConfigKeys.MonitorForceSequence);
        ConfigBinding.BindTextBox(TxtSequenceName, ConfigKeys.MonitorForceSequenceName);
        ChkTuning.IsChecked = ConfigBinding.GetValue(ConfigKeys.MonitorTuningEnabled, false);
        ChkTuning.Click += OnTuningClick;
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
        ConfigBinding.BindCheckBox(ChkRosbotKeyWrite, ConfigKeys.MonitorRosbotKeyWriteBeforeStart, true);
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

    /// <summary>RBAssist SHOWADVANCED: confirm the risk before enabling process tuning; monitor.tuning.enabled is written only after Yes (No reverts the box).</summary>
    private void OnTuningClick(object sender, RoutedEventArgs e)
    {
        bool enable = ChkTuning.IsChecked == true;
        if (enable)
        {
            var answer = MessageBox.Show(Window.GetWindow(this), T(I18nKeys.MonitorTuningWarning), T(I18nKeys.MonitorTuningWarningTitle),
                MessageBoxButton.YesNo, MessageBoxImage.Warning);
            if (answer != MessageBoxResult.Yes)
            {
                ChkTuning.IsChecked = false;
                return;
            }
        }
        ConfigBinding.SetValue(ConfigKeys.MonitorTuningEnabled, enable);
    }

    /// <summary>ROSBOT log is the ColorPrint sink while this tab is selected. Called from MainWindow.</summary>
    public void RegisterAsLogTarget() => RosbotLog.RegisterAsLogTarget();

    public void UnregisterAsLogTarget() => RosbotLog.UnregisterAsLogTarget();

    /// <summary>Raised after a ROSBOT update rewrote the path config.</summary>
    public event Action? RosbotPathsChanged
    {
        add => RosbotControl.PathsChanged += value;
        remove => RosbotControl.PathsChanged -= value;
    }

    private void UpdateStatus()
    {
        var snapshot = GameInterfaceData.Instance.GetStateSnapshot();
        var st = MonitorService.Instance.GetStatus(snapshot);
        bool flow = snapshot.RosbotFlowMasterEnabled;
        bool paused = flow && snapshot.RosbotFlowPaused;
        var (monitoringText, monitoringBrush) = D3StatusBarDisplayBuilder.MonitoringStatus(snapshot, D3D4TesterI18n.Provider);
        TxtMonitoring.Text = monitoringText;
        ChipMonitoring.SetResourceReference(StyleProperty, D3StatusBarDisplayBuilder.ChipStyleKeyForBrush(monitoringBrush));
        string d3Process = st.D3Running ? D3StatusBarDisplayBuilder.ProcessText(snapshot.D3ExeName, snapshot.D3Pid) : "";
        string rosbotProcess = st.RosbotOnline ? D3StatusBarDisplayBuilder.ProcessText(snapshot.RosbotFoundExeName, snapshot.RosbotFoundPid) : "";
        TxtD3.Text = T(st.D3Running ? I18nKeys.MonitorD3Running : I18nKeys.MonitorD3NotRunning) + (d3Process.Length > 0 ? CounterSeparator + d3Process : "");
        ChipD3.SetResourceReference(StyleProperty, st.D3Running ? StyleChipSuccess : StyleChip);
        TxtRosbot.Text = T(st.RosbotOnline ? I18nKeys.MonitorRosbotRunning : I18nKeys.MonitorRosbotNotRunning) + (rosbotProcess.Length > 0 ? CounterSeparator + rosbotProcess : "");
        ChipRosbot.SetResourceReference(StyleProperty, D3StatusBarDisplayBuilder.ChipStyleKeyForBrush(D3StatusBarDisplayBuilder.RosbotBrushKey(snapshot.RosbotExtendedStatus)));
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
        BtnPauseMonitoring.Visibility = flow ? Visibility.Visible : Visibility.Collapsed;
        BtnPauseMonitoring.Content = T(paused ? I18nKeys.MonitorResumeMonitoring : I18nKeys.MonitorPauseMonitoring);
        BtnPauseMonitoring.SetResourceReference(StyleProperty, paused ? StyleSuccessButton : StyleWarningButton);
    }

    private static string FormatIdle(double sec) => sec < 0 ? IdleUnknown : sec.ToString("0", CultureInfo.InvariantCulture);

    private void OnMonitorLogLine(string line)
    {
        if (!Dispatcher.CheckAccess())
        {
            Dispatcher.BeginInvoke(DispatcherPriority.Background, () => OnMonitorLogLine(line));
            return;
        }
        LogTextBoxHelper.Append(TxtMonitorLog, line + Environment.NewLine);
    }

    private void BtnToggleMonitoring_Click(object sender, RoutedEventArgs e)
    {
        RosbotTaskProcessor.Instance.ToggleFlow();
        UpdateStatus();
    }

    private void BtnPauseMonitoring_Click(object sender, RoutedEventArgs e)
    {
        RosbotTaskProcessor.Instance.TogglePause();
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

    private static readonly Dictionary<IniSetResult, string> RosbotKeyResultKeys = new()
    {
        [IniSetResult.Unchanged] = I18nKeys.MonitorRosbotKeyResultUnchanged,
        [IniSetResult.Replaced] = I18nKeys.MonitorRosbotKeyResultReplaced,
        [IniSetResult.Inserted] = I18nKeys.MonitorRosbotKeyResultInserted,
        [IniSetResult.FileMissing] = I18nKeys.MonitorRosbotKeyResultFileMissing,
        [IniSetResult.NoAnchor] = I18nKeys.MonitorRosbotKeyResultNoAnchor,
    };

    /// <summary>Key list (masked, active marked), ini path and the last write result.</summary>
    private void ReloadRosbotKeys()
    {
        int selected = LstRosbotKeys.SelectedIndex;
        var keys = RosbotKeyService.Keys;
        int active = RosbotKeyService.ActiveIndex;
        LstRosbotKeys.ItemsSource = keys.Select((k, i) => i == active
            ? string.Format(CultureInfo.InvariantCulture, T(I18nKeys.MonitorRosbotKeyActiveItem), RosbotKeyService.Mask(k))
            : RosbotKeyService.Mask(k)).ToList();
        LstRosbotKeys.SelectedIndex = selected >= 0 && selected < keys.Count ? selected : active;
        TxtRosbotKeyIni.Text = RosbotKeyService.IniPath is { } ini
            ? string.Format(CultureInfo.InvariantCulture, T(I18nKeys.MonitorRosbotKeyIniPath), ini)
            : T(I18nKeys.MonitorRosbotKeyNoRosDir);
        TxtRosbotKeyIni.ToolTip = TxtRosbotKeyIni.Text;
        TxtRosbotKeyStatus.Text = RosbotKeyService.LastApply is { } last
            ? string.Format(CultureInfo.InvariantCulture, T(I18nKeys.MonitorRosbotKeyLastApply),
                last.At.ToString("HH:mm:ss", CultureInfo.InvariantCulture), T(RosbotKeyResultKeys[last.Result]))
            : "";
    }

    private void OnRosbotKeyApplied()
    {
        if (!Dispatcher.CheckAccess())
        {
            Dispatcher.BeginInvoke(DispatcherPriority.Background, OnRosbotKeyApplied);
            return;
        }
        ReloadRosbotKeys();
    }

    private void BtnRosbotKeyAdd_Click(object sender, RoutedEventArgs e)
    {
        if (!RosbotKeyService.Add(PwdRosbotKey.Password))
        {
            MessageBox.Show(Window.GetWindow(this), T(I18nKeys.MonitorRosbotKeyAddFailed), T(I18nKeys.MonitorRosbotKeyTab),
                MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }
        PwdRosbotKey.Clear();
        ReloadRosbotKeys();
    }

    private void PwdRosbotKey_KeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter) BtnRosbotKeyAdd_Click(sender, e);
    }

    private void BtnRosbotKeyActive_Click(object sender, RoutedEventArgs e)
    {
        if (LstRosbotKeys.SelectedIndex < 0) return;
        RosbotKeyService.ActiveIndex = LstRosbotKeys.SelectedIndex;
        ReloadRosbotKeys();
    }

    private void LstRosbotKeys_MouseDoubleClick(object sender, MouseButtonEventArgs e) => BtnRosbotKeyActive_Click(sender, e);

    private void BtnRosbotKeyRemove_Click(object sender, RoutedEventArgs e)
    {
        int index = LstRosbotKeys.SelectedIndex;
        if (index < 0) return;
        var answer = MessageBox.Show(Window.GetWindow(this), T(I18nKeys.MonitorDeleteConfirm), T(I18nKeys.MonitorRosbotKeyRemove),
            MessageBoxButton.YesNo, MessageBoxImage.Question);
        if (answer != MessageBoxResult.Yes) return;
        RosbotKeyService.Remove(index);
        ReloadRosbotKeys();
    }

    private void BtnRosbotKeyApply_Click(object sender, RoutedEventArgs e)
    {
        if (RosbotKeyService.ApplyNow() == null) TxtRosbotKeyStatus.Text = T(I18nKeys.MonitorRosbotKeyResultNotWritten);
    }

    private void BtnClearLog_Click(object sender, RoutedEventArgs e)
    {
        MonitorLog.Clear();
        TxtMonitorLog.Clear();
    }

    private sealed record TriggerRow(string EventName, string EventArgs, string ActionName, string ActionArgs, string EnabledText, string LogText);

    /// <summary>Screenshot settings for one kind on one grid row: enable (+ period for periodic), save-to folder with browse / open, keep count.</summary>
    private sealed class ShotRow
    {
        private const string SharedHead = "ShotHead";
        private const string SharedKeepHint = "ShotKeepHint";
        private readonly string _kind;
        private readonly CheckBox _enabled = new() { VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(0, 0, 6, 0) };
        private readonly TextBox? _minutes;
        private readonly TextBlock? _minutesLabel;
        private readonly TextBlock _saveTo = new() { VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(12, 0, 6, 0) };
        private readonly TextBox _dir = new() { VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(0, 0, 4, 0) };
        private readonly Button _browse = new() { Content = GlyphBrowse, Margin = new Thickness(0, 0, 2, 0) };
        private readonly Button _open = new() { Content = GlyphOpenFolder };
        private readonly TextBlock _keep = new() { VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(12, 0, 6, 0) };
        private readonly TextBox _keepCount = new() { Width = 44, TextAlignment = TextAlignment.Right, VerticalAlignment = VerticalAlignment.Center };
        private readonly TextBlock _keepHint = new() { VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(4, 0, 0, 0) };

        public Grid Root { get; } = new() { Margin = new Thickness(0, 0, 0, 6) };

        public ShotRow(string kind)
        {
            _kind = kind;
            Root.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto, SharedSizeGroup = SharedHead });
            Root.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            Root.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            Root.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            Root.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            Root.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            Root.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            Root.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto, SharedSizeGroup = SharedKeepHint });

            var head = new StackPanel { Orientation = Orientation.Horizontal };
            head.Children.Add(_enabled);
            if (kind == MonitorScreenshotKinds.Periodic)
            {
                _minutes = new TextBox { Width = 44, TextAlignment = TextAlignment.Right, VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(0, 0, 4, 0) };
                _minutesLabel = new TextBlock { VerticalAlignment = VerticalAlignment.Center };
                _minutesLabel.SetResourceReference(StyleProperty, StyleMuted);
                head.Children.Add(_minutes);
                head.Children.Add(_minutesLabel);
            }
            _saveTo.SetResourceReference(StyleProperty, StyleFieldLabel);
            _browse.SetResourceReference(StyleProperty, StyleIconButton);
            _open.SetResourceReference(StyleProperty, StyleIconButton);
            _keep.SetResourceReference(StyleProperty, StyleFieldLabel);
            _keepHint.SetResourceReference(StyleProperty, StyleMuted);
            UIElement[] cells = { head, _saveTo, _dir, _browse, _open, _keep, _keepCount, _keepHint };
            for (int i = 0; i < cells.Length; i++)
            {
                Grid.SetColumn(cells[i], i);
                Root.Children.Add(cells[i]);
            }

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
