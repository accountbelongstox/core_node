// PY-REF: pyapps/d3-check/d3utils/yolo_train_flow.py
using System.ComponentModel;
using System.Globalization;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.Services;
using DotCore.Common;
using DotCore.VocAnnotator;
using DotCore.YoloRecord;
using DotCore.YoloTrain;

namespace DotApps.d3d4tester.Windows;

/// <summary>
/// YOLO training: environment detection with recommended parameters, every Ultralytics parameter, dataset split with preview,
/// and the run (live log, epoch progress, stop, ONNX export, set as navigation model). Every field is bound to config (yolo_training.*, yolo_dataset.*).
/// </summary>
public partial class YoloTrainingWindow : Window
{
    private const string SourceSelected = "selected";
    private const string SourceAll = "all";
    private const string GlyphInfo = "";
    private const string GlyphWarning = "";
    private const int MaxLogChars = 400_000;
    private const double Gib = 1024d * 1024 * 1024;

    private static readonly YoloTrainParameters Defaults = new();
    private static readonly YoloDatasetSplit SplitDefaults = new();
    private static readonly string[] Devices = { YoloTrainParameters.DeviceCpu, "0", "0,1", YoloTrainParameters.DeviceMps };

    private readonly string _projectDir;
    private readonly IReadOnlyList<string> _allSegments;
    private readonly IReadOnlyList<string> _selectedSegments;
    private readonly YoloTrainingService _service = YoloTrainingService.Instance;
    private YoloEnvironment? _env;
    private YoloDatasetPlan? _plan;
    private YoloTrainingOutcome? _outcome;
    private bool _detecting;

    public YoloTrainingWindow(string projectDir, IReadOnlyList<string> allSegments, IReadOnlyList<string> selectedSegments)
    {
        _projectDir = projectDir;
        _allSegments = allSegments;
        _selectedSegments = selectedSegments;
        InitializeComponent();
        ApplyTexts();
        BindConfig();
        BtnDetect.Click += async (_, _) => await DetectAsync();
        BtnApplyRecommended.Click += (_, _) => ApplyRecommendation();
        BtnBrowsePython.Click += (_, _) => BrowseInto(TxtPython, T(I18nKeys.YoloTrainingEnvPython) + "|python*.exe;python3*;python", ConfigKeys.YoloTrainingPythonExe);
        BtnBrowseModel.Click += (_, _) => BrowseModel();
        BtnPreview.Click += async (_, _) => await PreviewAsync();
        BtnStart.Click += async (_, _) => await StartAsync();
        BtnStop.Click += (_, _) => _service.Cancel();
        BtnOpenOutput.Click += (_, _) => OpenOutput();
        BtnUseForNavigation.Click += (_, _) => UseForNavigation();
        _service.Log += OnServiceLog;
        _service.Progress += OnServiceProgress;
        _service.PhaseChanged += OnServicePhase;
        D3D4TesterI18n.Provider.LanguageChanged += OnLanguageChanged;
        Closed += (_, _) =>
        {
            _service.Log -= OnServiceLog;
            _service.Progress -= OnServiceProgress;
            _service.PhaseChanged -= OnServicePhase;
            D3D4TesterI18n.Provider.LanguageChanged -= OnLanguageChanged;
        };
        Loaded += async (_, _) =>
        {
            UpdateRunState(_service.Phase);
            if (ConfigBinding.GetValue(ConfigKeys.YoloTrainingDetectOnOpen, true)) await DetectAsync();
        };
    }

    private static string T(string key) => D3D4TesterI18n.Provider.GetUiText(key);

    protected override void OnClosing(CancelEventArgs e)
    {
        base.OnClosing(e);
        if (e.Cancel || !_service.IsRunning) return;
        if (MessageBox.Show(this, T(I18nKeys.YoloTrainingConfirmCloseRunning), Title, MessageBoxButton.YesNo, MessageBoxImage.Warning) != MessageBoxResult.Yes)
            e.Cancel = true;
        else
            _service.Cancel();
    }

    private void OnLanguageChanged(object? sender, LanguageChangedEventArgs e) => Dispatcher.InvokeAsync(() =>
    {
        ApplyTexts();
        RenderEnvironment();
        RenderPreview();
        UpdateRunState(_service.Phase);
    });

    private void ApplyTexts()
    {
        Title = T(I18nKeys.YoloTrainingWindowTitle);
        LblEnv.Text = T(I18nKeys.YoloTrainingSectionEnv);
        LblPython.Text = T(I18nKeys.YoloTrainingPythonExe);
        BtnBrowsePython.Content = T(I18nKeys.YoloTrainingBrowse);
        BtnDetect.Content = T(_detecting ? I18nKeys.YoloTrainingDetecting : I18nKeys.YoloTrainingDetect);
        BtnApplyRecommended.Content = T(I18nKeys.YoloTrainingApplyRecommended);
        KeyOs.Text = T(I18nKeys.YoloTrainingEnvOs);
        KeyCpu.Text = T(I18nKeys.YoloTrainingEnvCpu);
        KeyRam.Text = T(I18nKeys.YoloTrainingEnvRam);
        KeyGpu.Text = T(I18nKeys.YoloTrainingEnvGpu);
        KeyPythonEnv.Text = T(I18nKeys.YoloTrainingEnvPython);
        KeyTorch.Text = T(I18nKeys.YoloTrainingEnvTorch);
        KeyUltralytics.Text = T(I18nKeys.YoloTrainingEnvUltralytics);
        KeyCli.Text = T(I18nKeys.YoloTrainingEnvCli);
        LblParams.Text = T(I18nKeys.YoloTrainingSectionParams);
        LblModel.Text = T(I18nKeys.YoloTrainingModel);
        BtnBrowseModel.Content = T(I18nKeys.YoloTrainingBrowse);
        LblEpochs.Text = T(I18nKeys.YoloTrainingEpochs);
        LblImgsz.Text = T(I18nKeys.YoloTrainingImgsz);
        LblBatch.Text = T(I18nKeys.YoloTrainingBatch);
        LblDevice.Text = T(I18nKeys.YoloTrainingDevice);
        LblWorkers.Text = T(I18nKeys.YoloTrainingWorkers);
        LblPatience.Text = T(I18nKeys.YoloTrainingPatience);
        LblCache.Text = T(I18nKeys.YoloTrainingCache);
        LblOptimizer.Text = T(I18nKeys.YoloTrainingOptimizer);
        LblLr0.Text = T(I18nKeys.YoloTrainingLr0);
        LblSeed.Text = T(I18nKeys.YoloTrainingSeed);
        LblCloseMosaic.Text = T(I18nKeys.YoloTrainingCloseMosaic);
        ChkAmp.Content = T(I18nKeys.YoloTrainingAmp);
        LblExtraArgs.Text = T(I18nKeys.YoloTrainingExtraArgs);
        ChkExportOnnx.Content = T(I18nKeys.YoloTrainingExportOnnx);
        LblDataset.Text = T(I18nKeys.YoloTrainingSectionDataset);
        RadioSelected.Content = T(I18nKeys.YoloTrainingSourceSelected) + $" ({_selectedSegments.Count})";
        RadioAll.Content = T(I18nKeys.YoloTrainingSourceAll) + $" ({_allSegments.Count})";
        LblTrainPct.Text = T(I18nKeys.YoloTrainingTrainPercent);
        LblValPct.Text = T(I18nKeys.YoloTrainingValPercent);
        LblTestPct.Text = T(I18nKeys.YoloTrainingTestPercent);
        LblSplitSeed.Text = T(I18nKeys.YoloTrainingSplitSeed);
        LblBackgroundPct.Text = T(I18nKeys.YoloTrainingBackgroundMaxPercent);
        ChkShuffle.Content = T(I18nKeys.YoloTrainingShuffle);
        ChkStratify.Content = T(I18nKeys.YoloTrainingStratify);
        ChkBackground.Content = T(I18nKeys.YoloTrainingIncludeBackground);
        ChkSkipDifficult.Content = T(I18nKeys.YoloTrainingSkipDifficult);
        BtnPreview.Content = T(I18nKeys.YoloTrainingPreview);
        LblRun.Text = T(I18nKeys.YoloTrainingSectionRun);
        BtnStart.Content = T(I18nKeys.YoloTrainingStart);
        BtnStop.Content = T(I18nKeys.YoloTrainingStop);
        BtnOpenOutput.Content = T(I18nKeys.YoloTrainingOpenOutput);
        BtnUseForNavigation.Content = T(I18nKeys.YoloTrainingUseForNavigation);
        int cacheIdx = CboCache.SelectedIndex;
        CboCache.ItemsSource = new[] { T(I18nKeys.YoloTrainingCacheOff), T(I18nKeys.YoloTrainingCacheRam), T(I18nKeys.YoloTrainingCacheDisk) };
        CboCache.SelectedIndex = cacheIdx;
    }

    private void BindConfig()
    {
        ConfigBinding.BindTextBox(TxtPython, ConfigKeys.YoloTrainingPythonExe);
        BindEditableCombo(CboModel, YoloTrainParameters.Models, ConfigKeys.YoloTrainingModel, Defaults.Model);
        BindEditableCombo(CboDevice, Devices, ConfigKeys.YoloTrainingDevice, Defaults.Device);
        ConfigBinding.BindIntTextBox(TxtEpochs, ConfigKeys.YoloTrainingEpochs, 1, 10000, Defaults.Epochs);
        ConfigBinding.BindIntTextBox(TxtImgsz, ConfigKeys.YoloTrainingImgsz, YoloTrainParameters.MinImgsz, YoloTrainParameters.MaxImgsz, Defaults.Imgsz);
        ConfigBinding.BindIntTextBox(TxtBatch, ConfigKeys.YoloTrainingBatch, YoloTrainParameters.AutoBatch, 1024, Defaults.Batch);
        ConfigBinding.BindIntTextBox(TxtWorkers, ConfigKeys.YoloTrainingWorkers, 0, 64, Defaults.Workers);
        ConfigBinding.BindIntTextBox(TxtPatience, ConfigKeys.YoloTrainingPatience, 0, 10000, Defaults.Patience);
        ConfigBinding.BindComboBox(CboCache, ConfigKeys.YoloTrainingCache, YoloTrainParameters.CacheModes, Defaults.Cache);
        CboOptimizer.ItemsSource = YoloTrainParameters.Optimizers;
        ConfigBinding.BindComboBox(CboOptimizer, ConfigKeys.YoloTrainingOptimizer, YoloTrainParameters.Optimizers, Defaults.Optimizer);
        TxtLr0.Text = Num(ConfigBinding.GetValue(ConfigKeys.YoloTrainingLr0, Defaults.Lr0));
        TxtLr0.LostFocus += (_, _) => TxtLr0.Text = Num(ConfigBinding.SaveDouble(ConfigKeys.YoloTrainingLr0, TxtLr0.Text, 1e-6, 1, Defaults.Lr0));
        ConfigBinding.BindIntTextBox(TxtSeed, ConfigKeys.YoloTrainingSeed, 0, int.MaxValue, Defaults.Seed);
        ConfigBinding.BindIntTextBox(TxtCloseMosaic, ConfigKeys.YoloTrainingCloseMosaic, 0, 10000, Defaults.CloseMosaic);
        ConfigBinding.BindCheckBox(ChkAmp, ConfigKeys.YoloTrainingAmp, Defaults.Amp);
        ConfigBinding.BindTextBox(TxtExtraArgs, ConfigKeys.YoloTrainingExtraArgs);
        ConfigBinding.BindCheckBox(ChkExportOnnx, ConfigKeys.YoloTrainingExportOnnx, true);

        var source = ConfigBinding.GetValue(ConfigKeys.YoloDatasetSource, SourceSelected);
        (source == SourceAll || _selectedSegments.Count == 0 ? RadioAll : RadioSelected).IsChecked = true;
        RadioSelected.Checked += (_, _) => { ConfigBinding.SaveString(ConfigKeys.YoloDatasetSource, SourceSelected); InvalidatePlan(); };
        RadioAll.Checked += (_, _) => { ConfigBinding.SaveString(ConfigKeys.YoloDatasetSource, SourceAll); InvalidatePlan(); };
        ConfigBinding.BindIntTextBox(TxtTrainPct, ConfigKeys.YoloDatasetTrainPercent, 0, 100, SplitDefaults.TrainPercent);
        ConfigBinding.BindIntTextBox(TxtValPct, ConfigKeys.YoloDatasetValPercent, 0, 100, SplitDefaults.ValPercent);
        ConfigBinding.BindIntTextBox(TxtTestPct, ConfigKeys.YoloDatasetTestPercent, 0, 100, SplitDefaults.TestPercent);
        ConfigBinding.BindIntTextBox(TxtSplitSeed, ConfigKeys.YoloDatasetSeed, 0, int.MaxValue, SplitDefaults.Seed);
        ConfigBinding.BindIntTextBox(TxtBackgroundPct, ConfigKeys.YoloDatasetBackgroundMaxPercent, 0, 99, SplitDefaults.BackgroundMaxPercent);
        ConfigBinding.BindCheckBox(ChkShuffle, ConfigKeys.YoloDatasetShuffle, SplitDefaults.Shuffle);
        ConfigBinding.BindCheckBox(ChkStratify, ConfigKeys.YoloDatasetStratify, SplitDefaults.Stratify);
        ConfigBinding.BindCheckBox(ChkBackground, ConfigKeys.YoloDatasetIncludeBackground, SplitDefaults.IncludeBackground);
        ConfigBinding.BindCheckBox(ChkSkipDifficult, ConfigKeys.YoloDatasetSkipDifficult, SplitDefaults.SkipDifficult);
        TxtPreview.Text = T(I18nKeys.YoloTrainingPreviewNone);
    }

    private static void BindEditableCombo(ComboBox combo, IReadOnlyList<string> items, string key, string defaultValue)
    {
        combo.ItemsSource = items;
        combo.Text = ConfigBinding.GetValue(key, defaultValue) ?? defaultValue;
        void Save()
        {
            var v = combo.Text.Trim();
            if (v.Length > 0) ConfigBinding.SaveString(key, v);
        }
        combo.LostFocus += (_, _) => Save();
        combo.SelectionChanged += (_, _) => combo.Dispatcher.BeginInvoke(Save);
    }

    private YoloTrainParameters GatherParameters() => new()
    {
        Model = NonEmpty(CboModel.Text, Defaults.Model),
        Epochs = ConfigBinding.ParseInt(TxtEpochs.Text, 1, 10000, Defaults.Epochs),
        Imgsz = YoloTrainParameters.NormalizeImgsz(ConfigBinding.ParseInt(TxtImgsz.Text, YoloTrainParameters.MinImgsz, YoloTrainParameters.MaxImgsz, Defaults.Imgsz)),
        Batch = NonZero(ConfigBinding.ParseInt(TxtBatch.Text, YoloTrainParameters.AutoBatch, 1024, Defaults.Batch), Defaults.Batch),
        Device = NonEmpty(CboDevice.Text, Defaults.Device),
        Workers = ConfigBinding.ParseInt(TxtWorkers.Text, 0, 64, Defaults.Workers),
        Patience = ConfigBinding.ParseInt(TxtPatience.Text, 0, 10000, Defaults.Patience),
        Cache = Pick(YoloTrainParameters.CacheModes, CboCache.SelectedIndex, Defaults.Cache),
        Amp = ChkAmp.IsChecked == true,
        Optimizer = Pick(YoloTrainParameters.Optimizers, CboOptimizer.SelectedIndex, Defaults.Optimizer),
        Lr0 = ConfigBinding.ParseDouble(TxtLr0.Text, 1e-6, 1, Defaults.Lr0),
        Seed = ConfigBinding.ParseInt(TxtSeed.Text, 0, int.MaxValue, Defaults.Seed),
        CloseMosaic = ConfigBinding.ParseInt(TxtCloseMosaic.Text, 0, 10000, Defaults.CloseMosaic),
        ExtraArguments = TxtExtraArgs.Text ?? "",
    };

    private YoloDatasetSplit GatherSplit() => new()
    {
        TrainPercent = ConfigBinding.ParseInt(TxtTrainPct.Text, 0, 100, SplitDefaults.TrainPercent),
        ValPercent = ConfigBinding.ParseInt(TxtValPct.Text, 0, 100, SplitDefaults.ValPercent),
        TestPercent = ConfigBinding.ParseInt(TxtTestPct.Text, 0, 100, SplitDefaults.TestPercent),
        Seed = ConfigBinding.ParseInt(TxtSplitSeed.Text, 0, int.MaxValue, SplitDefaults.Seed),
        Shuffle = ChkShuffle.IsChecked == true,
        Stratify = ChkStratify.IsChecked == true,
        IncludeBackground = ChkBackground.IsChecked == true,
        BackgroundMaxPercent = ConfigBinding.ParseInt(TxtBackgroundPct.Text, 0, 99, SplitDefaults.BackgroundMaxPercent),
        SkipDifficult = ChkSkipDifficult.IsChecked == true,
    };

    private List<YoloDatasetSource> GatherSources()
    {
        var segments = RadioSelected.IsChecked == true ? _selectedSegments : _allSegments;
        return segments
            .Select(s => (Name: Path.GetFileName(Path.TrimEndingDirectorySeparator(s)), Frames: Path.Combine(s, YoloDataLayout.FramesSubdir)))
            .Where(s => Directory.Exists(s.Frames))
            .Select(s => new YoloDatasetSource(s.Name, s.Frames, s.Frames))
            .ToList();
    }

    private void InvalidatePlan()
    {
        _plan = null;
        TxtPreview.Text = T(I18nKeys.YoloTrainingPreviewNone);
    }

    private async Task<YoloDatasetPlan?> PreviewAsync()
    {
        var split = GatherSplit();
        if (!split.IsValid)
        {
            Warn(I18nKeys.YoloTrainingSplitInvalid);
            return null;
        }
        var sources = GatherSources();
        if (sources.Count == 0)
        {
            Warn(I18nKeys.YoloTrainingNoSegments);
            return null;
        }
        var classes = ProjectConfig.GetClassesFromProjectDir(_projectDir);
        BtnPreview.IsEnabled = false;
        try
        {
            _plan = await Task.Run(() => YoloDatasetAssembler.Plan(sources, classes, split));
        }
        finally
        {
            BtnPreview.IsEnabled = true;
        }
        RenderPreview();
        RenderEnvironment();
        return _plan;
    }

    private void RenderPreview()
    {
        if (_plan is not { } p)
        {
            TxtPreview.Text = T(I18nKeys.YoloTrainingPreviewNone);
            return;
        }
        var lines = new List<string>
        {
            T(I18nKeys.YoloTrainingPreviewSummary)
                .Replace("{sources}", p.Sources.Count.ToString())
                .Replace("{images}", p.SourceImages.ToString())
                .Replace("{labeled}", p.LabeledImages.ToString())
                .Replace("{background}", p.BackgroundImages.ToString())
                .Replace("{background_available}", p.BackgroundAvailable.ToString())
                .Replace("{unannotated}", p.UnannotatedImages.ToString()),
        };
        var splitNames = new Dictionary<YoloSplit, string>
        {
            [YoloSplit.Train] = T(I18nKeys.YoloTrainingSplitTrain),
            [YoloSplit.Val] = T(I18nKeys.YoloTrainingSplitVal),
            [YoloSplit.Test] = T(I18nKeys.YoloTrainingSplitTest),
        };
        var summaries = Enum.GetValues<YoloSplit>().ToDictionary(s => s, p.Summary);
        foreach (var (split, sum) in summaries)
            lines.Add(T(I18nKeys.YoloTrainingPreviewSplit).Replace("{split}", splitNames[split])
                .Replace("{images}", sum.Images.ToString()).Replace("{background}", sum.Background.ToString()));
        foreach (var cls in p.Classes)
            lines.Add(T(I18nKeys.YoloTrainingPreviewClass).Replace("{name}", cls)
                .Replace("{train}", summaries[YoloSplit.Train].Instances[cls].ToString())
                .Replace("{val}", summaries[YoloSplit.Val].Instances[cls].ToString())
                .Replace("{test}", summaries[YoloSplit.Test].Instances[cls].ToString()));
        if (p.UnknownLabels.Count > 0)
            lines.Add(T(I18nKeys.YoloTrainingPreviewUnknown).Replace("{labels}", string.Join(", ", p.UnknownLabels.Select(kv => $"{kv.Key} ({kv.Value})"))));
        if (p.DifficultSkipped > 0)
            lines.Add(T(I18nKeys.YoloTrainingPreviewDifficult).Replace("{count}", p.DifficultSkipped.ToString()));
        TxtPreview.Text = string.Join("\n", lines);
    }

    private async Task DetectAsync()
    {
        if (_detecting) return;
        _detecting = true;
        BtnDetect.IsEnabled = false;
        BtnDetect.Content = T(I18nKeys.YoloTrainingDetecting);
        try
        {
            _env = await YoloEnvironmentProbe.ProbeAsync(TxtPython.Text);
        }
        finally
        {
            _detecting = false;
            BtnDetect.IsEnabled = true;
            BtnDetect.Content = T(I18nKeys.YoloTrainingDetect);
        }
        RenderEnvironment();
    }

    private void RenderEnvironment()
    {
        var none = T(I18nKeys.YoloTrainingEnvNone);
        if (_env is not { } env)
        {
            SetChip(ChipEnv, TxtEnvChip, "StatusChipStyle", T(I18nKeys.YoloTrainingEnvUnknown));
            LstAdvice.ItemsSource = null;
            return;
        }
        ValOs.Text = $"{env.OsDescription} ({env.Architecture})";
        ValCpu.Text = T(I18nKeys.YoloTrainingCpuFormat).Replace("{name}", env.CpuName).Replace("{cores}", env.LogicalCores.ToString());
        ValRam.Text = T(I18nKeys.YoloTrainingRamFormat).Replace("{total}", Gb(env.TotalMemoryBytes)).Replace("{free}", Gb(env.AvailableMemoryBytes));
        ValGpu.Text = env.Gpus.Count == 0 ? none : string.Join("\n", env.Gpus.Select(g => T(I18nKeys.YoloTrainingGpuFormat)
            .Replace("{name}", g.Name).Replace("{memory}", (g.MemoryTotalMb / 1024d).ToString("0.#", CultureInfo.InvariantCulture)).Replace("{driver}", g.Driver)));
        var py = env.Python;
        ValPythonEnv.Text = py == null ? none : $"{py.Version}  {py.Executable}";
        ValTorch.Text = py?.TorchVersion == null ? none
            : py.TorchVersion + "  " + (py.CudaAvailable ? T(I18nKeys.YoloTrainingCudaYes).Replace("{version}", py.CudaVersion ?? "") : T(I18nKeys.YoloTrainingCudaNo));
        ValUltralytics.Text = py?.UltralyticsVersion ?? none;
        ValCli.Text = py?.YoloCli ?? none;
        SetChip(ChipEnv, TxtEnvChip, env.CanTrain ? "StatusChipSuccessStyle" : "StatusChipDangerStyle",
            T(env.CanTrain ? I18nKeys.YoloTrainingEnvReady : I18nKeys.YoloTrainingEnvNotReady));
        var advice = YoloTrainAdvisor.Recommend(env, GatherParameters(), _plan).Advice;
        LstAdvice.ItemsSource = advice.Select(a => new AdviceRow(
            a.IsWarning ? GlyphWarning : GlyphInfo,
            T(I18nKeys.YoloTrainingAdvice(a.Code)).Replace("{value}", a.Value),
            (Brush)FindResource(a.IsWarning ? "WarningTextBrush" : "TextSecondaryBrush"))).ToList();
    }

    private void ApplyRecommendation()
    {
        if (_env == null) return;
        var r = YoloTrainAdvisor.Recommend(_env, GatherParameters(), _plan).Parameters;
        CboModel.Text = r.Model;
        ConfigBinding.SaveString(ConfigKeys.YoloTrainingModel, r.Model);
        CboDevice.Text = r.Device;
        ConfigBinding.SaveString(ConfigKeys.YoloTrainingDevice, r.Device);
        ConfigBinding.SetValue(ConfigKeys.YoloTrainingEpochs, r.Epochs);
        ConfigBinding.SetValue(ConfigKeys.YoloTrainingImgsz, r.Imgsz);
        ConfigBinding.SetValue(ConfigKeys.YoloTrainingBatch, r.Batch);
        ConfigBinding.SetValue(ConfigKeys.YoloTrainingWorkers, r.Workers);
        ConfigBinding.SetValue(ConfigKeys.YoloTrainingPatience, r.Patience);
        ConfigBinding.SetValue(ConfigKeys.YoloTrainingCache, r.Cache);
        ConfigBinding.SetValue(ConfigKeys.YoloTrainingAmp, r.Amp);
        RenderEnvironment();
    }

    private async Task StartAsync()
    {
        if (_service.IsRunning) return;
        var split = GatherSplit();
        if (!split.IsValid)
        {
            Warn(I18nKeys.YoloTrainingSplitInvalid);
            return;
        }
        var sources = GatherSources();
        if (sources.Count == 0)
        {
            Warn(I18nKeys.YoloTrainingNoSegments);
            return;
        }
        if (_env == null) await DetectAsync();
        if (_env is not { CanTrain: true } env || env.Python?.YoloCli is not { } cli)
        {
            Warn(I18nKeys.YoloTrainingCannotTrain);
            return;
        }
        var parameters = GatherParameters();
        var (_, rejected) = parameters.ParseExtraArguments();
        TxtLog.Clear();
        BarProgress.Value = 0;
        TxtEpoch.Text = "";
        if (rejected.Count > 0) AppendLog(T(I18nKeys.YoloTrainingExtraArgsRejected).Replace("{args}", string.Join(" ", rejected)));
        var request = new YoloTrainingRequest(_projectDir, sources, ProjectConfig.GetClassesFromProjectDir(_projectDir), split, parameters, cli,
            ChkExportOnnx.IsChecked == true);
        _outcome = await _service.RunAsync(request);
        UpdateRunState(YoloTrainingPhase.Idle);
    }

    private void OnServiceLog(string line) => Dispatcher.BeginInvoke(() => AppendLog(line));

    private void OnServiceProgress(YoloTrainProgress p) => Dispatcher.BeginInvoke(() =>
    {
        BarProgress.Value = p.TotalEpochs <= 0 ? 0 : (double)p.Epoch / p.TotalEpochs;
        TxtEpoch.Text = T(I18nKeys.YoloTrainingEpochFormat).Replace("{epoch}", p.Epoch.ToString()).Replace("{total}", p.TotalEpochs.ToString());
    });

    private void OnServicePhase(YoloTrainingPhase phase) => Dispatcher.BeginInvoke(() => UpdateRunState(phase));

    private void UpdateRunState(YoloTrainingPhase phase)
    {
        bool running = phase != YoloTrainingPhase.Idle;
        BtnStart.IsEnabled = !running;
        BtnStop.IsEnabled = running;
        BtnPreview.IsEnabled = !running;
        BtnUseForNavigation.IsEnabled = !running && _outcome?.Onnx != null;
        BtnOpenOutput.IsEnabled = Directory.Exists(_outcome?.RunDir ?? YoloDataLayout.GetRunsDir(_projectDir));
        var (style, key) = phase switch
        {
            YoloTrainingPhase.Building => ("StatusChipInfoStyle", I18nKeys.YoloTrainingStatusBuilding),
            YoloTrainingPhase.Training => ("StatusChipInfoStyle", I18nKeys.YoloTrainingStatusTraining),
            YoloTrainingPhase.Exporting => ("StatusChipInfoStyle", I18nKeys.YoloTrainingStatusExporting),
            _ when _outcome == null => ("StatusChipStyle", I18nKeys.YoloTrainingStatusIdle),
            _ when _outcome.Success => ("StatusChipSuccessStyle", I18nKeys.YoloTrainingStatusDone),
            _ when _outcome.Cancelled => ("StatusChipWarningStyle", I18nKeys.YoloTrainingStatusCancelled),
            _ => ("StatusChipDangerStyle", I18nKeys.YoloTrainingStatusFailed),
        };
        SetChip(ChipRun, TxtRunChip, style, T(key));
        if (_outcome?.Success == true) BarProgress.Value = 1;
    }

    private void OpenOutput()
    {
        var dir = _outcome?.RunDir ?? YoloDataLayout.GetRunsDir(_projectDir);
        if (Directory.Exists(dir)) YoloSegmentLayout.OpenDir(dir);
    }

    private void UseForNavigation()
    {
        if (_outcome?.Onnx is not { } onnx || !File.Exists(onnx)) return;
        ConfigBinding.SaveString(ConfigKeys.NavigationNpcModelPath, onnx);
        AppendLog(T(I18nKeys.YoloTrainingNavigationModelSet).Replace("{path}", onnx));
    }

    private void BrowseModel()
    {
        var dlg = new Microsoft.Win32.OpenFileDialog { Filter = T(I18nKeys.YoloTrainingModelFilter) + "|*.pt" };
        if (dlg.ShowDialog(this) != true) return;
        CboModel.Text = dlg.FileName;
        ConfigBinding.SaveString(ConfigKeys.YoloTrainingModel, dlg.FileName);
    }

    private void BrowseInto(TextBox box, string filter, string key)
    {
        var dlg = new Microsoft.Win32.OpenFileDialog { Filter = filter };
        if (dlg.ShowDialog(this) != true) return;
        box.Text = dlg.FileName;
        ConfigBinding.SaveString(key, dlg.FileName);
        _env = null;
        RenderEnvironment();
    }

    private void AppendLog(string line)
    {
        if (TxtLog.Text.Length > MaxLogChars) TxtLog.Text = TxtLog.Text[^(MaxLogChars / 2)..];
        TxtLog.AppendText((TxtLog.Text.Length > 0 ? "\n" : "") + line);
        TxtLog.ScrollToEnd();
    }

    private void SetChip(System.Windows.Controls.Border chip, TextBlock text, string styleKey, string value)
    {
        chip.SetResourceReference(StyleProperty, styleKey);
        text.Text = value;
    }

    private void Warn(string key) => MessageBox.Show(this, T(key), Title, MessageBoxButton.OK, MessageBoxImage.Warning);

    private static string NonEmpty(string? text, string fallback) => string.IsNullOrWhiteSpace(text) ? fallback : text.Trim();

    private static string Pick(IReadOnlyList<string> values, int index, string fallback) => index >= 0 && index < values.Count ? values[index] : fallback;

    private static string Num(double v) => v.ToString(CultureInfo.InvariantCulture);

    private static int NonZero(int v, int fallback) => v == 0 ? fallback : v;

    private static string Gb(long bytes) => (bytes / Gib).ToString("0.#", CultureInfo.InvariantCulture);

    public sealed record AdviceRow(string Glyph, string Text, Brush Brush);
}
