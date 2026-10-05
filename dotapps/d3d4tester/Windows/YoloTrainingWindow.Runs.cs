// PY-REF: none (DOT-only)
using System.Globalization;
using System.IO;
using System.Windows;
using System.Windows.Media;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core.Navigation;
using DotApps.d3d4tester.Services;
using DotApps.d3d4tester.ViewModels;
using DotCore.VocAnnotator;
using DotCore.YoloRecord;
using DotCore.YoloTaskSet;
using DotCore.YoloTrain;

namespace DotApps.d3d4tester.Windows;

/// <summary>Live metrics (results.csv rows, best epoch, mAP chart) and the runs list of the model registry with its actions.</summary>
public partial class YoloTrainingWindow
{
    private const string MetricFormat = "0.000";
    private const string LossFormat = "0.0000";
    private const string RunDateFormat = "yyyy-MM-dd HH:mm";
    private const string CurrentSeparator = ", ";

    private IReadOnlyList<YoloEpochMetrics> _metrics = Array.Empty<YoloEpochMetrics>();
    private string? _metricsRunDir;
    private int _runsVersion;

    /// <summary>Model consumers of the registry the window can set; navigation requires the town target classes.</summary>
    private sealed record ConsumerOption(string Id, string LabelKey)
    {
        public static readonly ConsumerOption Navigation = new(YoloModelRegistry.ConsumerNavigation, I18nKeys.YoloTrainingConsumerNavigation);
        public static readonly ConsumerOption AutoLabel = new(YoloModelRegistry.ConsumerAutoLabel, I18nKeys.YoloTrainingConsumerAutoLabel);
        public static readonly IReadOnlyList<ConsumerOption> All = new[] { Navigation, AutoLabel };

        public string Label => T(LabelKey);

        public override string ToString() => Label;
    }

    public sealed record MetricsRow(int Epoch, string BoxLoss, string ClsLoss, string DflLoss, string Precision, string Recall, string Map50, string Map5095);

    public sealed record RunRow(YoloRunEntry Entry, string Current, string Name, string Source, string Date, string Classes,
        string Map50, string Map5095, string RealMap50, string Status);

    private void ApplyRunsTexts()
    {
        TabRun.Header = T(I18nKeys.YoloTrainingTabRun);
        TabRuns.Header = T(I18nKeys.YoloTrainingTabRuns);
        TxtLegendMap50.Text = T(I18nKeys.YoloTrainingColMap50);
        TxtLegendMap5095.Text = T(I18nKeys.YoloTrainingColMap5095);
        ColMEpoch.Header = T(I18nKeys.YoloTrainingColEpoch);
        ColMBoxLoss.Header = T(I18nKeys.YoloTrainingColBoxLoss);
        ColMClsLoss.Header = T(I18nKeys.YoloTrainingColClsLoss);
        ColMDflLoss.Header = T(I18nKeys.YoloTrainingColDflLoss);
        ColMPrecision.Header = T(I18nKeys.YoloTrainingColPrecision);
        ColMRecall.Header = T(I18nKeys.YoloTrainingColRecall);
        ColMMap50.Header = T(I18nKeys.YoloTrainingColMap50);
        ColMMap5095.Header = T(I18nKeys.YoloTrainingColMap5095);
        BtnRefreshRuns.Content = T(I18nKeys.YoloTrainingRunsRefresh);
        ColRunCurrent.Header = T(I18nKeys.YoloTrainingColCurrent);
        ColRunName.Header = T(I18nKeys.YoloTrainingColRun);
        ColRunSource.Header = T(I18nKeys.YoloTrainingColSource);
        ColRunDate.Header = T(I18nKeys.YoloTrainingColDate);
        ColRunClasses.Header = T(I18nKeys.YoloTrainingColClasses);
        ColRunMap50.Header = T(I18nKeys.YoloTrainingColMap50);
        ColRunMap5095.Header = T(I18nKeys.YoloTrainingColMap5095);
        ColRunRealMap50.Header = T(I18nKeys.YoloTrainingColRealMap50);
        ColRunStatus.Header = T(I18nKeys.YoloTrainingColStatus);
        BtnRunSetCurrent.Content = T(I18nKeys.YoloTrainingRunSetCurrent);
        BtnRunExport.Content = T(I18nKeys.YoloTrainingRunExport);
        BtnRunResume.Content = T(I18nKeys.YoloTrainingResume);
        BtnRunFineTune.Content = T(I18nKeys.YoloTrainingRunFineTune);
        BtnRunTest.Content = T(I18nKeys.ModelTestOpenButton);
        BtnRunOpen.Content = T(I18nKeys.YoloTrainingRunOpen);
        BtnRunDelete.Content = T(I18nKeys.YoloTrainingRunDelete);
        ExpRealEval.Header = T(I18nKeys.YoloTrainingRealEval);
        TxtRealEvalHint.Text = T(I18nKeys.YoloTrainingRealEvalHint);
        BtnRunEvaluate.Content = T(I18nKeys.YoloTrainingRealEvalStart);
        int consumer = Math.Max(0, CboConsumer.SelectedIndex);
        CboConsumer.ItemsSource = null;
        CboConsumer.ItemsSource = ConsumerOption.All;
        CboConsumer.SelectedIndex = consumer;
        if (LstRealSegments.ItemsSource == null)
            LstRealSegments.ItemsSource = _allSegments.Select(s => Path.GetFileName(Path.TrimEndingDirectorySeparator(s))).ToList();
    }

    // ---------- metrics ----------

    private void RenderMetrics(IReadOnlyList<YoloEpochMetrics> rows, string? runDir)
    {
        _metrics = rows;
        _metricsRunDir = runDir;
        PanelMetrics.Visibility = rows.Count > 0 ? Visibility.Visible : Visibility.Collapsed;
        DgMetrics.ItemsSource = rows.Reverse().Select(r => new MetricsRow(r.Epoch, Fmt(r.BoxLoss, LossFormat), Fmt(r.ClsLoss, LossFormat),
            Fmt(r.DflLoss, LossFormat), Fmt(r.Precision), Fmt(r.Recall), Fmt(r.MAP50), Fmt(r.MAP50To95))).ToList();
        var best = YoloResultsCsv.Best(rows);
        TxtBestEpoch.Text = best == null ? "" : T(I18nKeys.YoloTrainingBestEpoch)
            .Replace("{run}", runDir == null ? "" : Path.GetFileName(runDir))
            .Replace("{epoch}", best.Epoch.ToString())
            .Replace("{epochs}", rows[^1].Epoch.ToString())
            .Replace("{map50}", Fmt(best.MAP50))
            .Replace("{map}", Fmt(best.MAP50To95));
        DrawChart();
    }

    private void OnChartSizeChanged(object sender, SizeChangedEventArgs e) => DrawChart();

    private void DrawChart()
    {
        LineMap50.Points = ChartPoints(r => r.MAP50);
        LineMap5095.Points = ChartPoints(r => r.MAP50To95);
    }

    /// <summary>Polyline over epochs (x) and the metric in [0, 1] (y, top = 1).</summary>
    private PointCollection ChartPoints(Func<YoloEpochMetrics, double?> metric)
    {
        var points = new PointCollection();
        double w = ChartMetrics.ActualWidth, h = ChartMetrics.ActualHeight;
        if (_metrics.Count == 0 || w <= 0 || h <= 0) return points;
        int first = _metrics[0].Epoch;
        double span = Math.Max(1, _metrics[^1].Epoch - first);
        foreach (var row in _metrics)
            if (metric(row) is { } v)
                points.Add(new Point((row.Epoch - first) / span * w, h - Math.Clamp(v, 0, 1) * h));
        return points;
    }

    private static string Fmt(double? value, string format = MetricFormat) => value?.ToString(format, CultureInfo.InvariantCulture) ?? "";

    // ---------- runs list ----------

    private async void RefreshRuns()
    {
        int version = ++_runsVersion;
        var root = YoloDataLayout.Root;
        var selected = SelectedRun()?.RunDir ?? Outcome?.RunDir;
        IReadOnlyList<YoloRunEntry> runs;
        IReadOnlyDictionary<string, YoloCurrentModel> current;
        try
        {
            (runs, current) = await Task.Run(() =>
            {
                var registry = new YoloModelRegistry(root);
                return (registry.ListRuns(), registry.GetAllCurrent());
            });
        }
        catch (Exception ex) when (TaskSetUiErrors.IsHandled(ex))
        {
            if (version == _runsVersion) WarnText(TaskSetUiErrors.Describe(ex));
            return;
        }
        if (version != _runsVersion) return;
        TxtRunsScope.Text = T(I18nKeys.YoloTrainingRunsScope).Replace("{root}", root).Replace("{count}", runs.Count.ToString());
        var rows = runs.Select(r => ToRunRow(r, current)).ToList();
        DgRuns.ItemsSource = rows;
        DgRuns.SelectedItem = rows.FirstOrDefault(r => SamePath(r.Entry.RunDir, selected));
        UpdateRunActions();
    }

    private static RunRow ToRunRow(YoloRunEntry entry, IReadOnlyDictionary<string, YoloCurrentModel> current)
    {
        var info = entry.Info;
        var best = info?.BestEpoch ?? YoloResultsCsv.Best(YoloResultsCsv.Read(entry.RunDir));
        var consumers = ConsumerOption.All.Where(c => current.TryGetValue(c.Id, out var m) && SamePath(m.RunDir, entry.RunDir)).Select(c => c.Label);
        var source = info?.Source is { } s ? s.Name : Path.GetFileName(entry.ScopeDir);
        var created = info != null && info.CreatedUtc != default ? info.CreatedUtc : entry.UpdatedUtc;
        var statusKey = info?.Status switch
        {
            YoloRunStatus.Running => I18nKeys.YoloTrainingRunStatusRunning,
            YoloRunStatus.Completed => I18nKeys.YoloTrainingRunStatusCompleted,
            YoloRunStatus.Cancelled => I18nKeys.YoloTrainingRunStatusCancelled,
            YoloRunStatus.Failed => I18nKeys.YoloTrainingRunStatusFailed,
            _ => I18nKeys.YoloTrainingRunStatusUnknown,
        };
        return new RunRow(entry,
            string.Join(CurrentSeparator, consumers),
            entry.Name,
            source,
            created.ToLocalTime().ToString(RunDateFormat, CultureInfo.InvariantCulture),
            string.Join(", ", entry.Classes),
            Fmt(best?.MAP50),
            Fmt(best?.MAP50To95),
            Fmt(info?.RealEvals.LastOrDefault()?.Metrics.MAP50),
            entry.Onnx != null ? T(I18nKeys.YoloTrainingRunStatusWithOnnx).Replace("{status}", T(statusKey)) : T(statusKey));
    }

    private YoloRunEntry? SelectedRun() => (DgRuns.SelectedItem as RunRow)?.Entry;

    private void UpdateRunActions()
    {
        bool running = _service.IsRunning;
        var run = SelectedRun();
        BtnRunSetCurrent.IsEnabled = run?.Onnx != null && CboConsumer.SelectedItem is ConsumerOption;
        BtnRunExport.IsEnabled = !running && run?.Weights != null;
        BtnRunResume.IsEnabled = !running && run?.CanResume == true;
        BtnRunFineTune.IsEnabled = !running && run?.Weights != null;
        BtnRunTest.IsEnabled = run?.Onnx != null;
        BtnRunOpen.IsEnabled = run != null;
        BtnRunDelete.IsEnabled = run != null && !running;
        BtnRunEvaluate.IsEnabled = !running && run?.Weights != null;
        if (!running && run != null && !SamePath(run.RunDir, _metricsRunDir)) RenderMetrics(YoloResultsCsv.Read(run.RunDir), run.RunDir);
    }

    private void SetCurrentModel(YoloRunEntry? run)
    {
        if (run?.Onnx is { } onnx && CboConsumer.SelectedItem is ConsumerOption consumer) SetCurrentModel(onnx, consumer);
    }

    /// <summary>Stores the model as the consumer's current model; refused when it lacks a class the consumer requires (T1).</summary>
    private void SetCurrentModel(string onnx, ConsumerOption consumer)
    {
        YoloModelResolution check;
        try
        {
            if (consumer == ConsumerOption.Navigation)
            {
                check = D3TownNavigator.SetCurrentModel(onnx);
                if (check.IsOk && ConfigBinding.GetValue(ConfigKeys.NavigationNpcModelPath, "") is { Length: > 0 } overridePath)
                    WarnText(T(I18nKeys.YoloTrainingNavigationOverrideActive).Replace("{path}", overridePath));
            }
            else
            {
                check = YoloModelRegistry.Check(Path.GetFullPath(onnx), null);
                if (check.IsOk) YoloModelRegistry.Default.SetCurrent(consumer.Id, check.ModelPath);
            }
        }
        catch (Exception ex) when (TaskSetUiErrors.IsHandled(ex))
        {
            WarnText(TaskSetUiErrors.Describe(ex));
            return;
        }
        switch (check.Status)
        {
            case YoloModelResolveStatus.Ok:
                AppendLog(T(I18nKeys.YoloTrainingCurrentModelSet).Replace("{consumer}", consumer.Label).Replace("{path}", check.ModelPath ?? onnx));
                break;
            case YoloModelResolveStatus.MissingClasses:
                WarnText(T(I18nKeys.YoloTrainingModelMissingClasses).Replace("{consumer}", consumer.Label)
                    .Replace("{missing}", string.Join(", ", check.MissingClasses)).Replace("{classes}", string.Join(", ", check.Classes)));
                break;
            default:
                WarnText(T(I18nKeys.YoloTrainingModelFileMissing).Replace("{path}", onnx));
                break;
        }
        if (TabsRun.SelectedItem == TabRuns) RefreshRuns();
    }

    /// <summary>Selects the run's best.pt as the start model after checking that its classes equal the current dataset classes.</summary>
    private void FineTuneFrom(YoloRunEntry? run)
    {
        if (run?.Weights is not { } weights) return;
        var datasetClasses = IsSpecific
            ? SelectedTaskSet()?.ClassNames ?? (IReadOnlyList<string>)Array.Empty<string>()
            : ProjectConfig.GetClassesFromProjectDir(_projectDir);
        var modelClasses = run.Classes;
        if (modelClasses.Count > 0 && datasetClasses.Count > 0 && !modelClasses.SequenceEqual(datasetClasses, StringComparer.Ordinal))
        {
            WarnText(T(I18nKeys.YoloTrainingFineTuneClassMismatch)
                .Replace("{model}", string.Join(", ", modelClasses)).Replace("{dataset}", string.Join(", ", datasetClasses)));
            return;
        }
        CboModel.Text = weights;
        ConfigBinding.SaveString(ConfigKeys.YoloTrainingModel, weights);
        TabsRun.SelectedItem = TabRun;
        AppendLog(T(I18nKeys.YoloTrainingFineTuneSet).Replace("{weights}", weights));
    }

    private void TestModel(string? onnx)
    {
        if (onnx != null && File.Exists(onnx)) ModelTestWindow.ShowSingle(this, onnx);
    }

    private void DeleteRun(YoloRunEntry? run)
    {
        if (run == null) return;
        var runsDir = Path.GetDirectoryName(run.RunDir) ?? run.RunDir;
        if (_service.IsRunning || YoloRunLock.ReadOwner(runsDir) is not null)
        {
            Warn(I18nKeys.YoloTrainingBusy);
            return;
        }
        if (MessageBox.Show(this, T(I18nKeys.YoloTrainingRunDeleteConfirm).Replace("{run}", run.Name).Replace("{dir}", run.RunDir), Title,
                MessageBoxButton.YesNo, MessageBoxImage.Warning) != MessageBoxResult.Yes) return;
        try
        {
            var registry = YoloModelRegistry.Default;
            foreach (var (consumer, model) in registry.GetAllCurrent())
                if (SamePath(model.RunDir, run.RunDir)) registry.SetCurrent(consumer, null);
            Directory.Delete(run.RunDir, recursive: true);
        }
        catch (Exception ex) when (TaskSetUiErrors.IsHandled(ex))
        {
            WarnText(TaskSetUiErrors.Describe(ex));
        }
        RefreshRuns();
        UpdateRunState(_service.Phase);
    }

    private async Task ResumeAsync(YoloRunEntry? run)
    {
        if (run is not { CanResume: true }) return;
        if (await LauncherAsync() is not { } launcher) return;
        BeginJobView();
        ShowResult(await _service.ResumeAsync(run.RunDir, launcher, ChkExportOnnx.IsChecked == true));
    }

    /// <summary>Exports the run's best.pt (also the best-so-far weights of a cancelled run).</summary>
    private async Task ExportAsync(YoloRunEntry? run)
    {
        if (run?.Weights == null) return;
        if (await LauncherAsync() is not { } launcher) return;
        TabsRun.SelectedItem = TabRun;
        ShowResult(await _service.ExportAsync(run.RunDir, launcher));
    }

    /// <summary>Evaluates the run on the annotated frames of the chosen segments of the current project (real data, not synthetic val).</summary>
    private async Task EvaluateAsync(YoloRunEntry? run)
    {
        if (run?.Weights == null) return;
        var names = LstRealSegments.SelectedItems.Cast<string>().ToHashSet(StringComparer.Ordinal);
        var sources = SourcesOf(_allSegments.Where(s => names.Contains(Path.GetFileName(Path.TrimEndingDirectorySeparator(s)))));
        if (sources.Count == 0)
        {
            Warn(I18nKeys.YoloTrainingRealEvalNoSegments);
            return;
        }
        if (_service.IsRunning)
        {
            Warn(I18nKeys.YoloTrainingBusy);
            return;
        }
        if (await LauncherAsync() is not { } launcher) return;
        TabsRun.SelectedItem = TabRun;
        await _service.EvaluateOnRealDataAsync(run.RunDir, sources, launcher);
        UpdateRunState(_service.Phase);
        RefreshRuns();
    }

    private void WarnText(string text) => MessageBox.Show(this, text, Title, MessageBoxButton.OK, MessageBoxImage.Warning);
}
