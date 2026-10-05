// PY-REF: pyapps/d3-check/share/asia_credentials.py
// PY-REF: pyapps/d3-check/ui/panels/rosbot_extension_panel.py
// PY-REF: pyapps/d3-check/ui/diablo3_macro_ui.py
// PY-REF: pyapps/d3-check/timers/one_shot_tasks.py
// PY-REF: pyapps/d3-check/d3utils/path_scanner.py
// PY-REF: pyapps/d3-check/d3utils/event_center.py
// PY-REF: pyapps/d3-check/ui/components/status_item.py
// PY-REF: pyapps/d3-check/ui/components/status_row_config.py
using System.IO;
using System.Diagnostics;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Threading;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Config.Options;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Hotkeys;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.Pages.Main;
using DotApps.d3d4tester.Pages.Rosbot;
using DotApps.d3d4tester.Pages.D4;
using DotApps.d3d4tester.Pages.Calibration;
using DotApps.d3d4tester.Pages.RunLog;
using DotApps.d3d4tester.Pages.Battlenet;
using DotApps.d3d4tester.StatusBar;
using DotApps.d3d4tester.Services;
using DotApps.d3d4tester.Ui;
using DotApps.d3d4tester.Windows;
using DotCore.Common;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Battlenet;
using DotApps.d3d4tester.Core.Flow;
using DotApps.d3d4tester.Ctl;
using DotCore.Foundations;
using DotCore.ScreenCapture;
using DotCore.UITheme.StatusBar;
using DotCore.Utils;

namespace DotApps.d3d4tester;

public partial class MainWindow : Window, IMainWindowHost
{
    private const string GameUiFoundBrushKey = "TextSuccessBrush";
    private const string GameUiMissingBrushKey = "TextMutedBrush";
    private const string WarningBrushKeyGameUi = "TextWarningBrush";
    private const string ErrorBrushKeyGameUi = "TextErrorBrush";
    private const int WM_HOTKEY = 0x0312;
    private const int WM_SIZING = 0x0214;
    private const int WMSZ_LEFT = 1, WMSZ_RIGHT = 2, WMSZ_TOP = 3, WMSZ_BOTTOM = 4;
    private const int WMSZ_TOPLEFT = 5, WMSZ_TOPRIGHT = 6, WMSZ_BOTTOMLEFT = 7, WMSZ_BOTTOMRIGHT = 8;

    [StructLayout(LayoutKind.Sequential)]
    private struct RECT
    {
        public int Left, Top, Right, Bottom;
    }
    private WindowsGlobalHotkeyService? _hotkeyService;
    private D3D4TesterHotkeyBinder? _hotkeyBinder;
    private IEventHub? _eventHub;
    private CombatMacroController? _combatMacroController;
    /// <summary>True after auto path scan was triggered once due to BN/ROSBOT mismatch; reset when path matches region. 1:1 Python _mismatch_scan_triggered.</summary>
    private bool _mismatchScanTriggered;
    private TrayIconService? _trayIcon;
    private DispatcherTimer? _geometrySaveTimer;
    /// <summary>Last path scan submit (UTC); auto scans run at most once per ShellConstants.PathScanThrottleSec. 1:1 Python _path_scan_submit_time.</summary>
    private DateTime _pathScanSubmitUtc = DateTime.MinValue;
    private bool _pathScanInProgress;

    public MainWindow()
    {
        InitializeComponent();
        MinWidth = ShellConstants.MinWindowWidth;
        MinHeight = ShellConstants.MinWindowHeight;
        ApplySavedGeometry();
        Icon = LoadAppIcon();
        Loaded += OnLoaded;
        Closing += OnClosing;
        LocationChanged += (_, _) => ScheduleGeometrySave();
        SizeChanged += (_, _) => ScheduleGeometrySave();
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        D3D4TesterConfigService.Instance.Load();
        D3D4TesterI18n.EnsureInitialized();
        BattlenetManager.Instance.SetPathProvider(() => ConfigOptionsProvider.GetOptions<BattlenetOptions>().BattlenetPath ?? "");
        BattlenetManager.Instance.SetRegionProvider(() => ConfigBinding.GetValue(ConfigKeys.BattlenetRegion, ""));
        // D3 window finder: same CONFIG key as 一键扫描 (ApplyScanResults writes ConfigKeys.D3Path) and RosbotPage TxtD3Path; priority = configured exe first, then title match.
        D3WindowFinder.SetConfigPathProvider(() => ConfigOptionsProvider.GetOptions<D3Options>().D3Path ?? "");

        // 1:1 Python game_interface_data._initialize_battlenet_region_from_config: region at startup for the status bar.
        BattlenetStatusProvider.EnsureBattlenetRegionFromConfig();
        ScreenCaptureService.DefaultGameWindowLocator = GameWindowDetector.Locate;

        var helper = new WindowInteropHelper(this);
        helper.EnsureHandle();
        var hwnd = helper.Handle;
        var dispatcher = new MainThreadDispatcher(Dispatcher);
        _hotkeyService = new WindowsGlobalHotkeyService(hwnd, dispatcher);
        var source = HwndSource.FromHwnd(hwnd);
        source?.AddHook(WndProc);
        _hotkeyBinder = new D3D4TesterHotkeyBinder(_hotkeyService);
        _eventHub = EventCenter.Hub;
        _combatMacroController = new CombatMacroController(_eventHub);
        _hotkeyBinder.SetCombatCallback(() => _combatMacroController.Toggle());
        _hotkeyBinder.SetAssistantCallback(RunAssistantAutoUse);
        _hotkeyBinder.SetAssistantStateProvider(AssistantExecutionState.Instance);
        _hotkeyBinder.Initialize();
        ColorPrinter.Blue("[MAIN] D3D4Tester started; hotkeys registered.");
        UiRegistry.RegisterCombatMacroController(_combatMacroController);
        var provider = D3D4TesterI18n.Provider;
        provider.LanguageChanged += OnLanguageChanged;

        UiRegistry.RegisterMainUi(this, this);
        EventCenter.RegisterMainThreadHandlers(this);
        ShutdownManager.RegisterUi(this);
        // Flow-triggered credentials dialog: B10a calls this when Asia credentials are missing; show on UI thread and block until closed. 1:1 Python schedule_battlenet_credentials_dialog.
        RosbotFlowController.SetShowCredentialsDialogAndWait(region =>
        {
            bool? result = null;
            Application.Current.Dispatcher.Invoke(() =>
            {
                var d = new CredentialsDialog(region) { Owner = this };
                result = d.ShowDialog();
                ColorPrinter.Gray($"[DEBUG][MainWindow] CredentialsDialog ShowDialog returned {result}");
            });
            return result == true;
        });
        GameInterfaceData.Instance.SetMarshalToUi(a =>
        {
            if (Dispatcher.CheckAccess())
                a();
            else
                Dispatcher.InvokeAsync(a);
        });
        BattlenetGuardService.Initialize();
        StartupShortcutService.Initialize();
        BattlenetNetHoldService.Initialize();
        RosbotPluginConfigSync.Initialize();

        var langList = provider.GetSupportedLanguages()
            .OrderBy(c => c, StringComparer.Ordinal)
            .Select(code => new LangItem(code, provider.GetLanguageDisplayNames().TryGetValue(code, out var d) ? d : code))
            .ToList();
        TitleBar.LanguageComboBox.ItemsSource = langList;
        TitleBar.LanguageComboBox.DisplayMemberPath = nameof(LangItem.Display);
        TitleBar.LanguageComboBox.SelectedValuePath = nameof(LangItem.Code);
        var currentCode = provider.GetCurrentLanguage();
        var selected = langList.FirstOrDefault(x => string.Equals(x.Code, currentCode, StringComparison.OrdinalIgnoreCase));
        TitleBar.LanguageComboBox.SelectedItem = selected ?? langList.FirstOrDefault();
        TitleBar.LanguageComboBox.SelectionChanged += OnLanguageSelectionChanged;

        TitleBar.RestoreSizeRequested += (_, _) => RestorePresetSize();
        TitleBar.RestartRequested += (_, _) => EventCenter.TriggerAppRestart();

        RefreshAllUiText();
        GameInterfaceData.Instance.RegisterCallback(UpdateStatusFromState);

        TabMain.SelectedIndex = LoadLastSelectedTab();
        TabMain.SelectionChanged += OnTabSelectionChanged;
        SwitchColorPrintToSelectedTab();

        // Single 1 s TickDriver (flow % 2, smart echo % 3, inactive refresh % 10) replaces the 100 ms poll and the 2 s BN timer. 1:1 Python rosbot_task.
        TickDriver.Instance.RegisterEveryTick(RefreshPathState);
        RosbotTaskProcessor.Instance.Install();
        LoginTryController.Initialize();
        InitializeShell();
    }

    /// <summary>
    /// Shell wiring after the UI is built: shutdown hooks, window monitor, first-run topmost, deferred tray, startup path scan.
    /// 1:1 Python Diablo3MacroUI.__init__ tail + D3MacroController.run (tray start, startup_path_scan_needed).
    /// </summary>
    private void InitializeShell()
    {
        ShutdownManager.RegisterStopLogWatching(RosbotTaskProcessor.Instance.StopLogWatching);
        ShutdownManager.RegisterHotkeyStop(() => _hotkeyBinder?.Shutdown());
        ShutdownManager.RegisterShutdownHook(() => SaveGeometryToConfig());
        ShutdownManager.RegisterTrayStop(() => _trayIcon?.Stop());
        WindowMonitorService.Instance.Register();
        _ = Task.Run(WindowMonitorService.Instance.RunInitialCheck);
        ApplyFirstRunTopmost();
        RunAfter(ShellConstants.TrayStartDelayMs, StartSystemTrayIfNeeded);
        if (StartupPathScanNeeded())
            RunAfter(ShellConstants.StartupPathScanDelayMs, SubmitPathScanIfThrottleOk);
    }

    /// <summary>Start the tray once (deferred so the shell is ready). 1:1 Python start_system_tray_if_needed.</summary>
    private void StartSystemTrayIfNeeded()
    {
        if (ShutdownManager.IsShutdownRequested) return;
        _trayIcon ??= new TrayIconService(SwitchToTab);
        if (_trayIcon.IsRunning) return;
        if (Icon is ImageSource icon && _trayIcon.Start(icon, Title))
            ColorPrinter.Green("[UI] System tray started successfully");
        else
            ColorPrinter.Yellow("[UI] System tray failed to start");
    }

    /// <summary>Tray notification (no-op before the tray starts). 1:1 Python SystemTray.show_notification.</summary>
    public void ShowTrayNotification(string title, string message) => _trayIcon?.ShowNotification(title, message);

    /// <summary>
    /// Switch to tab by index (0-based, clamped), persist it, re-route logs and bring the window to front.
    /// Used by the tray Debug menu. 1:1 Python switch_to_tab.
    /// </summary>
    public void SwitchToTab(int index)
    {
        int idx = Math.Clamp(index, 0, Math.Max(0, TabMain.Items.Count - 1));
        if (TabMain.SelectedIndex != idx)
            TabMain.SelectedIndex = idx;
        else
            SaveLastSelectedTab(idx);
        Show();
        if (WindowState == WindowState.Minimized) WindowState = WindowState.Normal;
        Activate();
        TabMain.Focus();
        ColorPrinter.Blue($"[UI] Switched to tab {idx}");
    }

    /// <summary>Saved tab, clamped; never restores to Calibration. 1:1 Python _load_last_tab.
    /// Fixes Python bug: the 6-tab migration (index - 1) ran on every load, so a saved 5-tab index restored the wrong tab.</summary>
    private static int LoadLastSelectedTab()
    {
        int last = D3D4TesterConfigService.Instance.GetValueSafe(ConfigKeys.UiSettingsLastSelectedTab, AppConstants.TabIndexMain);
        last = Math.Clamp(last, 0, AppConstants.TabCount - 1);
        return last == AppConstants.TabIndexCalibration ? AppConstants.TabIndexMain : last;
    }

    private static void SaveLastSelectedTab(int index)
    {
        D3D4TesterConfigService.Instance.SetValueAsync(ConfigKeys.UiSettingsLastSelectedTab, index);
    }

    /// <summary>Lift and briefly topmost once, then focus. 1:1 Python _apply_first_run_topmost / _clear_first_run_topmost.</summary>
    private void ApplyFirstRunTopmost()
    {
        Topmost = true;
        Activate();
        RunAfter(ShellConstants.FirstRunTopmostMs, () =>
        {
            Topmost = false;
            Activate();
            Focus();
        });
    }

    private void RunAfter(int delayMs, Action action)
    {
        var timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(delayMs) };
        timer.Tick += (_, _) =>
        {
            timer.Stop();
            action();
        };
        timer.Start();
    }

    /// <summary>App icon: config ui_settings.app_icon (absolute or relative to the app dir), else the embedded default icon.</summary>
    private static ImageSource? LoadAppIcon()
    {
        string cfg = ConfigOptionsProvider.GetOptions<UiSettingsOptions>().AppIcon ?? "";
        try
        {
            if (!string.IsNullOrWhiteSpace(cfg))
            {
                string path = Path.IsPathRooted(cfg) ? cfg : Path.Combine(AppContext.BaseDirectory, cfg);
                if (File.Exists(path))
                    return System.Windows.Media.Imaging.BitmapFrame.Create(new Uri(Path.GetFullPath(path)));
            }
            return System.Windows.Media.Imaging.BitmapFrame.Create(new Uri(ShellConstants.DefaultAppIconPackUri, UriKind.Absolute));
        }
        catch (Exception ex)
        {
            ColorPrinter.Yellow($"[UI] App icon load failed: {ex.Message}");
            return null;
        }
    }

    /// <summary>True when BN, D3 or ROSBOT path is missing or invalid. 1:1 Python startup_path_scan_needed.</summary>
    private static bool StartupPathScanNeeded() => !PathScanner.ArePathsValidForSkipScan(
        ConfigOptionsProvider.GetOptions<BattlenetOptions>().BattlenetPath,
        ConfigOptionsProvider.GetOptions<D3Options>().D3Path,
        ConfigOptionsProvider.GetOptions<RosSettingsOptions>().RosDirectory);

    private void OnTabSelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (!ReferenceEquals(e.OriginalSource, TabMain)) return;
        // Defer to ApplicationIdle so we run after selection/layout/input; avoids re-entrancy and UI freeze (see docs/DOT_TAB_UI_FREEZE_DESIGN.md).
        Dispatcher.BeginInvoke(DispatcherPriority.ApplicationIdle, (Action)(() =>
        {
            int idx = TabMain.SelectedIndex;
            if (idx < 0) return;
            SaveLastSelectedTab(idx);
            SwitchColorPrintToSelectedTab();
            ColorPrinter.Blue($"[UI] Tab changed to: {idx}");
        }));
    }

    /// <summary>
    /// Route ColorPrint to the current tab's panel only: Rosbot -> RosbotPage, D4 -> D4Page, Log -> RunLogPage; Main and
    /// Calibration have no sink. 1:1 Python _reregister_log_callback.
    /// </summary>
    private void SwitchColorPrintToSelectedTab()
    {
        if (GetPage(AppConstants.PanelKeyLog) is RunLogPage logPage)
            logPage.UnregisterAsLogTarget();
        if (GetPage(AppConstants.PanelKeyRosbot) is RosbotPage rosbotPage)
            rosbotPage.UnregisterAsLogTarget();
        if (GetPage(AppConstants.PanelKeyD4) is D4Page d4Page)
            d4Page.UnregisterAsLogTarget();
        switch (TabMain.SelectedIndex)
        {
            case AppConstants.TabIndexRosbot when GetPage(AppConstants.PanelKeyRosbot) is RosbotPage rb:
                rb.RegisterAsLogTarget();
                break;
            case AppConstants.TabIndexD4 when GetPage(AppConstants.PanelKeyD4) is D4Page d4:
                d4.RegisterAsLogTarget();
                break;
            case AppConstants.TabIndexLog when GetPage(AppConstants.PanelKeyLog) is RunLogPage lp:
                lp.RegisterAsLogTarget();
                break;
        }
    }

    /// <summary>Per-tick path validity (bottom bar icons, ROSBOT version); notify only on change. Window/dynamic state comes from the status providers.</summary>
    private static void RefreshPathState(IFlowTick _)
    {
        var game = GameInterfaceData.Instance;
        var before = game.GetStateSnapshot();
        game.UpdateFromPaths(
            ConfigOptionsProvider.GetOptions<BattlenetOptions>().BattlenetPath ?? "",
            ConfigOptionsProvider.GetOptions<D3Options>().D3Path ?? "",
            ConfigOptionsProvider.GetOptions<RosSettingsOptions>().RosDirectory ?? "");
        var after = game.GetStateSnapshot();
        if (before.PathValidBn != after.PathValidBn || before.PathValidD3 != after.PathValidD3 || before.PathValidRos != after.PathValidRos
            || before.RosVersionDisplay != after.RosVersionDisplay || before.RosbotExtendedStatus != after.RosbotExtendedStatus)
            game.NotifyCallbacks();
    }

    private IntPtr WndProc(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        if (msg == WM_HOTKEY && _hotkeyService != null)
        {
            ColorPrinter.Gray($"[HOTKEY] WM_HOTKEY received wParam={wParam.ToInt32()}");
            _hotkeyService.OnWmHotkey(wParam.ToInt32());
            handled = true;
            return IntPtr.Zero;
        }
        if (msg == WM_SIZING && lParam != IntPtr.Zero)
        {
            int minW = (int)MinWidth;
            int minH = (int)MinHeight;
            var rect = Marshal.PtrToStructure<RECT>(lParam);
            int w = rect.Right - rect.Left;
            int h = rect.Bottom - rect.Top;
            int edge = wParam.ToInt32();
            if (w < minW)
            {
                if (edge == WMSZ_LEFT || edge == WMSZ_TOPLEFT || edge == WMSZ_BOTTOMLEFT)
                    rect.Left = rect.Right - minW;
                else
                    rect.Right = rect.Left + minW;
            }
            if (h < minH)
            {
                if (edge == WMSZ_TOP || edge == WMSZ_TOPLEFT || edge == WMSZ_TOPRIGHT)
                    rect.Top = rect.Bottom - minH;
                else
                    rect.Bottom = rect.Top + minH;
            }
            Marshal.StructureToPtr(rect, lParam, false);
        }
        return IntPtr.Zero;
    }

    /// <summary>Assistant hotkey entry; flow lives in GameAssistantController.</summary>
    private void RunAssistantAutoUse() => GameAssistantController.Instance.AutoUseInterfaceFunction();

    private void OnLanguageChanged(object? sender, LanguageChangedEventArgs e)
    {
        RefreshAllUiText();
    }

    private void OnLanguageSelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (TitleBar.LanguageComboBox.SelectedItem is not LangItem item) return;
        var provider = D3D4TesterI18n.Provider;
        if (string.Equals(provider.GetCurrentLanguage(), item.Code, StringComparison.OrdinalIgnoreCase)) return;
        provider.SetLanguage(item.Code);
        D3D4TesterI18n.SaveLanguageToConfig(item.Code);
        RefreshAllUiText();
    }

    private void RefreshAllUiText()
    {
        var p = D3D4TesterI18n.Provider;
        Title = p.GetUiText(I18nKeys.MainWindowTitle);
        TitleBar.Title = Title;
        TabMainPage.Header = p.GetUiText(I18nKeys.TabsMainFunctions);
        TabRosbot.Header = p.GetUiText(I18nKeys.TabsRosbotExtension);
        TabD4.Header = p.GetUiText(I18nKeys.TabsD4Functions);
        TabCalibration.Header = p.GetUiText(I18nKeys.TabsCoordinateCalibration);
        TabLog.Header = p.GetUiText(I18nKeys.TabsLog);
        TabBattlenet.Header = p.GetUiText(I18nKeys.TabsBattlenetManagement);
        TabDecompile.Header = p.GetUiText(I18nKeys.TabsDecompile);
        BtnScanPaths.Content = p.GetUiText(_pathScanInProgress ? I18nKeys.BottomBarScanning : I18nKeys.BottomBarOneClickScan);
        BtnScanPaths.ToolTip = p.GetUiText(I18nKeys.BottomBarOneClickScanTooltip);
        GameInterfaceData.Instance.NotifyCallbacks();
        if (GetPage(AppConstants.PanelKeyMain) is MainPage mainPage)
            mainPage.RefreshI18n();
        if (GetPage(AppConstants.PanelKeyD4) is D4Page d4Page)
            d4Page.RefreshI18n();
        if (GetPage(AppConstants.PanelKeyRosbot) is RosbotPage rosbotPage)
            rosbotPage.RefreshRosbotUiText();
        if (GetPage(AppConstants.PanelKeyLog) is RunLogPage runLogPage && runLogPage.IsLoaded)
            runLogPage.RefreshI18n();
        if (GetPage(AppConstants.PanelKeyBattlenet) is BattlenetPage battlenetPage && battlenetPage.IsLoaded)
            battlenetPage.RefreshI18n();
        if (GetPage(AppConstants.PanelKeyDecompile) is Pages.Decompile.DecompilePage decompilePage && decompilePage.IsLoaded)
            decompilePage.RefreshI18n();
    }

    private void UpdateStatusFromState(GameInterfaceStateSnapshot s)
    {
        var p = D3D4TesterI18n.Provider;
        UpdateGameUiIcons(s, p);
        // Side effects: region-change and BN/ROSBOT mismatch auto-scan (1:1 Python)
        string? regionKey = s.BattlenetRegion;
        if (regionKey == BattlenetConstants.RegionAsia || regionKey == BattlenetConstants.RegionCn)
        {
            var rosOpts = ConfigOptionsProvider.GetOptions<RosSettingsOptions>();
            string? cached = string.IsNullOrEmpty(rosOpts.BattlenetRegionCache) ? null : rosOpts.BattlenetRegionCache;
            if (cached != regionKey)
            {
                D3D4TesterConfigService.Instance.SetValueAsync(ConfigKeys.RosSettingsBattlenetRegionCache, regionKey ?? "");
                D3D4TesterConfigService.Instance.QueueSave();
                if (cached != null)
                    SubmitPathScanIfThrottleOk();
            }
            string rosDir = rosOpts.RosDirectory ?? "";
            bool match = RosbotPathPicker.PathMatchesRegion(rosDir, regionKey);
            if (match)
                _mismatchScanTriggered = false;
            else if (!string.IsNullOrWhiteSpace(rosDir) && !_mismatchScanTriggered)
            {
                _mismatchScanTriggered = true;
                SubmitPathScanIfThrottleOk();
            }
        }

        // Centralized display: one place defines text + brush key (D3StatusBarDisplayBuilder), UI only applies
        IStatusBarDisplay d = D3StatusBarDisplayBuilder.Build(s, p);
        TxtMacroStatus.Text = d.CurrentConfigLabel;
        ApplyChip(ChipBn, TxtStatusBn, d.BattlenetText, d.BattlenetBrushKey);
        ApplyChip(ChipRos, TxtStatusRos, d.RosText, d.RosBrushKey);
        ApplyChip(ChipD3, TxtStatusD3, d.D3Text, d.D3BrushKey);
        ApplyChip(ChipMap, TxtStatusMap, d.MapText, d.MapBrushKey);
        ApplyChip(ChipStage, TxtStatusStage, d.StageText, d.StageBrushKey);
        ApplyChip(ChipOauth, TxtStatusOauth, d.OauthText, d.OauthBrushKey);
        TxtStatusWindowSize.Text = d.WindowSizeText;
        TxtStatusWindowSize.SetResourceReference(TextBlock.ForegroundProperty, d.WindowSizeBrushKey);
        TxtTestMode.Text = d.TestModeText;
        TxtTestMode.Visibility = string.IsNullOrEmpty(d.TestModeText) ? Visibility.Collapsed : Visibility.Visible;
        ApplyChip(ChipPathBn, TxtPathBn, d.PathBnText, d.PathBnBrushKey);
        ApplyChip(ChipPathD3, TxtPathD3, d.PathD3Text, d.PathD3BrushKey);
        ApplyChip(ChipPathD4, TxtPathD4, d.PathD4Text, d.PathD4BrushKey);
        ApplyChip(ChipPathRos, TxtPathRos, d.PathRosText, d.PathRosBrushKey);
    }

    /// <summary>Semantic chip style from the builder's brush key (success / warning / danger / neutral); text inherits the chip foreground.</summary>
    private void ApplyChip(Border chip, TextBlock text, string value, string brushKey)
    {
        text.Text = value;
        text.ClearValue(TextBlock.ForegroundProperty);
        string styleKey = D3StatusBarDisplayBuilder.ChipStyleKeyForBrush(brushKey);
        if (TryFindResource(styleKey) is Style style && !ReferenceEquals(chip.Style, style))
            chip.Style = style;
    }

    private void BtnScanPaths_Click(object sender, RoutedEventArgs e)
    {
        _pathScanSubmitUtc = DateTime.UtcNow;
        RunPathScanAsync();
    }

    /// <summary>
    /// Region change, BN/ROSBOT version mismatch or startup (paths invalid): full scan at most once per 5 s.
    /// 1:1 Python _submit_path_scan_if_throttle_ok.
    /// </summary>
    private void SubmitPathScanIfThrottleOk()
    {
        var now = DateTime.UtcNow;
        if ((now - _pathScanSubmitUtc).TotalSeconds < ShellConstants.PathScanThrottleSec) return;
        _pathScanSubmitUtc = now;
        RunPathScanAsync();
    }

    /// <summary>
    /// Scan drives (force ROSBOT discovery), then apply a newer ROSBOT zip silently, then apply results on the UI thread.
    /// The scan button shows the scanning state meanwhile. 1:1 Python do_path_scan (scan_for_paths + do_rosbot_update(silent=True)).
    /// </summary>
    private async void RunPathScanAsync()
    {
        if (_pathScanInProgress) return;
        _pathScanInProgress = true;
        string bn = ConfigOptionsProvider.GetOptions<BattlenetOptions>().BattlenetPath ?? "";
        string d3 = ConfigOptionsProvider.GetOptions<D3Options>().D3Path ?? "";
        string ros = ConfigOptionsProvider.GetOptions<RosSettingsOptions>().RosDirectory ?? "";
        var p = D3D4TesterI18n.Provider;
        BtnScanPaths.IsEnabled = false;
        BtnScanPaths.Content = p.GetUiText(I18nKeys.BottomBarScanning);
        try
        {
            var result = await Task.Run(async () =>
            {
                var r = PathScanner.ScanForPaths(null, includeRosbot: true, forceScanRosbot: true,
                    configuredBattlenet: bn, configuredD3: d3, configuredRosDir: ros);
                await RosbotUpdateManager.Instance.RunUpdateFlowAsync(silent: true, confirm: null, showNoUpdate: null);
                return r;
            });
            if (result != null && !ShutdownManager.IsShutdownRequested)
                ApplyScanResults(result);
        }
        catch (Exception ex)
        {
            ColorPrinter.Red($"[PathScan] Scan failed: {ex.Message}");
            if (!ShutdownManager.IsShutdownRequested)
                MessageBox.Show(this, ex.Message, p.GetUiText(I18nKeys.RosbotError), MessageBoxButton.OK, MessageBoxImage.Error);
        }
        finally
        {
            _pathScanInProgress = false;
            BtnScanPaths.IsEnabled = true;
            BtnScanPaths.Content = D3D4TesterI18n.Provider.GetUiText(I18nKeys.BottomBarOneClickScan);
        }
    }

    /// <summary>Apply scan results 1:1 Python _apply_scan_results: set BN/D3 when missing or invalid; pick best ROS by region, overwrite_ok (do not overwrite when current valid and matches region and chosen does not).</summary>
    private void ApplyScanResults(PathScanResult result)
    {
        var cfg = D3D4TesterConfigService.Instance;
        var battlenet = ConfigOptionsProvider.GetOptions<BattlenetOptions>();
        var d3Opts = ConfigOptionsProvider.GetOptions<D3Options>();
        var rosOpts = ConfigOptionsProvider.GetOptions<RosSettingsOptions>();
        string curBn = battlenet.BattlenetPath ?? "";
        string curD3 = d3Opts.D3Path ?? "";
        string curRos = rosOpts.RosDirectory ?? "";
        bool curBnOk = PathScanner.IsConfiguredBattlenetValid(curBn);
        bool curD3Ok = PathScanner.IsConfiguredD3Valid(curD3);
        bool curRosOk = PathScanner.IsRosPathUsable(curRos);

        if (result.BattlenetPath != null && !curBnOk)
            cfg.SetValueAsync(ConfigKeys.BattlenetPath, result.BattlenetPath);
        if (result.D3Path != null && !curD3Ok)
            cfg.SetValueAsync(ConfigKeys.D3Path, result.D3Path);

        string? region = GameInterfaceData.Instance.GetStateSnapshot().BattlenetRegion;
        string? chosen = result.RosbotDirs.Count > 0 ? RosbotPathPicker.PickBestRosbotDirByRegion(result.RosbotDirs, region) : null;
        bool overwriteOk = true;
        if (chosen != null && curRosOk && (region == BattlenetConstants.RegionAsia || region == BattlenetConstants.RegionCn))
        {
            if (RosbotPathPicker.PathMatchesRegion(curRos, region) && !RosbotPathPicker.PathMatchesRegion(chosen, region))
                overwriteOk = false;
        }
        bool didWriteRos = chosen != null && overwriteOk && (!curRosOk || !string.Equals(Path.GetFullPath(curRos).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar),
                Path.GetFullPath(chosen).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar), StringComparison.OrdinalIgnoreCase));
        if (didWriteRos)
            cfg.SetValueAsync(ConfigKeys.RosSettingsRosDirectory, chosen!);

        cfg.QueueSave();
        string finalBn = result.BattlenetPath ?? curBn;
        string finalD3 = result.D3Path ?? curD3;
        string finalRos = didWriteRos ? chosen! : (rosOpts.RosDirectory ?? "");
        GameInterfaceData.Instance.UpdateFromPaths(finalBn, finalD3, finalRos);
        GameInterfaceData.Instance.NotifyCallbacks();
        if (GetPage(AppConstants.PanelKeyRosbot) is RosbotPage rosbotPage)
            rosbotPage.RefreshPathFromConfig();
        if (result.BattlenetPath == null && result.D3Path == null && result.RosbotDirs.Count == 0)
            ShowScanNothingFound();
    }

    /// <summary>Nothing found at all: list the missing executables. 1:1 Python _apply_scan_results messagebox.showinfo(rosbot.scan_done).</summary>
    private void ShowScanNothingFound()
    {
        var p = D3D4TesterI18n.Provider;
        string message = string.Join(Environment.NewLine,
            p.GetUiText(I18nKeys.RosbotScanNotFoundBattlenet),
            p.GetUiText(I18nKeys.RosbotScanNotFoundD3),
            p.GetUiText(I18nKeys.RosbotScanNotFoundRosbot));
        MessageBox.Show(this, message, p.GetUiText(I18nKeys.RosbotScanDone), MessageBoxButton.OK, MessageBoxImage.Information);
    }

    private void RestorePresetSize()
    {
        WindowState = WindowState.Normal;
        if (ParseGeometry(AppConstants.DefaultWindowGeometry, out var w, out var h, out var x, out var y))
        {
            Width = Math.Max(w, MinWidth);
            Height = Math.Max(h, MinHeight);
            Left = x;
            Top = y;
            SaveGeometryToConfig();
        }
    }

    /// <summary>
    /// Window close (title bar X, Alt+F4) goes through the shutdown sequence; the close proceeds once ShutdownManager runs.
    /// 1:1 Python _on_window_close (save geometry, trigger_app_exit).
    /// </summary>
    private void OnClosing(object? sender, System.ComponentModel.CancelEventArgs e)
    {
        if (ShutdownManager.IsShutdownInProgress) return;
        e.Cancel = true;
        SaveGeometryToConfig();
        ColorPrinter.Blue("[UI] Window close button clicked - sending shutdown request");
        EventCenter.TriggerAppExit();
    }

    /// <summary>
    /// Startup geometry: saved ui_settings.window_geometry (when it fits the virtual screen and the minimum size), else the preset.
    /// 1:1 Python initial_geos = CONFIG ui_settings.window_geometry or DEFAULT_WINDOW_GEOMETRY.
    /// </summary>
    private void ApplySavedGeometry()
    {
        string saved = ConfigOptionsProvider.GetOptions<UiSettingsOptions>().WindowGeometry ?? "";
        if (!ParseGeometry(saved, out var w, out var h, out var x, out var y) || !IsGeometryOnScreen(w, h, x, y))
            ParseGeometry(AppConstants.DefaultWindowGeometry, out w, out h, out x, out y);
        Width = Math.Max(w, MinWidth);
        Height = Math.Max(h, MinHeight);
        Left = x;
        Top = y;
    }

    private static bool IsGeometryOnScreen(int w, int h, int x, int y)
    {
        if (w <= 1 || h <= 1) return false;
        double left = SystemParameters.VirtualScreenLeft;
        double top = SystemParameters.VirtualScreenTop;
        double right = left + SystemParameters.VirtualScreenWidth;
        double bottom = top + SystemParameters.VirtualScreenHeight;
        return x + ShellConstants.MinWindowWidth / 2 > left && x < right - ShellConstants.MinWindowWidth / 2 && y >= top && y < bottom - ShellConstants.MinWindowHeight / 2;
    }

    /// <summary>Debounced geometry save on move/resize. 1:1 Python _on_window_configure (800 ms).</summary>
    private void ScheduleGeometrySave()
    {
        if (!IsLoaded || ShutdownManager.IsShutdownInProgress) return;
        if (_geometrySaveTimer == null)
        {
            _geometrySaveTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(ShellConstants.GeometrySaveDebounceMs) };
            _geometrySaveTimer.Tick += (_, _) =>
            {
                _geometrySaveTimer.Stop();
                SaveGeometryToConfig();
            };
        }
        _geometrySaveTimer.Stop();
        _geometrySaveTimer.Start();
    }

    /// <summary>Persist WxH+X+Y (skipped while maximized/minimized). 1:1 Python _save_window_geometry.</summary>
    private void SaveGeometryToConfig()
    {
        if (WindowState != WindowState.Normal || ActualWidth <= 1 || ActualHeight <= 1) return;
        var geo = $"{(int)Width}x{(int)Height}+{(int)Left}+{(int)Top}";
        if (geo == ConfigOptionsProvider.GetOptions<UiSettingsOptions>().WindowGeometry) return;
        D3D4TesterConfigService.Instance.SetValueAsync(ConfigKeys.UiSettingsWindowGeometry, geo);
    }

    private static bool ParseGeometry(string geo, out int w, out int h, out int x, out int y)
    {
        w = h = x = y = 0;
        var parts = geo.Split('+');
        if (parts.Length < 3) return false;
        var wh = parts[0].Split('x');
        if (wh.Length != 2) return false;
        return int.TryParse(wh[0], out w) && int.TryParse(wh[1], out h)
            && int.TryParse(parts[1], out x) && int.TryParse(parts[2], out y);
    }

    protected override void OnClosed(EventArgs e)
    {
        RosbotSmartEchoCoordinator.Shutdown();
        RosbotLogLoginTryRegistry.LoginTryCallback = null;
        TickDriver.Instance.Unregister(RefreshPathState);
        RosbotTaskProcessor.Instance.Uninstall();
        GameInterfaceData.Instance.UnregisterCallback(UpdateStatusFromState);
        GameInterfaceData.Instance.SetMarshalToUi(null);
        _hotkeyBinder?.Shutdown();
        _geometrySaveTimer?.Stop();
        _trayIcon?.Stop();
        WindowMonitorService.Instance.Unregister();
        UiRegistry.UnregisterMainUi();
        base.OnClosed(e);
    }

    /// <summary>
    /// Status bar: verified BattleTag with presence icon, then a D3 and a D4 badge (coloured when the nav tab is recognised) each
    /// carrying its page's action icon (Play / Update / Install / Try For Free / Starting). Icons only; text is in tooltips.
    /// </summary>
    private void UpdateGameUiIcons(GameInterfaceStateSnapshot s, II18nProvider p)
    {
        bool tagKnown = !string.IsNullOrEmpty(s.BattlenetAccountTag);
        bool online = tagKnown && s.BattlenetClientState == BattlenetClientState.Normal;
        PanelAccountTag.Visibility = tagKnown ? Visibility.Visible : Visibility.Collapsed;
        TxtAccountTag.Text = s.BattlenetAccountTag ?? "";
        IconAccountPresence.SetResourceReference(TextBlock.ForegroundProperty, online ? GameUiFoundBrushKey : ErrorBrushKeyGameUi);
        PanelAccountTag.ToolTip = $"{p.GetUiText(I18nKeys.GameUiAccountTag)}: {s.BattlenetAccountTag} · {s.BattlenetAccountPresence}";
        var ui = s.BattlenetGameUi;
        ApplyGameBadge(BadgeD3, TxtBadgeD3, IconD3Action, ui.D3Tab, ui.D3Action, p.GetUiText(I18nKeys.GameUiD3Tab), p);
        ApplyGameBadge(BadgeD4, TxtBadgeD4, IconD4Action, ui.D4Tab, ui.D4Action, p.GetUiText(I18nKeys.GameUiD4Tab), p);
    }

    private static void ApplyGameBadge(Border badge, TextBlock label, TextBlock icon, bool tabFound, BattlenetGameAction action, string gameName, II18nProvider p)
    {
        string tabBrush = tabFound ? GameUiFoundBrushKey : GameUiMissingBrushKey;
        badge.SetResourceReference(Border.BorderBrushProperty, tabBrush);
        label.SetResourceReference(TextBlock.ForegroundProperty, tabBrush);
        var (glyph, brush, key) = GameActionIcons[action];
        icon.Text = glyph;
        icon.Visibility = action == BattlenetGameAction.None ? Visibility.Collapsed : Visibility.Visible;
        icon.SetResourceReference(TextBlock.ForegroundProperty, brush);
        string tabText = p.GetUiText(tabFound ? I18nKeys.GameUiFound : I18nKeys.GameUiMissing);
        badge.ToolTip = $"{gameName}: {tabText} · {p.GetUiText(key)}";
    }

    private static readonly Dictionary<BattlenetGameAction, (string Glyph, string Brush, string Key)> GameActionIcons = new()
    {
        [BattlenetGameAction.None] = ("", GameUiMissingBrushKey, I18nKeys.GameUiActionNone),
        [BattlenetGameAction.Play] = ("\uE768", GameUiFoundBrushKey, I18nKeys.GameUiActionPlay),
        [BattlenetGameAction.Update] = ("\uE895", WarningBrushKeyGameUi, I18nKeys.GameUiActionUpdate),
        [BattlenetGameAction.Install] = ("\uE896", WarningBrushKeyGameUi, I18nKeys.GameUiActionInstall),
        [BattlenetGameAction.TryFree] = ("\uE719", ErrorBrushKeyGameUi, I18nKeys.GameUiActionTryFree),
        [BattlenetGameAction.Starting] = ("\uE916", GameUiFoundBrushKey, I18nKeys.GameUiActionStarting),
        [BattlenetGameAction.Downloading] = ("\uE896", GameUiFoundBrushKey, I18nKeys.GameUiActionDownloading),
        [BattlenetGameAction.DownloadPaused] = ("\uE769", WarningBrushKeyGameUi, I18nKeys.GameUiActionDownloadPaused),
    };

    public object? GetPage(string key)
    {
        return key switch
        {
            AppConstants.PanelKeyMain => TabMainPage.Content,
            AppConstants.PanelKeyRosbot => TabRosbot.Content,
            AppConstants.PanelKeyD4 => TabD4.Content,
            AppConstants.PanelKeyCalibration => TabCalibration.Content,
            AppConstants.PanelKeyLog => TabLog.Content,
            AppConstants.PanelKeyBattlenet => TabBattlenet.Content,
            AppConstants.PanelKeyDecompile => TabDecompile.Content,
            _ => null
        };
    }

    private sealed class LangItem
    {
        public string Code { get; }
        public string Display { get; }
        public LangItem(string code, string display) { Code = code; Display = display; }
        /// <summary>Theme ComboBox selection box uses ContentTemplate with Text="{Binding}"; ToString() must return the visible label.</summary>
        public override string ToString() => Display;
    }

    private sealed class MainThreadDispatcher : IMainThreadDispatcher
    {
        private readonly System.Windows.Threading.Dispatcher _dispatcher;
        public MainThreadDispatcher(System.Windows.Threading.Dispatcher d) => _dispatcher = d;
        public void Invoke(Action action) => _dispatcher.Invoke(action);
    }
}

