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
    private DispatcherTimer? _startRosbotPollTimer;
    private DateTime? _startRosbotWakeWaitStart;
    /// <summary>When BN is stuck (sleep or fetching account info), time we first saw it. After StuckCleanupDelaySec (5 min) we call cache cleanup.</summary>
    private DateTime? _stuckSinceUtc;
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
        _startRosbotPollTimer?.Stop();
        _startRosbotPollTimer = null;
        _startRosbotWakeWaitStart = null;
        _stuckSinceUtc = null;
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
        if (string.IsNullOrEmpty(message) || !LogAcceptMarkers.Any(m => message.Contains(m, StringComparison.Ordinal))) return;
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

    /// <summary>"Last: x ago" from max(logs.txt mtime, last accepted line); latency only when log_settings.debug_log_latency. 1:1 Python _update_rosbot_log_status_display.</summary>
    private void UpdateLogStatusDisplay()
    {
        DateTime? last = _lastLogUtc;
        var path = RosbotLogPaths.GetLogsFilePath();
        if (File.Exists(path))
        {
            var mtime = File.GetLastWriteTimeUtc(path);
            if (last == null || mtime > last) last = mtime;
        }
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

    /// <summary>Reload path fields from config (after path scan or update writes config directly).</summary>
    public void RefreshPathFromConfig()
    {
        if (_loading) return;
        TxtRosDirectory.Text = ConfigBinding.GetValue(ConfigKeys.RosSettingsRosDirectory, "") ?? "";
        TxtBattlenetPath.Text = ConfigBinding.GetValue(ConfigKeys.BattlenetPath, "") ?? "";
        TxtD3Path.Text = ConfigBinding.GetValue(ConfigKeys.D3Path, "") ?? "";
    }

    /// <summary>Reload all settings when a ros_settings/battlenet/d3/rosbot key changed outside the page.</summary>
    public void RefreshFromConfig(string? keyPath)
    {
        if (_loading || string.IsNullOrEmpty(keyPath)) return;
        if (!keyPath.StartsWith("ros_settings.", StringComparison.OrdinalIgnoreCase)
            && !keyPath.StartsWith("battlenet.", StringComparison.OrdinalIgnoreCase)
            && !keyPath.StartsWith("d3.", StringComparison.OrdinalIgnoreCase)
            && !keyPath.StartsWith("rosbot.", StringComparison.OrdinalIgnoreCase))
            return;
        RefreshPathFromConfig();
        var rosOpts = ConfigOptionsProvider.GetOptions<RosSettingsOptions>();
        var battlenetOpts = ConfigOptionsProvider.GetOptions<BattlenetOptions>();
        var rosbotOpts = ConfigOptionsProvider.GetOptions<RosbotOptions>();
        ChkAutoEnableLatestRos.IsChecked = rosOpts.AutoEnableLatestRos;
        ChkPickupBloodShards.IsChecked = rosbotOpts.PickupBloodShards;
        ChkPreventStuck.IsChecked = rosbotOpts.PreventStuck;
        ChkBluePortalPriority.IsChecked = rosbotOpts.BluePortalPriority;
        ChkSmartEcho.IsChecked = rosbotOpts.SmartEcho;
        TxtSmartEchoWaitSeconds.Text = rosbotOpts.SmartEchoWaitSeconds.ToString(CultureInfo.InvariantCulture);
        ChkFirstbornBlueGateReuse.IsChecked = rosbotOpts.FirstbornBlueGateReuse;
        ChkStartup.IsChecked = rosbotOpts.Startup;
        ChkTestMode.IsChecked = rosbotOpts.TestMode;
        TxtTestTimeoutMinutes.Text = rosbotOpts.TestTimeoutMinutes.ToString(CultureInfo.InvariantCulture);
        ChkTimeoutRestart.IsChecked = battlenetOpts.TimeoutRestart;
        TxtTimeoutMinutes.Text = rosbotOpts.TimeoutMinutes.ToString(CultureInfo.InvariantCulture);
    }

    private async void BtnStartRosbot_Click(object sender, RoutedEventArgs e)
    {
        var game = GameInterfaceData.Instance;
        var snapshot = game.GetStateSnapshot();
        string? regionSnapshot = snapshot.BattlenetRegion;
        string bnPath = ConfigOptionsProvider.GetOptions<BattlenetOptions>().BattlenetPath ?? "";
        string rosPath = ConfigOptionsProvider.GetOptions<RosSettingsOptions>().RosDirectory ?? "";
        string d3Path = ConfigOptionsProvider.GetOptions<D3Options>().D3Path ?? "";
        bool hasBn = BattlenetManager.Instance.HasWindow();
        ColorPrinter.Gray($"[DEBUG][ROSBOT UI] BtnStartRosbot clicked. RosbotFlowMasterEnabled={snapshot.RosbotFlowMasterEnabled}, BattlenetRegion={regionSnapshot ?? "null"}, HasBnWindow={hasBn}, BattlenetPath={(string.IsNullOrEmpty(bnPath) ? "empty" : "set")}, RosPath={(string.IsNullOrEmpty(rosPath) ? "empty" : "set")}, D3Path={(string.IsNullOrEmpty(d3Path) ? "empty" : "set")}.");

        if (snapshot.RosbotFlowMasterEnabled)
        {
            ColorPrinter.Gray("[DEBUG][ROSBOT UI] BtnStartRosbot: snapshot.RosbotFlowMasterEnabled=true -> STOP path.");
            _startRosbotPollTimer?.Stop();
            _startRosbotPollTimer = null;
            _startRosbotWakeWaitStart = null;
            _stuckSinceUtc = null;
            game.SetBattlenetWakingUp(false);
            RosbotFlowController.StopRosbot();
            game.SetRosbotFlowMasterEnabled(false);
            game.SetRosbotStatus(false);
            game.NotifyCallbacks();
            ColorPrinter.Yellow("[ROSBOT] Stopped.");
            ColorPrinter.Gray("[DEBUG][ROSBOT UI] BtnStartRosbot: stop path done. FlowMasterEnabled=false, timer cleared.");
            UpdateRosbotControlFromState();
            return;
        }
        ColorPrinter.Gray("[DEBUG][ROSBOT UI] BtnStartRosbot: START path (RosbotFlowMasterEnabled was false).");
        string? region = EnsureBattlenetRegionBeforeStart();
        if (string.IsNullOrEmpty(region))
        {
            ColorPrinter.Gray("[DEBUG][ROSBOT UI] BtnStartRosbot: EnsureBattlenetRegionBeforeStart returned null, aborting start.");
            ColorPrinter.Yellow("[ROSBOT] Cannot start: region unknown. Set Battle.net path and ensure Battle.net has been launched once, or set ros_settings.battlenet_region_cache to asia/cn.");
            return;
        }
        ColorPrinter.Gray($"[DEBUG][ROSBOT UI] BtnStartRosbot: region={region}, setting RosbotFlowMasterEnabled=true (button stays enabled for toggle 1:1 Python).");
        game.SetRosbotFlowMasterEnabled(true);
        _stuckSinceUtc = null;
        UpdateRosbotControlFromState();
        // 1:1 Python: do NOT disable button on start; Python _start_rosbot only sets state + _update_control_button(), button stays clickable so user can click Stop anytime.
        BtnStartRosbot.IsEnabled = true;

        var op = BattlenetOperationFactory.GetOperation(region);
        if (!BattlenetManager.Instance.HasWindow())
        {
            ColorPrinter.Blue("[ROSBOT] Battle.net not running, starting...");
            op.Start();
        }

        if (BattlenetManager.Instance.HasWindow())
        {
            ColorPrinter.Gray("[DEBUG][ROSBOT UI] BtnStartRosbot: BN window present, refreshing status and checking sleep mode.");
            RefreshBattlenetStatus();
            RosbotStatusProvider.Refresh();
            game.NotifyCallbacks();
            bool sleep = await CheckSleepModeAsync();
            if (sleep)
            {
                ColorPrinter.Gray("[DEBUG][ROSBOT UI] BtnStartRosbot: BN in sleep mode, starting 2s poll timer for wake.");
                _startRosbotWakeWaitStart = DateTime.UtcNow;
                game.SetBattlenetWakingUp(true);
                game.NotifyCallbacks();
                ColorPrinter.Blue("[ROSBOT] Battle.net in sleep mode (status: 唤醒中 every 2s). Waiting for wake...");
                _startRosbotPollTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(2) };
                _startRosbotPollTimer.Tick += StartRosbotPollTimer_Tick;
                _startRosbotPollTimer.Start();
                RefreshBattlenetStatus();
                return;
            }
            ColorPrinter.Gray("[DEBUG][ROSBOT UI] BtnStartRosbot: BN not in sleep, calling DoRunRosbotAfterWakeAsync.");
            game.SetBattlenetWakingUp(false);
            DoRunRosbotAfterWakeAsync(game);
            return;
        }

        ColorPrinter.Gray("[DEBUG][ROSBOT UI] BtnStartRosbot: no BN window, starting 2s poll timer to wait for Battle.net.");
        ColorPrinter.Blue("[ROSBOT] Waiting for Battle.net (status updates every 2s)...");
        _startRosbotWakeWaitStart = null;
        _startRosbotPollTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(2) };
        _startRosbotPollTimer.Tick += StartRosbotPollTimer_Tick;
        _startRosbotPollTimer.Start();
        RefreshBattlenetStatus();
    }

    private async void StartRosbotPollTimer_Tick(object? sender, EventArgs e)
    {
        var game = GameInterfaceData.Instance;
        RefreshBattlenetStatus();
        RosbotStatusProvider.Refresh();
        game.NotifyCallbacks();
        if (!BattlenetManager.Instance.HasWindow())
        {
            _stuckSinceUtc = null;
            return;
        }

        bool stuck = await CheckStuckAsync();
        if (stuck)
        {
            if (_stuckSinceUtc == null)
                _stuckSinceUtc = DateTime.UtcNow;
            if (_startRosbotWakeWaitStart == null)
                _startRosbotWakeWaitStart = DateTime.UtcNow;
            game.SetBattlenetWakingUp(true);
            game.NotifyCallbacks();
            double elapsed = (DateTime.UtcNow - _stuckSinceUtc.Value).TotalSeconds;
            if (elapsed >= BattlenetConstants.StuckCleanupDelaySec)
            {
                _startRosbotPollTimer?.Stop();
                _startRosbotPollTimer = null;
                _stuckSinceUtc = null;
                _startRosbotWakeWaitStart = null;
                game.SetBattlenetWakingUp(false);
                game.NotifyCallbacks();
                ColorPrinter.Blue("[ROSBOT] Battle.net stuck " + (int)elapsed + "s (sleep or fetching account) -> clearing cache (Reddit/Blizzard fix).");
                BattlenetCacheCleanup.ClearCache();
                BtnStartRosbot.IsEnabled = true;
                UpdateRosbotControlFromState();
                return;
            }
            return;
        }

        _stuckSinceUtc = null;
        _startRosbotWakeWaitStart = null;
        game.SetBattlenetWakingUp(false);
        _startRosbotPollTimer?.Stop();
        _startRosbotPollTimer = null;
        DoRunRosbotAfterWakeAsync(game);
    }

    private async void DoRunRosbotAfterWakeAsync(GameInterfaceData game)
    {
        ColorPrinter.Gray("[DEBUG][ROSBOT UI] DoRunRosbotAfterWakeAsync: calling RosbotFlowController.RunAsync().");
        try
        {
            bool ok = await RosbotFlowController.RunAsync();
            ColorPrinter.Gray($"[DEBUG][ROSBOT UI] DoRunRosbotAfterWakeAsync: RunAsync returned ok={ok}. RosbotFlowMasterEnabled kept={ok}.");
            if (!ok)
                game.SetRosbotFlowMasterEnabled(false);
        }
        catch (Exception ex)
        {
            ColorPrinter.Red("[ROSBOT] Flow error: " + ex.Message);
            ColorPrinter.Gray("[DEBUG][ROSBOT UI] DoRunRosbotAfterWakeAsync: exception, setting RosbotFlowMasterEnabled=false.");
            game.SetRosbotFlowMasterEnabled(false);
        }
        game.NotifyCallbacks();
        UpdateRosbotControlFromState();
    }

    private static async Task<bool> CheckSleepModeAsync()
    {
        var bn = GetBnProcess();
        if (bn == null) return false;
        return await Task.Run(() => BattlenetStuckDetector.IsSleepMode(bn)).ConfigureAwait(true);
    }

    /// <summary>True when BN is stuck: sleep (Agent went to sleep) or fetching/loading account info. Used for 5-min cache cleanup.</summary>
    private static async Task<bool> CheckStuckAsync()
    {
        var bn = GetBnProcess();
        if (bn == null) return false;
        return await Task.Run(() => BattlenetStuckDetector.IsStuck(bn)).ConfigureAwait(true);
    }

    private void RefreshBattlenetStatus()
    {
        bool hasBn = BattlenetManager.Instance.HasWindow();
        GameInterfaceData.Instance.SetBattlenetWindowFound(hasBn);
        GameInterfaceData.Instance.SetBattlenetNormalAvailable(hasBn);
        GameInterfaceData.Instance.NotifyCallbacks();
    }

    /// <summary>Get first Battle.net process that has a main window, or null.</summary>
    private static Process? GetBnProcess()
    {
        foreach (var p in Process.GetProcessesByName(BattlenetManager.ProcessName))
        {
            try
            {
                if (p.MainWindowHandle != IntPtr.Zero)
                    return p;
            }
            catch { /* skip */ }
        }
        return null;
    }

    /// <summary>Ensure Battle.net region before start. 1:1 Python ensure_battlenet_region_from_config: config file first, then ros_settings.battlenet_region_cache. Returns "asia" or "cn" or null.</summary>
    private static string? EnsureBattlenetRegionBeforeStart()
    {
        var game = GameInterfaceData.Instance;
        string? existing = game.GetStateSnapshot().BattlenetRegion;
        if (!string.IsNullOrEmpty(existing) && (existing == AppConstants.RegionAsia || existing == AppConstants.RegionCn))
            return existing;
        string? region = BattlenetRegionDetection.DetectRegion();
        if (string.IsNullOrEmpty(region))
            region = ConfigOptionsProvider.GetOptions<RosSettingsOptions>().BattlenetRegionCache;
            if (string.IsNullOrEmpty(region)) region = null;
        if (string.IsNullOrEmpty(region) || (region != AppConstants.RegionAsia && region != AppConstants.RegionCn))
            return null;
        game.SetBattlenetRegion(region);
        if (BattlenetRegionDetection.DetectRegion() != null)
            D3D4TesterConfigService.Instance.SetValueAsync(ConfigKeys.RosSettingsBattlenetRegionCache, region);
        D3D4TesterConfigService.Instance.QueueSave();
        return region;
    }

    private async void BtnEnsureBattlenet_Click(object sender, RoutedEventArgs e)
    {
        var game = GameInterfaceData.Instance;
        var snapshot = game.GetStateSnapshot();
        string? bnPathCfg = ConfigOptionsProvider.GetOptions<BattlenetOptions>().BattlenetPath;
        if (string.IsNullOrWhiteSpace(bnPathCfg)) bnPathCfg = null;
        bool hasBn = BattlenetManager.Instance.HasWindow();
        ColorPrinter.Gray($"[DEBUG][ROSBOT UI] BtnEnsureBattlenet clicked. EnsureBattlenetOnlyEnabled={snapshot.EnsureBattlenetOnlyEnabled}, BattlenetRegion={snapshot.BattlenetRegion ?? "null"}, HasBnWindow={hasBn}, BattlenetPath={(string.IsNullOrWhiteSpace(bnPathCfg) ? "empty" : "set")}.");

        if (snapshot.EnsureBattlenetOnlyEnabled)
        {
            ColorPrinter.Gray("[DEBUG][ROSBOT UI] BtnEnsureBattlenet: turning off EnsureBattlenetOnly; BN-only tick loop will stop.");
            game.SetEnsureBattlenetOnlyEnabled(false);
            game.NotifyCallbacks();
            UpdateRosbotControlFromState();
            return;
        }
        ColorPrinter.Gray("[DEBUG][ROSBOT UI] BtnEnsureBattlenet: turning on path; EnsureBattlenetRegionBeforeStart next.");
        string? region = EnsureBattlenetRegionBeforeStart();
        if (string.IsNullOrEmpty(region))
        {
            ColorPrinter.Yellow("[ROSBOT] Ensure Battle.net: region unknown. Set Battle.net path and ensure Battle.net has been launched once.");
            return;
        }
        string? bnPath = ConfigOptionsProvider.GetOptions<BattlenetOptions>().BattlenetPath;
        if (string.IsNullOrWhiteSpace(bnPath)) bnPath = null;
        if (string.IsNullOrWhiteSpace(bnPath) || !System.IO.File.Exists(bnPath))
        {
            ColorPrinter.Gray("[DEBUG][ROSBOT UI] BtnEnsureBattlenet: region ok but Battlenet path empty or file not found.");
            ColorPrinter.Yellow("[ROSBOT] Ensure Battle.net: path not set or file not found. Set Battle.net path in Path Settings.");
            return;
        }
        ColorPrinter.Gray($"[DEBUG][ROSBOT UI] BtnEnsureBattlenet: region={region}, path set; getting op and checking BN window.");
        var op = BattlenetOperationFactory.GetOperation(region);
        BtnEnsureBattlenet.IsEnabled = false;
        try
        {
            if (!BattlenetManager.Instance.HasWindow())
            {
                ColorPrinter.Gray("[DEBUG][ROSBOT UI] BtnEnsureBattlenet: no BN window, starting Battle.net.");
                ColorPrinter.Blue("[ROSBOT] Ensure Battle.net: starting Battle.net (" + region + ")...");
                if (!op.Start())
                {
                    ColorPrinter.Red("[ROSBOT] Ensure Battle.net: failed to start.");
                    return;
                }
                ColorPrinter.Gray("[DEBUG][ROSBOT UI] BtnEnsureBattlenet: op.Start() ok; waiting for BN window (poll).");
                for (int i = 0; i < AppConstants.WaitForBnWindowMaxAttempts; i++)
                {
                    await Task.Delay(AppConstants.WaitForBnWindowMs);
                    if (BattlenetManager.Instance.HasWindow())
                        break;
                }
            }
            if (BattlenetManager.Instance.HasWindow())
            {
                ColorPrinter.Gray("[DEBUG][ROSBOT UI] BtnEnsureBattlenet: BN window found, activating and setting EnsureBattlenetOnly=true; 2s BN-only tick loop will start.");
                op.ActivateWindow();
                game.SetBattlenetWindowFound(true);
                game.SetEnsureBattlenetOnlyEnabled(true);
                game.NotifyCallbacks();
                ColorPrinter.Green("[ROSBOT] Ensure Battle.net: window activated (region=" + region + ").");
            }
            else
                ColorPrinter.Yellow("[ROSBOT] Ensure Battle.net: window not found after start (timeout).");
        }
        finally
        {
            BtnEnsureBattlenet.IsEnabled = true;
            UpdateRosbotControlFromState();
        }
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
