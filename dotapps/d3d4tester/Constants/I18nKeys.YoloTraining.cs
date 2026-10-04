// PY-REF: none (DOT-only)
using System.Text.RegularExpressions;
using DotCore.YoloTrain;

namespace DotApps.d3d4tester.Constants;

/// <summary>YOLO training window keys (ui.yolo_training.*).</summary>
public static partial class I18nKeys
{
    private const string Yt = "ui.yolo_training.";
    private const string YtAdvice = Yt + "advice.";

    public const string YoloTrainingWindowTitle = Yt + "window_title";
    public const string YoloTrainingSectionEnv = Yt + "section_env";
    public const string YoloTrainingPythonExe = Yt + "python_exe";
    public const string YoloTrainingBrowse = Yt + "browse";
    public const string YoloTrainingDetect = Yt + "detect";
    public const string YoloTrainingDetecting = Yt + "detecting";
    public const string YoloTrainingApplyRecommended = Yt + "apply_recommended";
    public const string YoloTrainingEnvOs = Yt + "env_os";
    public const string YoloTrainingEnvCpu = Yt + "env_cpu";
    public const string YoloTrainingEnvRam = Yt + "env_ram";
    public const string YoloTrainingEnvGpu = Yt + "env_gpu";
    public const string YoloTrainingEnvPython = Yt + "env_python";
    public const string YoloTrainingEnvTorch = Yt + "env_torch";
    public const string YoloTrainingEnvUltralytics = Yt + "env_ultralytics";
    public const string YoloTrainingEnvCli = Yt + "env_cli";
    public const string YoloTrainingEnvNone = Yt + "env_none";
    public const string YoloTrainingEnvReady = Yt + "env_ready";
    public const string YoloTrainingEnvNotReady = Yt + "env_not_ready";
    public const string YoloTrainingEnvUnknown = Yt + "env_unknown";
    public const string YoloTrainingCudaYes = Yt + "cuda_yes";
    public const string YoloTrainingCudaNo = Yt + "cuda_no";
    public const string YoloTrainingCpuFormat = Yt + "cpu_format";
    public const string YoloTrainingRamFormat = Yt + "ram_format";
    public const string YoloTrainingGpuFormat = Yt + "gpu_format";
    public const string YoloTrainingSectionParams = Yt + "section_params";
    public const string YoloTrainingModel = Yt + "model";
    public const string YoloTrainingModelFilter = Yt + "model_filter";
    public const string YoloTrainingEpochs = Yt + "epochs";
    public const string YoloTrainingImgsz = Yt + "imgsz";
    public const string YoloTrainingBatch = Yt + "batch";
    public const string YoloTrainingDevice = Yt + "device";
    public const string YoloTrainingWorkers = Yt + "workers";
    public const string YoloTrainingPatience = Yt + "patience";
    public const string YoloTrainingCache = Yt + "cache";
    public const string YoloTrainingCacheOff = Yt + "cache_off";
    public const string YoloTrainingCacheRam = Yt + "cache_ram";
    public const string YoloTrainingCacheDisk = Yt + "cache_disk";
    public const string YoloTrainingOptimizer = Yt + "optimizer";
    public const string YoloTrainingLr0 = Yt + "lr0";
    public const string YoloTrainingSeed = Yt + "seed";
    public const string YoloTrainingCloseMosaic = Yt + "close_mosaic";
    public const string YoloTrainingAmp = Yt + "amp";
    public const string YoloTrainingExtraArgs = Yt + "extra_args";
    public const string YoloTrainingExportOnnx = Yt + "export_onnx";
    public const string YoloTrainingExtraArgsRejected = Yt + "extra_args_rejected";
    public const string YoloTrainingSectionDataset = Yt + "section_dataset";
    public const string YoloTrainingSourceSelected = Yt + "source_selected";
    public const string YoloTrainingSourceAll = Yt + "source_all";
    public const string YoloTrainingTrainPercent = Yt + "train_percent";
    public const string YoloTrainingValPercent = Yt + "val_percent";
    public const string YoloTrainingTestPercent = Yt + "test_percent";
    public const string YoloTrainingSplitSeed = Yt + "split_seed";
    public const string YoloTrainingShuffle = Yt + "shuffle";
    public const string YoloTrainingStratify = Yt + "stratify";
    public const string YoloTrainingIncludeBackground = Yt + "include_background";
    public const string YoloTrainingBackgroundMaxPercent = Yt + "background_max_percent";
    public const string YoloTrainingSkipDifficult = Yt + "skip_difficult";
    public const string YoloTrainingPreview = Yt + "preview";
    public const string YoloTrainingPreviewNone = Yt + "preview_none";
    public const string YoloTrainingSplitInvalid = Yt + "split_invalid";
    public const string YoloTrainingPreviewSummary = Yt + "preview_summary";
    public const string YoloTrainingPreviewSplit = Yt + "preview_split";
    public const string YoloTrainingPreviewClass = Yt + "preview_class";
    public const string YoloTrainingPreviewUnknown = Yt + "preview_unknown";
    public const string YoloTrainingPreviewDifficult = Yt + "preview_difficult";
    public const string YoloTrainingSplitTrain = Yt + "split_train";
    public const string YoloTrainingSplitVal = Yt + "split_val";
    public const string YoloTrainingSplitTest = Yt + "split_test";
    public const string YoloTrainingNoSegments = Yt + "no_segments";
    public const string YoloTrainingNoLabeled = Yt + "no_labeled";
    public const string YoloTrainingSectionRun = Yt + "section_run";
    public const string YoloTrainingStart = Yt + "start";
    public const string YoloTrainingStop = Yt + "stop";
    public const string YoloTrainingOpenOutput = Yt + "open_output";
    public const string YoloTrainingUseForNavigation = Yt + "use_for_navigation";
    public const string YoloTrainingStatusIdle = Yt + "status_idle";
    public const string YoloTrainingStatusBuilding = Yt + "status_building";
    public const string YoloTrainingStatusTraining = Yt + "status_training";
    public const string YoloTrainingStatusExporting = Yt + "status_exporting";
    public const string YoloTrainingStatusDone = Yt + "status_done";
    public const string YoloTrainingStatusFailed = Yt + "status_failed";
    public const string YoloTrainingStatusCancelled = Yt + "status_cancelled";
    public const string YoloTrainingEpochFormat = Yt + "epoch_format";
    public const string YoloTrainingCannotTrain = Yt + "cannot_train";
    public const string YoloTrainingBusy = Yt + "busy";
    public const string YoloTrainingLogDataset = Yt + "log_dataset";
    public const string YoloTrainingLogDatasetCounts = Yt + "log_dataset_counts";
    public const string YoloTrainingLogTrainDone = Yt + "log_train_done";
    public const string YoloTrainingLogExportDone = Yt + "log_export_done";
    public const string YoloTrainingLogFailed = Yt + "log_failed";
    public const string YoloTrainingNavigationModelSet = Yt + "navigation_model_set";
    public const string YoloTrainingConfirmCloseRunning = Yt + "confirm_close_running";
    public const string YoloTrainingMode = Yt + "mode";
    public const string YoloTrainingModeGeneral = Yt + "mode_general";
    public const string YoloTrainingModeSpecific = Yt + "mode_specific";
    public const string YoloTrainingManageTaskSets = Yt + "manage_task_sets";
    public const string YoloTrainingTaskSetNone = Yt + "task_set_none";
    public const string YoloTrainingTaskSetSummary = Yt + "task_set_summary";
    public const string YoloTrainingTaskSetInvalid = Yt + "task_set_invalid";
    public const string YoloTrainingBuildProgress = Yt + "build_progress";

    private static readonly Regex SnakeBoundary = new("(?<=[a-z0-9])([A-Z])", RegexOptions.Compiled);

    /// <summary>ui.yolo_training.advice.{code in snake_case}; texts use {value}.</summary>
    public static string YoloTrainingAdvice(TrainAdviceCode code) => YtAdvice + SnakeBoundary.Replace(code.ToString(), "_$1").ToLowerInvariant();
}
