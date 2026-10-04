// PY-REF: pyapps/d3-check/d3utils/yolo_train_flow.py
using System.IO;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.I18n;
using DotCore.Foundations;
using DotCore.VocAnnotator;
using DotCore.YoloTrain;

namespace DotApps.d3d4tester.Services;

/// <summary>One training job: classes, dataset sources and split, Ultralytics parameters and the CLI of the probed environment.</summary>
public sealed record YoloTrainingRequest(
    string ProjectDir,
    IReadOnlyList<YoloDatasetSource> Sources,
    IReadOnlyList<string> Classes,
    YoloDatasetSplit Split,
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
/// Single owner of the running YOLO training (steps 5-7 of the calibration workflow): assembles {project}/_datasets/{stamp},
/// trains into {project}/_runs/{stamp}, then exports best.onnx. Events may fire on worker threads.
/// 1:1 Python flow5_prepare_training_dir + flow6 (TODO stub there) + DOT-only ONNX export.
/// </summary>
public sealed class YoloTrainingService
{
    private const string RunStampFormat = "yyyyMMdd_HHmmss";

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

    public event Action<YoloTrainingPhase>? PhaseChanged;

    public YoloTrainingPhase Phase
    {
        get { lock (_lock) return _phase; }
    }

    public bool IsRunning => Phase != YoloTrainingPhase.Idle;

    public void Cancel()
    {
        lock (_lock) _cts?.Cancel();
        _runner.Cancel();
    }

    public async Task<YoloTrainingOutcome> RunAsync(YoloTrainingRequest request)
    {
        CancellationToken ct;
        lock (_lock)
        {
            if (_phase != YoloTrainingPhase.Idle) return new YoloTrainingOutcome(false, false, null, null, null, null, T(I18nKeys.YoloTrainingBusy));
            _cts = new CancellationTokenSource();
            ct = _cts.Token;
        }
        var stamp = DateTime.Now.ToString(RunStampFormat);
        string? datasetDir = null, runDir = null, weights = null;
        try
        {
            SetPhase(YoloTrainingPhase.Building);
            datasetDir = Path.Combine(YoloDataLayout.GetDatasetsDir(request.ProjectDir), stamp);
            var built = await Task.Run(() =>
            {
                var plan = YoloDatasetAssembler.Plan(request.Sources, request.Classes, request.Split, ct);
                if (!plan.CanBuild) return null;
                return YoloDatasetAssembler.Build(plan, datasetDir, null, ct);
            }, ct);
            if (built == null)
                return Fail(T(I18nKeys.YoloTrainingNoLabeled), datasetDir, null, null);
            Emit(T(I18nKeys.YoloTrainingLogDataset).Replace("{dir}", datasetDir));
            Emit(T(I18nKeys.YoloTrainingLogDatasetCounts)
                .Replace("{train}", built.Plan.Summary(YoloSplit.Train).Images.ToString())
                .Replace("{val}", built.Plan.Summary(YoloSplit.Val).Images.ToString())
                .Replace("{test}", built.Plan.Summary(YoloSplit.Test).Images.ToString()));

            SetPhase(YoloTrainingPhase.Training);
            var train = await _runner.TrainAsync(request.CliPath, built.DataYamlPath, request.Parameters, YoloDataLayout.GetRunsDir(request.ProjectDir), stamp, ct);
            runDir = train.RunDir;
            weights = train.OutputFile;
            if (train.Cancelled || ct.IsCancellationRequested) return Cancelled(datasetDir, runDir, weights);
            if (!train.Success || weights == null) return Fail(train.Error ?? "", datasetDir, runDir, weights);
            Emit(T(I18nKeys.YoloTrainingLogTrainDone).Replace("{weights}", weights));

            string? onnx = null;
            if (request.ExportOnnx)
            {
                SetPhase(YoloTrainingPhase.Exporting);
                var export = await _runner.ExportOnnxAsync(request.CliPath, weights, request.Parameters.Imgsz, ct);
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
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or InvalidOperationException or ArgumentException)
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
}
