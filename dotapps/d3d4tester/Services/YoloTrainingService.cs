// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/yolo_train_flow.py
using System.Globalization;
using System.IO;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.I18n;
using DotCore.Foundations;
using DotCore.VocAnnotator;
using DotCore.YoloDetect;
using DotCore.YoloTaskSet;
using DotCore.YoloTrain;

namespace DotApps.d3d4tester.Services;

/// <summary>Dataset produced by a job's build step (Ultralytics layout with data.yaml).</summary>
public sealed record YoloDatasetBuild(string DatasetDir, string DataYamlPath, int TrainImages, int ValImages, int TestImages)
{
    public IReadOnlyList<string> Classes { get; init; } = Array.Empty<string>();

    /// <summary>Synthesis outcome in specific mode (warnings and statistics are logged).</summary>
    public SynthesisResult? Synthesis { get; init; }

    /// <summary>Manifest "inference" object (design §11), copied into run_info.</summary>
    public JsonObject? Inference { get; init; }
}

/// <summary>
/// One training job: a dataset build step (general: annotated segments; specific: task-set synthesis; existing dataset), the runs dir,
/// Ultralytics parameters and the launcher of the probed environment. BuildDataset returns null when nothing can be trained;
/// it reports (done, total) through the progress callback. Stamp names both the dataset dir and the run dir.
/// </summary>
public sealed record YoloTrainingJob(
    string RunsDir,
    Func<IProgress<(int Done, int Total)>, CancellationToken, YoloDatasetBuild?> BuildDataset,
    YoloTrainParameters Parameters,
    YoloLauncher Launcher,
    bool ExportOnnx)
{
    public string Stamp { get; init; } = YoloTrainingService.NewStamp();

    public YoloRunSource? Source { get; init; }
}

public enum YoloTrainingPhase
{
    Idle,
    Building,
    Training,
    Exporting,
    Evaluating,
}

public sealed record YoloTrainingOutcome(bool Success, bool Cancelled, string? DatasetDir, string? RunDir, string? Weights, string? Onnx, string? Error)
{
    public YoloRunInfo? RunInfo { get; init; }
}

public sealed record YoloEvalOutcome(bool Success, bool Cancelled, YoloRealEval? Eval, string? Error);

/// <summary>
/// Single owner of the running YOLO job (train, resume, export, real-data evaluation): builds the job's dataset into
/// {scope}/_datasets/{stamp}, trains into {scope}/_runs/{stamp}, exports best.onnx and keeps run_info.json current.
/// A {runs}/.lock guards the runs dir across app instances; the app shutdown cancels the child. Events may fire on worker threads.
/// 1:1 Python flow5_prepare_training_dir + flow6 (TODO stub there) + DOT-only task-set synthesis, ONNX export and run registry.
/// </summary>
public sealed class YoloTrainingService
{
    public const string RunStampFormat = D3PathConstants.FileTimestampFormat;
    private const string LogTag = "[YoloTraining] ";
    private const string EvalSubdir = "eval";
    private const string EvalDatasetSubdir = "dataset";
    private const string EvalValName = "val";
    private const string MetricFormat = "0.000";
    private static readonly TimeSpan ShutdownWait = TimeSpan.FromSeconds(5);
    private static readonly Regex UltralyticsBanner = new(@"Ultralytics\s+(\d+\.\d+\.\d+)", RegexOptions.Compiled);

    private readonly YoloTrainRunner _runner = new();
    private readonly object _lock = new();
    private CancellationTokenSource? _cts;
    private YoloTrainingPhase _phase;
    private YoloTrainingOutcome? _lastOutcome;
    private string? _ultralyticsVersion;
    private YoloRunInfo? _activeInfo;
    private bool _activeInfoSaved;

    private YoloTrainingService()
    {
        _runner.Output += OnRunnerOutput;
        _runner.Progress += p => Progress?.Invoke(p);
        _runner.Metrics += OnRunnerMetrics;
        ShutdownManager.RegisterShutdownHook(CancelForShutdown);
    }

    public static YoloTrainingService Instance { get; } = new();

    public event Action<string>? Log;

    public event Action<YoloTrainProgress>? Progress;

    public event Action<int, int>? BuildProgress;

    public event Action<YoloTrainingPhase>? PhaseChanged;

    /// <summary>results.csv rows of the running training (one more per finished epoch).</summary>
    public event Action<YoloTrainMetrics>? Metrics;

    /// <summary>Outcome of the last train / resume / export job (any window can show it).</summary>
    public event Action<YoloTrainingOutcome>? OutcomeChanged;

    public YoloTrainingPhase Phase
    {
        get { lock (_lock) return _phase; }
    }

    public bool IsRunning => Phase != YoloTrainingPhase.Idle;

    public YoloTrainingOutcome? LastOutcome
    {
        get { lock (_lock) return _lastOutcome; }
    }

    public static string NewStamp() => DateTime.Now.ToString(RunStampFormat);

    /// <summary>NewStamp with a _2, _3 ... suffix while {dir}/{stamp} (or a synthesis {stamp}.partial) exists in any of the dirs.</summary>
    public static string UniqueStamp(params string[] parentDirs)
    {
        var stamp = NewStamp();
        var candidate = stamp;
        for (int i = 2; parentDirs.Any(d => Directory.Exists(Path.Combine(d, candidate)) || Directory.Exists(Path.Combine(d, candidate + TaskSetSynthesizer.PartialSuffix))); i++)
            candidate = stamp + "_" + i;
        return candidate;
    }

    /// <summary>
    /// App startup: YOLO data root override and recorder shutdown (YoloCalibrationData), ONNX session defaults of the shared model host
    /// from config, and shutdown hooks that stop a running training child and release every loaded model.
    /// </summary>
    public static void InitializeRuntime()
    {
        YoloCalibrationData.InitializeRuntime();
        YoloModelHost.Shared.DefaultOptions = new YoloDetectorOptions(
            YoloDetectorOptions.ParseProvider(ConfigBinding.GetValue(ConfigKeys.YoloDetectExecutionProvider, "")),
            ConfigBinding.GetValue(ConfigKeys.YoloDetectIntraOpThreads, 0),
            ConfigBinding.GetValue(ConfigKeys.YoloDetectWarmUp, true));
        _ = Instance;
        ShutdownManager.RegisterShutdownHook(DisposeModelHost);
    }

    private static void DisposeModelHost() => YoloModelHost.Shared.Dispose();

    /// <summary>General mode: annotated segment frames split by YoloDatasetAssembler into {project}/_datasets/{stamp}.</summary>
    public static YoloTrainingJob ForSegments(string projectDir, IReadOnlyList<YoloDatasetSource> sources, IReadOnlyList<string> classes,
        YoloDatasetSplit split, YoloTrainParameters parameters, YoloLauncher launcher, bool exportOnnx)
    {
        var stamp = UniqueStamp(YoloDataLayout.GetDatasetsDir(projectDir), YoloDataLayout.GetRunsDir(projectDir));
        var full = Path.GetFullPath(projectDir);
        var id = YoloDataLayout.IsUnder(full, YoloDataLayout.Root) ? Path.GetRelativePath(YoloDataLayout.Root, full) : full;
        return new YoloTrainingJob(YoloDataLayout.GetRunsDir(projectDir), (progress, ct) =>
        {
            var plan = YoloDatasetAssembler.Plan(sources, classes, split, ct);
            if (!plan.CanBuild) return null;
            var dir = Path.Combine(YoloDataLayout.GetDatasetsDir(projectDir), stamp);
            var built = YoloDatasetAssembler.Build(plan, dir, progress, ct);
            return new YoloDatasetBuild(dir, built.DataYamlPath, plan.Summary(YoloSplit.Train).Images, plan.Summary(YoloSplit.Val).Images, plan.Summary(YoloSplit.Test).Images)
            {
                Classes = plan.Classes,
            };
        }, parameters, launcher, exportOnnx)
        {
            Stamp = stamp,
            Source = new YoloRunSource(YoloRunSource.KindProject, id, Path.GetFileName(full)),
        };
    }

    /// <summary>
    /// Specific mode: task-set synthesis into {task_set}/_datasets/{stamp}, runs in {task_set}/_runs. Default augmentation is
    /// replaced by AugmentationForTaskSet (Ultralytics defaults would mirror and halve already synthesized objects).
    /// </summary>
    public static YoloTrainingJob ForTaskSet(TaskSet set, string taskSetDir, YoloTrainParameters parameters, YoloLauncher launcher, bool exportOnnx)
    {
        var stamp = UniqueStamp(YoloDataLayout.GetDatasetsDir(taskSetDir), YoloDataLayout.GetRunsDir(taskSetDir));
        if (parameters.Augmentation.IsDefault) parameters = parameters with { Augmentation = AugmentationForTaskSet(set) };
        return new YoloTrainingJob(YoloDataLayout.GetRunsDir(taskSetDir), (progress, ct) =>
        {
            var errors = TaskSetSynthesizer.Validate(set, taskSetDir).Where(i => i.IsError).ToList();
            if (errors.Count > 0) throw new BuildFailedException(T(I18nKeys.YoloTrainingServiceTaskSetInvalid).Replace("{issues}", FormatIssues(errors)));
            var dir = Path.Combine(YoloDataLayout.GetDatasetsDir(taskSetDir), stamp);
            var result = TaskSetSynthesizer.Generate(set, taskSetDir, dir, new SyncProgress<SynthesisProgress>(p => progress.Report((p.Done, p.Total))), ct);
            if (result.TrainImages == 0 || result.ValImages == 0)
                throw new BuildFailedException(T(I18nKeys.YoloTrainingServiceSynthesisEmpty)
                    .Replace("{train}", result.TrainImages.ToString()).Replace("{val}", result.ValImages.ToString()));
            bool holdoutInTest = string.Equals(set.Synthesis.HoldoutSplit, SynthesisSettings.HoldoutSplitTest, StringComparison.Ordinal);
            return new YoloDatasetBuild(result.DatasetDir, result.DataYamlPath, result.TrainImages,
                result.ValImages + (holdoutInTest ? 0 : result.HoldoutImages), holdoutInTest ? result.HoldoutImages : 0)
            {
                Classes = result.Classes,
                Synthesis = result,
                Inference = JsonSerializer.SerializeToNode(result.Inference) as JsonObject,
            };
        }, parameters, launcher, exportOnnx)
        {
            Stamp = stamp,
            Source = new YoloRunSource(YoloRunSource.KindTaskSet, set.Id, set.Name),
        };
    }

    /// <summary>Train on an existing Ultralytics dataset (data.yaml with images/{train,val[,test]} beside it); no rebuild.</summary>
    public static YoloTrainingJob ForDataset(string dataYamlPath, string runsDir, YoloTrainParameters parameters, YoloLauncher launcher, bool exportOnnx,
        YoloRunSource? source = null)
    {
        var yaml = Path.GetFullPath(dataYamlPath);
        var datasetDir = Path.GetDirectoryName(yaml) ?? "";
        return new YoloTrainingJob(runsDir, (_, _) =>
        {
            if (!File.Exists(yaml)) throw new BuildFailedException(T(I18nKeys.YoloTrainingServiceDatasetMissing).Replace("{path}", yaml));
            int Count(YoloSplit s) => AnnotationIo.ListImages(Path.Combine(datasetDir, YoloDataYaml.SplitImagesDir(s))).Count();
            int train = Count(YoloSplit.Train), val = Count(YoloSplit.Val), test = Count(YoloSplit.Test);
            if (train == 0 || val == 0) throw new BuildFailedException(T(I18nKeys.YoloTrainingServiceDatasetMissing).Replace("{path}", yaml));
            return new YoloDatasetBuild(datasetDir, yaml, train, val, test)
            {
                Classes = YoloModelRegistry.ReadDataYamlNames(yaml),
                Inference = TaskSetSynthesizer.ReadInferenceInfo(datasetDir) is { } inference ? JsonSerializer.SerializeToNode(inference) as JsonObject : null,
            };
        }, parameters, launcher, exportOnnx)
        {
            Stamp = UniqueStamp(runsDir),
            Source = source ?? new YoloRunSource(YoloRunSource.KindDataset, datasetDir, Path.GetFileName(datasetDir)),
        };
    }

    /// <summary>
    /// Ultralytics augmentation matching a task set: the synthesis already rotated, stretched and jittered every object, so geometry
    /// is off, mirroring follows flip_horizontal (all targets), scale jitter stays small (native pixel size matters for small icons),
    /// and colour jitter follows brightness / contrast.
    /// </summary>
    public static YoloAugmentation AugmentationForTaskSet(TaskSet set)
    {
        var profiles = set.Targets.Count > 0 ? set.Targets.Select(t => set.Augmentation.Resolve(t.Augmentation)).ToList() : new List<AugmentationProfile> { set.Augmentation };
        bool flip = profiles.All(p => p.FlipHorizontal);
        bool native = string.Equals(set.Synthesis.ScaleMode, SynthesisSettings.ScaleModeNative, StringComparison.OrdinalIgnoreCase);
        return new YoloAugmentation
        {
            Fliplr = flip ? 0.5 : 0,
            Flipud = 0,
            Degrees = 0,
            Shear = 0,
            Perspective = 0,
            Translate = 0.1,
            Scale = native ? 0.1 : 0.25,
            Mixup = 0,
            HsvH = 0.005,
            HsvS = Math.Clamp(profiles.Max(p => p.ContrastMax) * 2, 0.1, 0.7),
            HsvV = Math.Clamp(profiles.Max(p => p.BrightnessMax) * 2, 0.1, 0.4),
            Erasing = 0,
        };
    }

    /// <summary>Advisor input for a task set before synthesis (TaskSetSynthesizer.Estimate).</summary>
    public static IYoloDatasetStats EstimateStats(TaskSet set, string taskSetDir)
    {
        var e = TaskSetSynthesizer.Estimate(set, taskSetDir);
        int holdoutVal = string.Equals(set.Synthesis.HoldoutSplit, SynthesisSettings.HoldoutSplitTest, StringComparison.Ordinal) ? 0 : e.HoldoutImages;
        int total = e.TrainImages + e.ValImages + e.HoldoutImages;
        int perClass = e.Classes.Count == 0 ? 0 : Math.Max(0, total - e.NegativeImages) / e.Classes.Count;
        var synthesis = set.Synthesis.Normalized();
        bool native = string.Equals(synthesis.ScaleMode, SynthesisSettings.ScaleModeNative, StringComparison.OrdinalIgnoreCase);
        return new YoloDatasetStats(Math.Max(0, total - e.NegativeImages), total, e.ValImages + holdoutVal, e.ImageWidth, e.ImageHeight,
            e.Classes.ToDictionary(c => c, _ => perClass, StringComparer.Ordinal), new Dictionary<string, int>())
        {
            RequiredImgsz = native ? Math.Max(synthesis.NativeWindowWidth, synthesis.NativeWindowHeight) : 0,
        };
    }

    public void Cancel()
    {
        lock (_lock) _cts?.Cancel();
        _runner.Cancel();
    }

    public Task<YoloTrainingOutcome> RunAsync(YoloTrainingJob job) =>
        Exclusive(job.RunsDir, "train " + job.Stamp, Busy, error => Fail(error, null, null, null), () => Cancelled(null, null, null), ct => TrainCoreAsync(job, ct));

    /// <summary>Continue an interrupted run from {run}/weights/last.pt, then export when requested.</summary>
    public Task<YoloTrainingOutcome> ResumeAsync(string runDir, YoloLauncher launcher, bool exportOnnx) =>
        Exclusive(Path.GetDirectoryName(Path.GetFullPath(runDir)), "resume " + Path.GetFileName(runDir), Busy, error => Fail(error, null, runDir, null),
            () => Cancelled(null, runDir, null), ct => ResumeCoreAsync(Path.GetFullPath(runDir), launcher, exportOnnx, ct));

    /// <summary>Export {run}/weights/best.pt to ONNX (also the best-so-far weights of a cancelled run).</summary>
    public Task<YoloTrainingOutcome> ExportAsync(string runDir, YoloLauncher launcher, YoloExportOptions? options = null) =>
        Exclusive(Path.GetDirectoryName(Path.GetFullPath(runDir)), "export " + Path.GetFileName(runDir), Busy, error => Fail(error, null, runDir, null), () => Cancelled(null, runDir, null), async ct =>
        {
            var full = Path.GetFullPath(runDir);
            var weights = YoloArtifacts.WeightsPath(full);
            var info = YoloRunInfo.Load(full);
            if (!File.Exists(weights)) return Fail(T(I18nKeys.YoloTrainingServiceNoBestWeights).Replace("{dir}", full), info?.DatasetDir, full, null);
            var (onnx, error, cancelled) = await ExportCoreAsync(full, weights, launcher, options ?? new YoloExportOptions { Imgsz = EffectiveImgsz(info) }, info, ct);
            if (cancelled) return Cancelled(info?.DatasetDir, full, weights);
            return error != null ? Fail(error, info?.DatasetDir, full, weights)
                : new YoloTrainingOutcome(true, false, info?.DatasetDir, full, weights, onnx, null) { RunInfo = YoloRunInfo.Load(full) };
        });

    /// <summary>
    /// Evaluate a run on real annotated data: every annotated image of the sources goes into the val split of a dataset under
    /// {run}/eval/{stamp}/dataset (classes = the model's classes), `yolo detect val` at the training imgsz, metrics stored in run_info.
    /// </summary>
    public Task<YoloEvalOutcome> EvaluateOnRealDataAsync(string runDir, IReadOnlyList<YoloDatasetSource> sources, YoloLauncher launcher) =>
        Exclusive(Path.GetDirectoryName(Path.GetFullPath(runDir)), "eval " + Path.GetFileName(runDir), error => new YoloEvalOutcome(false, false, null, error), EvalFail, () => new YoloEvalOutcome(false, true, null, null), ct => EvaluateCoreAsync(Path.GetFullPath(runDir), sources, launcher, ct));

    private async Task<YoloTrainingOutcome> TrainCoreAsync(YoloTrainingJob job, CancellationToken ct)
    {
        string? datasetDir = null, runDir = null, weights = null;
        SetPhase(YoloTrainingPhase.Building);
        var progress = new SyncProgress<(int Done, int Total)>(p => BuildProgress?.Invoke(p.Done, p.Total));
        var built = await Task.Run(() => job.BuildDataset(progress, ct), ct);
        if (built == null) return Fail(T(I18nKeys.YoloTrainingNoLabeled), null, null, null);
        datasetDir = built.DatasetDir;
        Emit(T(I18nKeys.YoloTrainingLogDataset).Replace("{dir}", datasetDir));
        Emit(T(I18nKeys.YoloTrainingLogDatasetCounts)
            .Replace("{train}", built.TrainImages.ToString())
            .Replace("{val}", built.ValImages.ToString())
            .Replace("{test}", built.TestImages.ToString()));
        LogSynthesis(built.Synthesis);

        var parameters = job.Parameters;
        var startFrom = !YoloTrainParameters.IsStockModel(parameters.Model) && File.Exists(parameters.Model) ? Path.GetFullPath(parameters.Model) : null;
        if (startFrom != null)
        {
            var modelClasses = YoloModelRegistry.ClassesForModel(startFrom);
            if (modelClasses.Count > 0 && built.Classes.Count > 0 && !modelClasses.SequenceEqual(built.Classes, StringComparer.Ordinal))
                return Fail(T(I18nKeys.YoloTrainingServiceClassMismatch).Replace("{model}", string.Join(", ", modelClasses))
                    .Replace("{dataset}", string.Join(", ", built.Classes)), datasetDir, null, null);
        }
        var rejected = parameters.ParseExtraArguments().Rejected;
        if (rejected.Count > 0) Emit(T(I18nKeys.YoloTrainingServiceExtraRejected).Replace("{args}", string.Join(" ", rejected)));
        if (!parameters.Augmentation.IsDefault)
            Emit(T(I18nKeys.YoloTrainingServiceAugmentation).Replace("{values}", string.Join(" ", parameters.Augmentation.ToArguments())));
        var baseModel = YoloTrainParameters.ResolveModelPath(parameters.Model, _runner.EffectiveWeightsDir);
        if (YoloTrainParameters.IsStockModel(parameters.Model) && !File.Exists(baseModel))
            Emit(T(I18nKeys.YoloTrainingServiceWeightsDownload).Replace("{model}", parameters.Model).Replace("{dir}", _runner.EffectiveWeightsDir));

        var info = new YoloRunInfo
        {
            RunName = job.Stamp,
            Status = YoloRunStatus.Running,
            CreatedUtc = DateTime.UtcNow,
            Source = job.Source,
            DatasetDir = datasetDir,
            DataYaml = built.DataYamlPath,
            Classes = built.Classes,
            Parameters = parameters,
            Imgsz = YoloTrainParameters.NormalizeImgsz(parameters.Imgsz),
            BaseModel = baseModel,
            StartFromRun = startFrom == null ? null : YoloArtifacts.RunDirOfModel(startFrom),
            Python = job.Launcher.IsPython ? job.Launcher.FileName : null,
            Inference = built.Inference,
        };
        SetActiveInfo(info);
        SetPhase(YoloTrainingPhase.Training);
        var train = await _runner.TrainAsync(job.Launcher, built.DataYamlPath, parameters, job.RunsDir, job.Stamp, ct);
        SetActiveInfo(null);
        runDir = train.RunDir;
        weights = train.OutputFile;
        info = Finish(info, runDir);
        if (train.Cancelled || ct.IsCancellationRequested) return Cancelled(datasetDir, runDir, weights, SaveInfo(runDir, info with { Status = YoloRunStatus.Cancelled }));
        if (!train.Success || weights == null)
            return Fail(train.Error ?? "", datasetDir, runDir, weights, SaveInfo(runDir, info with { Status = YoloRunStatus.Failed, Error = train.Error }));
        Emit(T(I18nKeys.YoloTrainingLogTrainDone).Replace("{weights}", weights));
        return await CompleteAsync(job.Launcher, job.ExportOnnx, info, datasetDir, runDir!, weights, ct);
    }

    private async Task<YoloTrainingOutcome> ResumeCoreAsync(string runDir, YoloLauncher launcher, bool exportOnnx, CancellationToken ct)
    {
        var last = YoloArtifacts.LastWeightsPath(runDir);
        var info = YoloRunInfo.Load(runDir) ?? new YoloRunInfo
        {
            RunName = Path.GetFileName(runDir),
            CreatedUtc = Directory.GetCreationTimeUtc(runDir),
            Classes = YoloModelRegistry.ClassesFromArgs(runDir),
        };
        if (!File.Exists(last)) return Fail(T(I18nKeys.YoloTrainingServiceNoLastWeights).Replace("{dir}", runDir), info.DatasetDir, runDir, null);
        Emit(T(I18nKeys.YoloTrainingServiceResumeStart).Replace("{dir}", runDir));
        info = info with { Status = YoloRunStatus.Running, Resumes = info.Resumes + 1, Error = null };
        SaveInfo(runDir, info);
        SetActiveInfo(info, runDir);
        SetPhase(YoloTrainingPhase.Training);
        var train = await _runner.ResumeAsync(launcher, last, ct);
        SetActiveInfo(null);
        var weights = train.OutputFile;
        info = Finish(info, runDir);
        if (train.Cancelled || ct.IsCancellationRequested) return Cancelled(info.DatasetDir, runDir, weights, SaveInfo(runDir, info with { Status = YoloRunStatus.Cancelled }));
        if (!train.Success || weights == null)
            return Fail(train.Error ?? "", info.DatasetDir, runDir, weights, SaveInfo(runDir, info with { Status = YoloRunStatus.Failed, Error = train.Error }));
        Emit(T(I18nKeys.YoloTrainingLogTrainDone).Replace("{weights}", weights));
        return await CompleteAsync(launcher, exportOnnx, info, info.DatasetDir, runDir, weights, ct);
    }

    private async Task<YoloTrainingOutcome> CompleteAsync(YoloLauncher launcher, bool exportOnnx, YoloRunInfo info, string? datasetDir, string runDir, string weights,
        CancellationToken ct)
    {
        info = info with { Status = YoloRunStatus.Completed };
        SaveInfo(runDir, info);
        string? onnx = null;
        if (exportOnnx)
        {
            var (path, error, cancelled) = await ExportCoreAsync(runDir, weights, launcher, new YoloExportOptions { Imgsz = EffectiveImgsz(info) }, info, ct);
            if (cancelled) return Cancelled(datasetDir, runDir, weights, YoloRunInfo.Load(runDir));
            if (error != null) return Fail(error, datasetDir, runDir, weights, YoloRunInfo.Load(runDir));
            onnx = path;
        }
        return Publish(new YoloTrainingOutcome(true, false, datasetDir, runDir, weights, onnx, null) { RunInfo = YoloRunInfo.Load(runDir) });
    }

    private async Task<(string? Onnx, string? Error, bool Cancelled)> ExportCoreAsync(string runDir, string weights, YoloLauncher launcher,
        YoloExportOptions options, YoloRunInfo? info, CancellationToken ct)
    {
        SetPhase(YoloTrainingPhase.Exporting);
        var export = await _runner.ExportOnnxAsync(launcher, weights, options, ct);
        if (export.Cancelled || ct.IsCancellationRequested) return (null, null, true);
        if (!export.Success) return (null, export.Error ?? "", false);
        Emit(T(I18nKeys.YoloTrainingLogExportDone).Replace("{onnx}", export.OutputFile ?? ""));
        var current = YoloRunInfo.Load(runDir) ?? info ?? new YoloRunInfo { RunName = Path.GetFileName(runDir), Classes = YoloModelRegistry.ClassesFromArgs(runDir) };
        SaveInfo(runDir, current with { Onnx = export.OutputFile, Export = options });
        return (export.OutputFile, null, false);
    }

    private async Task<YoloEvalOutcome> EvaluateCoreAsync(string runDir, IReadOnlyList<YoloDatasetSource> sources, YoloLauncher launcher, CancellationToken ct)
    {
        var weights = YoloArtifacts.WeightsPath(runDir);
        var info = YoloRunInfo.Load(runDir);
        if (!File.Exists(weights)) return EvalFail(T(I18nKeys.YoloTrainingServiceNoBestWeights).Replace("{dir}", runDir));
        var classes = info?.Classes is { Count: > 0 } c ? c : YoloModelRegistry.ClassesForModel(weights);
        SetPhase(YoloTrainingPhase.Building);
        var plan = await Task.Run(() => YoloDatasetAssembler.PlanEvaluation(sources, classes, ct), ct);
        if (!plan.CanBuild) return EvalFail(T(I18nKeys.YoloTrainingServiceEvalNoData));
        var evalDir = Path.Combine(runDir, EvalSubdir, UniqueStamp(Path.Combine(runDir, EvalSubdir)));
        var datasetDir = Path.Combine(evalDir, EvalDatasetSubdir);
        var progress = new SyncProgress<(int Done, int Total)>(p => BuildProgress?.Invoke(p.Done, p.Total));
        var built = await Task.Run(() => YoloDatasetAssembler.Build(plan, datasetDir, progress, ct), ct);
        Emit(T(I18nKeys.YoloTrainingLogDataset).Replace("{dir}", datasetDir));

        SetPhase(YoloTrainingPhase.Evaluating);
        int imgsz = EffectiveImgsz(info);
        var val = await _runner.ValAsync(launcher, weights, built.DataYamlPath, imgsz, evalDir, EvalValName, info?.Parameters?.Device, ct);
        if (val.Run.Cancelled || ct.IsCancellationRequested) return new YoloEvalOutcome(false, true, null, null);
        if (val.Metrics == null) return EvalFail(T(I18nKeys.YoloTrainingServiceEvalNoMetrics).Replace("{error}", val.Run.Error ?? ""));
        var eval = new YoloRealEval(DateTime.UtcNow, sources.Select(s => s.Name).ToList(), datasetDir, imgsz, val.Metrics);
        var current = YoloRunInfo.Load(runDir) ?? new YoloRunInfo { RunName = Path.GetFileName(runDir), Classes = classes };
        SaveInfo(runDir, current with { RealEvals = current.RealEvals.Append(eval).ToList() });
        var m = val.Metrics;
        Emit(T(I18nKeys.YoloTrainingServiceEvalDone)
            .Replace("{images}", m.Images.ToString())
            .Replace("{p}", Fmt(m.Precision)).Replace("{r}", Fmt(m.Recall))
            .Replace("{map50}", Fmt(m.MAP50)).Replace("{map}", Fmt(m.MAP50To95)));
        return new YoloEvalOutcome(true, false, eval, null);
    }

    /// <summary>Runs body as the single active job: busy check, optional runs-dir lock, phase reset and cancellation token.</summary>
    private async Task<TResult> Exclusive<TResult>(string? runsDir, string lockDescription, Func<string, TResult> busy, Func<string, TResult> fail,
        Func<TResult> cancelled, Func<CancellationToken, Task<TResult>> body)
    {
        CancellationToken ct;
        lock (_lock)
        {
            if (_phase != YoloTrainingPhase.Idle) return busy(T(I18nKeys.YoloTrainingBusy));
            _phase = YoloTrainingPhase.Building;
            _cts = new CancellationTokenSource();
            ct = _cts.Token;
        }
        YoloRunLock? runLock = null;
        try
        {
            if (runsDir != null)
            {
                runLock = YoloRunLock.TryAcquire(runsDir, lockDescription, out var owner);
                if (runLock == null)
                    return fail(T(I18nKeys.YoloTrainingServiceRunsLocked)
                        .Replace("{pid}", owner?.ProcessId.ToString() ?? "?")
                        .Replace("{job}", owner?.Description ?? "")
                        .Replace("{started}", owner?.StartedUtc.ToLocalTime().ToString("g", CultureInfo.CurrentCulture) ?? ""));
            }
            return await body(ct);
        }
        catch (OperationCanceledException)
        {
            return cancelled();
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or InvalidOperationException or ArgumentException
                                       or JsonException or BuildFailedException or OpenCvSharp.OpenCVException)
        {
            return fail(ex.Message);
        }
        finally
        {
            runLock?.Dispose();
            SetActiveInfo(null);
            lock (_lock)
            {
                _cts?.Dispose();
                _cts = null;
            }
            SetPhase(YoloTrainingPhase.Idle);
        }
    }

    private YoloTrainingOutcome Publish(YoloTrainingOutcome outcome)
    {
        lock (_lock) _lastOutcome = outcome;
        OutcomeChanged?.Invoke(outcome);
        return outcome;
    }

    private void CancelForShutdown()
    {
        if (!IsRunning) return;
        ColorPrinter.Yellow(LogTag + "shutdown: cancelling the running job");
        Cancel();
        _runner.WaitForIdle(ShutdownWait);
    }

    private void OnRunnerOutput(string line)
    {
        if (_ultralyticsVersion == null && UltralyticsBanner.Match(line) is { Success: true } m) _ultralyticsVersion = m.Groups[1].Value;
        Log?.Invoke(line);
    }

    /// <summary>Writes run_info (status running) as soon as the run dir appears, so other instances and windows see the live run.</summary>
    private void OnRunnerMetrics(YoloTrainMetrics metrics)
    {
        YoloRunInfo? save = null;
        lock (_lock)
        {
            if (_activeInfo != null && !_activeInfoSaved)
            {
                _activeInfoSaved = true;
                save = _activeInfo with { UltralyticsVersion = _ultralyticsVersion ?? _activeInfo.UltralyticsVersion };
            }
        }
        if (save != null) SaveInfo(metrics.RunDir, save.WithResults(metrics.RunDir));
        Metrics?.Invoke(metrics);
    }

    private void SetActiveInfo(YoloRunInfo? info, string? knownRunDir = null)
    {
        lock (_lock)
        {
            _activeInfo = info;
            _activeInfoSaved = knownRunDir != null;
            if (info != null) _ultralyticsVersion = null;
        }
    }

    private YoloRunInfo Finish(YoloRunInfo info, string? runDir)
    {
        info = info with { UltralyticsVersion = _ultralyticsVersion ?? info.UltralyticsVersion };
        if (runDir == null) return info;
        info = info.WithResults(runDir);
        if (info.BestEpoch is { } best)
            Emit(T(I18nKeys.YoloTrainingServiceBestEpoch).Replace("{epoch}", best.Epoch.ToString())
                .Replace("{map50}", Fmt(best.MAP50 ?? 0)).Replace("{map}", Fmt(best.MAP50To95 ?? 0)));
        return info;
    }

    private YoloRunInfo? SaveInfo(string? runDir, YoloRunInfo info)
    {
        if (runDir == null || !Directory.Exists(runDir)) return null;
        try
        {
            info.Save(runDir);
            ColorPrinter.Gray($"[DEBUG]{LogTag}run_info {info.Status} {runDir}");
            return info;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            ColorPrinter.Yellow($"{LogTag}run_info not saved ({runDir}): {ex.Message}");
            return null;
        }
    }

    private void LogSynthesis(SynthesisResult? s)
    {
        if (s == null) return;
        Emit(T(I18nKeys.YoloTrainingServiceSynthesisStats)
            .Replace("{negatives}", s.NegativeImages.ToString())
            .Replace("{instances}", string.Join(", ", s.Instances.Select(kv => $"{kv.Key} {kv.Value}")))
            .Replace("{holdout}", s.HoldoutImages.ToString())
            .Replace("{failed}", s.FailedJobs.ToString()));
        if (s.Warnings.Count > 0) Emit(T(I18nKeys.YoloTrainingServiceSynthesisWarnings).Replace("{warnings}", FormatIssues(s.Warnings)));
    }

    private static string FormatIssues(IEnumerable<TaskSetIssue> issues) =>
        string.Join(", ", issues.Select(i => string.IsNullOrEmpty(i.Subject) ? i.Code.ToString() : $"{i.Code} ({i.Subject})"));

    private static int EffectiveImgsz(YoloRunInfo? info) =>
        info?.Imgsz > 0 ? info.Imgsz : YoloTrainParameters.NormalizeImgsz(info?.Parameters?.Imgsz ?? new YoloTrainParameters().Imgsz);

    private static string Fmt(double value) => value.ToString(MetricFormat, CultureInfo.InvariantCulture);

    private static string T(string key) => D3D4TesterI18n.Provider.GetUiText(key);

    /// <summary>Busy answer: not published, the running job's outcome follows.</summary>
    private static YoloTrainingOutcome Busy(string error) => new(false, false, null, null, null, null, error);

    private YoloEvalOutcome EvalFail(string error)
    {
        Emit(T(I18nKeys.YoloTrainingLogFailed).Replace("{error}", error));
        return new YoloEvalOutcome(false, false, null, error);
    }

    private YoloTrainingOutcome Fail(string error, string? datasetDir, string? runDir, string? weights, YoloRunInfo? info = null)
    {
        if (error.Length > 0) Emit(T(I18nKeys.YoloTrainingLogFailed).Replace("{error}", error));
        return Publish(new YoloTrainingOutcome(false, false, datasetDir, runDir, weights, null, error) { RunInfo = info });
    }

    private YoloTrainingOutcome Cancelled(string? datasetDir, string? runDir, string? weights, YoloRunInfo? info = null) =>
        Publish(new YoloTrainingOutcome(false, true, datasetDir, runDir, weights, null, null) { RunInfo = info });

    private void Emit(string line)
    {
        ColorPrinter.Blue(LogTag + line);
        Log?.Invoke(line);
    }

    private void SetPhase(YoloTrainingPhase phase)
    {
        lock (_lock) _phase = phase;
        PhaseChanged?.Invoke(phase);
    }

    /// <summary>Dataset build failure with a user-facing (i18n) message.</summary>
    private sealed class BuildFailedException : Exception
    {
        public BuildFailedException(string message) : base(message) { }
    }

    /// <summary>Progress reported synchronously on the worker (Progress&lt;T&gt; would post to a captured context).</summary>
    private sealed class SyncProgress<T> : IProgress<T>
    {
        private readonly Action<T> _report;

        public SyncProgress(Action<T> report) => _report = report;

        public void Report(T value) => _report(value);
    }
}
