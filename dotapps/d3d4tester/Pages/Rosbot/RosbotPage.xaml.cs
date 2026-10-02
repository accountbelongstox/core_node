// PY-REF: pyapps/d3-check/ui/panels/rosbot_extension_panel.py
// PY-REF: pyapps/d3-check/timers/one_shot_tasks.py
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Config.Options;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Ctl;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Battlenet;
using DotApps.d3d4tester.Pages.RunLog;
using DotApps.d3d4tester.Services;
using DotApps.d3d4tester.Windows;
using DotApps.d3d4tester.ViewModels;
using DotCore.Foundations;
using DotCore.UIInspect;
using DotCore.Utils;
using Microsoft.Win32;

namespace DotApps.d3d4tester.Pages.Rosbot;

/// <summary>
/// ROSBOT tab: paths, bot settings, control buttons and the ROSBOT log (header: last-log age, latency, debug-latency switch, open logs.txt).
/// 1:1 Python ui/panels/rosbot_extension_panel.py.
/// </summary>
public partial class RosbotPage : UserControl
{
    private const string StyleSuccessButton = "SuccessButtonStyle";
    private const string StyleDangerButton = "DangerButtonStyle";
    private const string StyleWarningButton = "WarningButtonStyle";
    private const string StyleSecondaryButton = "SecondaryButtonStyle";
    private const string LatencyTagStart = "[ROSBOT~";
    private const string LatencyTagEnd = "s]";
    private const int SettingMin = 1;
    private const int SettingMax = 120;
    private const double SecondsPerMinute = 60.0;
    private static readonly string[] LogAcceptMarkers = { "[ROSBOT]", "[PathScan]", "LogAnalyzer" };
    private static readonly TimeSpan LogStatusTickInterval = TimeSpan.FromSeconds(1);

    private bool _loading;
    private bool _bound;
    private readonly DispatcherTimer _logStatusTimer;
    private DateTime? _lastLogUtc;
    private double? _lastLatencySec;

    public RosbotPage()
    {
        InitializeComponent();
        DataContext = new RosbotViewModel();
        _logStatusTimer = new DispatcherTimer { Interval = LogStatusTickInterval };
        _logStatusTimer.Tick += (_, _) => UpdateLogStatusDisplay();
        Loaded += OnLoaded;
        Unloaded += OnUnloaded;
    }

    /// <summary>Refresh all labels from i18n (same keys as Python rosbot panel). Call from Loaded and when language changes.</summary>
    public void RefreshRosbotUiText()
    {
        var p = D3D4TesterI18n.Provider;
        LblPathSettings.Text = p.GetUiText(I18nKeys.RosbotPathSettings);
        LblRosbotPath.Text = p.GetUiText(I18nKeys.RosbotRosbotPath);
        LblBattlenetPath.Text = p.GetUiText(I18nKeys.RosbotBattlenetPath);
        LblD3Path.Text = p.GetUiText(I18nKeys.RosbotD3Path);
        BtnBrowseRosbot.ToolTip = p.GetUiText(I18nKeys.RosbotSelectRosbotDirectory);
        BtnBrowseBattlenet.ToolTip = p.GetUiText(I18nKeys.RosbotSelectBattlenetExecutable);
        BtnBrowseD3.ToolTip = p.GetUiText(I18nKeys.RosbotSelectD3Executable);
        LblBotSettings.Text = p.GetUiText(I18nKeys.RosbotBotSettings);
        ChkAutoEnableLatestRos.Content = p.GetUiText(I18nKeys.RosbotAutoEnableLatestRos);
        ChkBluePortalPriority.Content = p.GetUiText(I18nKeys.RosbotBluePortalPriority);
        ChkFirstbornBlueGateReuse.Content = p.GetUiText(I18nKeys.RosbotFirstbornBlueGateReuse);
        ChkPickupBloodShards.Content = p.GetUiText(I18nKeys.RosbotPickupBloodShards);
        ChkSmartEcho.Content = p.GetUiText(I18nKeys.RosbotSmartEcho);
        LblSeconds.Text = p.GetUiText(I18nKeys.RosbotSeconds);
        ChkTestMode.Content = p.GetUiText(I18nKeys.RosbotTestMode);
        LblMinutes1.Text = p.GetUiText(I18nKeys.RosbotMinutes);
        ChkPreventStuck.Content = p.GetUiText(I18nKeys.RosbotPreventStuck);
        ChkStartup.Content = p.GetUiText(I18nKeys.RosbotStartup);
        TxtTimeoutRestart.Text = p.GetUiText(I18nKeys.RosbotTimeoutRestart);
        LblMinutes2.Text = p.GetUiText(I18nKeys.RosbotMinutes);
        LblControlPanel.Text = p.GetUiText(I18nKeys.RosbotControlPanel);
        BtnUpdateRosbot.Content = p.GetUiText(I18nKeys.RosbotUpdateRosbot);
        BtnOpenTampermonkey.Content = p.GetUiText(I18nKeys.RosbotOpenTampermonkeyScript);
        BtnSetAccountPassword.Content = p.GetUiText(I18nKeys.RosbotSetAccountPassword);
        LblRosbotLog.Text = p.GetUiText(I18nKeys.RosbotRosbotLog);
        ChkDebugLogLatency.Content = p.GetUiText(I18nKeys.LogPanelDebugLogLatency);
        TxtOpenLogFile.Text = p.GetUiText(I18nKeys.RosbotOpenLogFile);
        MiCopyLog.Header = p.GetUiText(I18nKeys.RosbotCopy);
        UpdateRosbotControlFromState();
        UpdateLogStatusDisplay();
    }

    /// <summary>Set Ensure Battle.net button text to "on" or default. Call when ensure_battlenet_only state changes.</summary>
    public void SetEnsureBattlenetButtonText(bool isOn)
    {
        var p = D3D4TesterI18n.Provider;
        BtnEnsureBattlenet.Content = isOn ? p.GetUiText(I18nKeys.RosbotEnsureBattlenetOnlyOn) : p.GetUiText(I18nKeys.RosbotEnsureBattlenetOnly);
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        _loading = true;
        D3D4TesterI18n.EnsureInitialized();
        if (!_bound)
        {
            _bound = true;
            BindSettings();
        }
        RefreshRosbotUiText();
        GameInterfaceData.Instance.RegisterCallback(OnGameStateSnapshot);
        _logStatusTimer.Start();
        UpdateRosbotControlFromState();
        _loading = false;
    }

    /// <summary>Bind every setting to its config key (1:1 Python ROSBOT_PANEL_CONFIG_KEYS defaults and spinbox ranges 1..120).</summary>
    private void BindSettings()
    {
        ConfigBinding.BindTextBox(TxtRosDirectory, ConfigKeys.RosSettingsRosDirectory);
        ConfigBinding.BindTextBox(TxtBattlenetPath, ConfigKeys.BattlenetPath);
        ConfigBinding.BindTextBox(TxtD3Path, ConfigKeys.D3Path);
        ConfigBinding.BindCheckBox(ChkAutoEnableLatestRos, ConfigKeys.RosSettingsAutoEnableLatestRos, true);
        ConfigBinding.BindCheckBox(ChkBluePortalPriority, ConfigKeys.RosbotBluePortalPriority);
        ConfigBinding.BindCheckBox(ChkFirstbornBlueGateReuse, ConfigKeys.RosbotFirstbornBlueGateReuse);
        ConfigBinding.BindCheckBox(ChkPickupBloodShards, ConfigKeys.RosbotPickupBloodShards);
        ConfigBinding.BindCheckBox(ChkSmartEcho, ConfigKeys.RosbotSmartEcho);
        ConfigBinding.BindIntTextBox(TxtSmartEchoWaitSeconds, ConfigKeys.RosbotSmartEchoWaitSeconds, SettingMin, SettingMax, AppConstants.RosbotSmartEchoWaitSecondsDefault);
        ConfigBinding.BindCheckBox(ChkTestMode, ConfigKeys.RosbotTestMode);
        ConfigBinding.BindIntTextBox(TxtTestTimeoutMinutes, ConfigKeys.RosbotTestTimeoutMinutes, SettingMin, SettingMax, AppConstants.RosbotTestTimeoutMinutesDefault);
        ConfigBinding.BindCheckBox(ChkPreventStuck, ConfigKeys.RosbotPreventStuck);
        ConfigBinding.BindCheckBox(ChkStartup, ConfigKeys.RosbotStartup);
        ConfigBinding.BindCheckBox(ChkTimeoutRestart, ConfigKeys.BattlenetTimeoutRestart, true);
        ConfigBinding.BindIntTextBox(TxtTimeoutMinutes, ConfigKeys.RosbotTimeoutMinutes, SettingMin, SettingMax, AppConstants.RosbotTimeoutMinutesDefault);
        ConfigBinding.BindCheckBox(ChkDebugLogLatency, ConfigKeys.LogSettingsDebugLogLatency);
        ChkDebugLogLatency.Checked += (_, _) => UpdateLogStatusDisplay();
        ChkDebugLogLatency.Unchecked += (_, _) => UpdateLogStatusDisplay();
    }

    private void OnUnloaded(object sender, RoutedEventArgs e)
    {
        _logStatusTimer.Stop();
        GameInterfaceData.Instance.UnregisterCallback(OnGameStateSnapshot);
        ColorPrinter.UnregisterCallback(OnLogMessage);
    }

    private void OnGameStateSnapshot(GameInterfaceStateSnapshot s)
    {
        if (!Dispatcher.CheckAccess())
        {
            Dispatcher.BeginInvoke(DispatcherPriority.Normal, () => OnGameStateSnapshot(s));
            return;
        }
        UpdateRosbotControlFromState();
    }

    /// <summary>Refresh Start/Stop and Ensure Battle.net buttons from GameInterfaceData. 1:1 Python _update_control_button (start = success, stop = danger).</summary>
    private void UpdateRosbotControlFromState()
    {
        var s = GameInterfaceData.Instance.GetStateSnapshot();
        var p = D3D4TesterI18n.Provider;
        BtnStartRosbot.Content = s.RosbotFlowMasterEnabled ? p.GetUiText(I18nKeys.RosbotStopRosbot) : p.GetUiText(I18nKeys.RosbotStartRosbot);
        BtnStartRosbot.SetResourceReference(StyleProperty, s.RosbotFlowMasterEnabled ? StyleDangerButton : StyleSuccessButton);
        SetEnsureBattlenetButtonText(s.EnsureBattlenetOnlyEnabled);
        BtnEnsureBattlenet.SetResourceReference(StyleProperty, s.EnsureBattlenetOnlyEnabled ? StyleWarningButton : StyleSecondaryButton);
    }

    /// <summary>Register this panel as ColorPrint target when Rosbot tab is selected. Called from MainWindow.</summary>
    public void RegisterAsLogTarget()
    {
        ColorPrinter.UnregisterCallback(OnLogMessage);
        ColorPrinter.RegisterCallback(OnLogMessage);
    }

    /// <summary>Unregister ColorPrint callback when leaving Rosbot tab.</summary>
    public void UnregisterAsLogTarget() => ColorPrinter.UnregisterCallback(OnLogMessage);

    /// <summary>Accept only ROSBOT/PathScan/LogAnalyzer lines, track last-log time and "[ROSBOT~Ns]" latency, strip prefix, auto-scroll. 1:1 Python add_log_message.</summary>
    private void OnLogMessage(string message, string colorType, string? logLevel)
    {
        if (ShutdownManager.IsShutdownRequested || string.IsNullOrEmpty(message) || !LogAcceptMarkers.Any(m => message.Contains(m, StringComparison.Ordinal))) return;
        if (!Dispatcher.CheckAccess())
        {
            Dispatcher.BeginInvoke(DispatcherPriority.Normal, () => OnLogMessage(message, colorType, logLevel));
            return;
        }
        _lastLogUtc = DateTime.UtcNow;
        int start = message.IndexOf(LatencyTagStart, StringComparison.Ordinal);
        if (start >= 0)
        {
            start += LatencyTagStart.Length;
            int end = message.IndexOf(LatencyTagEnd, start, StringComparison.Ordinal);
            if (end >= 0)
                _lastLatencySec = double.TryParse(message[start..end], NumberStyles.Float, CultureInfo.InvariantCulture, out var latency) ? latency : null;
        }
        TxtRosbotLog.AppendText(RunLogPage.StripUiLogPrefix(message) + "\n");
        TxtRosbotLog.ScrollToEnd();
    }

    /// <summary>"Last: x ago" from max(watcher logs.txt mtime, last accepted line); latency only when log_settings.debug_log_latency. 1:1 Python _update_rosbot_log_status_display.</summary>
    private void UpdateLogStatusDisplay()
    {
        DateTime? last = _lastLogUtc;
        var mtime = RosbotFlowHost.Current?.GetLastLogModifiedUtc() ?? LogFileMtimeUtc();
        if (mtime != null && (last == null || mtime > last)) last = mtime;
        if (last == null)
        {
            ChipLogStatus.Visibility = Visibility.Collapsed;
            ChipLogLatency.Visibility = Visibility.Collapsed;
            return;
        }
        var p = D3D4TesterI18n.Provider;
        double elapsed = Math.Max(0, (DateTime.UtcNow - last.Value).TotalSeconds);
        TxtLogStatus.Text = elapsed < SecondsPerMinute
            ? string.Format(CultureInfo.InvariantCulture, p.GetUiText(I18nKeys.RosbotLogLastAgo), elapsed.ToString("0.0", CultureInfo.InvariantCulture) + "s")
            : string.Format(CultureInfo.InvariantCulture, p.GetUiText(I18nKeys.RosbotLogLastAgoMin), (elapsed / SecondsPerMinute).ToString("0", CultureInfo.InvariantCulture) + "min");
        ChipLogStatus.Visibility = Visibility.Visible;
        bool showLatency = ConfigBinding.GetValue<bool?>(ConfigKeys.LogSettingsDebugLogLatency, false) == true;
        if (showLatency && _lastLatencySec is { } lat)
        {
            TxtLogLatency.Text = string.Format(CultureInfo.InvariantCulture, p.GetUiText(I18nKeys.RosbotLogLatency), lat.ToString("0.0", CultureInfo.InvariantCulture));
            ChipLogLatency.Visibility = Visibility.Visible;
        }
        else
        {
            ChipLogLatency.Visibility = Visibility.Collapsed;
        }
    }

    private static DateTime? LogFileMtimeUtc()
    {
        var path = RosbotLogPaths.GetLogsFilePath();
        return File.Exists(path) ? File.GetLastWriteTimeUtc(path) : null;
    }

    /// <summary>Reload path fields from config (after path scan or update writes config directly).</summary>
    public void RefreshPathFromConfig()
    {
        if (_loading) return;
        TxtRosDirectory.Text = ConfigBinding.GetValue(ConfigKeys.RosSettingsRosDirectory, "") ?? "";
        TxtBattlenetPath.Text = ConfigBinding.GetValue(ConfigKeys.BattlenetPath, "") ?? "";
        TxtD3Path.Text = ConfigBinding.GetValue(ConfigKeys.D3Path, "") ?? "";
    }

    /// <summary>Start/Stop toggle: only flips the flow-master flag; the 1 s tick drives the flow. 1:1 Python _toggle_rosbot.</summary>
    private void BtnStartRosbot_Click(object sender, RoutedEventArgs e)
    {
        var processor = RosbotTaskProcessor.Instance;
        if (GameInterfaceData.Instance.GetStateSnapshot().RosbotFlowMasterEnabled)
            processor.RequestStopFlow();
        else
            processor.RequestStartFlow();
        UpdateRosbotControlFromState();
    }

    /// <summary>"Ensure Battle.net only" toggle (the tick runs the BN segment: start, login, poll). 1:1 Python _ensure_battlenet_only.</summary>
    private void BtnEnsureBattlenet_Click(object sender, RoutedEventArgs e)
    {
        RosbotTaskProcessor.Instance.ToggleEnsureBattlenetOnly();
        UpdateRosbotControlFromState();
    }

    /// <summary>E1 kill, E2 wait, region zips, confirm / no-update detail dialogs (RosbotUpdateInfoWindow). 1:1 Python _update_rosbot (do_rosbot_update).</summary>
    private async void BtnUpdateRosbot_Click(object sender, RoutedEventArgs e)
    {
        BtnUpdateRosbot.IsEnabled = false;
        try
        {
            bool applied = await RosbotUpdateInfoWindow.RunInteractiveUpdateAsync(Window.GetWindow(this));
            if (!applied) return;
            RefreshPathFromConfig();
            GameInterfaceData.Instance.NotifyCallbacks();
        }
        catch (Exception ex)
        {
            ColorPrinter.Red("[ROSBOT] Update failed: " + ex.Message);
        }
        finally
        {
            BtnUpdateRosbot.IsEnabled = true;
        }
    }

    /// <summary>Open Tampermonkey script in Notepad. 1:1 Python _open_tampermonkey_script.</summary>
    private void BtnOpenTampermonkey_Click(object sender, RoutedEventArgs e) => OpenWithNotepadOrWarn(GetTampermonkeyScriptPath());

    /// <summary>Open ROSBOT logs.txt in Notepad. 1:1 Python _open_rosbot_log_file.</summary>
    private void BtnOpenLogFile_Click(object sender, RoutedEventArgs e) => OpenWithNotepadOrWarn(RosbotLogPaths.GetLogsFilePath());

    /// <summary>Open a file in the text editor; warn with rosbot.log_file_not_found + path when missing or not openable.</summary>
    private void OpenWithNotepadOrWarn(string? path)
    {
        if (!string.IsNullOrWhiteSpace(path) && ShellOpen.OpenFileWithNotepad(path)) return;
        var p = D3D4TesterI18n.Provider;
        MessageBox.Show(Window.GetWindow(this), p.GetUiText(I18nKeys.RosbotLogFileNotFound) + "\n" + (path ?? ""),
            p.GetUiText(I18nKeys.RosbotWarning), MessageBoxButton.OK, MessageBoxImage.Warning);
    }

    /// <summary>Copy selection, else the whole log. 1:1 Python _copy_rosbot_log_to_clipboard.</summary>
    private void MiCopyLog_Click(object sender, RoutedEventArgs e)
    {
        var text = TxtRosbotLog.SelectionLength > 0 ? TxtRosbotLog.SelectedText : TxtRosbotLog.Text;
        if (!string.IsNullOrWhiteSpace(text)) Clipboard.SetText(text);
    }

    /// <summary>
    /// Pick the ROSBOT folder. Fixes Python bug: _browse_rosbot_path stored an .exe path into ros_settings.ros_directory.
    /// </summary>
    private void BtnBrowseRosbot_Click(object sender, RoutedEventArgs e)
    {
        var current = (TxtRosDirectory.Text ?? "").Trim();
        var dlg = new OpenFolderDialog { Title = D3D4TesterI18n.Provider.GetUiText(I18nKeys.RosbotSelectRosbotDirectory) };
        if (Directory.Exists(current)) dlg.InitialDirectory = current;
        if (dlg.ShowDialog(Window.GetWindow(this)) == true)
            ConfigBinding.SetValue(ConfigKeys.RosSettingsRosDirectory, dlg.FolderName);
    }

    private void BtnBrowseBattlenet_Click(object sender, RoutedEventArgs e) =>
        BrowseExecutable(TxtBattlenetPath, ConfigKeys.BattlenetPath, I18nKeys.RosbotSelectBattlenetExecutable);

    private void BtnBrowseD3_Click(object sender, RoutedEventArgs e) =>
        BrowseExecutable(TxtD3Path, ConfigKeys.D3Path, I18nKeys.RosbotSelectD3Executable);

    /// <summary>Pick an .exe; start in the folder of the current value when it exists. 1:1 Python _browse_battlenet_path / _browse_d3_path.</summary>
    private void BrowseExecutable(TextBox source, string configKey, string titleKey)
    {
        var p = D3D4TesterI18n.Provider;
        var current = (source.Text ?? "").Trim();
        var dlg = new OpenFileDialog
        {
            Title = p.GetUiText(titleKey),
            Filter = $"{p.GetUiText(I18nKeys.RosbotExecutableFiles)} (*.exe)|*.exe|{p.GetUiText(I18nKeys.RosbotAllFiles)} (*.*)|*.*",
        };
        var dir = File.Exists(current) ? Path.GetDirectoryName(current) : null;
        if (!string.IsNullOrEmpty(dir)) dlg.InitialDirectory = dir;
        if (dlg.ShowDialog(Window.GetWindow(this)) == true)
            ConfigBinding.SetValue(configKey, dlg.FileName);
    }

    /// <summary>Resolve Tampermonkey script path: config PathsTampermonkeyScript, else default under repo scripts/ (1:1 Python TAMPERMONKEY_SCRIPT_PATH).</summary>
    private static string? GetTampermonkeyScriptPath()
    {
        const string fileName = "d3check_oauth_login_tampermonkey.user.js";
        var cfg = ConfigOptionsProvider.GetOptions<PathsOptions>().TampermonkeyScript;
        if (!string.IsNullOrWhiteSpace(cfg))
        {
            var p = Path.GetFullPath(cfg);
            if (File.Exists(p)) return p;
        }
        var baseDir = AppDomain.CurrentDomain.BaseDirectory;
        var scriptsHere = Path.Combine(baseDir, "scripts", fileName);
        if (File.Exists(scriptsHere)) return Path.GetFullPath(scriptsHere);
        var dir = new DirectoryInfo(baseDir);
        for (int i = 0; i < 6 && dir?.Parent != null; i++, dir = dir.Parent)
        {
            var candidate = Path.Combine(dir.FullName, "scripts", fileName);
            if (File.Exists(candidate)) return Path.GetFullPath(candidate);
        }
        return Path.GetFullPath(scriptsHere);
    }

    private void BtnSetAccountPassword_Click(object sender, RoutedEventArgs e)
    {
        ColorPrinter.Gray("[DEBUG][ROSBOT UI] BtnSetAccountPassword clicked. Opening CredentialsDialog for Asia.");
        var owner = Window.GetWindow(this);
        var dialog = new CredentialsDialog(AsiaCredentialsService.RegionAsia) { Owner = owner };
        dialog.ShowDialog();
    }
}
