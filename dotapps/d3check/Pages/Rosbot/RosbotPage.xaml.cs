using System.Diagnostics;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Threading;
using DotApps.d3check.Config;
using DotApps.d3check.Config.Options;
using DotApps.d3check.Constants;
using DotApps.d3check.Ctl;
using DotApps.d3check.I18n;
using DotApps.d3check.Core;
using DotApps.d3check.Core.Battlenet;
using DotApps.d3check.Windows;
using DotApps.d3check.ViewModels;
using DotCore.Foundations;
using DotCore.UIInspect;

namespace DotApps.d3check.Pages.Rosbot;

public partial class RosbotPage : UserControl
{
    private bool _loading;
    private DispatcherTimer? _startRosbotPollTimer;
    private DateTime? _startRosbotWakeWaitStart;
    /// <summary>When BN is stuck (sleep or fetching account info), time we first saw it. After StuckCleanupDelaySec (5 min) we call cache cleanup.</summary>
    private DateTime? _stuckSinceUtc;

    public RosbotPage()
    {
        InitializeComponent();
        DataContext = new RosbotViewModel();
        Loaded += OnLoaded;
        Unloaded += OnUnloaded;
    }

    /// <summary>Refresh all labels/contents from i18n (same keys as Python rosbot panel). Call from Loaded and when language changes.</summary>
    public void RefreshRosbotUiText()
    {
        var p = D3CheckI18n.Provider;
        if (LblPathSettings != null) LblPathSettings.Text = p.GetUiText(I18nKeys.RosbotPathSettings);
        if (LblRosbotPath != null) LblRosbotPath.Text = p.GetUiText(I18nKeys.RosbotRosbotPath);
        if (LblBattlenetPath != null) LblBattlenetPath.Text = p.GetUiText(I18nKeys.RosbotBattlenetPath);
        if (LblD3Path != null) LblD3Path.Text = p.GetUiText(I18nKeys.RosbotD3Path);
        if (LblBotSettings != null) LblBotSettings.Text = p.GetUiText(I18nKeys.RosbotBotSettings);
        if (ChkAutoEnableLatestRos != null) ChkAutoEnableLatestRos.Content = p.GetUiText(I18nKeys.RosbotAutoEnableLatestRos);
        if (ChkBluePortalPriority != null) ChkBluePortalPriority.Content = p.GetUiText(I18nKeys.RosbotBluePortalPriority);
        if (ChkFirstbornBlueGateReuse != null) ChkFirstbornBlueGateReuse.Content = p.GetUiText(I18nKeys.RosbotFirstbornBlueGateReuse);
        if (ChkPickupBloodShards != null) ChkPickupBloodShards.Content = p.GetUiText(I18nKeys.RosbotPickupBloodShards);
        if (ChkSmartEcho != null) ChkSmartEcho.Content = p.GetUiText(I18nKeys.RosbotSmartEcho);
        if (LblSeconds != null) LblSeconds.Text = p.GetUiText(I18nKeys.RosbotSeconds);
        if (ChkTestMode != null) ChkTestMode.Content = p.GetUiText(I18nKeys.RosbotTestMode);
        if (LblMinutes1 != null) LblMinutes1.Text = p.GetUiText(I18nKeys.RosbotMinutes);
        if (ChkPreventStuck != null) ChkPreventStuck.Content = p.GetUiText(I18nKeys.RosbotPreventStuck);
        if (ChkStartup != null) ChkStartup.Content = p.GetUiText(I18nKeys.RosbotStartup);
        if (ChkTimeoutRestart != null) ChkTimeoutRestart.Content = p.GetUiText(I18nKeys.RosbotTimeoutRestart);
        if (LblMinutes2 != null) LblMinutes2.Text = p.GetUiText(I18nKeys.RosbotMinutes);
        if (LblControlPanel != null) LblControlPanel.Text = p.GetUiText(I18nKeys.RosbotControlPanel);
        if (BtnStartRosbot != null) BtnStartRosbot.Content = p.GetUiText(I18nKeys.RosbotStartRosbot);
        if (BtnEnsureBattlenet != null) BtnEnsureBattlenet.Content = p.GetUiText(I18nKeys.RosbotEnsureBattlenetOnly);
        if (BtnUpdateRosbot != null) BtnUpdateRosbot.Content = p.GetUiText(I18nKeys.RosbotUpdateRosbot);
        if (BtnOpenTampermonkey != null) BtnOpenTampermonkey.Content = p.GetUiText(I18nKeys.RosbotOpenTampermonkeyScript);
        if (BtnSetAccountPassword != null) BtnSetAccountPassword.Content = p.GetUiText(I18nKeys.RosbotSetAccountPassword);
        if (LblRosbotLog != null) LblRosbotLog.Text = p.GetUiText(I18nKeys.RosbotRosbotLog);
    }

    /// <summary>Set Ensure Battle.net button text to "on" or default. Call when ensure_battlenet_only state changes.</summary>
    public void SetEnsureBattlenetButtonText(bool isOn)
    {
        if (BtnEnsureBattlenet == null) return;
        var p = D3CheckI18n.Provider;
        BtnEnsureBattlenet.Content = isOn ? p.GetUiText(I18nKeys.RosbotEnsureBattlenetOnlyOn) : p.GetUiText(I18nKeys.RosbotEnsureBattlenetOnly);
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        _loading = true;
        D3CheckI18n.EnsureInitialized();
        RefreshRosbotUiText();
        var rosOpts = ConfigOptionsProvider.GetOptions<RosSettingsOptions>();
        var battlenetOpts = ConfigOptionsProvider.GetOptions<BattlenetOptions>();
        var d3Opts = ConfigOptionsProvider.GetOptions<D3Options>();
        var rosbotOpts = ConfigOptionsProvider.GetOptions<RosbotOptions>();

        TxtRosDirectory.Text = rosOpts.RosDirectory ?? "";
        TxtBattlenetPath.Text = battlenetOpts.BattlenetPath ?? "";
        TxtD3Path.Text = d3Opts.D3Path ?? "";

        ChkAutoEnableLatestRos.IsChecked = rosOpts.AutoEnableLatestRos;
        ChkPickupBloodShards.IsChecked = rosbotOpts.PickupBloodShards;
        ChkPreventStuck.IsChecked = rosbotOpts.PreventStuck;
        ChkBluePortalPriority.IsChecked = rosbotOpts.BluePortalPriority;
        ChkSmartEcho.IsChecked = rosbotOpts.SmartEcho;
        TxtSmartEchoWaitSeconds.Text = rosbotOpts.SmartEchoWaitSeconds.ToString();
        ChkFirstbornBlueGateReuse.IsChecked = rosbotOpts.FirstbornBlueGateReuse;
        ChkStartup.IsChecked = rosbotOpts.Startup;
        ChkTestMode.IsChecked = rosbotOpts.TestMode;
        TxtTestTimeoutMinutes.Text = rosbotOpts.TestTimeoutMinutes.ToString();
        ChkTimeoutRestart.IsChecked = battlenetOpts.TimeoutRestart;
        TxtTimeoutMinutes.Text = rosbotOpts.TimeoutMinutes.ToString();

        TxtRosDirectory.LostFocus += (_, _) => SaveString(ConfigKeys.RosSettingsRosDirectory, TxtRosDirectory.Text);
        TxtBattlenetPath.LostFocus += (_, _) => SaveString(ConfigKeys.BattlenetPath, TxtBattlenetPath.Text);
        TxtD3Path.LostFocus += (_, _) => SaveString(ConfigKeys.D3Path, TxtD3Path.Text);
        TxtSmartEchoWaitSeconds.LostFocus += (_, _) => SaveInt(ConfigKeys.RosbotSmartEchoWaitSeconds, TxtSmartEchoWaitSeconds.Text, AppConstants.RosbotSmartEchoWaitSecondsDefault);
        TxtTestTimeoutMinutes.LostFocus += (_, _) => SaveInt(ConfigKeys.RosbotTestTimeoutMinutes, TxtTestTimeoutMinutes.Text, AppConstants.RosbotTestTimeoutMinutesDefault);
        TxtTimeoutMinutes.LostFocus += (_, _) => SaveInt(ConfigKeys.RosbotTimeoutMinutes, TxtTimeoutMinutes.Text, AppConstants.RosbotTimeoutMinutesDefault);

        ChkAutoEnableLatestRos.Checked += (_, _) => SaveCheckbox(ConfigKeys.RosSettingsAutoEnableLatestRos, true);
        ChkAutoEnableLatestRos.Unchecked += (_, _) => SaveCheckbox(ConfigKeys.RosSettingsAutoEnableLatestRos, false);
        ChkPickupBloodShards.Checked += (_, _) => SaveCheckbox(ConfigKeys.RosbotPickupBloodShards, true);
        ChkPickupBloodShards.Unchecked += (_, _) => SaveCheckbox(ConfigKeys.RosbotPickupBloodShards, false);
        ChkPreventStuck.Checked += (_, _) => SaveCheckbox(ConfigKeys.RosbotPreventStuck, true);
        ChkPreventStuck.Unchecked += (_, _) => SaveCheckbox(ConfigKeys.RosbotPreventStuck, false);
        ChkBluePortalPriority.Checked += (_, _) => SaveCheckbox(ConfigKeys.RosbotBluePortalPriority, true);
        ChkBluePortalPriority.Unchecked += (_, _) => SaveCheckbox(ConfigKeys.RosbotBluePortalPriority, false);
        ChkSmartEcho.Checked += (_, _) => SaveCheckbox(ConfigKeys.RosbotSmartEcho, true);
        ChkSmartEcho.Unchecked += (_, _) => SaveCheckbox(ConfigKeys.RosbotSmartEcho, false);
        ChkFirstbornBlueGateReuse.Checked += (_, _) => SaveCheckbox(ConfigKeys.RosbotFirstbornBlueGateReuse, true);
        ChkFirstbornBlueGateReuse.Unchecked += (_, _) => SaveCheckbox(ConfigKeys.RosbotFirstbornBlueGateReuse, false);
        ChkStartup.Checked += (_, _) => SaveCheckbox(ConfigKeys.RosbotStartup, true);
        ChkStartup.Unchecked += (_, _) => SaveCheckbox(ConfigKeys.RosbotStartup, false);
        ChkTestMode.Checked += (_, _) => SaveCheckbox(ConfigKeys.RosbotTestMode, true);
        ChkTestMode.Unchecked += (_, _) => SaveCheckbox(ConfigKeys.RosbotTestMode, false);
        ChkTimeoutRestart.Checked += (_, _) => SaveCheckbox(ConfigKeys.BattlenetTimeoutRestart, true);
        ChkTimeoutRestart.Unchecked += (_, _) => SaveCheckbox(ConfigKeys.BattlenetTimeoutRestart, false);

        GameInterfaceData.Instance.RegisterCallback(OnGameStateSnapshot);
        UpdateRosbotControlFromState();
        _loading = false;
    }

    private void OnUnloaded(object sender, RoutedEventArgs e)
    {
        _startRosbotPollTimer?.Stop();
        _startRosbotPollTimer = null;
        _startRosbotWakeWaitStart = null;
        _stuckSinceUtc = null;
        GameInterfaceData.Instance.UnregisterCallback(OnGameStateSnapshot);
        ColorPrinter.UnregisterCallback(OnLogMessage);
    }

    private void OnGameStateSnapshot(GameInterfaceStateSnapshot s)
    {
        if (!Dispatcher.CheckAccess())
        {
            Dispatcher.BeginInvoke(System.Windows.Threading.DispatcherPriority.Normal, () => OnGameStateSnapshot(s));
            return;
        }
        UpdateRosbotControlFromState();
    }

    /// <summary>Refresh Start/Stop and Ensure Battle.net button from GameInterfaceData; green = 可启动 (off), yellow = 可停止 (on). 1:1 Python _update_control_button.</summary>
    private void UpdateRosbotControlFromState()
    {
        var s = GameInterfaceData.Instance.GetStateSnapshot();
        var p = D3CheckI18n.Provider;
        if (BtnStartRosbot != null)
        {
            BtnStartRosbot.Content = s.RosbotFlowMasterEnabled ? p.GetUiText(I18nKeys.RosbotStopRosbot) : p.GetUiText(I18nKeys.RosbotStartRosbot);
            ApplyStateToButton(BtnStartRosbot, s.RosbotFlowMasterEnabled);
        }
        SetEnsureBattlenetButtonText(s.EnsureBattlenetOnlyEnabled);
        ApplyStateToButton(BtnEnsureBattlenet, s.EnsureBattlenetOnlyEnabled);
    }

    /// <summary>Reusable: green = 可启动 (state off), yellow = 可停止 (state on). Used for Start ROSBOT and Ensure Battle.net.</summary>
    private static void ApplyStateToButton(Button? btn, bool isOn)
    {
        if (btn == null) return;
        btn.Background = new SolidColorBrush(isOn ? Colors.LightYellow : Colors.LightGreen);
    }

    private static void SaveString(string key, string value)
    {
        D3CheckConfigService.Instance.SetValueAsync(key, value ?? "");
        D3CheckConfigService.Instance.QueueSave();
    }

    private static void SaveCheckbox(string key, bool value)
    {
        D3CheckConfigService.Instance.SetValueAsync(key, value);
        D3CheckConfigService.Instance.QueueSave();
    }

    private static void SaveInt(string key, string text, int defaultVal)
    {
        if (int.TryParse(text, out var v) && v >= 1 && v <= 120)
        {
            D3CheckConfigService.Instance.SetValueAsync(key, v);
            D3CheckConfigService.Instance.QueueSave();
        }
    }

    /// <summary>Register this panel as ColorPrint target when Rosbot tab is selected. Called from MainWindow.</summary>
    public void RegisterAsLogTarget()
    {
        ColorPrinter.UnregisterCallback(OnLogMessage);
        ColorPrinter.RegisterCallback(OnLogMessage);
    }

    /// <summary>Unregister ColorPrint callback when leaving Rosbot tab.</summary>
    public void UnregisterAsLogTarget()
    {
        ColorPrinter.UnregisterCallback(OnLogMessage);
    }

    private void OnLogMessage(string message, string colorType, string? logLevel)
    {
        if (TxtRosbotLog == null) return;
        if (!Dispatcher.CheckAccess())
        {
            Dispatcher.BeginInvoke(System.Windows.Threading.DispatcherPriority.Normal, () => OnLogMessage(message, colorType, logLevel));
            return;
        }
        TxtRosbotLog.AppendText(message + "\n");
    }

    public void RefreshPathFromConfig()
    {
        if (_loading) return;
        var rosOpts = ConfigOptionsProvider.GetOptions<RosSettingsOptions>();
        var battlenetOpts = ConfigOptionsProvider.GetOptions<BattlenetOptions>();
        var d3Opts = ConfigOptionsProvider.GetOptions<D3Options>();
        TxtRosDirectory.Text = rosOpts.RosDirectory ?? "";
        TxtBattlenetPath.Text = battlenetOpts.BattlenetPath ?? "";
        TxtD3Path.Text = d3Opts.D3Path ?? "";
    }

    public void RefreshFromConfig(string? keyPath)
    {
        if (_loading || string.IsNullOrEmpty(keyPath)) return;
        if (!keyPath.StartsWith("ros_settings.", StringComparison.OrdinalIgnoreCase)
            && !keyPath.StartsWith("battlenet.", StringComparison.OrdinalIgnoreCase)
            && !keyPath.StartsWith("d3.", StringComparison.OrdinalIgnoreCase)
            && !keyPath.StartsWith("rosbot.", StringComparison.OrdinalIgnoreCase))
            return;
        var rosOpts = ConfigOptionsProvider.GetOptions<RosSettingsOptions>();
        var battlenetOpts = ConfigOptionsProvider.GetOptions<BattlenetOptions>();
        var d3Opts = ConfigOptionsProvider.GetOptions<D3Options>();
        var rosbotOpts = ConfigOptionsProvider.GetOptions<RosbotOptions>();
        TxtRosDirectory.Text = rosOpts.RosDirectory ?? "";
        TxtBattlenetPath.Text = battlenetOpts.BattlenetPath ?? "";
        TxtD3Path.Text = d3Opts.D3Path ?? "";
        ChkAutoEnableLatestRos.IsChecked = rosOpts.AutoEnableLatestRos;
        ChkPickupBloodShards.IsChecked = rosbotOpts.PickupBloodShards;
        ChkPreventStuck.IsChecked = rosbotOpts.PreventStuck;
        ChkBluePortalPriority.IsChecked = rosbotOpts.BluePortalPriority;
        ChkSmartEcho.IsChecked = rosbotOpts.SmartEcho;
        TxtSmartEchoWaitSeconds.Text = rosbotOpts.SmartEchoWaitSeconds.ToString();
        ChkFirstbornBlueGateReuse.IsChecked = rosbotOpts.FirstbornBlueGateReuse;
        ChkStartup.IsChecked = rosbotOpts.Startup;
        ChkTestMode.IsChecked = rosbotOpts.TestMode;
        TxtTestTimeoutMinutes.Text = rosbotOpts.TestTimeoutMinutes.ToString();
        ChkTimeoutRestart.IsChecked = battlenetOpts.TimeoutRestart;
        TxtTimeoutMinutes.Text = rosbotOpts.TimeoutMinutes.ToString();
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
            D3CheckConfigService.Instance.SetValueAsync(ConfigKeys.RosSettingsBattlenetRegionCache, region);
        D3CheckConfigService.Instance.QueueSave();
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

    private void BtnUpdateRosbot_Click(object sender, RoutedEventArgs e)
    {
        ColorPrinter.Gray("[DEBUG][ROSBOT UI] BtnUpdateRosbot clicked.");
        var (zipPath, isNewer, versionStr, region) = RosbotUpdateManager.Instance.CheckUpdate();
        if (zipPath == null || !isNewer)
        {
            ColorPrinter.Gray($"[DEBUG][ROSBOT UI] BtnUpdateRosbot: CheckUpdate zipPath={(zipPath != null ? "set" : "null")} isNewer={isNewer} region={region ?? "null"}.");
            ColorPrinter.Blue("[ROSBOT] No newer ROSBOT zip found in Downloads (region: " + (region ?? "unknown") + "). Place zip (20–50MB, name matching region) in: " + RosbotUpdateManager.Instance.GetDownloadsDir());
            string downloadsPath = RosbotUpdateManager.Instance.GetDownloadsDir();
            string noUpdateMessage = (region != "asia" && region != "cn")
                ? "ROSBOT update is only supported for Asia/CN region. Current region: " + (region ?? "unknown") + ".\nSet Battle.net path and region (asia/cn), then try again."
                : "No newer ROSBOT zip found in Downloads (region: " + (region ?? "unknown") + ").\nPlace zip (20–50MB, name matching region) in:\n" + downloadsPath;
            D3CheckCenterMessageWindow.ShowNoUpdate(Window.GetWindow(this), noUpdateMessage);
            return;
        }
        string message = "Apply ROSBOT update from:\n" + zipPath + "\nVersion: " + (versionStr ?? "?") + "\nProceed?";
        if (System.Windows.MessageBox.Show(message, "ROSBOT Update", MessageBoxButton.YesNo, MessageBoxImage.Question) != MessageBoxResult.Yes || string.IsNullOrEmpty(region)) return;
        bool ok = RosbotUpdateManager.Instance.ApplyUpdate(zipPath, region, versionStr);
        if (ok)
        {
            ColorPrinter.Green("[ROSBOT] Update applied.");
            RefreshPathFromConfig();
            GameInterfaceData.Instance.NotifyCallbacks();
        }
        else
            ColorPrinter.Yellow("[ROSBOT] Update failed.");
    }

    /// <summary>Open Tampermonkey script in Notepad. 1:1 Python _open_tampermonkey_script (open_file_with_notepad(TAMPERMONKEY_SCRIPT_PATH)).</summary>
    private void BtnOpenTampermonkey_Click(object sender, RoutedEventArgs e)
    {
        string? path = GetTampermonkeyScriptPath();
        ColorPrinter.Gray($"[DEBUG][ROSBOT UI] BtnOpenTampermonkey clicked. Resolved path={(path ?? "null")}, exists={(!string.IsNullOrWhiteSpace(path) && File.Exists(path))}.");
        if (string.IsNullOrWhiteSpace(path) || !File.Exists(path))
        {
            var msg = (D3CheckI18n.Provider.GetUiText(I18nKeys.RosbotLogFileNotFound) ?? "File not found or could not open.") + "\n" + (path ?? "");
            MessageBox.Show(Window.GetWindow(this) as Window, msg, D3CheckI18n.Provider.GetUiText(I18nKeys.RosbotWarning) ?? "Warning", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }
        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = "notepad.exe",
                ArgumentList = { path },
                UseShellExecute = true
            });
        }
        catch (Exception ex)
        {
            ColorPrinter.Red("[ROSBOT] Open Tampermonkey script failed: " + ex.Message);
        }
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
