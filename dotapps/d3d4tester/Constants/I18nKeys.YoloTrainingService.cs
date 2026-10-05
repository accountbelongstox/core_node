// PY-REF: none (DOT-only)
namespace DotApps.d3d4tester.Constants;

/// <summary>YOLO training service log and failure texts (ui.yolo_training_service.*).</summary>
public static partial class I18nKeys
{
    private const string Yts = "ui.yolo_training_service.";

    public const string YoloTrainingServiceTaskSetInvalid = Yts + "task_set_invalid";
    public const string YoloTrainingServiceSynthesisEmpty = Yts + "synthesis_empty";
    public const string YoloTrainingServiceSynthesisStats = Yts + "synthesis_stats";
    public const string YoloTrainingServiceSynthesisWarnings = Yts + "synthesis_warnings";
    public const string YoloTrainingServiceDatasetMissing = Yts + "dataset_missing";
    public const string YoloTrainingServiceRunsLocked = Yts + "runs_locked";
    public const string YoloTrainingServiceClassMismatch = Yts + "class_mismatch";
    public const string YoloTrainingServiceWeightsDownload = Yts + "weights_download";
    public const string YoloTrainingServiceAugmentation = Yts + "augmentation";
    public const string YoloTrainingServiceExtraRejected = Yts + "extra_rejected";
    public const string YoloTrainingServiceBestEpoch = Yts + "best_epoch";
    public const string YoloTrainingServiceResumeStart = Yts + "resume_start";
    public const string YoloTrainingServiceNoLastWeights = Yts + "no_last_weights";
    public const string YoloTrainingServiceNoBestWeights = Yts + "no_best_weights";
    public const string YoloTrainingServiceEvalNoData = Yts + "eval_no_data";
    public const string YoloTrainingServiceEvalNoMetrics = Yts + "eval_no_metrics";
    public const string YoloTrainingServiceEvalDone = Yts + "eval_done";
}
