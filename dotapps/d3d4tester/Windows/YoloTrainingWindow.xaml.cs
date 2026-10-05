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
using DotApps.d3d4tester.ViewModels;
using DotCore.Common;
using DotCore.VocAnnotator;
using DotCore.YoloRecord;
using DotCore.YoloTaskSet;
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

    private const string ModeGeneral = "general";
    private const string ModeSpecific = "specific";

    private readonly string? _projectDir;
    private readonly IReadOnlyList<string> _allSegments;
    private readonly IReadOnlyList<string> _selectedSegments;
    private readonly YoloTrainingService _service = YoloTrainingService.Instance;
    private readonly TaskSetStore _taskSets = new(TaskSetStore.DefaultRoot);
    private readonly string? _initialTaskSetId;
    private readonly bool _autoStart;
    private YoloEnvironment? _env;
    private YoloDatasetPlan? _plan;
    private IYoloDatasetStats? _taskSetStats;
    private string? _datasetYaml;
    private string? _datasetTaskSetId;
    private bool _detecting;
    private int _summaryVersion;

    /// <summary>projectDir null = no recorded project: only the specific (task set) mode is available.</summary>
    public YoloTrainingWindow(string? projectDir, IReadOnlyList<string> allSegments, IReadOnlyList<string> selectedSegments,
        string? taskSetId = null, bool autoStart = false)
    {
        _projectDir = projectDir;
        _allSegments = allSegments;
        _selectedSegments = selectedSegments;
        _initialTaskSetId = taskSetId;
        _autoStart = autoStart;
        InitializeComponent();
        ApplyTexts();
        BindConfig();
        BindMode();
        BtnManageTaskSets.Click += (_, _) => OpenTaskSetManager();
        BtnClearDataset.Click += (_, _) => SetExistingDataset(null, null);
        BtnDetect.Click += async (_, _) => await DetectAsync();
        BtnApplyRecommended.Click += (_, _) => ApplyRecommendation();
        BtnBrowsePython.Click += (_, _) => BrowseInto(TxtPython, T(I18nKeys.YoloTrainingEnvPython) + "|python*.exe;python3*;python", ConfigKeys.YoloTrainingPythonExe);
        BtnBrowseModel.Click += (_, _) => BrowseModel();
        BtnPreview.Click += async (_, _) => await PreviewAsync();
        BtnStart.Click += async (_, _) => await StartAsync();
        BtnStop.Click += (_, _) => _service.Cancel();
        BtnOpenOutput.Click += (_, _) => OpenOutput();
        BtnUseForNavigation.Click += (_, _) => UseForNavigation();
        BtnTestModel.Click += (_, _) => TestModel(OnnxOf(Outcome, LastRunEntry()));
        BtnResume.Click += async (_, _) => await ResumeAsync(LastRunEntry());
        BtnExportBest.Click += async (_, _) => await ExportAsync(LastRunEntry());
        BtnRefreshRuns.Click += (_, _) => RefreshRuns();
        BtnRunSetCurrent.Click += (_, _) => SetCurrentModel(SelectedRun());
        BtnRunExport.Click += async (_, _) => await ExportAsync(SelectedRun());
        BtnRunResume.Click += async (_, _) => await ResumeAsync(SelectedRun());
        BtnRunFineTune.Click += (_, _) => FineTuneFrom(SelectedRun());
        BtnRunTest.Click += (_, _) => TestModel(SelectedRun()?.Onnx);
        BtnRunOpen.Click += (_, _) => { if (SelectedRun() is { } r) YoloSegmentLayout.OpenDir(r.RunDir); };
        BtnRunDelete.Click += (_, _) => DeleteRun(SelectedRun());
        BtnRunEvaluate.Click += async (_, _) => await EvaluateAsync(SelectedRun());
        BtnAugReset.Click += (_, _) => ResetAugmentation();
        DgRuns.SelectionChanged += (_, _) => UpdateRunActions();
        TabsRun.SelectionChanged += (_, e) => { if (e.Source == TabsRun && TabsRun.SelectedItem == TabRuns) RefreshRuns(); };
        TxtExtraArgs.TextChanged += (_, _) => RenderExtraArgsIssue();
        _service.Log += OnServiceLog;
        _service.Progress += OnServiceProgress;
        _service.BuildProgress += OnServiceBuildProgress;
        _service.PhaseChanged += OnServicePhase;
        _service.Metrics += OnServiceMetrics;
        _service.OutcomeChanged += OnServiceOutcome;
        D3D4TesterI18n.Provider.LanguageChanged += OnLanguageChanged;
        Closed += (_, _) =>
        {
            _service.Log -= OnServiceLog;
            _service.Progress -= OnServiceProgress;
            _service.BuildProgress -= OnServiceBuildProgress;
            _service.PhaseChanged -= OnServicePhase;
            _service.Metrics -= OnServiceMetrics;
            _service.OutcomeChanged -= OnServiceOutcome;
            D3D4TesterI18n.Provider.LanguageChanged -= OnLanguageChanged;
        };
        Activated += (_, _) => RefreshTaskSets();
        Loaded += async (_, _) =>
        {
            if (Outcome?.RunDir is { } lastRun) RenderMetrics(YoloResultsCsv.Read(lastRun), lastRun);
            UpdateRunState(_service.Phase);
            if (_autoStart || ConfigBinding.GetValue(ConfigKeys.YoloTrainingDetectOnOpen, true)) await DetectAsync();
            if (_autoStart) await StartAsync();
        };
    }

    private static string T(string key) => D3D4TesterI18n.Provider.GetUiText(key);

    private bool IsSpecific => RadioSpecific.IsChecked == true;

    /// <summary>Last train / resume / export outcome of the service (shared by every window).</summary>
    private YoloTrainingOutcome? Outcome => _service.LastOutcome;

    /// <summary>Open in specific (task set) mode over the current calibration project; autoStart begins training after the environment check.</summary>
    public static YoloTrainingWindow ShowForTaskSet(Window? owner, string taskSetId, bool autoStart)
    {
        var project = ConfigBinding.GetValue(ConfigKeys.CoordCalibrationYoloCurrentProject, "");
        project = !string.IsNullOrWhiteSpace(project) && Directory.Exists(project) ? project : null;
        var segments = project == null ? new List<string>() : YoloSegmentLayout.ListSegments(project).Select(s => s.SegmentPath).ToList();
        ConfigBinding.SaveString(ConfigKeys.YoloTrainingMode, ModeSpecific);
        return ShowSingle(owner, project, segments, Array.Empty<string>(), taskSetId, autoStart);
    }

    /// <summary>
    /// Like ShowForTaskSet, but trains on an already generated dataset of the task set without regenerating; datasetDir is
    /// {task_set}/_datasets/{stamp} or its data.yaml.
    /// </summary>
    public static YoloTrainingWindow ShowForDataset(Window? owner, string taskSetId, string datasetDir, bool autoStart)
    {
        var project = ConfigBinding.GetValue(ConfigKeys.CoordCalibrationYoloCurrentProject, "");
        project = !string.IsNullOrWhiteSpace(project) && Directory.Exists(project) ? project : null;
        var segments = project == null ? new List<string>() : YoloSegmentLayout.ListSegments(project).Select(s => s.SegmentPath).ToList();
        ConfigBinding.SaveString(ConfigKeys.YoloTrainingMode, ModeSpecific);
        return ShowSingle(owner, project, segments, Array.Empty<string>(), taskSetId, autoStart, datasetDir);
    }

    /// <summary>
    /// Show the single training window. An open window is reused (activated, task set selected) unless it belongs to another project
    /// or segment selection and nothing runs, in which case it is replaced. A second autostart while training runs is refused with a busy notice.
    /// datasetDir (specific mode) trains on that existing dataset instead of regenerating one.
    /// </summary>
    public static YoloTrainingWindow ShowSingle(Window? owner, string? projectDir, IReadOnlyList<string> allSegments,
        IReadOnlyList<string> selectedSegments, string? taskSetId = null, bool autoStart = false, string? datasetDir = null)
    {
        var win = Application.Current.Windows.OfType<YoloTrainingWindow>().FirstOrDefault();
        var service = YoloTrainingService.Instance;
        if (win != null && !service.IsRunning && (!SamePath(win._projectDir, projectDir)
                || selectedSegments.Count > 0 && !selectedSegments.SequenceEqual(win._selectedSegments, StringComparer.OrdinalIgnoreCase)))
        {
            win.Close();
            win = Application.Current.Windows.OfType<YoloTrainingWindow>().FirstOrDefault();
        }
        if (win == null)
        {
            win = new YoloTrainingWindow(projectDir, allSegments, selectedSegments, taskSetId, autoStart) { Owner = owner };
            win.SetExistingDataset(taskSetId, datasetDir);
            win.Show();
            return win;
        }
        if (win.WindowState == WindowState.Minimized) win.WindowState = WindowState.Normal;
        win.Activate();
        if (service.IsRunning)
        {
            if (autoStart) win.Warn(I18nKeys.YoloTrainingBusy);
            return win;
        }
        if (taskSetId != null) win.SelectTaskSet(taskSetId);
        win.SetExistingDataset(taskSetId, datasetDir);
        if (autoStart) _ = win.StartAsync();
        return win;
    }

    /// <summary>Pins (or with datasetDir null clears) an existing dataset of the task set for the next specific-mode training.</summary>
    private void SetExistingDataset(string? taskSetId, string? datasetDir)
    {
        var full = datasetDir == null ? null : Path.GetFullPath(datasetDir);
        _datasetYaml = taskSetId == null || full == null ? null : File.Exists(full) ? full : Path.Combine(full, YoloDataYaml.FileName);
        _datasetTaskSetId = _datasetYaml == null ? null : taskSetId;
        RenderExistingDataset();
    }

    private void RenderExistingDataset()
    {
        PanelExistingDataset.Visibility = _datasetYaml != null && IsSpecific ? Visibility.Visible : Visibility.Collapsed;
        TxtExistingDataset.Text = _datasetYaml == null ? ""
            : T(I18nKeys.YoloTrainingExistingDataset).Replace("{dir}", Path.GetDirectoryName(_datasetYaml) ?? _datasetYaml);
    }

    private static bool SamePath(string? a, string? b) =>
        string.Equals(a == null ? null : Path.GetFullPath(a).TrimEnd(Path.DirectorySeparatorChar),
            b == null ? null : Path.GetFullPath(b).TrimEnd(Path.DirectorySeparatorChar), StringComparison.OrdinalIgnoreCase);

    private void SelectTaskSet(string taskSetId)
    {
        RadioSpecific.IsChecked = true;
        RefreshTaskSets();
        if (CboTaskSet.ItemsSource is IEnumerable<TaskSet> sets && sets.FirstOrDefault(s => s.Id == taskSetId) is { } set)
            CboTaskSet.SelectedItem = set;
    }

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
        RenderAugmentation();
        RenderExtraArgsIssue();
        RenderMetrics(_metrics, _metricsRunDir);
        UpdateRunState(_service.Phase);
        if (TabsRun.SelectedItem == TabRuns) RefreshRuns();
        _ = RenderTaskSetSummaryAsync();
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
        LblMode.Text = T(I18nKeys.YoloTrainingMode);
        RadioGeneral.Content = T(I18nKeys.YoloTrainingModeGeneral);
        RadioSpecific.Content = T(I18nKeys.YoloTrainingModeSpecific);
        BtnManageTaskSets.Content = T(I18nKeys.YoloTrainingManageTaskSets);
        BtnClearDataset.Content = T(I18nKeys.YoloTrainingExistingDatasetClear);
        RenderExistingDataset();
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
        ChkPseudoLabels.Content = T(I18nKeys.YoloTrainingIncludePseudoLabels);
        BtnPreview.Content = T(I18nKeys.YoloTrainingPreview);
        LblRun.Text = T(I18nKeys.YoloTrainingSectionRun);
        BtnStart.Content = T(I18nKeys.YoloTrainingStart);
        BtnStop.Content = T(I18nKeys.YoloTrainingStop);
        BtnOpenOutput.Content = T(I18nKeys.YoloTrainingOpenOutput);
        BtnUseForNavigation.Content = T(I18nKeys.YoloTrainingUseForNavigation);
        BtnResume.Content = T(I18nKeys.YoloTrainingResume);
        BtnExportBest.Content = T(I18nKeys.YoloTrainingExportBest);
        BtnTestModel.Content = T(I18nKeys.ModelTestOpenButton);
        ApplyAugmentationTexts();
        ApplyRunsTexts();
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
        TxtImgsz.LostFocus += (_, _) => RenderImgszHint();
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
        ConfigBinding.BindCheckBox(ChkPseudoLabels, ConfigKeys.YoloDatasetIncludeUnreviewedPseudoLabels, SplitDefaults.IncludeUnreviewedPseudoLabels);
        TxtPreview.Text = T(I18nKeys.YoloTrainingPreviewNone);
        BindAugmentation();
        RenderExtraArgsIssue();
    }

    private void BindMode()
    {
        RadioGeneral.IsEnabled = _projectDir != null;
        var mode = ConfigBinding.GetValue(ConfigKeys.YoloTrainingMode, ModeGeneral);
        bool specific = _initialTaskSetId != null || _projectDir == null || mode == ModeSpecific;
        (specific ? RadioSpecific : RadioGeneral).IsChecked = true;
        RadioGeneral.Checked += (_, _) => OnModeChanged(ModeGeneral);
        RadioSpecific.Checked += (_, _) => OnModeChanged(ModeSpecific);
        RefreshTaskSets();
        CboTaskSet.SelectionChanged += (_, _) =>
        {
            if (CboTaskSet.SelectedItem is TaskSet set) ConfigBinding.SaveString(ConfigKeys.YoloTrainingTaskSet, set.Id);
            if (_datasetYaml != null && (CboTaskSet.SelectedItem as TaskSet)?.Id != _datasetTaskSetId) SetExistingDataset(null, null);
            _ = RenderTaskSetSummaryAsync();
        };
        UpdateModePanels();
    }

    private void OnModeChanged(string mode)
    {
        ConfigBinding.SaveString(ConfigKeys.YoloTrainingMode, mode);
        UpdateModePanels();
        RenderEnvironment();
        RenderAugmentation();
    }

    private void UpdateModePanels()
    {
        PanelSpecific.Visibility = IsSpecific ? Visibility.Visible : Visibility.Collapsed;
        PanelGeneral.Visibility = IsSpecific ? Visibility.Collapsed : Visibility.Visible;
        RenderExistingDataset();
        RenderImgszHint();
        _ = RenderTaskSetSummaryAsync();
    }

    /// <summary>Reload the task set list (kept in sync with the manager window), keeping the selection.</summary>
    private void RefreshTaskSets()
    {
        IReadOnlyList<TaskSet> sets;
        try { sets = _taskSets.List(); }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { sets = Array.Empty<TaskSet>(); }
        var wanted = (CboTaskSet.SelectedItem as TaskSet)?.Id ?? _initialTaskSetId ?? ConfigBinding.GetValue(ConfigKeys.YoloTrainingTaskSet, "");
        CboTaskSet.ItemsSource = sets;
        CboTaskSet.SelectedItem = sets.FirstOrDefault(s => s.Id == wanted) ?? sets.FirstOrDefault();
    }

    private TaskSet? SelectedTaskSet() => CboTaskSet.SelectedItem is TaskSet s ? _taskSets.Load(s.Id) : null;

    private async Task RenderTaskSetSummaryAsync()
    {
        if (!IsSpecific) return;
        int version = ++_summaryVersion;
        var set = SelectedTaskSet();
        _taskSetStats = null;
        RenderImgszHint();
        RenderAugmentation();
        if (set == null)
        {
            TxtTaskSetSummary.Text = T(I18nKeys.YoloTrainingTaskSetNone);
            RenderEnvironment();
            return;
        }
        var summary = T(I18nKeys.YoloTrainingTaskSetSummary)
            .Replace("{targets}", set.Targets.Count.ToString())
            .Replace("{classes}", string.Join(", ", set.ClassNames))
            .Replace("{variants}", set.Targets.Sum(t => t.Variants.Count).ToString())
            .Replace("{scenes}", set.Targets.Sum(t => t.Scenes.Count).ToString())
            .Replace("{common}", set.CommonResources.Count.ToString())
            .Replace("{per_target}", set.Synthesis.ImagesPerTarget.ToString())
            .Replace("{val}", set.Synthesis.ValPercent.ToString());
        TxtTaskSetSummary.Text = summary;
        var dir = _taskSets.GetDir(set.Id);
        var (issues, stats) = await Task.Run(() =>
        {
            var found = TaskSetSynthesizer.Validate(set, dir);
            IYoloDatasetStats? estimate = null;
            try { estimate = YoloTrainingService.EstimateStats(set, dir); }
            catch (Exception ex) when (TaskSetUiErrors.IsHandled(ex)) { }
            return (found, estimate);
        });
        if (version != _summaryVersion) return;
        TxtTaskSetSummary.Text = string.Join("\n", new[] { summary }.Concat(TaskSetIssueFormatter.Ordered(issues).Select(FormatIssue)));
        _taskSetStats = stats;
        RenderEnvironment();
        RenderImgszHint();
    }

    /// <summary>Imgsz the task set requires (native scale: the synthesis window), null when free.</summary>
    private int? RequiredImgsz => IsSpecific && _taskSetStats is { RequiredImgsz: > 0 } s ? YoloTrainParameters.NormalizeImgsz(s.RequiredImgsz) : null;

    /// <summary>
    /// Native-scale task sets: the synthesis window is the training image, and tiled inference does not resize tiles, so imgsz
    /// must equal the window; another imgsz makes Ultralytics rescale every training image and object sizes stop matching.
    /// </summary>
    private void RenderImgszHint()
    {
        int current = YoloTrainParameters.NormalizeImgsz(ConfigBinding.ParseInt(TxtImgsz.Text, YoloTrainParameters.MinImgsz, YoloTrainParameters.MaxImgsz, Defaults.Imgsz));
        var required = RequiredImgsz;
        bool show = required is { } n && n != current;
        TxtImgszHint.Text = show ? T(I18nKeys.YoloTrainingImgszNativeMismatch).Replace("{native}", required.ToString()).Replace("{current}", current.ToString()) : "";
        TxtImgszHint.Visibility = show ? Visibility.Visible : Visibility.Collapsed;
    }

    private static string FormatIssue(TaskSetIssue issue) => TaskSetIssueFormatter.Line(issue);

    private void OpenTaskSetManager() => TaskSetWindow.ShowSingle(this, (CboTaskSet.SelectedItem as TaskSet)?.Id);

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
        IncludeUnreviewedPseudoLabels = ChkPseudoLabels.IsChecked == true,
    };

    private List<YoloDatasetSource> GatherSources() => SourcesOf(RadioSelected.IsChecked == true ? _selectedSegments : _allSegments);

    /// <summary>Annotated frame folders of recorded segments (segments without frames are skipped).</summary>
    private static List<YoloDatasetSource> SourcesOf(IEnumerable<string> segments)
    {
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
        if (p.PseudoLabeledImages > 0 || p.UnreviewedSkipped > 0)
            lines.Add(T(I18nKeys.YoloTrainingPreviewPseudoLabels).Replace("{included}", p.PseudoLabeledImages.ToString())
                .Replace("{skipped}", p.UnreviewedSkipped.ToString()));
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
        ValCli.Text = py?.Launcher?.Format(Array.Empty<string>()) ?? py?.YoloCli ?? none;
        SetChip(ChipEnv, TxtEnvChip, env.CanTrain ? "StatusChipSuccessStyle" : "StatusChipDangerStyle",
            T(env.CanTrain ? I18nKeys.YoloTrainingEnvReady : I18nKeys.YoloTrainingEnvNotReady));
        var advice = YoloTrainAdvisor.Recommend(env, GatherParameters(), AdvisorDataset).Advice;
        LstAdvice.ItemsSource = advice.Select(a => new AdviceRow(
            a.IsWarning ? GlyphWarning : GlyphInfo,
            T(I18nKeys.YoloTrainingAdvice(a.Code)).Replace("{value}", a.Value),
            (Brush)FindResource(a.IsWarning ? "WarningTextBrush" : "TextSecondaryBrush"))).ToList();
    }

    private void ApplyRecommendation()
    {
        if (_env == null) return;
        var r = YoloTrainAdvisor.Recommend(_env, GatherParameters(), AdvisorDataset).Parameters;
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
        RenderImgszHint();
    }

    private IYoloDatasetStats? AdvisorDataset => IsSpecific ? _taskSetStats : _plan;

    private async Task StartAsync()
    {
        if (_service.IsRunning)
        {
            Warn(I18nKeys.YoloTrainingBusy);
            return;
        }
        Func<YoloTrainParameters, YoloLauncher, bool, YoloTrainingJob>? makeJob;
        var parameters = GatherParameters();
        if (IsSpecific)
        {
            var set = SelectedTaskSet();
            if (set == null)
            {
                Warn(I18nKeys.YoloTrainingTaskSetNone);
                return;
            }
            var dir = _taskSets.GetDir(set.Id);
            parameters = parameters with { Augmentation = UseDerivedAugmentation ? YoloTrainingService.AugmentationForTaskSet(set) : CustomAugmentation() };
            if (_datasetYaml is { } yaml && _datasetTaskSetId == set.Id)
            {
                var source = new YoloRunSource(YoloRunSource.KindTaskSet, set.Id, set.Name);
                makeJob = (p, launcher, export) => YoloTrainingService.ForDataset(yaml, YoloDataLayout.GetRunsDir(dir), p, launcher, export, source);
            }
            else
            {
                var errors = (await Task.Run(() => TaskSetSynthesizer.Validate(set, dir))).Where(i => i.IsError).ToList();
                if (errors.Count > 0)
                {
                    MessageBox.Show(this, T(I18nKeys.YoloTrainingTaskSetInvalid) + "\n" + string.Join("\n", errors.Select(FormatIssue)), Title,
                        MessageBoxButton.OK, MessageBoxImage.Warning);
                    return;
                }
                makeJob = (p, launcher, export) => YoloTrainingService.ForTaskSet(set, dir, p, launcher, export);
            }
        }
        else
        {
            var split = GatherSplit();
            if (!split.IsValid)
            {
                Warn(I18nKeys.YoloTrainingSplitInvalid);
                return;
            }
            var sources = GatherSources();
            if (_projectDir == null || sources.Count == 0)
            {
                Warn(I18nKeys.YoloTrainingNoSegments);
                return;
            }
            var project = _projectDir;
            parameters = parameters with { Augmentation = CustomAugmentation() };
            makeJob = (p, launcher, export) => YoloTrainingService.ForSegments(project, sources, ProjectConfig.GetClassesFromProjectDir(project), split, p, launcher, export);
        }
        if (await LauncherAsync() is not { } launcher) return;
        BeginJobView();
        ShowResult(await _service.RunAsync(makeJob(parameters, launcher, ChkExportOnnx.IsChecked == true)));
    }

    /// <summary>Launcher of the probed environment (probes once when needed); warns and returns null when training is impossible.</summary>
    private async Task<YoloLauncher?> LauncherAsync()
    {
        if (_env == null) await DetectAsync();
        if (_env is { CanTrain: true, Python.Launcher: { } launcher }) return launcher;
        Warn(I18nKeys.YoloTrainingCannotTrain);
        return null;
    }

    /// <summary>Clears log, progress and metrics and shows the Run tab before a job starts.</summary>
    private void BeginJobView()
    {
        TabsRun.SelectedItem = TabRun;
        TxtLog.Clear();
        BarProgress.Value = 0;
        TxtEpoch.Text = "";
        RenderMetrics(Array.Empty<YoloEpochMetrics>(), null);
    }

    /// <summary>A busy answer is not published by the service, so only this window reports it.</summary>
    private void ShowResult(YoloTrainingOutcome outcome)
    {
        if (!ReferenceEquals(outcome, Outcome) && outcome.Error is { Length: > 0 } error)
            MessageBox.Show(this, error, Title, MessageBoxButton.OK, MessageBoxImage.Warning);
        UpdateRunState(_service.Phase);
    }

    private void OnServiceBuildProgress(int done, int total) => Dispatcher.BeginInvoke(() =>
    {
        BarProgress.Value = total <= 0 ? 0 : (double)done / total;
        TxtEpoch.Text = T(I18nKeys.YoloTrainingBuildProgress).Replace("{done}", done.ToString()).Replace("{total}", total.ToString());
    });

    /// <summary>Runs dir of the active mode (null when none).</summary>
    private string? RunsDir()
    {
        if (!IsSpecific) return _projectDir == null ? null : YoloDataLayout.GetRunsDir(_projectDir);
        return CboTaskSet.SelectedItem is TaskSet s ? YoloDataLayout.GetRunsDir(_taskSets.GetDir(s.Id)) : null;
    }

    private void OnServiceLog(string line) => Dispatcher.BeginInvoke(() => AppendLog(line));

    private void OnServiceProgress(YoloTrainProgress p) => Dispatcher.BeginInvoke(() =>
    {
        BarProgress.Value = p.TotalEpochs <= 0 ? 0 : (double)p.Epoch / p.TotalEpochs;
        TxtEpoch.Text = T(I18nKeys.YoloTrainingEpochFormat).Replace("{epoch}", p.Epoch.ToString()).Replace("{total}", p.TotalEpochs.ToString());
    });

    private void OnServicePhase(YoloTrainingPhase phase) => Dispatcher.BeginInvoke(() => UpdateRunState(phase));

    private void OnServiceMetrics(YoloTrainMetrics metrics) => Dispatcher.BeginInvoke(() => RenderMetrics(metrics.Rows, metrics.RunDir));

    private void OnServiceOutcome(YoloTrainingOutcome outcome) => Dispatcher.BeginInvoke(() =>
    {
        if (outcome.RunDir is { } dir) RenderMetrics(YoloResultsCsv.Read(dir), dir);
        UpdateRunState(_service.Phase);
        if (TabsRun.SelectedItem == TabRuns) RefreshRuns();
    });

    private void UpdateRunState(YoloTrainingPhase phase)
    {
        bool running = phase != YoloTrainingPhase.Idle;
        var outcome = Outcome;
        var last = running ? null : LastRunEntry();
        BtnStart.IsEnabled = !running;
        BtnStop.IsEnabled = running;
        BtnPreview.IsEnabled = !running;
        BtnResume.IsEnabled = last?.CanResume == true;
        BtnExportBest.IsEnabled = last is { Weights: not null, Onnx: null };
        BtnUseForNavigation.IsEnabled = !running && OnnxOf(outcome, last) != null;
        BtnTestModel.IsEnabled = OnnxOf(outcome, last) != null;
        BtnOpenOutput.IsEnabled = (outcome?.RunDir ?? RunsDir()) is { } runs && Directory.Exists(runs);
        var (style, key) = phase switch
        {
            YoloTrainingPhase.Building => ("StatusChipInfoStyle", I18nKeys.YoloTrainingStatusBuilding),
            YoloTrainingPhase.Training => ("StatusChipInfoStyle", I18nKeys.YoloTrainingStatusTraining),
            YoloTrainingPhase.Exporting => ("StatusChipInfoStyle", I18nKeys.YoloTrainingStatusExporting),
            YoloTrainingPhase.Evaluating => ("StatusChipInfoStyle", I18nKeys.YoloTrainingStatusEvaluating),
            _ when outcome == null => ("StatusChipStyle", I18nKeys.YoloTrainingStatusIdle),
            _ when outcome.Success => ("StatusChipSuccessStyle", I18nKeys.YoloTrainingStatusDone),
            _ when outcome.Cancelled => ("StatusChipWarningStyle", I18nKeys.YoloTrainingStatusCancelled),
            _ => ("StatusChipDangerStyle", I18nKeys.YoloTrainingStatusFailed),
        };
        SetChip(ChipRun, TxtRunChip, style, T(key));
        if (!running && outcome?.Success == true) BarProgress.Value = 1;
        RenderOutcome(outcome, running);
        UpdateRunActions();
    }

    /// <summary>Outcome line under the run buttons: run dir, best-so-far hint after a cancel, or the error (e.g. task-set validation issues).</summary>
    private void RenderOutcome(YoloTrainingOutcome? outcome, bool running)
    {
        string? text = running || outcome == null ? null
            : outcome.Success ? T(I18nKeys.YoloTrainingOutcomeDone).Replace("{run}", outcome.RunDir ?? "")
            : outcome.Cancelled ? T(outcome.Weights != null || LastRunEntry()?.Weights != null ? I18nKeys.YoloTrainingOutcomeCancelledBest : I18nKeys.YoloTrainingOutcomeCancelled)
                .Replace("{run}", outcome.RunDir ?? "")
            : T(I18nKeys.YoloTrainingOutcomeFailed).Replace("{error}", outcome.Error ?? "");
        TxtOutcome.Text = text ?? "";
        TxtOutcome.Visibility = text == null ? Visibility.Collapsed : Visibility.Visible;
    }

    /// <summary>Registry entry of the last outcome's run (fresh from disk), or null.</summary>
    private YoloRunEntry? LastRunEntry() => Outcome?.RunDir is { } dir && Directory.Exists(dir) ? YoloModelRegistry.ReadRun(dir) : null;

    private static string? OnnxOf(YoloTrainingOutcome? outcome, YoloRunEntry? entry) =>
        outcome?.Onnx is { } onnx && File.Exists(onnx) ? onnx : entry?.Onnx;

    private void OpenOutput()
    {
        var dir = Outcome?.RunDir ?? RunsDir();
        if (dir != null && Directory.Exists(dir)) YoloSegmentLayout.OpenDir(dir);
    }

    private void UseForNavigation()
    {
        if (OnnxOf(Outcome, LastRunEntry()) is { } onnx) SetCurrentModel(onnx, ConsumerOption.Navigation);
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
