// PY-REF: pyapps/d3-check/d3utils/yolo_train_flow.py
using System.IO;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.I18n;
using DotCore.Foundations;
using DotCore.VocAnnotator;
using DotCore.YoloTaskSet;
using DotCore.YoloTrain;

namespace DotApps.d3d4tester.Services;

/// <summary>Dataset produced by a job's build step (Ultralytics layout with data.yaml).</summary>
public sealed record YoloDatasetBuild(string DatasetDir, string DataYamlPath, int TrainImages, int ValImages, int TestImages);

/// <summary>
/// One training job: a dataset build step (general: annotated segments; specific: task-set synthesis), the runs dir,
/// Ultralytics parameters and the CLI of the probed environment. BuildDataset returns null when nothing can be trained;
/// it reports (done, total) through the progress callback.
/// </summary>
public sealed record YoloTrainingJob(
    string RunsDir,
    Func<IProgress<(int Done, int Total)>, CancellationToken, YoloDatasetBuild?> BuildDataset,
    YoloTrainParameters Parameters,
    string CliPath,
    bool ExportOnnx);

public enum YoloTrainingPhase
{
    Idle,
    Building,
    Training,
    Exporting,
}

public sealed record YoloTrainingOutcome(bool Success, bool Cancelled, string? DatasetDir, string? RunDir, string? Weights, string? Onnx, string? Error);

/// <summary>
/// Single owner of the running YOLO training: builds the job's dataset into a timestamped dir, trains into {runs}/{stamp},
/// then exports best.onnx. Events may fire on worker threads.
/// 1:1 Python flow5_prepare_training_dir + flow6 (TODO stub there) + DOT-only task-set synthesis and ONNX export.
/// </summary>
public sealed class YoloTrainingService
{
    public const string RunStampFormat = "yyyyMMdd_HHmmss";

    private readonly YoloTrainRunner _runner = new();
    private readonly object _lock = new();
    private CancellationTokenSource? _cts;
    private YoloTrainingPhase _phase;

    private YoloTrainingService()
    {
        _runner.Output += line => Log?.Invoke(line);
        _runner.Progress += p => Progress?.Invoke(p);
    }

    public static YoloTrainingService Instance { get; } = new();

    public event Action<string>? Log;

    public event Action<YoloTrainProgress>? Progress;

    public event Action<int, int>? BuildProgress;

    public event Action<YoloTrainingPhase>? PhaseChanged;

    public YoloTrainingPhase Phase
    {
        get { lock (_lock) return _phase; }
    }

    public bool IsRunning => Phase != YoloTrainingPhase.Idle;

    public static string NewStamp() => DateTime.Now.ToString(RunStampFormat);

    /// <summary>General mode: annotated segment frames split by YoloDatasetAssembler into {project}/_datasets/{stamp}.</summary>
    public static YoloTrainingJob ForSegments(string projectDir, IReadOnlyList<YoloDatasetSource> sources, IReadOnlyList<string> classes,
        YoloDatasetSplit split, YoloTrainParameters parameters, string cliPath, bool exportOnnx) =>
        new(YoloDataLayout.GetRunsDir(projectDir), (progress, ct) =>
        {
            var plan = YoloDatasetAssembler.Plan(sources, classes, split, ct);
            if (!plan.CanBuild) return null;
            var dir = Path.Combine(YoloDataLayout.GetDatasetsDir(projectDir), NewStamp());
            var built = YoloDatasetAssembler.Build(plan, dir, progress, ct);
            return new YoloDatasetBuild(dir, built.DataYamlPath, plan.Summary(YoloSplit.Train).Images, plan.Summary(YoloSplit.Val).Images, plan.Summary(YoloSplit.Test).Images);
        }, parameters, cliPath, exportOnnx);

    /// <summary>Specific mode: task-set synthesis into {task_set}/_datasets/{stamp}, runs in {task_set}/_runs.</summary>
    public static YoloTrainingJob ForTaskSet(TaskSet set, string taskSetDir, YoloTrainParameters parameters, string cliPath, bool exportOnnx) =>
        new(YoloDataLayout.GetRunsDir(taskSetDir), (progress, ct) =>
        {
            if (TaskSetSynthesizer.Validate(set, taskSetDir).Any(i => i.IsError)) return null;
            var dir = Path.Combine(YoloDataLayout.GetDatasetsDir(taskSetDir), NewStamp());
            var result = TaskSetSynthesizer.Generate(set, taskSetDir, dir, new SyncProgress<SynthesisProgress>(p => progress.Report((p.Done, p.Total))), ct);
            return result.TrainImages == 0 || result.ValImages == 0
                ? null
                : new YoloDatasetBuild(result.DatasetDir, result.DataYamlPath, result.TrainImages, result.ValImages, 0);
        }, parameters, cliPath, exportOnnx);

    public void Cancel()
    {
        lock (_lock) _cts?.Cancel();
        _runner.Cancel();
    }

    public async Task<YoloTrainingOutcome> RunAsync(YoloTrainingJob job)
    {
        CancellationToken ct;
        lock (_lock)
        {
            if (_phase != YoloTrainingPhase.Idle) return new YoloTrainingOutcome(false, false, null, null, null, null, T(I18nKeys.YoloTrainingBusy));
            _cts = new CancellationTokenSource();
            ct = _cts.Token;
        }
        string? datasetDir = null, runDir = null, weights = null;
        try
        {
            SetPhase(YoloTrainingPhase.Building);
            var progress = new SyncProgress<(int Done, int Total)>(p => BuildProgress?.Invoke(p.Done, p.Total));
            var built = await Task.Run(() => job.BuildDataset(progress, ct), ct);
            if (built == null)
                return Fail(T(I18nKeys.YoloTrainingNoLabeled), null, null, null);
            datasetDir = built.DatasetDir;
            Emit(T(I18nKeys.YoloTrainingLogDataset).Replace("{dir}", datasetDir));
            Emit(T(I18nKeys.YoloTrainingLogDatasetCounts)
                .Replace("{train}", built.TrainImages.ToString())
                .Replace("{val}", built.ValImages.ToString())
                .Replace("{test}", built.TestImages.ToString()));

            SetPhase(YoloTrainingPhase.Training);
            var train = await _runner.TrainAsync(job.CliPath, built.DataYamlPath, job.Parameters, job.RunsDir, NewStamp(), ct);
            runDir = train.RunDir;
            weights = train.OutputFile;
            if (train.Cancelled || ct.IsCancellationRequested) return Cancelled(datasetDir, runDir, weights);
            if (!train.Success || weights == null) return Fail(train.Error ?? "", datasetDir, runDir, weights);
            Emit(T(I18nKeys.YoloTrainingLogTrainDone).Replace("{weights}", weights));

            string? onnx = null;
            if (job.ExportOnnx)
            {
                SetPhase(YoloTrainingPhase.Exporting);
                var export = await _runner.ExportOnnxAsync(job.CliPath, weights, job.Parameters.Imgsz, ct);
                if (export.Cancelled || ct.IsCancellationRequested) return Cancelled(datasetDir, runDir, weights);
                if (!export.Success) return Fail(export.Error ?? "", datasetDir, runDir, weights);
                onnx = export.OutputFile;
                Emit(T(I18nKeys.YoloTrainingLogExportDone).Replace("{onnx}", onnx ?? ""));
            }
            return new YoloTrainingOutcome(true, false, datasetDir, runDir, weights, onnx, null);
        }
        catch (OperationCanceledException)
        {
            return Cancelled(datasetDir, runDir, weights);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or InvalidOperationException or ArgumentException or OpenCvSharp.OpenCVException)
        {
            return Fail(ex.Message, datasetDir, runDir, weights);
        }
        finally
        {
            lock (_lock)
            {
                _cts?.Dispose();
                _cts = null;
            }
            SetPhase(YoloTrainingPhase.Idle);
        }
    }

    private static string T(string key) => D3D4TesterI18n.Provider.GetUiText(key);

    private YoloTrainingOutcome Fail(string error, string? datasetDir, string? runDir, string? weights)
    {
        Emit(T(I18nKeys.YoloTrainingLogFailed).Replace("{error}", error));
        return new YoloTrainingOutcome(false, false, datasetDir, runDir, weights, null, error);
    }

    private static YoloTrainingOutcome Cancelled(string? datasetDir, string? runDir, string? weights) =>
        new(false, true, datasetDir, runDir, weights, null, null);

    private void Emit(string line)
    {
        ColorPrinter.Blue("[YoloTraining] " + line);
        Log?.Invoke(line);
    }

    private void SetPhase(YoloTrainingPhase phase)
    {
        lock (_lock) _phase = phase;
        PhaseChanged?.Invoke(phase);
    }

    /// <summary>Progress reported synchronously on the worker (Progress&lt;T&gt; would post to a captured context).</summary>
    private sealed class SyncProgress<T> : IProgress<T>
    {
        private readonly Action<T> _report;

        public SyncProgress(Action<T> report) => _report = report;

        public void Report(T value) => _report(value);
    }
}
