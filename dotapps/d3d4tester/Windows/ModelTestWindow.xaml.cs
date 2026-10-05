// PY-REF: none (DOT-only)
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Globalization;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.Services;
using DotApps.d3d4tester.ViewModels;
using DotApps.d3d4tester.ViewModels.Base;
using DotCore.Common;
using DotCore.ScreenCapture;
using DotCore.Utils;
using DotCore.Utils.ImagePreprocess;
using DotCore.VocAnnotator;
using DotCore.VocAnnotatorUI;
using DotCore.YoloDetect;
using DotCore.YoloRecord;
using DotCore.YoloTaskSet;
using DotCore.YoloTrain;
using OpenCvSharp;
using Rect = OpenCvSharp.Rect;
using Window = System.Windows.Window;

namespace DotApps.d3d4tester.Windows;

/// <summary>
/// Model test window (YOLO_TASKSET_SYNTHESIS_DESIGN.md sections 1.1, 10 U1/U17-U19, 11): run a trained ONNX model on an image
/// file, a screenshot (client window, monitor or picked region), a video file (play, pause, scrub, frame step, whole-video
/// analysis with a cached per-class timeline) or a live capture loop, with confidence / IoU, Full / ROI / Tiled modes, track ids
/// and flicker, per-class counts and timing, plus the hard-example loop (labeled data, batch frame export, task-set variant,
/// task-set negative). Sessions come from the shared YoloModelHost. Detection, decoding and capture run off the UI thread;
/// frames are rendered latest-wins.
/// </summary>
public partial class ModelTestWindow : Window
{
    private const int RedetectDebounceMs = 150;
    private const int FrameBigStep = 10;
    private const int MinLiveFps = 1;
    private const int MaxLiveFps = 60;
    private const int MinTile = 0;
    private const int MaxTile = 8192;
    private const int MaxStep = 10_000;
    private const int CloseWaitMs = 3000;
    private const int TimelineMaxColumns = 2000;
    private const int TimelineRowPixels = 4;
    private const byte TimelineLowAlpha = 0x60;
    private const int WmHotkey = 0x0312;
    private const float TrackMatchIou = 0.3f;
    private const string SnapshotHotkeyId = "model_test_snapshot";
    private const string OnnxExtension = ".onnx";
    private const string OnnxPattern = "*.onnx";
    private const string ConfFormat = "0.00";
    private const string MsFormat = "0.0";
    private const string TimeFormat = @"hh\:mm\:ss\.fff";
    private const string GlyphPlay = "";
    private const string GlyphPause = "";
    private const string ChipIdle = "StatusChipStyle";
    private const string ChipInfo = "StatusChipInfoStyle";
    private const string ChipSuccess = "StatusChipSuccessStyle";
    private const string ChipDanger = "StatusChipDangerStyle";
    private const string LiveSourceRegion = "region";
    private const string LiveSourceClient = "client";
    private const string LiveSourceMonitorPrefix = "monitor:";
    private const string ExportFilterEveryN = "every_n";
    private const string ExportFilterLow = "low_confidence";
    private const string ExportFilterClass = "with_class";
    private static readonly double[] Speeds = { 0.25, 0.5, 1, 2, 0 };

    private readonly ModelTestSession _session = new();
    private readonly TaskSetStore _store = new(TaskSetStore.DefaultRoot);
    private readonly ObservableCollection<AnnotationBox> _boxes = new();
    private readonly ObservableCollection<string> _counts = new();
    private readonly ObservableCollection<string> _tracks = new();
    private readonly Dictionary<string, int> _labelClass = new(StringComparer.Ordinal);
    private readonly Dictionary<string, int> _maxCounts = new(StringComparer.Ordinal);
    private readonly List<string> _externalModels = new();
    private readonly DispatcherTimer _redetectTimer;
    private WindowsGlobalHotkeyService? _hotkeys;
    private HwndSource? _hwndSource;
    private Rendered? _pending;
    private int _renderQueued;
    private double _speed = 1;
    private long _dropped;
    private volatile bool _minimized;
    private ModelTestFrame? _frame;
    private Mat? _still;
    private string? _stillPath;
    private Source _source = Source.Image;
    private string? _videoPath;
    private VideoInfo? _video;
    private int _videoFrame;
    private ModelTestVideoAnalysis? _analysis;
    private CancellationTokenSource? _analyzeCts;
    private CancellationTokenSource? _exportCts;
    private CancellationTokenSource? _playCts;
    private Task _playTask = Task.CompletedTask;
    private IReadOnlyList<Rect> _monitors = Array.Empty<Rect>();
    private Rect? _screenRegion;
    private Rect _pickOrigin;
    private ModelItem? _model;
    private string? _pendingModelPath;
    private string? _sessionExportDir;
    private (int W, int H) _imageSize;
    private bool _picking;
    private bool _rendering;
    private bool _busy;
    private bool _closed;
    private int _modelVersion;
    private int _stillVersion;
    private string _statusStyle = ChipIdle;
    private Func<string> _statusText = () => T(I18nKeys.ModelTestStatusIdle);
    private Func<string> _hardStatus = () => "";
    private Func<string> _analysisStatus = () => "";
    private Func<string> _exportStatus = () => "";

    public ModelTestWindow()
    {
        InitializeComponent();
        _redetectTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(RedetectDebounceMs) };
        _redetectTimer.Tick += async (_, _) =>
        {
            _redetectTimer.Stop();
            await RedetectAsync();
        };
        Canvas.Boxes = _boxes;
        Canvas.LabelColor = label => _labelClass.TryGetValue(label, out int id) ? ClassColor(id) : ClassPalette.Unknown;
        LstCounts.ItemsSource = _counts;
        LstTracks.ItemsSource = _tracks;
        _monitors = ModelTestScreens.Monitors();
        LoadSettings();
        ApplyTexts();
        BindEvents();
        ShowSourcePanels();
        UpdateEnabled();
        D3D4TesterI18n.Provider.LanguageChanged += OnLanguageChanged;
        SourceInitialized += (_, _) => RegisterSnapshotHotkey();
        StateChanged += async (_, _) =>
        {
            _minimized = WindowState == WindowState.Minimized;
            if (_minimized) await PauseAsync();
        };
        Loaded += async (_, _) =>
        {
            RefreshTaskSets();
            await RefreshModelsAsync(_pendingModelPath ?? ConfigBinding.GetValue(ConfigKeys.YoloModelTestLastModel, ""));
        };
    }

    private enum Source { Image, Screen, Video, Live }

    private static string T(string key) => D3D4TesterI18n.Provider.GetUiText(key);

    private static string F(double value, string format) => value.ToString(format, CultureInfo.InvariantCulture);

    private static string I(long value) => value.ToString(CultureInfo.InvariantCulture);

    private static Color ClassColor(int classId) => ClassPalette.Colors[classId % ClassPalette.Colors.Count];

    /// <summary>Show the single model-test window (reused when open), optionally loading a model (.onnx, .pt with a sibling .onnx, or a run dir).</summary>
    public static ModelTestWindow ShowSingle(Window? owner, string? modelPath = null)
    {
        var win = Application.Current.Windows.OfType<ModelTestWindow>().FirstOrDefault();
        if (win == null)
        {
            win = new ModelTestWindow { Owner = owner, _pendingModelPath = modelPath };
            win.Show();
            return win;
        }
        if (win.WindowState == WindowState.Minimized) win.WindowState = WindowState.Normal;
        win.Activate();
        if (modelPath != null && win.IsLoaded) _ = win.RefreshModelsAsync(modelPath);
        return win;
    }

    protected override void OnClosing(CancelEventArgs e)
    {
        base.OnClosing(e);
        if (e.Cancel) return;
        _closed = true;
        _redetectTimer.Stop();
        _playCts?.Cancel();
        _analyzeCts?.Cancel();
        _exportCts?.Cancel();
    }

    protected override void OnClosed(EventArgs e)
    {
        base.OnClosed(e);
        D3D4TesterI18n.Provider.LanguageChanged -= OnLanguageChanged;
        _hotkeys?.UnregisterAll();
        _hwndSource?.RemoveHook(WndProc);
        var play = _playTask;
        var frame = _frame;
        var still = _still;
        _frame = null;
        _still = null;
        Canvas.ImageSource = null;
        _ = Task.Run(async () =>
        {
            _session.StopLive();
            await Task.WhenAny(play, Task.Delay(CloseWaitMs));
            _session.Dispose();
            frame?.Dispose();
            still?.Dispose();
            Interlocked.Exchange(ref _pending, null)?.Frame.Dispose();
        });
    }

    // ---------- settings ----------

    private void LoadSettings()
    {
        _rendering = true;
        SldConfidence.Value = Math.Clamp(ConfigBinding.GetValue(ConfigKeys.YoloModelTestConfidence, 0.35), SldConfidence.Minimum, SldConfidence.Maximum);
        SldIou.Value = Math.Clamp(ConfigBinding.GetValue(ConfigKeys.YoloModelTestIou, 0.45), SldIou.Minimum, SldIou.Maximum);
        TxtTileSize.Text = I(ConfigBinding.GetValue(ConfigKeys.YoloModelTestTileSize, 0));
        TxtTileOverlap.Text = I(ConfigBinding.GetValue(ConfigKeys.YoloModelTestTileOverlap, -1));
        TxtRoi.Text = ConfigBinding.GetValue(ConfigKeys.YoloModelTestRoi, "") ?? "";
        ChkTrack.IsChecked = ConfigBinding.GetValue(ConfigKeys.YoloModelTestTrack, true);
        TxtLiveFps.Text = I(ConfigBinding.GetValue(ConfigKeys.YoloModelTestLiveFps, 10));
        TxtAnalysisStep.Text = I(ConfigBinding.GetValue(ConfigKeys.YoloModelTestAnalysisStep, 1));
        TxtExportEvery.Text = I(ConfigBinding.GetValue(ConfigKeys.YoloModelTestExportEvery, 10));
        TxtExportLow.Text = F(ConfigBinding.GetValue(ConfigKeys.YoloModelTestExportLowConfidence, 0.5), ConfFormat);
        _screenRegion = ModelTestSession.ParseRect(ConfigBinding.GetValue(ConfigKeys.YoloModelTestScreenRegion, ""));
        _rendering = false;
    }

    private ModelTestMode Mode => (CboMode.SelectedItem as Choice<ModelTestMode>)?.Value ?? ModelTestMode.Auto;

    private ModelTestSettings CurrentSettings() => new(
        Mode,
        (float)SldConfidence.Value,
        (float)SldIou.Value,
        ConfigBinding.ParseInt(TxtTileSize.Text, MinTile, MaxTile, 0),
        ConfigBinding.ParseInt(TxtTileOverlap.Text, -1, MaxTile, -1),
        ModelTestSession.ParseRect(TxtRoi.Text),
        ChkTrack.IsChecked == true);

    private double LiveFps => ConfigBinding.ParseInt(TxtLiveFps.Text, MinLiveFps, MaxLiveFps, 10);

    private int AnalysisStep => ConfigBinding.ParseInt(TxtAnalysisStep.Text, 1, MaxStep, 1);

    private string LiveSource => (CboLiveSource.SelectedItem as Choice<string>)?.Value ?? LiveSourceRegion;

    private YoloExecutionProvider? Provider => (CboProvider.SelectedItem as Choice<YoloExecutionProvider?>)?.Value;

    private ModelTestExportFilter ExportFilter => (CboExportFilter.SelectedItem as Choice<ModelTestExportFilter>)?.Value ?? ModelTestExportFilter.EveryN;

    private void OnSettingsChanged()
    {
        if (_rendering) return;
        UpdateSliderLabels();
        if (_session.IsLive)
        {
            _session.UpdateLive(CurrentSettings(), LiveFps);
            return;
        }
        _redetectTimer.Stop();
        _redetectTimer.Start();
    }

    // ---------- texts ----------

    private void OnLanguageChanged(object? sender, LanguageChangedEventArgs e) => Dispatcher.InvokeAsync(() =>
    {
        ApplyTexts();
        RefreshTaskSets();
        RenderModelInfo();
        _ = RefreshModelsAsync(null);
        if (_frame != null) RenderDetections(_frame);
        RenderFrameInfo();
    });

    private void ApplyTexts()
    {
        Title = T(I18nKeys.ModelTestWindowTitle);
        LblModel.Text = T(I18nKeys.ModelTestSectionModel);
        BtnBrowseModel.Content = T(I18nKeys.ModelTestModelBrowse);
        SetTip(BtnRefreshModels, I18nKeys.ModelTestModelRefresh);
        LblProvider.Text = T(I18nKeys.ModelTestProviderLabel);
        LblSource.Text = T(I18nKeys.ModelTestSectionSource);
        RadioImage.Content = T(I18nKeys.ModelTestSourceImage);
        RadioScreen.Content = T(I18nKeys.ModelTestSourceScreen);
        RadioVideo.Content = T(I18nKeys.ModelTestSourceVideo);
        RadioLive.Content = T(I18nKeys.ModelTestSourceLive);
        BtnOpenImage.Content = T(I18nKeys.ModelTestOpenImage);
        BtnOpenVideo.Content = T(I18nKeys.ModelTestOpenVideo);
        LblAnalysisStep.Text = T(I18nKeys.ModelTestAnalysisStep);
        BtnCaptureScreen.Content = T(I18nKeys.ModelTestCaptureScreen);
        BtnPickRegion.Content = T(I18nKeys.ModelTestPickRegion);
        LblLiveSource.Text = T(I18nKeys.ModelTestLiveSourceLabel);
        LblLiveFps.Text = T(I18nKeys.ModelTestLiveFps);
        BtnLiveStart.Content = T(I18nKeys.ModelTestLiveStart);
        BtnLiveStop.Content = T(I18nKeys.ModelTestLiveStop);
        LblDetect.Text = T(I18nKeys.ModelTestSectionDetect);
        LblMode.Text = T(I18nKeys.ModelTestModeLabel);
        LblTileSize.Text = T(I18nKeys.ModelTestTileSize);
        LblTileOverlap.Text = T(I18nKeys.ModelTestTileOverlap);
        LblRoi.Text = T(I18nKeys.ModelTestRoiLabel);
        TxtRoi.ToolTip = T(I18nKeys.ModelTestRoiTooltip);
        ChkTrack.Content = T(I18nKeys.ModelTestTrack);
        LblHard.Text = T(I18nKeys.ModelTestSectionHard);
        LblExportDir.Text = T(I18nKeys.ModelTestExportDirLabel);
        BtnExportDir.Content = T(I18nKeys.ModelTestExportDirChoose);
        BtnSaveLabeled.Content = T(I18nKeys.ModelTestSaveLabeled);
        var hotkey = ConfigBinding.GetValue(ConfigKeys.YoloModelTestSnapshotHotkey, "") ?? "";
        BtnSaveLabeled.ToolTip = T(I18nKeys.ModelTestSnapshotHotkey).Replace("{hotkey}", hotkey);
        LblTaskSet.Text = T(I18nKeys.ModelTestTaskSetLabel);
        LblTarget.Text = T(I18nKeys.ModelTestTargetLabel);
        TglMarkMissed.Content = T(I18nKeys.ModelTestMarkMissed);
        TglMarkMissed.ToolTip = T(I18nKeys.ModelTestMarkMissedHint);
        BtnNegative.Content = T(I18nKeys.ModelTestNegative);
        LblExport.Text = T(I18nKeys.ModelTestExportSection);
        LblExportEvery.Text = T(I18nKeys.ModelTestExportEvery);
        LblExportLow.Text = T(I18nKeys.ModelTestExportLow);
        LblExportClass.Text = T(I18nKeys.ModelTestExportClass);
        BtnFit.Content = T(I18nKeys.ModelTestFit);
        SetTip(BtnFramePrev, I18nKeys.ModelTestFramePrev);
        SetTip(BtnFrameNext, I18nKeys.ModelTestFrameNext);
        SetTip(BtnFrameBack, I18nKeys.ModelTestFrameBack);
        SetTip(BtnFrameForward, I18nKeys.ModelTestFrameForward);
        SetTip(CboSpeed, I18nKeys.ModelTestSpeed);
        SetTip(ImgTimeline, I18nKeys.ModelTestTimelineTip);
        LblStats.Text = T(I18nKeys.ModelTestSectionStats);
        LblCounts.Text = T(I18nKeys.ModelTestSectionCounts);
        LblTracks.Text = T(I18nKeys.ModelTestSectionTracks);
        UpdatePlayButton();
        UpdateAnalyzeButton();
        UpdateExportButton();
        UpdateSliderLabels();
        RenderHint();
        RenderRegion();
        RenderExportDir();
        RebuildChoices();
        SetStatus(_statusStyle, _statusText);
        TxtHardStatus.Text = _hardStatus();
        TxtAnalysis.Text = _analysisStatus();
        TxtExportStatus.Text = _exportStatus();
    }

    private static void SetTip(FrameworkElement element, string key)
    {
        element.ToolTip = T(key);
        System.Windows.Automation.AutomationProperties.SetName(element, T(key));
    }

    private void RebuildChoices()
    {
        bool was = _rendering;
        _rendering = true;
        var modeValue = (CboMode.SelectedItem as Choice<ModelTestMode>)?.Value
            ?? (Enum.TryParse(ConfigBinding.GetValue(ConfigKeys.YoloModelTestMode, ""), true, out ModelTestMode m) ? m : ModelTestMode.Auto);
        var modes = new[]
        {
            new Choice<ModelTestMode>(T(I18nKeys.ModelTestModeAuto), ModelTestMode.Auto),
            new Choice<ModelTestMode>(T(I18nKeys.ModelTestModeFull), ModelTestMode.Full),
            new Choice<ModelTestMode>(T(I18nKeys.ModelTestModeRoi), ModelTestMode.Roi),
            new Choice<ModelTestMode>(T(I18nKeys.ModelTestModeTiled), ModelTestMode.Tiled),
        };
        CboMode.ItemsSource = modes;
        CboMode.SelectedItem = modes.First(c => c.Value == modeValue);

        var liveValue = (CboLiveSource.SelectedItem as Choice<string>)?.Value ?? ConfigBinding.GetValue(ConfigKeys.YoloModelTestLiveSource, LiveSourceRegion);
        var lives = new List<Choice<string>>
        {
            new(T(I18nKeys.ModelTestLiveSourceRegion), LiveSourceRegion),
            new(T(I18nKeys.ModelTestLiveSourceClient), LiveSourceClient),
        };
        for (int i = 0; i < _monitors.Count; i++)
        {
            var b = _monitors[i];
            lives.Add(new(T(i == 0 ? I18nKeys.ModelTestLiveSourceMonitorPrimary : I18nKeys.ModelTestLiveSourceMonitor)
                .Replace("{index}", I(i + 1)).Replace("{width}", I(b.Width)).Replace("{height}", I(b.Height)), LiveSourceMonitorPrefix + I(i)));
        }
        CboLiveSource.ItemsSource = lives;
        CboLiveSource.SelectedItem = lives.FirstOrDefault(c => c.Value == liveValue) ?? lives[0];

        var providerValue = CboProvider.SelectedItem is Choice<YoloExecutionProvider?> pc ? pc.Value : ConfiguredProvider();
        var providers = new List<Choice<YoloExecutionProvider?>> { new(T(I18nKeys.ModelTestProviderDefault), null) };
        providers.AddRange(Enum.GetValues<YoloExecutionProvider>().Select(p => new Choice<YoloExecutionProvider?>(p.ToString(), p)));
        CboProvider.ItemsSource = providers;
        CboProvider.SelectedItem = providers.FirstOrDefault(c => c.Value == providerValue) ?? providers[0];

        double speed = (CboSpeed.SelectedItem as Choice<double>)?.Value ?? 1;
        var speeds = Speeds.Select(s => new Choice<double>(s > 0 ? T(I18nKeys.ModelTestSpeedValue).Replace("{value}", F(s, "0.##")) : T(I18nKeys.ModelTestSpeedMax), s)).ToList();
        CboSpeed.ItemsSource = speeds;
        CboSpeed.SelectedItem = speeds.First(c => c.Value == speed);

        var filterValue = (CboExportFilter.SelectedItem as Choice<ModelTestExportFilter>)?.Value ?? ParseExportFilter(ConfigBinding.GetValue(ConfigKeys.YoloModelTestExportFilter, ""));
        var filters = new[]
        {
            new Choice<ModelTestExportFilter>(T(I18nKeys.ModelTestExportFilterEveryN), ModelTestExportFilter.EveryN),
            new Choice<ModelTestExportFilter>(T(I18nKeys.ModelTestExportFilterLow), ModelTestExportFilter.LowConfidence),
            new Choice<ModelTestExportFilter>(T(I18nKeys.ModelTestExportFilterClass), ModelTestExportFilter.WithClass),
        };
        CboExportFilter.ItemsSource = filters;
        CboExportFilter.SelectedItem = filters.First(c => c.Value == filterValue);
        _rendering = was;
    }

    private static YoloExecutionProvider? ConfiguredProvider()
    {
        var value = ConfigBinding.GetValue(ConfigKeys.YoloModelTestProvider, "");
        return string.IsNullOrWhiteSpace(value) ? null : YoloDetectorOptions.ParseProvider(value);
    }

    private static ModelTestExportFilter ParseExportFilter(string? value) => value switch
    {
        ExportFilterLow => ModelTestExportFilter.LowConfidence,
        ExportFilterClass => ModelTestExportFilter.WithClass,
        _ => ModelTestExportFilter.EveryN,
    };

    private static string ExportFilterName(ModelTestExportFilter filter) => filter switch
    {
        ModelTestExportFilter.LowConfidence => ExportFilterLow,
        ModelTestExportFilter.WithClass => ExportFilterClass,
        _ => ExportFilterEveryN,
    };

    private void UpdateSliderLabels()
    {
        LblConfidence.Text = T(I18nKeys.ModelTestConfidence).Replace("{value}", F(SldConfidence.Value, ConfFormat));
        LblIou.Text = T(I18nKeys.ModelTestIou).Replace("{value}", F(SldIou.Value, ConfFormat));
    }

    private void RenderHint() => TxtHint.Text = T(_picking ? I18nKeys.ModelTestPickRegionHint
        : TglMarkMissed.IsChecked == true ? I18nKeys.ModelTestMarkMissedHint : I18nKeys.ModelTestViewerHint);

    private void RenderRegion() => TxtRegion.Text = _screenRegion is { } r
        ? T(I18nKeys.ModelTestRegion).Replace("{region}", ModelTestSession.FormatRect(r))
        : T(I18nKeys.ModelTestRegionNone);

    private void RenderExportDir()
    {
        var dir = ConfigBinding.GetValue(ConfigKeys.YoloModelTestExportDir, "");
        TxtExportDir.Text = string.IsNullOrWhiteSpace(dir) ? _sessionExportDir ?? T(I18nKeys.ModelTestExportDirDefault) : dir;
    }

    private void SetStatus(string style, Func<string> text)
    {
        _statusStyle = style;
        _statusText = text;
        ChipStatus.SetResourceReference(StyleProperty, style);
        TxtStatus.Text = text();
    }

    private void SetHardStatus(Func<string> text)
    {
        _hardStatus = text;
        TxtHardStatus.Text = text();
    }

    private void SetAnalysisStatus(Func<string> text)
    {
        _analysisStatus = text;
        TxtAnalysis.Text = text();
    }

    private void SetExportStatus(Func<string> text)
    {
        _exportStatus = text;
        TxtExportStatus.Text = text();
    }

    private void ShowError(Exception ex)
    {
        var message = ex.Message;
        SetStatus(ChipDanger, () => T(I18nKeys.ModelTestStatusError).Replace("{message}", message));
    }

    private static Func<string> ErrorText(Exception ex)
    {
        var message = ex.Message;
        return () => T(I18nKeys.ModelTestStatusError).Replace("{message}", message);
    }

    // ---------- events ----------

    private void BindEvents()
    {
        CboModel.SelectionChanged += async (_, _) =>
        {
            if (!_rendering && CboModel.SelectedItem is ModelItem item && !ReferenceEquals(item, _model)) await LoadModelAsync(item);
        };
        BtnBrowseModel.Click += async (_, _) => await BrowseModelAsync();
        BtnRefreshModels.Click += async (_, _) => await RefreshModelsAsync(null);
        CboProvider.SelectionChanged += async (_, _) =>
        {
            if (_rendering) return;
            ConfigBinding.SaveString(ConfigKeys.YoloModelTestProvider, Provider?.ToString().ToLowerInvariant() ?? "");
            if (_model != null) await LoadModelAsync(_model);
        };

        RadioImage.Checked += (_, _) => SwitchSource(Source.Image);
        RadioScreen.Checked += (_, _) => SwitchSource(Source.Screen);
        RadioVideo.Checked += (_, _) => SwitchSource(Source.Video);
        RadioLive.Checked += (_, _) => SwitchSource(Source.Live);
        BtnOpenImage.Click += async (_, _) => await OpenImageAsync();
        BtnOpenVideo.Click += async (_, _) => await OpenVideoAsync();
        BtnAnalyze.Click += async (_, _) => await ToggleAnalyzeAsync();
        TxtAnalysisStep.LostFocus += (_, _) =>
            TxtAnalysisStep.Text = I(ConfigBinding.SaveInt(ConfigKeys.YoloModelTestAnalysisStep, TxtAnalysisStep.Text, 1, MaxStep, 1));
        BtnCaptureScreen.Click += async (_, _) => await CaptureStillAsync();
        BtnPickRegion.Click += async (_, _) => await BeginPickRegionAsync();
        BtnLiveStart.Click += (_, _) => StartLive();
        BtnLiveStop.Click += (_, _) => StopLive();
        CboLiveSource.SelectionChanged += (_, _) =>
        {
            if (_rendering) return;
            ConfigBinding.SaveString(ConfigKeys.YoloModelTestLiveSource, LiveSource);
            if (_session.IsLive) StartLive();
        };
        TxtLiveFps.LostFocus += (_, _) =>
        {
            TxtLiveFps.Text = I(ConfigBinding.SaveInt(ConfigKeys.YoloModelTestLiveFps, TxtLiveFps.Text, MinLiveFps, MaxLiveFps, 10));
            OnSettingsChanged();
        };

        CboMode.SelectionChanged += (_, _) =>
        {
            if (_rendering) return;
            ConfigBinding.SaveString(ConfigKeys.YoloModelTestMode, Mode.ToString().ToLowerInvariant());
            OnSettingsChanged();
        };
        TxtTileSize.LostFocus += (_, _) =>
        {
            TxtTileSize.Text = I(ConfigBinding.SaveInt(ConfigKeys.YoloModelTestTileSize, TxtTileSize.Text, MinTile, MaxTile, 0));
            OnSettingsChanged();
        };
        TxtTileOverlap.LostFocus += (_, _) =>
        {
            TxtTileOverlap.Text = I(ConfigBinding.SaveInt(ConfigKeys.YoloModelTestTileOverlap, TxtTileOverlap.Text, -1, MaxTile, -1));
            OnSettingsChanged();
        };
        TxtRoi.LostFocus += (_, _) =>
        {
            TxtRoi.Text = ModelTestSession.FormatRect(ModelTestSession.ParseRect(TxtRoi.Text));
            ConfigBinding.SaveString(ConfigKeys.YoloModelTestRoi, TxtRoi.Text);
            OnSettingsChanged();
        };
        SldConfidence.ValueChanged += (_, _) =>
        {
            if (_rendering) return;
            ConfigBinding.SetValue(ConfigKeys.YoloModelTestConfidence, Math.Round(SldConfidence.Value, 2));
            OnSettingsChanged();
        };
        SldIou.ValueChanged += (_, _) =>
        {
            if (_rendering) return;
            ConfigBinding.SetValue(ConfigKeys.YoloModelTestIou, Math.Round(SldIou.Value, 2));
            OnSettingsChanged();
        };
        ChkTrack.Click += (_, _) =>
        {
            ConfigBinding.SaveCheckbox(ConfigKeys.YoloModelTestTrack, ChkTrack.IsChecked == true);
            OnSettingsChanged();
        };

        BtnExportDir.Click += (_, _) => ChooseExportDir();
        BtnSaveLabeled.Click += async (_, _) => await SaveLabeledAsync();
        CboTaskSet.SelectionChanged += (_, _) =>
        {
            if (_rendering) return;
            ConfigBinding.SaveString(ConfigKeys.YoloModelTestTaskSet, (CboTaskSet.SelectedItem as Choice<TaskSet>)?.Value.Id ?? "");
            RefreshTargets();
        };
        CboTarget.SelectionChanged += (_, _) => UpdateDrawMode();
        TglMarkMissed.Checked += (_, _) => UpdateDrawMode();
        TglMarkMissed.Unchecked += (_, _) => UpdateDrawMode();
        BtnNegative.Click += async (_, _) => await AddNegativeAsync();
        CboExportFilter.SelectionChanged += (_, _) =>
        {
            if (_rendering) return;
            ConfigBinding.SaveString(ConfigKeys.YoloModelTestExportFilter, ExportFilterName(ExportFilter));
            UpdateEnabled();
        };
        TxtExportEvery.LostFocus += (_, _) =>
            TxtExportEvery.Text = I(ConfigBinding.SaveInt(ConfigKeys.YoloModelTestExportEvery, TxtExportEvery.Text, 1, MaxStep, 10));
        TxtExportLow.LostFocus += (_, _) =>
            TxtExportLow.Text = F(ConfigBinding.SaveDouble(ConfigKeys.YoloModelTestExportLowConfidence, TxtExportLow.Text, 0.01, 1, 0.5), ConfFormat);
        BtnExportFrames.Click += async (_, _) => await ToggleExportAsync();

        BtnFit.Click += (_, _) => Canvas.FitToView();
        BtnPlay.Click += async (_, _) => await TogglePlayAsync();
        BtnFramePrev.Click += async (_, _) => await StepVideoAsync(-1);
        BtnFrameNext.Click += async (_, _) => await StepVideoAsync(1);
        BtnFrameBack.Click += async (_, _) => await StepVideoAsync(-FrameBigStep);
        BtnFrameForward.Click += async (_, _) => await StepVideoAsync(FrameBigStep);
        SldFrame.ValueChanged += (_, _) =>
        {
            if (_rendering || _video == null) return;
            _videoFrame = (int)SldFrame.Value;
            RenderFrameInfo();
            _redetectTimer.Stop();
            _redetectTimer.Start();
        };
        CboSpeed.SelectionChanged += (_, _) => Volatile.Write(ref _speed, (CboSpeed.SelectedItem as Choice<double>)?.Value ?? 1);
        Canvas.BoxDrawn += async (_, box) => await OnBoxDrawnAsync(box);
        Canvas.PreviewMouseDown += (_, _) => Canvas.Focus();
        var keys = new AnnotationCanvasKeys(Canvas) { Escape = new RelayCommand(() => EndPickRegion(null), () => _picking) };
        AnnotationCanvasKeys.Attach(this, keys, async (_, e) => await OnHostKeyDownAsync(e));
    }

    /// <summary>Video keys after the shared canvas map (fit, zoom, Space pan): P play / pause, Left / Right step (Shift x10).</summary>
    private async Task OnHostKeyDownAsync(KeyEventArgs e)
    {
        if (_video == null || Keyboard.FocusedElement is TextBox) return;
        int step = Keyboard.Modifiers.HasFlag(ModifierKeys.Shift) ? FrameBigStep : 1;
        Func<Task>? action = e.Key switch
        {
            Key.P => TogglePlayAsync,
            Key.Left => () => StepVideoAsync(-step),
            Key.Right => () => StepVideoAsync(step),
            _ => null,
        };
        if (action == null) return;
        e.Handled = true;
        await action();
    }

    private void UpdateEnabled()
    {
        bool hasModel = _session.Detector != null && !_busy;
        bool live = _session.IsLive;
        bool video = _playCts != null;
        bool analyzing = _analyzeCts != null;
        bool exporting = _exportCts != null;
        BtnOpenImage.IsEnabled = hasModel;
        BtnOpenVideo.IsEnabled = hasModel && !video && !analyzing && !exporting;
        BtnAnalyze.IsEnabled = analyzing || (hasModel && _video != null && !video && !exporting);
        BtnCaptureScreen.IsEnabled = hasModel && !_picking;
        BtnPickRegion.IsEnabled = !_busy && !live && !_picking;
        BtnLiveStart.IsEnabled = hasModel && !live && !_picking;
        BtnLiveStop.IsEnabled = live;
        CboModel.IsEnabled = !_busy && !analyzing;
        CboProvider.IsEnabled = !_busy && !analyzing;
        BtnBrowseModel.IsEnabled = !_busy && !analyzing;
        bool hasFrame = _frame != null && !_picking;
        BtnSaveLabeled.IsEnabled = hasFrame;
        BtnNegative.IsEnabled = hasFrame && CboTaskSet.SelectedItem != null;
        TglMarkMissed.IsEnabled = hasFrame && CboTarget.SelectedItem != null && !live && !video;
        PanelPlayback.IsEnabled = _video != null && hasModel && !analyzing;
        bool canExport = _analysis != null && _videoPath != null && !analyzing;
        BtnExportFrames.IsEnabled = exporting || canExport;
        CboExportClass.IsEnabled = ExportFilter == ModelTestExportFilter.WithClass;
        TxtExportEvery.IsEnabled = ExportFilter == ModelTestExportFilter.EveryN;
        TxtExportLow.IsEnabled = ExportFilter == ModelTestExportFilter.LowConfidence;
    }

    private void SwitchSource(Source source)
    {
        if (_source == source) return;
        _source = source;
        if (source != Source.Live) StopLive();
        if (source != Source.Video) _ = PauseAsync();
        ShowSourcePanels();
        UpdateEnabled();
    }

    private void ShowSourcePanels()
    {
        static Visibility V(bool visible) => visible ? Visibility.Visible : Visibility.Collapsed;
        PanelImage.Visibility = V(_source == Source.Image);
        PanelVideoSource.Visibility = V(_source == Source.Video);
        PanelCapture.Visibility = V(_source is Source.Screen or Source.Live);
        BtnCaptureScreen.Visibility = V(_source == Source.Screen);
        PanelLive.Visibility = V(_source == Source.Live);
        PanelPlayback.Visibility = V(_source == Source.Video);
        BorderTimeline.Visibility = V(_source == Source.Video && ImgTimeline.Source != null);
        PanelExport.Visibility = V(_source == Source.Video);
    }

    // ---------- snapshot hotkey ----------

    private void RegisterSnapshotHotkey()
    {
        var hotkey = ConfigBinding.GetValue(ConfigKeys.YoloModelTestSnapshotHotkey, "");
        if (string.IsNullOrWhiteSpace(hotkey)) return;
        var hwnd = new WindowInteropHelper(this).Handle;
        _hwndSource = HwndSource.FromHwnd(hwnd);
        _hwndSource?.AddHook(WndProc);
        _hotkeys = new WindowsGlobalHotkeyService(hwnd);
        _hotkeys.Register(SnapshotHotkeyId, hotkey.Trim().ToLowerInvariant(), () => _ = SaveLabeledAsync());
    }

    private IntPtr WndProc(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        if (msg != WmHotkey || _hotkeys == null) return IntPtr.Zero;
        _hotkeys.OnWmHotkey(wParam.ToInt32());
        handled = true;
        return IntPtr.Zero;
    }

    // ---------- models ----------

    private async Task RefreshModelsAsync(string? select)
    {
        var selected = select ?? _model?.OnnxPath;
        if (select != null && ResolveOnnx(select) is { } resolved && !_externalModels.Any(p => PathEquals(p, resolved)))
            _externalModels.Add(resolved);
        IReadOnlyList<ModelItem> items;
        try
        {
            var external = _externalModels.ToList();
            items = await Task.Run(() => ListModels(external));
        }
        catch (Exception ex) when (IsHandled(ex))
        {
            ShowError(ex);
            return;
        }
        if (_closed) return;
        var target = selected == null ? null : ResolveOnnx(selected);
        _rendering = true;
        CboModel.ItemsSource = items;
        var match = items.FirstOrDefault(i => PathEquals(i.OnnxPath, target)) ?? items.FirstOrDefault(i => PathEquals(i.OnnxPath, _model?.OnnxPath));
        CboModel.SelectedItem = match;
        _rendering = false;
        if (match != null && (!PathEquals(match.OnnxPath, _model?.OnnxPath) || _session.IsStale)) await LoadModelAsync(match);
        else
        {
            if (match != null) _model = match;
            RenderModelInfo();
        }
        UpdateEnabled();
    }

    /// <summary>.onnx path for a model file or run dir (best.pt -> sibling .onnx); null when none exists.</summary>
    private static string? ResolveOnnx(string? path)
    {
        if (string.IsNullOrWhiteSpace(path)) return null;
        var full = Path.GetFullPath(path.Trim());
        if (Directory.Exists(full))
        {
            var weights = YoloArtifacts.OnnxPath(full);
            if (File.Exists(weights)) return weights;
            var direct = Path.Combine(full, YoloArtifacts.ExportedOnnxFileName);
            return File.Exists(direct) ? direct : Directory.EnumerateFiles(full, OnnxPattern).FirstOrDefault();
        }
        if (!string.Equals(Path.GetExtension(full), OnnxExtension, StringComparison.OrdinalIgnoreCase))
            full = YoloArtifacts.OnnxPathForWeights(full);
        return File.Exists(full) ? full : null;
    }

    /// <summary>Registry runs with ONNX (task sets and projects) plus browsed files; blocking, call off the UI thread.</summary>
    private static IReadOnlyList<ModelItem> ListModels(IReadOnlyList<string> external)
    {
        var runs = ModelTestSession.ListModelRuns().ToList();
        foreach (var path in external)
        {
            if (runs.Any(r => PathEquals(r.Onnx, path))) continue;
            var run = ModelTestSession.RunOfModel(path);
            runs.Add(run != null && PathEquals(run.Onnx, path) ? run : new YoloRunEntry(Path.GetDirectoryName(path) ?? path, YoloRunScopeKind.Other, "", null, null, null, path, DateTime.MinValue));
        }
        return runs.Select(ToModelItem).ToList();
    }

    private static ModelItem ToModelItem(YoloRunEntry run)
    {
        var info = run.Info;
        var scope = info?.Source?.Name is { Length: > 0 } n ? n : Path.GetFileName(run.ScopeDir);
        var key = run.ScopeKind switch
        {
            YoloRunScopeKind.TaskSet => I18nKeys.ModelTestModelItemTaskSet,
            YoloRunScopeKind.Project => I18nKeys.ModelTestModelItemProject,
            _ => I18nKeys.ModelTestModelItemExternal,
        };
        var display = T(key).Replace("{scope}", scope).Replace("{run}", run.Name).Replace("{file}", Path.GetFileName(run.Onnx ?? ""));
        var best = info?.BestEpoch ?? (run.ScopeKind != YoloRunScopeKind.Other ? YoloResultsCsv.Best(YoloResultsCsv.Read(run.RunDir)) : null);
        return new ModelItem(display, run.Onnx!, ModelTestSession.ProfileFromRun(info), best);
    }

    private async Task BrowseModelAsync()
    {
        var dlg = new Microsoft.Win32.OpenFileDialog { Filter = $"{T(I18nKeys.ModelTestModelFilter)}|{OnnxPattern}" };
        if (_model != null) dlg.InitialDirectory = Path.GetDirectoryName(_model.OnnxPath);
        if (dlg.ShowDialog(this) == true) await RefreshModelsAsync(dlg.FileName);
    }

    private async Task LoadModelAsync(ModelItem item)
    {
        int version = ++_modelVersion;
        await PauseAsync();
        StopLive();
        _busy = true;
        UpdateEnabled();
        var name = Path.GetFileName(item.OnnxPath);
        var options = _session.OptionsFor(Provider);
        SetStatus(ChipInfo, () => T(I18nKeys.ModelTestModelLoading).Replace("{name}", name));
        try
        {
            await Task.Run(() => _session.Load(item.OnnxPath, item.Profile, options));
            if (version != _modelVersion || _closed) return;
            _model = item;
            ConfigBinding.SaveString(ConfigKeys.YoloModelTestLastModel, item.OnnxPath);
            SetStatus(ChipIdle, () => T(I18nKeys.ModelTestStatusIdle));
        }
        catch (Exception ex) when (IsHandled(ex) || ex is Microsoft.ML.OnnxRuntime.OnnxRuntimeException)
        {
            if (version != _modelVersion) return;
            _model = null;
            var message = ex.Message;
            SetStatus(ChipDanger, () => T(I18nKeys.ModelTestModelLoadFailed).Replace("{message}", message));
        }
        finally
        {
            if (version == _modelVersion) _busy = false;
            RenderModelInfo();
            UpdateEnabled();
        }
        if (_model == null) return;
        if (_videoPath != null) await LoadCachedAnalysisAsync();
        await RedetectAsync();
    }

    private void RenderModelInfo()
    {
        var detector = _session.Detector;
        if (_model == null || detector == null)
        {
            TxtModelInfo.Text = T(I18nKeys.ModelTestModelNone);
            return;
        }
        var p = _session.ModelProfile;
        var lines = new List<string>
        {
            T(I18nKeys.ModelTestModelClasses).Replace("{count}", I(detector.ClassNames.Count)).Replace("{classes}", string.Join(", ", detector.ClassNames)),
            _model.Best is { } best
                ? T(I18nKeys.ModelTestModelMetrics).Replace("{epoch}", I(best.Epoch))
                    .Replace("{map50}", F(best.MAP50 ?? 0, ConfFormat)).Replace("{map}", F(best.MAP50To95 ?? 0, ConfFormat))
                    .Replace("{p}", F(best.Precision ?? 0, ConfFormat)).Replace("{r}", F(best.Recall ?? 0, ConfFormat))
                : T(I18nKeys.ModelTestModelNoMetrics),
            T(I18nKeys.ModelTestModelProfile)
                .Replace("{scale}", T(p.ScaleMode == YoloScaleMode.Native ? I18nKeys.ModelTestScaleNative : I18nKeys.ModelTestScaleRelative))
                .Replace("{tile}", p.TileWidth > 0 ? $"{I(p.TileWidth)}x{I(p.TileHeight)}" : $"{I(detector.InputWidth)}x{I(detector.InputHeight)}")
                .Replace("{roi}", p.Roi is { } roi ? ModelTestSession.FormatRect(roi) : T(I18nKeys.ModelTestValueNone)),
            T(I18nKeys.ModelTestModelProvider).Replace("{provider}", detector.ExecutionProvider),
            _model.OnnxPath,
        };
        TxtModelInfo.Text = string.Join(Environment.NewLine, lines);
    }

    // ---------- still sources ----------

    private async Task OpenImageAsync()
    {
        var patterns = string.Join(";", TaskSetStore.ImageExtensions.Select(e => "*" + e));
        var dlg = new Microsoft.Win32.OpenFileDialog { Filter = $"{T(I18nKeys.ModelTestImageFilter)}|{patterns}" };
        if (dlg.ShowDialog(this) != true) return;
        var path = dlg.FileName;
        await RunStillAsync(() =>
        {
            var mat = Cv2.ImRead(path, ImreadModes.Color);
            if (!mat.Empty()) return (mat, 0);
            mat.Dispose();
            return (null, 0);
        }, path, I18nKeys.ModelTestOpenFailed);
    }

    private async Task CaptureStillAsync()
    {
        var provider = CaptureProvider(LiveSource);
        if (provider == null) return;
        await RunStillAsync(() =>
        {
            var watch = System.Diagnostics.Stopwatch.StartNew();
            var mat = provider();
            return (mat, watch.Elapsed.TotalMilliseconds);
        }, null, I18nKeys.ModelTestCaptureFailed);
    }

    /// <summary>Load (decode or capture) a still frame off the UI thread, keep it for re-detection, and show it detected.</summary>
    private async Task RunStillAsync(Func<(Mat? Image, double CaptureMs)> load, string? path, string failKey)
    {
        if (_session.Detector == null)
        {
            SetStatus(ChipDanger, () => T(I18nKeys.ModelTestNoModel));
            return;
        }
        await PauseAsync();
        StopLive();
        CloseVideo();
        int version = ++_stillVersion;
        _busy = true;
        UpdateEnabled();
        SetStatus(ChipInfo, () => T(I18nKeys.ModelTestStatusBusy));
        var settings = CurrentSettings();
        try
        {
            var (image, frame) = await Task.Run(() =>
            {
                var (mat, captureMs) = load();
                if (mat == null) return ((Mat?)null, (Rendered?)null);
                var copy = mat.Clone();
                return (mat, Render(_session.DetectStill(copy, settings, captureMs)));
            });
            if (version != _stillVersion || _closed)
            {
                image?.Dispose();
                frame?.Frame.Dispose();
                return;
            }
            if (image == null || frame == null)
            {
                SetStatus(ChipDanger, () => T(failKey));
                return;
            }
            _still?.Dispose();
            _still = image;
            _stillPath = path;
            ResetStats();
            Show(frame);
            SetStatus(ChipSuccess, () => T(I18nKeys.ModelTestStatusIdle));
        }
        catch (Exception ex) when (IsHandled(ex))
        {
            ShowError(ex);
        }
        finally
        {
            _busy = false;
            UpdateEnabled();
        }
    }

    /// <summary>Re-run detection on the current still image or paused video frame with the current settings.</summary>
    private async Task RedetectAsync()
    {
        if (_session.Detector == null || _picking) return;
        if (_video != null)
        {
            if (_playCts != null) await RestartPlaybackAsync();
            else await SeekVideoAsync(_videoFrame);
            return;
        }
        if (_still is not { } still) return;
        int version = ++_stillVersion;
        var settings = CurrentSettings();
        var copy = still.Clone();
        try
        {
            var frame = await Task.Run(() => Render(_session.DetectStill(copy, settings)));
            if (version != _stillVersion || _closed)
            {
                frame.Frame.Dispose();
                return;
            }
            Show(frame);
        }
        catch (Exception ex) when (IsHandled(ex))
        {
            ShowError(ex);
        }
    }

    // ---------- screen capture ----------

    private static int? MonitorIndex(string source) =>
        source.StartsWith(LiveSourceMonitorPrefix, StringComparison.Ordinal)
        && int.TryParse(source[LiveSourceMonitorPrefix.Length..], NumberStyles.Integer, CultureInfo.InvariantCulture, out int i) ? i : null;

    /// <summary>
    /// Frame provider for the capture source (owned BGR Mat, or null to skip a tick while this window is minimized). The client
    /// window is looked up again when it disappears and its current rectangle is read every tick, so the capture follows moves.
    /// </summary>
    private Func<Mat?>? CaptureProvider(string source)
    {
        var capture = ScreenCaptureService.GetScreenshotProvider();
        if (source == LiveSourceClient)
        {
            var data = new YoloCalibrationData();
            data.LoadFromConfig();
            var hwnd = data.FindClientWindow();
            if (hwnd == IntPtr.Zero)
            {
                SetStatus(ChipDanger, () => T(I18nKeys.ModelTestNoClientWindow));
                return null;
            }
            return () =>
            {
                if (_minimized) return null;
                var mat = ToMat(capture.CaptureWindow(hwnd));
                if (mat == null) hwnd = data.FindClientWindow();
                return mat;
            };
        }
        var rect = source == LiveSourceRegion ? _screenRegion : null;
        if (rect == null && _monitors.Count > 0) rect = _monitors[Math.Clamp(MonitorIndex(source) ?? 0, 0, _monitors.Count - 1)];
        if (rect is not { } r) return () => _minimized ? null : ToMat(capture.CaptureFullScreenBitBlt());
        return () => _minimized ? null : ToMat(capture.CaptureRegionBitBlt(r.X, r.Y, r.Width, r.Height));
    }

    private static Mat? ToMat(System.Drawing.Bitmap? bitmap)
    {
        if (bitmap == null) return null;
        using (bitmap) return ImageConvert.NormalizeToBgr(bitmap);
    }

    /// <summary>Monitor to pick on: the selected monitor source, else the one holding the current region, else the primary.</summary>
    private Rect PickMonitor()
    {
        if (_monitors.Count == 0) return default;
        if (MonitorIndex(LiveSource) is int i) return _monitors[Math.Clamp(i, 0, _monitors.Count - 1)];
        if (_screenRegion is { } r)
            foreach (var m in _monitors)
                if (m.Contains(new OpenCvSharp.Point(r.X, r.Y))) return m;
        return _monitors[0];
    }

    /// <summary>
    /// Region picking happens on a capture of the monitor shown in the canvas (zoomable, pixel exact, DPI independent):
    /// the drawn box is offset by the monitor origin into virtual-screen pixels.
    /// </summary>
    private async Task BeginPickRegionAsync()
    {
        await PauseAsync();
        StopLive();
        var monitor = PickMonitor();
        var capture = ScreenCaptureService.GetScreenshotProvider();
        var full = await Task.Run(() => ToMat(monitor.Width > 0
            ? capture.CaptureRegionBitBlt(monitor.X, monitor.Y, monitor.Width, monitor.Height)
            : capture.CaptureFullScreenBitBlt()));
        if (full == null)
        {
            SetStatus(ChipDanger, () => T(I18nKeys.ModelTestCaptureFailed));
            return;
        }
        BitmapSource bitmap;
        using (full) bitmap = BitmapDecode.FromMat(full);
        _pickOrigin = monitor;
        _picking = true;
        TglMarkMissed.IsChecked = false;
        _boxes.Clear();
        Canvas.FitOnOpen = true;
        Canvas.ImageSource = bitmap;
        _imageSize = (bitmap.PixelWidth, bitmap.PixelHeight);
        UpdateDrawMode();
        UpdateEnabled();
        Canvas.Focus();
    }

    private void EndPickRegion(Rect? region)
    {
        if (!_picking) return;
        _picking = false;
        if (region is { } r)
        {
            _screenRegion = new Rect(r.X + _pickOrigin.X, r.Y + _pickOrigin.Y, r.Width, r.Height);
            ConfigBinding.SaveString(ConfigKeys.YoloModelTestScreenRegion, ModelTestSession.FormatRect(_screenRegion));
            RenderRegion();
            _rendering = true;
            CboLiveSource.SelectedItem = (CboLiveSource.ItemsSource as IEnumerable<Choice<string>>)?.FirstOrDefault(c => c.Value == LiveSourceRegion);
            _rendering = false;
            ConfigBinding.SaveString(ConfigKeys.YoloModelTestLiveSource, LiveSourceRegion);
        }
        UpdateDrawMode();
        if (_frame != null)
        {
            Canvas.FitOnOpen = true;
            Canvas.ImageSource = BitmapDecode.FromMat(_frame.Image);
            _imageSize = (_frame.Image.Width, _frame.Image.Height);
            RenderDetections(_frame);
        }
        else
        {
            Canvas.ImageSource = null;
            _boxes.Clear();
        }
        UpdateEnabled();
    }

    private void UpdateDrawMode()
    {
        Canvas.IsDrawMode = _picking || TglMarkMissed.IsChecked == true;
        Canvas.CurrentLabel = (CboTarget.SelectedItem as Choice<TaskTarget>)?.Value.Name ?? "";
        RenderHint();
    }

    private static Rect? ToRect(AnnotationBox box, (int W, int H) size)
    {
        int x0 = (int)Math.Floor(Math.Clamp(box.XMin, 0, size.W)), y0 = (int)Math.Floor(Math.Clamp(box.YMin, 0, size.H));
        int x1 = (int)Math.Ceiling(Math.Clamp(box.XMax, 0, size.W)), y1 = (int)Math.Ceiling(Math.Clamp(box.YMax, 0, size.H));
        return x1 - x0 < 2 || y1 - y0 < 2 ? null : new Rect(x0, y0, x1 - x0, y1 - y0);
    }

    private async Task OnBoxDrawnAsync(AnnotationBox box)
    {
        var rect = ToRect(box, _imageSize);
        if (_picking)
        {
            EndPickRegion(rect);
            return;
        }
        if (TglMarkMissed.IsChecked == true && rect is { } r) await AddMissedVariantAsync(r);
    }

    // ---------- live ----------

    private void StartLive()
    {
        if (_session.Detector == null) return;
        var provider = CaptureProvider(LiveSource);
        if (provider == null) return;
        _ = PauseAsync();
        CloseVideo();
        _still?.Dispose();
        _still = null;
        _stillPath = null;
        TglMarkMissed.IsChecked = false;
        ResetStats();
        try
        {
            _session.StartLive(provider, CurrentSettings(), LiveFps, Post, ex => Dispatcher.BeginInvoke(() =>
            {
                _session.StopLive();
                ShowError(ex);
                UpdateEnabled();
            }));
            SetStatus(ChipSuccess, () => T(I18nKeys.ModelTestStatusLive));
        }
        catch (Exception ex) when (IsHandled(ex))
        {
            ShowError(ex);
        }
        UpdateEnabled();
    }

    private void StopLive()
    {
        if (!_session.IsLive) return;
        _session.StopLive();
        SetStatus(ChipIdle, () => T(I18nKeys.ModelTestStatusIdle));
        UpdateEnabled();
    }

    // ---------- video ----------

    private async Task OpenVideoAsync()
    {
        var patterns = string.Join(";", TaskSetStore.VideoExtensions.Select(e => "*" + e));
        var dlg = new Microsoft.Win32.OpenFileDialog { Filter = $"{T(I18nKeys.ModelTestVideoFilter)}|{patterns}" };
        if (dlg.ShowDialog(this) != true) return;
        var path = dlg.FileName;
        await PauseAsync();
        StopLive();
        var info = await Task.Run(() => VariantExtractor.GetVideoInfo(path));
        if (info is not { FrameCount: > 0 })
        {
            SetStatus(ChipDanger, () => T(I18nKeys.ModelTestOpenFailed));
            return;
        }
        _still?.Dispose();
        _still = null;
        _stillPath = null;
        _videoPath = path;
        _video = info;
        _videoFrame = 0;
        ResetStats();
        _rendering = true;
        SldFrame.Maximum = info.FrameCount - 1;
        SldFrame.Value = 0;
        _rendering = false;
        SetAnalysis(null);
        SetExportStatus(() => "");
        UpdateEnabled();
        await LoadCachedAnalysisAsync();
        await SeekVideoAsync(0);
    }

    private void CloseVideo()
    {
        _video = null;
        _videoPath = null;
        SetAnalysis(null);
        RenderFrameInfo();
    }

    private async Task TogglePlayAsync()
    {
        if (_playCts != null) await PauseAsync();
        else StartPlayback(_videoFrame + 1 >= (_video?.FrameCount ?? 0) ? 0 : _videoFrame + 1);
    }

    private void StartPlayback(int startFrame)
    {
        if (_videoPath is not { } path || _video is not { } info || _session.Detector == null || _analyzeCts != null) return;
        var cts = new CancellationTokenSource();
        _playCts = cts;
        var settings = CurrentSettings();
        TglMarkMissed.IsChecked = false;
        SetStatus(ChipSuccess, () => T(I18nKeys.ModelTestStatusPlaying));
        _playTask = Task.Run(() => _session.PlayVideo(path, startFrame, -1, info.Fps, () => Volatile.Read(ref _speed), settings, Post, cts.Token))
            .ContinueWith(t => Dispatcher.BeginInvoke(() =>
            {
                if (t.Exception?.InnerException is { } ex) ShowError(ex);
                if (!ReferenceEquals(_playCts, cts)) return;
                _playCts = null;
                cts.Dispose();
                if (t.Exception == null) SetStatus(ChipIdle, () => T(I18nKeys.ModelTestStatusIdle));
                UpdatePlayButton();
                UpdateEnabled();
            }), TaskScheduler.Default);
        UpdatePlayButton();
        UpdateEnabled();
    }

    private async Task PauseAsync()
    {
        var cts = _playCts;
        if (cts == null) return;
        _playCts = null;
        cts.Cancel();
        try
        {
            await _playTask;
        }
        catch (OperationCanceledException)
        {
        }
        cts.Dispose();
        if (_frame?.FrameIndex is int f and >= 0) _videoFrame = f;
        if (!_closed) SetStatus(ChipIdle, () => T(I18nKeys.ModelTestStatusIdle));
        UpdatePlayButton();
        UpdateEnabled();
    }

    private async Task RestartPlaybackAsync()
    {
        int target = _videoFrame;
        await PauseAsync();
        _videoFrame = target;
        StartPlayback(target);
    }

    private async Task StepVideoAsync(int delta)
    {
        if (_video is not { } info) return;
        await PauseAsync();
        await SeekVideoAsync(Math.Clamp(_videoFrame + delta, 0, info.FrameCount - 1));
    }

    private async Task SeekVideoAsync(int frameIndex)
    {
        if (_videoPath is not { } path || _video is not { } info) return;
        _videoFrame = Math.Clamp(frameIndex, 0, info.FrameCount - 1);
        if (_playCts != null)
        {
            await RestartPlaybackAsync();
            return;
        }
        int version = ++_stillVersion;
        var settings = CurrentSettings();
        int target = _videoFrame;
        var analysis = UsableAnalysis(settings);
        RenderFrameInfo();
        try
        {
            var frame = await Task.Run(() => _session.DetectVideoFrame(path, target, info.Fps, settings, analysis) is { } f ? Render(f) : null);
            if (version != _stillVersion || _closed)
            {
                frame?.Frame.Dispose();
                return;
            }
            if (frame == null)
            {
                SetStatus(ChipDanger, () => T(I18nKeys.ModelTestOpenFailed));
                return;
            }
            Show(frame);
        }
        catch (Exception ex) when (IsHandled(ex))
        {
            ShowError(ex);
        }
    }

    private void UpdatePlayButton()
    {
        bool playing = _playCts != null;
        BtnPlay.Content = playing ? GlyphPause : GlyphPlay;
        SetTip(BtnPlay, playing ? I18nKeys.ModelTestPause : I18nKeys.ModelTestPlay);
    }

    // ---------- whole-video analysis ----------

    /// <summary>The analysis when it matches the current model, settings and step (scrubbing uses its cached detections).</summary>
    private ModelTestVideoAnalysis? UsableAnalysis(ModelTestSettings settings)
    {
        if (_analysis is not { } a || _videoPath is not { } path || _session.Detector == null) return null;
        return a.Key == _session.AnalysisKey(path, settings, a.FrameStep) ? a : null;
    }

    private async Task LoadCachedAnalysisAsync()
    {
        if (_videoPath is not { } path || _session.Detector == null) return;
        var settings = CurrentSettings();
        int step = AnalysisStep;
        var cached = await Task.Run(() => _session.LoadAnalysis(path, settings, step));
        if (_closed || _videoPath != path) return;
        SetAnalysis(cached);
        if (cached != null) SetAnalysisStatus(AnalysisSummary(cached, true));
    }

    private async Task ToggleAnalyzeAsync()
    {
        if (_analyzeCts is { } running)
        {
            running.Cancel();
            return;
        }
        if (_videoPath is not { } path || _video is not { } info || _session.Detector == null) return;
        await PauseAsync();
        var cts = new CancellationTokenSource();
        _analyzeCts = cts;
        var settings = CurrentSettings();
        int step = AnalysisStep;
        var progress = new Progress<(int Done, int Total)>(p => SetAnalysisStatus(() => T(I18nKeys.ModelTestAnalysisProgress)
            .Replace("{done}", I(p.Done)).Replace("{total}", I(p.Total))));
        UpdateAnalyzeButton();
        UpdateEnabled();
        try
        {
            var analysis = await Task.Run(() => _session.AnalyzeVideo(path, info.FrameCount, settings, step, progress, cts.Token));
            if (_closed || _videoPath != path) return;
            if (analysis == null)
            {
                SetAnalysisStatus(() => T(I18nKeys.ModelTestAnalysisCancelled));
                return;
            }
            SetAnalysis(analysis);
            SetAnalysisStatus(AnalysisSummary(analysis, false));
        }
        catch (Exception ex) when (IsHandled(ex))
        {
            SetAnalysisStatus(ErrorText(ex));
        }
        finally
        {
            _analyzeCts = null;
            cts.Dispose();
            UpdateAnalyzeButton();
            UpdateEnabled();
        }
    }

    private static Func<string> AnalysisSummary(ModelTestVideoAnalysis a, bool cached)
    {
        int withDetections = a.Frames.Values.Count(d => d.Count > 0);
        return () => T(cached ? I18nKeys.ModelTestAnalysisCached : I18nKeys.ModelTestAnalysisDone)
            .Replace("{frames}", I(a.Frames.Count)).Replace("{hits}", I(withDetections)).Replace("{step}", I(a.FrameStep));
    }

    private void UpdateAnalyzeButton() =>
        BtnAnalyze.Content = T(_analyzeCts != null ? I18nKeys.ModelTestAnalysisCancel : I18nKeys.ModelTestAnalyze);

    private void SetAnalysis(ModelTestVideoAnalysis? analysis)
    {
        _analysis = analysis;
        if (analysis == null) SetAnalysisStatus(() => "");
        ImgTimeline.Source = analysis == null ? null : RenderTimeline(analysis, (float)ConfigBinding.ParseDouble(TxtExportLow.Text, 0.01, 1, 0.5));
        ImgTimeline.Height = Math.Max(1, analysis?.Classes.Count ?? 1) * TimelineRowPixels;
        var classes = analysis?.Classes ?? Array.Empty<string>();
        var selectedClass = CboExportClass.SelectedItem as string;
        CboExportClass.ItemsSource = classes;
        CboExportClass.SelectedItem = classes.Contains(selectedClass) ? selectedClass : classes.FirstOrDefault();
        ShowSourcePanels();
        UpdateEnabled();
    }

    /// <summary>One row per class, one column per frame bucket: class color where the class was seen, faint where its best score dips.</summary>
    private static BitmapSource RenderTimeline(ModelTestVideoAnalysis analysis, float lowConfidence)
    {
        int rows = Math.Max(1, analysis.Classes.Count);
        int columns = Math.Clamp(analysis.FrameCount, 1, TimelineMaxColumns);
        var pixels = new byte[columns * rows * 4];
        foreach (var (frame, detections) in analysis.Frames)
        {
            int column = (int)((long)frame * columns / Math.Max(1, analysis.FrameCount));
            foreach (var group in detections.GroupBy(d => d.ClassId))
            {
                if (group.Key < 0 || group.Key >= rows) continue;
                var color = ClassColor(group.Key);
                byte alpha = group.Max(d => d.Confidence) < lowConfidence ? TimelineLowAlpha : byte.MaxValue;
                int i = (group.Key * columns + Math.Min(column, columns - 1)) * 4;
                if (pixels[i + 3] >= alpha) continue;
                pixels[i] = color.B;
                pixels[i + 1] = color.G;
                pixels[i + 2] = color.R;
                pixels[i + 3] = alpha;
            }
        }
        var bitmap = BitmapSource.Create(columns, rows, 96, 96, PixelFormats.Bgra32, null, pixels, columns * 4);
        bitmap.Freeze();
        return bitmap;
    }

    // ---------- batch export ----------

    private void UpdateExportButton() =>
        BtnExportFrames.Content = T(_exportCts != null ? I18nKeys.ModelTestExportCancel : I18nKeys.ModelTestExportFrames);

    private async Task ToggleExportAsync()
    {
        if (_exportCts is { } running)
        {
            running.Cancel();
            return;
        }
        if (_analysis is not { } analysis || _videoPath is not { } path || _session.Detector is not { } detector) return;
        if (ExportDir() is not { } dir)
        {
            SetExportStatus(() => T(I18nKeys.ModelTestNoProject));
            return;
        }
        RenderExportDir();
        var frames = ModelTestSession.SelectFrames(analysis, ExportFilter, ConfigBinding.ParseInt(TxtExportEvery.Text, 1, MaxStep, 10),
            (float)ConfigBinding.ParseDouble(TxtExportLow.Text, 0.01, 1, 0.5), CboExportClass.SelectedItem as string);
        if (frames.Count == 0)
        {
            SetExportStatus(() => T(I18nKeys.ModelTestExportNone));
            return;
        }
        var source = AutoLabelService.SourceOf(detector.ModelPath, Math.Round(SldConfidence.Value, 2));
        var cts = new CancellationTokenSource();
        _exportCts = cts;
        var progress = new Progress<(int Done, int Total)>(p => SetExportStatus(() => T(I18nKeys.ModelTestExportProgress)
            .Replace("{done}", I(p.Done)).Replace("{total}", I(p.Total))));
        UpdateExportButton();
        UpdateEnabled();
        try
        {
            int written = await Task.Run(() => ModelTestSession.ExportFrames(path, analysis, frames, dir, source, progress, cts.Token));
            SetExportStatus(() => T(I18nKeys.ModelTestExportDone).Replace("{count}", I(written)).Replace("{dir}", dir));
        }
        catch (Exception ex) when (IsHandled(ex))
        {
            SetExportStatus(ErrorText(ex));
        }
        finally
        {
            _exportCts = null;
            cts.Dispose();
            UpdateExportButton();
            UpdateEnabled();
        }
    }

    // ---------- rendering ----------

    private sealed record Rendered(ModelTestFrame Frame, BitmapSource Bitmap);

    private static Rendered Render(ModelTestFrame frame) => new(frame, BitmapDecode.FromMat(frame.Image));

    /// <summary>Loop-thread sink: convert off the UI thread, keep only the newest pending frame, drain on the dispatcher.</summary>
    private void Post(ModelTestFrame frame)
    {
        if (_closed)
        {
            frame.Dispose();
            return;
        }
        var old = Interlocked.Exchange(ref _pending, Render(frame));
        if (old != null)
        {
            old.Frame.Dispose();
            Interlocked.Increment(ref _dropped);
        }
        if (Interlocked.Exchange(ref _renderQueued, 1) == 0) Dispatcher.BeginInvoke(DispatcherPriority.Render, DrainPending);
    }

    private void DrainPending()
    {
        Interlocked.Exchange(ref _renderQueued, 0);
        var next = Interlocked.Exchange(ref _pending, null);
        if (next == null) return;
        if (_closed)
        {
            next.Frame.Dispose();
            return;
        }
        Show(next);
    }

    private void Show(Rendered rendered)
    {
        var frame = rendered.Frame;
        var old = _frame;
        _frame = frame;
        old?.Dispose();
        if (_picking) return;
        var size = (frame.Image.Width, frame.Image.Height);
        Canvas.FitOnOpen = size != _imageSize || Canvas.ImageSource == null;
        _imageSize = size;
        Canvas.ImageSource = rendered.Bitmap;
        if (frame.FrameIndex >= 0 && !SldFrame.IsMouseCaptureWithin && !_redetectTimer.IsEnabled)
        {
            _videoFrame = frame.FrameIndex;
            _rendering = true;
            SldFrame.Value = frame.FrameIndex;
            _rendering = false;
        }
        RenderDetections(frame);
        RenderFrameInfo();
        UpdateEnabled();
    }

    private void RenderDetections(ModelTestFrame frame)
    {
        var classes = _session.Detector?.ClassNames ?? Array.Empty<string>();
        _labelClass.Clear();
        _boxes.Clear();
        foreach (var d in frame.Detections)
        {
            var track = frame.Tracks.Where(t => t.ClassId == d.ClassId && t.Misses == 0)
                .Select(t => (Track: t, Iou: Iou(t.Box, d.Box))).Where(x => x.Iou >= TrackMatchIou).OrderByDescending(x => x.Iou).FirstOrDefault().Track;
            var label = (track == null ? T(I18nKeys.ModelTestBoxLabel) : T(I18nKeys.ModelTestBoxLabelTrack).Replace("{id}", I(track.TrackId)))
                .Replace("{class}", d.ClassName).Replace("{conf}", F(d.Confidence, ConfFormat));
            _labelClass[label] = d.ClassId;
            _boxes.Add(new AnnotationBox(label, d.Box.X, d.Box.Y, d.Box.X + d.Box.Width, d.Box.Y + d.Box.Height));
        }
        Canvas.SelectedIndex = -1;
        Canvas.Refresh();

        var current = frame.Detections.GroupBy(d => d.ClassName).ToDictionary(g => g.Key, g => g.Count(), StringComparer.Ordinal);
        foreach (var (name, count) in current)
            _maxCounts[name] = Math.Max(count, _maxCounts.TryGetValue(name, out int m) ? m : 0);
        _counts.Clear();
        foreach (var name in classes.Concat(_maxCounts.Keys.Where(k => !classes.Contains(k))).Where(n => _maxCounts.ContainsKey(n) || current.ContainsKey(n)))
        {
            _counts.Add(T(I18nKeys.ModelTestCountRow).Replace("{class}", name)
                .Replace("{count}", I(current.TryGetValue(name, out int c) ? c : 0))
                .Replace("{max}", I(_maxCounts.TryGetValue(name, out int mx) ? mx : 0)));
        }
        _tracks.Clear();
        foreach (var t in frame.Tracks.OrderBy(t => t.TrackId))
        {
            _tracks.Add(T(I18nKeys.ModelTestTrackRow).Replace("{id}", I(t.TrackId)).Replace("{class}", t.ClassName)
                .Replace("{conf}", F(t.Confidence, ConfFormat)).Replace("{age}", I(t.Age)).Replace("{hits}", I(t.Hits)).Replace("{misses}", I(t.Misses))
                .Replace("{flicker}", I(frame.Flicker.TryGetValue(t.TrackId, out int fl) ? fl : 0)));
        }
        RenderStats(frame);
    }

    private void RenderStats(ModelTestFrame frame)
    {
        var lines = new List<string>();
        if (frame.Fps > 0) lines.Add(T(I18nKeys.ModelTestStatsFps).Replace("{value}", F(frame.Fps, MsFormat)));
        if (frame.CaptureMs > 0) lines.Add(T(I18nKeys.ModelTestStatsCapture).Replace("{value}", F(frame.CaptureMs, MsFormat)));
        if (frame.FromCache) lines.Add(T(I18nKeys.ModelTestStatsCached));
        else
        {
            var t = frame.Timing;
            lines.Add(T(I18nKeys.ModelTestStatsInfer).Replace("{value}", F(t.TotalMs, MsFormat)).Replace("{pre}", F(t.PreMs, MsFormat))
                .Replace("{infer}", F(t.InferMs, MsFormat)).Replace("{post}", F(t.PostMs, MsFormat)).Replace("{passes}", I(t.Passes)));
        }
        lines.Add(T(I18nKeys.ModelTestStatsDetections).Replace("{count}", I(frame.Detections.Count)));
        if (frame.Tracks.Count > 0)
            lines.Add(T(I18nKeys.ModelTestStatsFlicker).Replace("{count}", I(frame.Flicker.Values.Sum())));
        if (_source is Source.Live or Source.Video) lines.Add(T(I18nKeys.ModelTestStatsDropped).Replace("{count}", I(Interlocked.Read(ref _dropped))));
        if (_session.Detector is { } d)
            lines.Add(T(I18nKeys.ModelTestStatsMode).Replace("{mode}", (CboMode.SelectedItem as Choice<ModelTestMode>)?.Display ?? "").Replace("{provider}", d.ExecutionProvider));
        TxtStats.Text = string.Join(Environment.NewLine, lines);
    }

    private void RenderFrameInfo()
    {
        if (_video is { } v)
        {
            var time = v.Fps > 0 ? TimeSpan.FromSeconds(_videoFrame / v.Fps).ToString(TimeFormat, CultureInfo.InvariantCulture) : "-";
            TxtFrameInfo.Text = T(I18nKeys.ModelTestFrameInfo).Replace("{frame}", I(_videoFrame)).Replace("{total}", I(v.FrameCount - 1))
                .Replace("{time}", time).Replace("{fps}", F(v.Fps, MsFormat)).Replace("{width}", I(v.Width)).Replace("{height}", I(v.Height));
        }
        else if (_frame != null)
        {
            TxtFrameInfo.Text = T(I18nKeys.ModelTestImageInfo).Replace("{width}", I(_frame.Image.Width)).Replace("{height}", I(_frame.Image.Height));
        }
        else
        {
            TxtFrameInfo.Text = "";
        }
    }

    private void ResetStats()
    {
        _maxCounts.Clear();
        Interlocked.Exchange(ref _dropped, 0);
    }

    private static double Iou(Rect a, Rect b)
    {
        var inter = a.Intersect(b);
        if (inter.Width <= 0 || inter.Height <= 0) return 0;
        double i = (double)inter.Width * inter.Height;
        return i / ((double)a.Width * a.Height + (double)b.Width * b.Height - i);
    }

    // ---------- hard examples ----------

    private void ChooseExportDir()
    {
        var dlg = new Microsoft.Win32.OpenFolderDialog { Title = T(I18nKeys.ModelTestExportDirLabel) };
        var current = ConfigBinding.GetValue(ConfigKeys.YoloModelTestExportDir, "");
        if (!string.IsNullOrWhiteSpace(current) && Directory.Exists(current)) dlg.InitialDirectory = current;
        if (dlg.ShowDialog(this) != true) return;
        ConfigBinding.SaveString(ConfigKeys.YoloModelTestExportDir, dlg.FolderName);
        RenderExportDir();
    }

    /// <summary>Configured folder, else a new segment of the current project ({project}/seg_0_{stamp}/frames, one per window).</summary>
    private string? ExportDir()
    {
        var configured = ConfigBinding.GetValue(ConfigKeys.YoloModelTestExportDir, "");
        if (!string.IsNullOrWhiteSpace(configured)) return configured;
        if (_sessionExportDir != null) return _sessionExportDir;
        var project = ConfigBinding.GetValue(ConfigKeys.CoordCalibrationYoloCurrentProject, "");
        if (string.IsNullOrWhiteSpace(project) || !Directory.Exists(project)) return null;
        _sessionExportDir = Path.Combine(project, YoloSegmentLayout.MakeSegmentId(), YoloSegmentLayout.FramesSubdir);
        return _sessionExportDir;
    }

    private string SourceStem() => ModelTestSession.FrameStem(_videoPath ?? _stillPath, _frame?.FrameIndex ?? -1);

    private async Task SaveLabeledAsync()
    {
        if (_frame is not { } frame || _session.Detector is not { } detector)
        {
            SetHardStatus(() => T(I18nKeys.ModelTestNoFrame));
            return;
        }
        if (ExportDir() is not { } dir)
        {
            SetHardStatus(() => T(I18nKeys.ModelTestNoProject));
            return;
        }
        RenderExportDir();
        var image = frame.Image.Clone();
        var detections = frame.Detections;
        var stem = SourceStem();
        var source = AutoLabelService.SourceOf(detector.ModelPath, Math.Round(SldConfidence.Value, 2));
        try
        {
            var path = await Task.Run(() =>
            {
                using (image) return ModelTestSession.SaveLabeled(image, detections, dir, stem, source);
            });
            var file = Path.GetFileName(path);
            int count = detections.Count;
            SetHardStatus(() => T(I18nKeys.ModelTestSavedLabeled).Replace("{file}", file).Replace("{count}", I(count)).Replace("{dir}", dir));
        }
        catch (Exception ex) when (IsHandled(ex))
        {
            SetHardStatus(ErrorText(ex));
        }
    }

    private void RefreshTaskSets()
    {
        var selectedId = (CboTaskSet.SelectedItem as Choice<TaskSet>)?.Value.Id ?? ConfigBinding.GetValue(ConfigKeys.YoloModelTestTaskSet, "");
        IReadOnlyList<TaskSet> sets;
        try
        {
            sets = _store.List();
        }
        catch (Exception ex) when (IsHandled(ex))
        {
            sets = Array.Empty<TaskSet>();
        }
        var items = sets.Select(s => new Choice<TaskSet>(s.Name, s)).ToList();
        _rendering = true;
        CboTaskSet.ItemsSource = items;
        CboTaskSet.SelectedItem = items.FirstOrDefault(i => i.Value.Id == selectedId) ?? items.FirstOrDefault();
        _rendering = false;
        RefreshTargets();
    }

    private void RefreshTargets()
    {
        var set = (CboTaskSet.SelectedItem as Choice<TaskSet>)?.Value;
        var selectedId = (CboTarget.SelectedItem as Choice<TaskTarget>)?.Value.Id;
        var items = set?.Targets.Select((t, i) => new Choice<TaskTarget>($"{I(i + 1)}. {t.Name}", t)).ToList() ?? new List<Choice<TaskTarget>>();
        bool was = _rendering;
        _rendering = true;
        CboTarget.ItemsSource = items;
        CboTarget.SelectedItem = items.FirstOrDefault(i => i.Value.Id == selectedId) ?? items.FirstOrDefault();
        _rendering = was;
        UpdateDrawMode();
        UpdateEnabled();
    }

    private async Task AddMissedVariantAsync(Rect region)
    {
        if (_frame is not { } frame || CboTaskSet.SelectedItem is not Choice<TaskSet> set || CboTarget.SelectedItem is not Choice<TaskTarget> target)
        {
            SetHardStatus(() => T(I18nKeys.ModelTestNoTarget));
            return;
        }
        var png = ModelTestSession.CropPng(frame.Image, region);
        if (png == null) return;
        var source = _videoPath ?? _stillPath ?? "";
        var originalPath = frame.FrameIndex >= 0
            ? string.Create(CultureInfo.InvariantCulture, $"{source}#frame={frame.FrameIndex}@{ModelTestSession.FormatRect(region)}")
            : string.Create(CultureInfo.InvariantCulture, $"{source}@{ModelTestSession.FormatRect(region)}");
        var nameHint = SourceStem();
        var (setId, targetId) = (set.Value.Id, target.Value.Id);
        try
        {
            await TaskSetWindow.FlushPendingAsync(setId);
            var name = await Task.Run(() => ModelTestSession.AddVariant(_store, setId, targetId, png, originalPath, nameHint));
            if (name == null)
            {
                SetHardStatus(() => T(I18nKeys.ModelTestNoTarget));
                return;
            }
            TaskSetWindow.NotifyExternalChange(setId);
            SetHardStatus(() => T(I18nKeys.ModelTestVariantAdded).Replace("{target}", name));
        }
        catch (Exception ex) when (IsHandled(ex))
        {
            SetHardStatus(ErrorText(ex));
        }
    }

    private async Task AddNegativeAsync()
    {
        if (_frame is not { } frame || CboTaskSet.SelectedItem is not Choice<TaskSet> set)
        {
            SetHardStatus(() => T(I18nKeys.ModelTestNoTarget));
            return;
        }
        var image = frame.Image.Clone();
        var setId = set.Value.Id;
        var nameHint = SourceStem();
        try
        {
            await TaskSetWindow.FlushPendingAsync(setId);
            var name = await Task.Run(() =>
            {
                using (image) return ModelTestSession.AddCommonNegative(_store, setId, image, nameHint);
            });
            if (name == null)
            {
                SetHardStatus(() => T(I18nKeys.ModelTestNoTarget));
                return;
            }
            TaskSetWindow.NotifyExternalChange(setId);
            SetHardStatus(() => T(I18nKeys.ModelTestNegativeAdded).Replace("{set}", name));
        }
        catch (Exception ex) when (IsHandled(ex))
        {
            SetHardStatus(ErrorText(ex));
        }
    }

    // ---------- helpers ----------

    private static bool IsHandled(Exception ex) =>
        ex is IOException or UnauthorizedAccessException or NotSupportedException or ArgumentException or InvalidOperationException
            or OpenCVException or System.Text.Json.JsonException;

    private static bool PathEquals(string? a, string? b) => a != null && b != null && string.Equals(a, b, StringComparison.OrdinalIgnoreCase);

    private sealed record Choice<T>(string Display, T Value);

    /// <summary>Model picker entry; Profile and Best (epoch metrics) come from the run's recorded info when known.</summary>
    private sealed record ModelItem(string Display, string OnnxPath, YoloInferenceProfile? Profile, YoloEpochMetrics? Best);
}
