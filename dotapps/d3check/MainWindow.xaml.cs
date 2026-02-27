using System.IO;
using System.Diagnostics;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Threading;
using DotApps.d3check.Config;
using DotApps.d3check.Config.Options;
using DotApps.d3check.Constants;
using DotApps.d3check.Hotkeys;
using DotApps.d3check.I18n;
using DotApps.d3check.Pages.Main;
using DotApps.d3check.Pages.Rosbot;
using DotApps.d3check.Pages.D4;
using DotApps.d3check.Pages.Calibration;
using DotApps.d3check.Pages.Log;
using DotApps.d3check.StatusBar;
using DotApps.d3check.Services;
using DotApps.d3check.Ui;
using DotApps.d3check.Windows;
using DotCore.Common;
using DotApps.d3check.Core;
using DotApps.d3check.Core.Battlenet;
using DotApps.d3check.Ctl;
using DotCore.Foundations;
using DotCore.ScreenCapture;
using DotCore.UITheme.StatusBar;
using DotCore.Utils;

namespace DotApps.d3check;

public partial class MainWindow : Window, IMainWindowHost
{
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
    private D3CheckHotkeyBinder? _hotkeyBinder;
    private IEventHub? _eventHub;
    private CombatMacroController? _combatMacroController;
    private DispatcherTimer? _statePollTimer;
    /// <summary>2s tick for BN-only flow when EnsureBattlenetOnlyEnabled. 1:1 Python process_rosbot_task tick%2 + tick_bn_only_flow.</summary>
    private DispatcherTimer? _bnOnlyFlowTimer;
    /// <summary>True after auto path scan was triggered once due to BN/ROSBOT mismatch; reset when path matches region. 1:1 Python _mismatch_scan_triggered.</summary>
    private bool _mismatchScanTriggered;

    public MainWindow()
    {
        InitializeComponent();
        MinWidth = AppConstants.DefaultWindowWidth;
        MinHeight = AppConstants.DefaultWindowHeight;
        ApplyDefaultGeometry();
        Loaded += OnLoaded;
        Closing += OnClosing;
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        D3CheckConfigService.Instance.Load();
        D3CheckI18n.EnsureInitialized();
        BattlenetManager.Instance.SetPathProvider(() => ConfigOptionsProvider.GetOptions<BattlenetOptions>().BattlenetPath ?? "");
        // D3 window finder: same CONFIG key as 一键扫描 (ApplyScanResults writes ConfigKeys.D3Path) and RosbotPage TxtD3Path; priority = configured exe first, then title match.
        D3WindowFinder.SetConfigPathProvider(() => ConfigOptionsProvider.GetOptions<D3Options>().D3Path ?? "");

        // 1:1 Python: ensure Battle.net region from config at startup so status bar shows "战网: 正常(亚服)" / "Login(亚服)" with region
        BattlenetRegionDetection.EnsureRegionFromConfigAndCache(
            () => GameInterfaceData.Instance.GetStateSnapshot().BattlenetRegion,
            r => GameInterfaceData.Instance.SetBattlenetRegion(r),
            () => { var r = ConfigOptionsProvider.GetOptions<RosSettingsOptions>().BattlenetRegionCache; return string.IsNullOrEmpty(r) ? null : r; },
            v => { D3CheckConfigService.Instance.SetValueAsync(ConfigKeys.RosSettingsBattlenetRegionCache, v); D3CheckConfigService.Instance.QueueSave(); });

        var helper = new WindowInteropHelper(this);
        helper.EnsureHandle();
        var hwnd = helper.Handle;
        var dispatcher = new MainThreadDispatcher(Dispatcher);
        _hotkeyService = new WindowsGlobalHotkeyService(hwnd, dispatcher);
        var source = HwndSource.FromHwnd(hwnd);
        source?.AddHook(WndProc);
        _hotkeyBinder = new D3CheckHotkeyBinder(_hotkeyService);
        _eventHub = new DefaultEventHub();
        _combatMacroController = new CombatMacroController(_eventHub);
        _hotkeyBinder.SetCombatCallback(() => _combatMacroController.Toggle());
        _hotkeyBinder.SetAssistantCallback(RunAssistantAutoUse);
        _hotkeyBinder.SetAssistantStateProvider(AssistantExecutionState.Instance);
        _hotkeyBinder.Initialize();
        ColorPrinter.Blue("[MAIN] D3Check started; hotkeys registered.");
        UiRegistry.RegisterCombatMacroController(_combatMacroController);
        var provider = D3CheckI18n.Provider;
        provider.LanguageChanged += OnLanguageChanged;

        UiRegistry.RegisterMainUi(this, this);
        ApplyWindowChromeIfAvailable();
        MicaBackdropHelper.TryApplyMica(this);
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
        TitleBar.RestartRequested += (_, _) => RestartApp();

        RefreshAllUiText();
        GameInterfaceData.Instance.RegisterCallback(UpdateStatusFromState);
        GameInterfaceData.Instance.RegisterCallback(OnEnsureBattlenetOnlyStateChanged);
        // Loop that keeps system responsive (1:1 Python: controller.run() = Tk mainloop + timers). DOT: WPF Dispatcher is the main loop; below timers are periodic ticks.
        _statePollTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(100) };
        _statePollTimer.Tick += StatePollTimer_Tick;
        _statePollTimer.Start();
        _bnOnlyFlowTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(2) };
        _bnOnlyFlowTimer.Tick += BnOnlyFlowTimer_Tick;
        StatePollTimer_Tick(null!, EventArgs.Empty);

        TabMain.SelectionChanged += OnTabSelectionChanged;
        SwitchColorPrintToSelectedTab();
    }

    private void OnTabSelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        // Defer to ApplicationIdle so we run after selection/layout/input; avoids re-entrancy and UI freeze (see docs/DOT_TAB_UI_FREEZE_DESIGN.md).
        Dispatcher.BeginInvoke(System.Windows.Threading.DispatcherPriority.ApplicationIdle, (Action)SwitchColorPrintToSelectedTab);
    }

    /// <summary>Route ColorPrint to current tab: Rosbot tab (index 1) -> RosbotPage log; else -> Log tab. 1:1 Python _reregister_log_callback.</summary>
    private void SwitchColorPrintToSelectedTab()
    {
        if (GetPage(AppConstants.PanelKeyLog) is LogPage logPage)
            logPage.UnregisterAsLogTarget();
        if (GetPage(AppConstants.PanelKeyRosbot) is RosbotPage rosbotPage)
            rosbotPage.UnregisterAsLogTarget();
        int idx = TabMain.SelectedIndex;
        if (idx == AppConstants.TabIndexRosbot && GetPage(AppConstants.PanelKeyRosbot) is RosbotPage rb)
            rb.RegisterAsLogTarget();
        else if (GetPage(AppConstants.PanelKeyLog) is LogPage lp)
            lp.RegisterAsLogTarget();
    }

    private void StatePollTimer_Tick(object? sender, EventArgs e)
    {
        // Run state gathering (config read, File.Exists, process enum) on thread pool so UI thread stays responsive.
        // NotifyCallbacks is then posted to UI; tab switch and other input are not blocked by I/O or HasWindow().
        var dispatcher = Dispatcher;
        _ = Task.Run(() =>
        {
            var battlenet = ConfigOptionsProvider.GetOptions<BattlenetOptions>();
            var d3Opts = ConfigOptionsProvider.GetOptions<D3Options>();
            var ros = ConfigOptionsProvider.GetOptions<RosSettingsOptions>();
            string bn = battlenet.BattlenetPath ?? "";
            string d3 = d3Opts.D3Path ?? "";
            string rosDir = ros.RosDirectory ?? "";
            GameInterfaceData.Instance.UpdateFromPaths(bn, d3, rosDir);
            bool hasBn = BattlenetManager.Instance.HasWindow();
            GameInterfaceData.Instance.SetBattlenetWindowFound(hasBn);
            GameInterfaceData.Instance.SetBattlenetNormalAvailable(hasBn);
            bool hasD3 = D3WindowFinder.FindFirstHandle() != IntPtr.Zero;
            GameInterfaceData.Instance.SetD3Status(hasD3);
            dispatcher.InvokeAsync(() => GameInterfaceData.Instance.NotifyCallbacks());
        });
    }

    /// <summary>Start/stop BN-only 2s tick loop when EnsureBattlenetOnlyEnabled changes. 1:1 Python rosbot_task every 1s + tick%2 run tick_bn_only_flow.</summary>
    private void OnEnsureBattlenetOnlyStateChanged(GameInterfaceStateSnapshot s)
    {
        if (_bnOnlyFlowTimer == null) return;
        if (s.EnsureBattlenetOnlyEnabled)
        {
            if (!_bnOnlyFlowTimer.IsEnabled)
            {
                _bnOnlyFlowTimer.Start();
                ColorPrinter.Gray("[DEBUG][BNOnly] 2s tick loop started (Ensure Battle.net on); loop keeps system running until turned off.");
            }
        }
        else
        {
            if (_bnOnlyFlowTimer.IsEnabled)
            {
                _bnOnlyFlowTimer.Stop();
                ColorPrinter.Gray("[DEBUG][BNOnly] 2s tick loop stopped (Ensure Battle.net off).");
            }
        }
    }

    private void BnOnlyFlowTimer_Tick(object? sender, EventArgs e)
    {
        _ = Task.Run(async () =>
        {
            try
            {
                await RosbotFlowController.TickBnOnlyFlowAsync();
            }
            catch (Exception ex)
            {
                ColorPrinter.Gray($"[DEBUG][BNOnly] tick error: {ex.Message}");
            }
        });
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

    /// <summary>
    /// Entry for assistant hotkey. 1:1 with Python GameInterfaceController.run_assistant_auto_use
    /// and GameAssistantController.auto_use_interface_function (state guard, set_running, reset on exit).
    /// Hotkey callback already checked can_start and set_should_stop; here we run the workflow (stub until full auto_use).
    /// </summary>
    private void RunAssistantAutoUse()
    {
        var state = AssistantExecutionState.Instance;
        if (!state.CanStart())
            return;
        state.SetRunning(true);
        try
        {
            ColorPrinter.Blue("[AutoUseInterface] Started (press hotkey again to stop)");
            if (state.ShouldStopAssistant())
            {
                ColorPrinter.Yellow("[AutoUseInterface] Execution stopped by user");
                return;
            }
            // Step 1: capture D3 window and update scale (1:1 Python collect_ui_info)
            if (!D3AssistantCapture.TryCollectUiInfo())
                return;
            if (state.ShouldStopAssistant())
            {
                ColorPrinter.Yellow("[AutoUseInterface] Execution stopped by user");
                return;
            }
            // Step 2: detect interface (template match + left 30%) and optional DEBUG screenshot
            var provider = ScreenCaptureService.GetScreenshotProvider();
            var screenshotData = provider.CurrentScreenshot;
            var gameWindowImage = screenshotData?.GameWindowImage;
            bool showDebugLogs = ConfigOptionsProvider.GetOptions<LogSettingsOptions>().ShowDebugLogs;
            if (showDebugLogs && gameWindowImage != null)
            {
                string debugDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "d3check", "debug_capture");
                try
                {
                    Directory.CreateDirectory(debugDir);
                    int leftWidth = Math.Max(1, (int)(gameWindowImage.Width * D3InterfaceConstants.LeftRegionRatio));
                    int h = gameWindowImage.Height;
                    using (var leftRegion = new Bitmap(leftWidth, h))
                    {
                        using (var g = Graphics.FromImage(leftRegion))
                        {
                            g.DrawImage(gameWindowImage, 0, 0, new Rectangle(0, 0, leftWidth, h), GraphicsUnit.Pixel);
                        }
                        string fileName = "autouse_debug_left30_" + DateTime.Now.ToString("yyyyMMdd_HHmmss") + ".png";
                        string debugPath = Path.Combine(debugDir, fileName);
                        ScreenCaptureService.SaveToFile(leftRegion, debugPath);
                        ColorPrinter.Gray($"[DEBUG][AutoUseInterface] Saved left 30% region ({leftWidth}x{h}) to: {debugPath}");
                    }
                }
                catch (Exception ex)
                {
                    ColorPrinter.Yellow($"[DEBUG][AutoUseInterface] Failed to save debug screenshot: {ex.Message}");
                }
            }
            bool wantBlacksmith = ConfigOptionsProvider.GetOptions<MacroAuxiliaryOptions>().Blacksmith;
            var debugAttempts = showDebugLogs ? new List<InterfaceDetectionAttempt>() : null;
            string? interfaceType = D3InterfaceDetection.DetectInterfaceTypeFromFullWindow(gameWindowImage, wantBlacksmith, D3InterfaceConstants.DefaultMatchThreshold, debugAttempts);
            if (showDebugLogs && gameWindowImage != null && debugAttempts != null && debugAttempts.Count > 0)
            {
                string debugDirAnnot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "d3check", "debug_capture");
                try
                {
                    string annotatorPath = Path.Combine(debugDirAnnot, "autouse_annotator_" + DateTime.Now.ToString("yyyyMMdd_HHmmss") + ".png");
                    D3InterfaceDetectionDebugImage.SaveDebugImage(gameWindowImage, debugAttempts, annotatorPath);
                }
                catch (Exception ex)
                {
                    ColorPrinter.Yellow($"[DEBUG][AutoUseInterface] Failed to save annotator debug image: {ex.Message}");
                }
            }
            if (interfaceType == null)
            {
                ColorPrinter.Gray("[AutoUseInterface] No interface detected (bag/kanai in left 30%); skipping collect_bag and blacksmith/kanai.");
            }
            else
            {
                ColorPrinter.Blue($"[AutoUseInterface] Detected interface: {interfaceType} -> flow (collect_bag / blacksmith|kanai stubbed)");
            }
            if (state.ShouldStopAssistant())
            {
                ColorPrinter.Yellow("[AutoUseInterface] Execution stopped by user");
                return;
            }
            // Step 3: collect_bag_info_from_current_shared — not yet implemented
            ColorPrinter.Yellow("[AutoUseInterface] DOT: collect_bag_info_from_current_shared not yet implemented; skipping.");
            // Step 4: blacksmith/kanai handlers — not yet implemented
            ColorPrinter.Yellow("[AutoUseInterface] DOT: blacksmith/kanai flows not yet implemented. See docs/DOT_REF_辅助宏快捷键启动流程.md §10.");
        }
        finally
        {
            state.ResetState();
        }
    }

    private void OnLanguageChanged(object? sender, LanguageChangedEventArgs e)
    {
        RefreshAllUiText();
    }

    private void OnLanguageSelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (TitleBar.LanguageComboBox.SelectedItem is not LangItem item) return;
        var provider = D3CheckI18n.Provider;
        if (string.Equals(provider.GetCurrentLanguage(), item.Code, StringComparison.OrdinalIgnoreCase)) return;
        provider.SetLanguage(item.Code);
        D3CheckI18n.SaveLanguageToConfig(item.Code);
        RefreshAllUiText();
    }

    private void RefreshAllUiText()
    {
        var p = D3CheckI18n.Provider;
        Title = p.GetUiText(I18nKeys.MainWindowTitle);
        TitleBar.Title = Title;
        TabMainPage.Header = p.GetUiText(I18nKeys.TabsMainFunctions);
        TabRosbot.Header = p.GetUiText(I18nKeys.TabsRosbotExtension);
        TabD4.Header = p.GetUiText(I18nKeys.TabsD4Functions);
        TabCalibration.Header = p.GetUiText(I18nKeys.TabsCoordinateCalibration);
        TabLog.Header = p.GetUiText(I18nKeys.TabsLog);
        TxtMacroStatus.Text = p.GetUiText(I18nKeys.OptionsCurrentActiveConfig);
        BtnScanPaths.Content = p.GetUiText(I18nKeys.BottomBarOneClickScan);
        if (GetPage(AppConstants.PanelKeyMain) is MainPage mainPage)
            mainPage.RefreshI18n();
        if (GetPage(AppConstants.PanelKeyD4) is D4Page d4Page)
            d4Page.RefreshI18n();
        if (GetPage(AppConstants.PanelKeyRosbot) is RosbotPage rosbotPage)
            rosbotPage.RefreshRosbotUiText();
    }

    private void UpdateStatusFromState(GameInterfaceStateSnapshot s)
    {
        var p = D3CheckI18n.Provider;
        // Side effects: region-change and BN/ROSBOT mismatch auto-scan (1:1 Python)
        string? regionKey = s.BattlenetRegion;
        if (regionKey == AppConstants.RegionAsia || regionKey == AppConstants.RegionCn)
        {
            var rosOpts = ConfigOptionsProvider.GetOptions<RosSettingsOptions>();
            string? cached = string.IsNullOrEmpty(rosOpts.BattlenetRegionCache) ? null : rosOpts.BattlenetRegionCache;
            if (cached != regionKey)
            {
                D3CheckConfigService.Instance.SetValueAsync(ConfigKeys.RosSettingsBattlenetRegionCache, regionKey ?? "");
                D3CheckConfigService.Instance.QueueSave();
                if (cached != null)
                    RunRegionChangePathScanAsync();
            }
            string rosDir = rosOpts.RosDirectory ?? "";
            bool match = RosbotPathPicker.PathMatchesRegion(rosDir, regionKey);
            if (match)
                _mismatchScanTriggered = false;
            else if (!string.IsNullOrWhiteSpace(rosDir) && !_mismatchScanTriggered)
            {
                _mismatchScanTriggered = true;
                RunRegionChangePathScanAsync();
            }
        }

        // Centralized display: one place defines text + brush key (D3StatusBarDisplayBuilder), UI only applies
        IStatusBarDisplay d = D3StatusBarDisplayBuilder.Build(s, p);
        TxtMacroStatus.Text = d.CurrentConfigLabel;
        TxtStatusBn.Text = d.BattlenetText;
        TxtStatusBn.Foreground = (System.Windows.Media.Brush)FindResource(d.BattlenetBrushKey);
        TxtStatusRos.Text = d.RosText;
        TxtStatusRos.Foreground = (System.Windows.Media.Brush)FindResource(d.RosBrushKey);
        TxtStatusD3.Text = d.D3Text;
        TxtStatusD3.Foreground = (System.Windows.Media.Brush)FindResource(d.D3BrushKey);
        TxtStatusMap.Text = d.MapText;
        TxtStatusMap.Foreground = (System.Windows.Media.Brush)FindResource(d.MapBrushKey);
        TxtStatusStage.Text = d.StageText;
        TxtStatusStage.Foreground = (System.Windows.Media.Brush)FindResource(d.StageBrushKey);
        TxtStatusOauth.Text = d.OauthText;
        TxtStatusOauth.Foreground = (System.Windows.Media.Brush)FindResource(d.OauthBrushKey);
        TxtStatusWindowSize.Text = d.WindowSizeText;
        TxtStatusWindowSize.Foreground = (System.Windows.Media.Brush)FindResource(d.WindowSizeBrushKey);
        TxtTestMode.Text = d.TestModeText;
        TxtPathBn.Text = d.PathBnText;
        TxtPathBn.Foreground = (System.Windows.Media.Brush)FindResource(d.PathBnBrushKey);
        TxtPathD3.Text = d.PathD3Text;
        TxtPathD3.Foreground = (System.Windows.Media.Brush)FindResource(d.PathD3BrushKey);
        TxtPathD4.Text = d.PathD4Text;
        TxtPathD4.Foreground = (System.Windows.Media.Brush)FindResource(d.PathD4BrushKey);
        TxtPathRos.Text = d.PathRosText;
        TxtPathRos.Foreground = (System.Windows.Media.Brush)FindResource(d.PathRosBrushKey);
    }

    private async void BtnScanPaths_Click(object sender, RoutedEventArgs e)
    {
        var battlenet = ConfigOptionsProvider.GetOptions<BattlenetOptions>();
        var d3Opts = ConfigOptionsProvider.GetOptions<D3Options>();
        var rosOpts = ConfigOptionsProvider.GetOptions<RosSettingsOptions>();
        string bn = battlenet.BattlenetPath ?? "";
        string d3 = d3Opts.D3Path ?? "";
        string ros = rosOpts.RosDirectory ?? "";

        var p = D3CheckI18n.Provider;
        BtnScanPaths.IsEnabled = false;
        BtnScanPaths.Content = p.GetUiText(I18nKeys.BottomBarScanning);
        try
        {
            var result = await Task.Run(() => PathScanner.ScanForPaths(
                null, includeRosbot: true, forceScanRosbot: true,
                configuredBattlenet: bn, configuredD3: d3, configuredRosDir: ros));
            await Dispatcher.InvokeAsync(() =>
            {
                ApplyScanResults(result);
            });
        }
        finally
        {
            BtnScanPaths.IsEnabled = true;
            BtnScanPaths.Content = p.GetUiText(I18nKeys.BottomBarOneClickScan);
        }
    }

    /// <summary>Run one path scan in background and apply results on UI thread. Used for region-change and BN/ROSBOT mismatch auto-scan. 1:1 Python _region_changed_callback.</summary>
    private void RunRegionChangePathScanAsync()
    {
        var battlenet = ConfigOptionsProvider.GetOptions<BattlenetOptions>();
        var d3Opts = ConfigOptionsProvider.GetOptions<D3Options>();
        var rosOpts = ConfigOptionsProvider.GetOptions<RosSettingsOptions>();
        string bn = battlenet.BattlenetPath ?? "";
        string d3 = d3Opts.D3Path ?? "";
        string ros = rosOpts.RosDirectory ?? "";
        _ = Task.Run(() => PathScanner.ScanForPaths(
                null, includeRosbot: true, forceScanRosbot: true,
                configuredBattlenet: bn, configuredD3: d3, configuredRosDir: ros))
            .ContinueWith(t =>
            {
                if (t.IsCompletedSuccessfully && t.Result != null)
                    Dispatcher.InvokeAsync(() => ApplyScanResults(t.Result));
            }, TaskScheduler.Default);
    }

    /// <summary>Apply scan results 1:1 Python _apply_scan_results: set BN/D3 when missing or invalid; pick best ROS by region, overwrite_ok (do not overwrite when current valid and matches region and chosen does not).</summary>
    private void ApplyScanResults(PathScanResult result)
    {
        var cfg = D3CheckConfigService.Instance;
        var battlenet = ConfigOptionsProvider.GetOptions<BattlenetOptions>();
        var d3Opts = ConfigOptionsProvider.GetOptions<D3Options>();
        var rosOpts = ConfigOptionsProvider.GetOptions<RosSettingsOptions>();
        string curBn = battlenet.BattlenetPath ?? "";
        string curD3 = d3Opts.D3Path ?? "";
        string curRos = rosOpts.RosDirectory ?? "";
        bool curBnOk = !string.IsNullOrWhiteSpace(curBn) && File.Exists(curBn) && Path.GetFileName(curBn) == D3PathConstants.BattleNetExeName;
        bool curD3Ok = !string.IsNullOrWhiteSpace(curD3) && File.Exists(curD3) && Path.GetFileName(curD3) == D3PathConstants.DiabloIIIExeName;
        bool curRosOk = !string.IsNullOrWhiteSpace(curRos) && (Directory.Exists(curRos) || (File.Exists(curRos) && curRos.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)));

        if (result.BattlenetPath != null && !curBnOk)
            cfg.SetValueAsync(ConfigKeys.BattlenetPath, result.BattlenetPath);
        if (result.D3Path != null && !curD3Ok)
            cfg.SetValueAsync(ConfigKeys.D3Path, result.D3Path);

        string? region = GameInterfaceData.Instance.GetStateSnapshot().BattlenetRegion;
        string? chosen = result.RosbotDirs.Count > 0 ? RosbotPathPicker.PickBestRosbotDirByRegion(result.RosbotDirs, region) : null;
        bool overwriteOk = true;
        if (chosen != null && curRosOk && (region == AppConstants.RegionAsia || region == AppConstants.RegionCn))
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
    }

    /// <summary>Removes the native caption gap (blank line). Uses WindowChrome when available; else 1px negative top margin.</summary>
    private void ApplyWindowChromeIfAvailable()
    {
        var asm = typeof(Window).Assembly;
        var chromeType = asm.GetType("Microsoft.Windows.Shell.WindowChrome") ?? asm.GetType("System.Windows.Shell.WindowChrome");
        if (chromeType != null)
        {
            try
            {
                var setChrome = chromeType.GetMethod("SetWindowChrome", new[] { typeof(Window), chromeType });
                var chromeInstance = Activator.CreateInstance(chromeType);
                chromeType.GetProperty("CaptionHeight")?.SetValue(chromeInstance, 0.0);
                chromeType.GetProperty("ResizeBorderThickness")?.SetValue(chromeInstance, new Thickness(4));
                chromeType.GetProperty("UseAeroCaptionButtons")?.SetValue(chromeInstance, false);
                setChrome?.Invoke(null, new object[] { this, chromeInstance! });
                return;
            }
            catch { /* fallback below */ }
        }
        RootGrid.Margin = new Thickness(0, -1, 0, 0);
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

    private static void RestartApp()
    {
        var path = Environment.ProcessPath ?? Process.GetCurrentProcess().MainModule?.FileName;
        if (!string.IsNullOrEmpty(path))
            Process.Start(path);
        Application.Current.Shutdown();
    }

    private void OnClosing(object? sender, System.ComponentModel.CancelEventArgs e)
    {
        SaveGeometryToConfig();
    }

    /// <summary>Apply preset size and position at startup (single source: AppConstants). Config is not read for size so window is always 800x600 on start.</summary>
    private void ApplyDefaultGeometry()
    {
        if (ParseGeometry(AppConstants.DefaultWindowGeometry, out var w, out var h, out var x, out var y))
        {
            Width = w;
            Height = h;
            Left = x;
            Top = y;
        }
    }

    private void SaveGeometryToConfig()
    {
        var state = WindowState;
        if (state == WindowState.Maximized) return;
        var geo = $"{(int)Width}x{(int)Height}+{(int)Left}+{(int)Top}";
        D3CheckConfigService.Instance.SetValueAsync(ConfigKeys.UiSettingsWindowGeometry, geo);
        D3CheckConfigService.Instance.QueueSave();
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
        _statePollTimer?.Stop();
        _bnOnlyFlowTimer?.Stop();
        GameInterfaceData.Instance.UnregisterCallback(UpdateStatusFromState);
        GameInterfaceData.Instance.UnregisterCallback(OnEnsureBattlenetOnlyStateChanged);
        GameInterfaceData.Instance.SetMarshalToUi(null);
        _hotkeyBinder?.Shutdown();
        UiRegistry.UnregisterMainUi();
        base.OnClosed(e);
    }

    public object? GetPage(string key)
    {
        return key switch
        {
            AppConstants.PanelKeyMain => TabMainPage.Content,
            AppConstants.PanelKeyRosbot => TabRosbot.Content,
            AppConstants.PanelKeyD4 => TabD4.Content,
            AppConstants.PanelKeyCalibration => TabCalibration.Content,
            AppConstants.PanelKeyLog => TabLog.Content,
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

