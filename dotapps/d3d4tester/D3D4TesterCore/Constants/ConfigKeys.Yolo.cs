// PY-REF: none (DOT-only)
namespace DotApps.d3d4tester.Constants;

/// <summary>Config keys of the YOLO areas: calibration data panel, training, dataset split, town navigation model.</summary>
public static partial class ConfigKeys
{
    // ---------- navigation (town NPC model) ----------
    public const string NavigationNpcModelPath = "navigation.npc_model_path";
    public const string NavigationTarget = "navigation.target";
    public const string NavigationConfidence = "navigation.confidence";
    public const string NavigationMaxSteps = "navigation.max_steps";

    // ---------- coord_calibration (YOLO / calibration panel) ----------
    public const string CoordCalibrationClientType = "coord_calibration.client_type";
    public const string CoordCalibrationYoloDataRoot = "coord_calibration.yolo_data_root";
    public const string CoordCalibrationYoloCurrentProject = "coord_calibration.yolo_current_project";
    public const string CoordCalibrationYoloProjectList = "coord_calibration.yolo_project_list";

    // ---------- yolo_training (Ultralytics parameters) ----------
    public const string YoloTrainingPythonExe = "yolo_training.python_exe";
    public const string YoloTrainingModel = "yolo_training.model";
    public const string YoloTrainingEpochs = "yolo_training.epochs";
    public const string YoloTrainingImgsz = "yolo_training.imgsz";
    public const string YoloTrainingBatch = "yolo_training.batch";
    public const string YoloTrainingDevice = "yolo_training.device";
    public const string YoloTrainingWorkers = "yolo_training.workers";
    public const string YoloTrainingPatience = "yolo_training.patience";
    public const string YoloTrainingCache = "yolo_training.cache";
    public const string YoloTrainingAmp = "yolo_training.amp";
    public const string YoloTrainingOptimizer = "yolo_training.optimizer";
    public const string YoloTrainingLr0 = "yolo_training.lr0";
    public const string YoloTrainingSeed = "yolo_training.seed";
    public const string YoloTrainingCloseMosaic = "yolo_training.close_mosaic";
    public const string YoloTrainingExtraArgs = "yolo_training.extra_args";
    public const string YoloTrainingExportOnnx = "yolo_training.export_onnx";
    public const string YoloTrainingDetectOnOpen = "yolo_training.detect_on_open";
    public const string YoloTrainingMode = "yolo_training.mode";
    public const string YoloTrainingTaskSet = "yolo_training.task_set";
    public const string YoloTrainingAugmentation = "yolo_training.augmentation";
    public const string YoloTrainingAugmentationFromTaskSet = "yolo_training.augmentation_from_task_set";

    // ---------- yolo_dataset (train / val / test split) ----------
    public const string YoloDatasetSource = "yolo_dataset.source";
    public const string YoloDatasetTrainPercent = "yolo_dataset.train_percent";
    public const string YoloDatasetValPercent = "yolo_dataset.val_percent";
    public const string YoloDatasetTestPercent = "yolo_dataset.test_percent";
    public const string YoloDatasetSeed = "yolo_dataset.seed";
    public const string YoloDatasetShuffle = "yolo_dataset.shuffle";
    public const string YoloDatasetStratify = "yolo_dataset.stratify";
    public const string YoloDatasetIncludeBackground = "yolo_dataset.include_background";
    public const string YoloDatasetBackgroundMaxPercent = "yolo_dataset.background_max_percent";
    public const string YoloDatasetSkipDifficult = "yolo_dataset.skip_difficult";
    public const string YoloDatasetIncludeUnreviewedPseudoLabels = "yolo_dataset.include_unreviewed_pseudo_labels";

    // ---------- yolo_taskset (task-set manager UI state) ----------
    public const string YoloTaskSetLastTaskSet = "yolo_taskset.last_task_set";

    // ---------- yolo_detect (shared YoloModelHost session options) ----------
    public const string YoloDetectExecutionProvider = "yolo_detect.execution_provider";
    public const string YoloDetectIntraOpThreads = "yolo_detect.intra_op_threads";
    public const string YoloDetectWarmUp = "yolo_detect.warm_up";
}
