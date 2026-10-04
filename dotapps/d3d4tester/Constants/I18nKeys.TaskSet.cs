// PY-REF: none (DOT-only)
using System.Text.RegularExpressions;
using DotCore.YoloTaskSet;

namespace DotApps.d3d4tester.Constants;

/// <summary>YOLO task-set manager keys (ui.yolo_taskset.*).</summary>
public static partial class I18nKeys
{
    private const string Ts = "ui.yolo_taskset.";
    private const string TsIssue = Ts + "issue.";
    private const string TsAug = Ts + "aug.";
    private const string TsSyn = Ts + "syn.";

    public const string YoloTaskSetOpenButton = Ts + "open_button";
    public const string YoloTaskSetWindowTitle = Ts + "window_title";
    public const string YoloTaskSetConfirmTitle = Ts + "confirm_title";

    public const string YoloTaskSetSectionSets = Ts + "section_sets";
    public const string YoloTaskSetSectionTargets = Ts + "section_targets";
    public const string YoloTaskSetSectionCommon = Ts + "section_common";
    public const string YoloTaskSetSectionGlobalAug = Ts + "section_global_aug";
    public const string YoloTaskSetSectionSynthesis = Ts + "section_synthesis";
    public const string YoloTaskSetSectionValidation = Ts + "section_validation";
    public const string YoloTaskSetSectionPreview = Ts + "section_preview";
    public const string YoloTaskSetSectionGenerate = Ts + "section_generate";

    public const string YoloTaskSetSetNew = Ts + "set_new";
    public const string YoloTaskSetSetRename = Ts + "set_rename";
    public const string YoloTaskSetSetDuplicate = Ts + "set_duplicate";
    public const string YoloTaskSetSetDelete = Ts + "set_delete";
    public const string YoloTaskSetSetDescription = Ts + "set_description";
    public const string YoloTaskSetSetNamePrompt = Ts + "set_name_prompt";
    public const string YoloTaskSetSetDefaultName = Ts + "set_default_name";
    public const string YoloTaskSetSetDuplicateName = Ts + "set_duplicate_name";
    public const string YoloTaskSetSetDeleteConfirm = Ts + "set_delete_confirm";
    public const string YoloTaskSetSetRowDetail = Ts + "set_row_detail";
    public const string YoloTaskSetNoSetSelected = Ts + "no_set_selected";

    public const string YoloTaskSetTargetAdd = Ts + "target_add";
    public const string YoloTaskSetTargetRename = Ts + "target_rename";
    public const string YoloTaskSetTargetDelete = Ts + "target_delete";
    public const string YoloTaskSetTargetUp = Ts + "target_up";
    public const string YoloTaskSetTargetDown = Ts + "target_down";
    public const string YoloTaskSetTargetNamePrompt = Ts + "target_name_prompt";
    public const string YoloTaskSetTargetDefaultName = Ts + "target_default_name";
    public const string YoloTaskSetTargetDeleteConfirm = Ts + "target_delete_confirm";
    public const string YoloTaskSetTargetRow = Ts + "target_row";
    public const string YoloTaskSetTargetRowDetail = Ts + "target_row_detail";
    public const string YoloTaskSetNoTargetSelected = Ts + "no_target_selected";
    public const string YoloTaskSetTabVariants = Ts + "tab_variants";
    public const string YoloTaskSetTabScenes = Ts + "tab_scenes";
    public const string YoloTaskSetTabAugmentation = Ts + "tab_augmentation";
    public const string YoloTaskSetVariantsHint = Ts + "variants_hint";
    public const string YoloTaskSetScenesHint = Ts + "scenes_hint";
    public const string YoloTaskSetCommonHint = Ts + "common_hint";
    public const string YoloTaskSetOverrideHint = Ts + "override_hint";
    public const string YoloTaskSetImagesPerTarget = Ts + "images_per_target";
    public const string YoloTaskSetInheritGlobal = Ts + "inherit_global";
    public const string YoloTaskSetGlobalValue = Ts + "global_value";
    public const string YoloTaskSetValueOn = Ts + "value_on";
    public const string YoloTaskSetValueOff = Ts + "value_off";

    public const string YoloTaskSetAddFiles = Ts + "add_files";
    public const string YoloTaskSetAddFolder = Ts + "add_folder";
    public const string YoloTaskSetRemoveSelected = Ts + "remove_selected";
    public const string YoloTaskSetRemoveConfirm = Ts + "remove_confirm";
    public const string YoloTaskSetImageFilter = Ts + "image_filter";
    public const string YoloTaskSetMediaFilter = Ts + "media_filter";
    public const string YoloTaskSetFolderTitle = Ts + "folder_title";
    public const string YoloTaskSetAddSkipped = Ts + "add_skipped";
    public const string YoloTaskSetKindImage = Ts + "kind_image";
    public const string YoloTaskSetKindVideo = Ts + "kind_video";
    public const string YoloTaskSetVideoFrames = Ts + "video_frames";
    public const string YoloTaskSetVideoFramesPending = Ts + "video_frames_pending";
    public const string YoloTaskSetVideoFramesFailed = Ts + "video_frames_failed";
    public const string YoloTaskSetScaleModeNative = Ts + "scale_mode_native";
    public const string YoloTaskSetScaleModeRelative = Ts + "scale_mode_relative";

    public const string YoloTaskSetValidate = Ts + "validate";
    public const string YoloTaskSetPreview = Ts + "preview";
    public const string YoloTaskSetNextSample = Ts + "next_sample";
    public const string YoloTaskSetGenerate = Ts + "generate";
    public const string YoloTaskSetCancel = Ts + "cancel";
    public const string YoloTaskSetOpenDataset = Ts + "open_dataset";
    public const string YoloTaskSetTrain = Ts + "train";
    public const string YoloTaskSetValidationNone = Ts + "validation_none";
    public const string YoloTaskSetValidationOk = Ts + "validation_ok";
    public const string YoloTaskSetPreviewNone = Ts + "preview_none";
    public const string YoloTaskSetPreviewInfo = Ts + "preview_info";
    public const string YoloTaskSetGenerateNone = Ts + "generate_none";
    public const string YoloTaskSetStatusIdle = Ts + "status_idle";
    public const string YoloTaskSetStatusBusy = Ts + "status_busy";
    public const string YoloTaskSetStatusGenerating = Ts + "status_generating";
    public const string YoloTaskSetStatusDone = Ts + "status_done";
    public const string YoloTaskSetStatusCancelled = Ts + "status_cancelled";
    public const string YoloTaskSetStatusFailed = Ts + "status_failed";
    public const string YoloTaskSetResultSummary = Ts + "result_summary";
    public const string YoloTaskSetResultInstances = Ts + "result_instances";
    public const string YoloTaskSetResultWarnings = Ts + "result_warnings";
    public const string YoloTaskSetResultDir = Ts + "result_dir";
    public const string YoloTaskSetTrainBlocked = Ts + "train_blocked";
    public const string YoloTaskSetGenerateBlocked = Ts + "generate_blocked";
    public const string YoloTaskSetErrorIo = Ts + "error_io";
    public const string YoloTaskSetConfirmCloseBusy = Ts + "confirm_close_busy";

    public const string YoloTaskSetAugScaleMin = TsAug + "scale_min";
    public const string YoloTaskSetAugScaleMax = TsAug + "scale_max";
    public const string YoloTaskSetAugStretchMin = TsAug + "stretch_min";
    public const string YoloTaskSetAugStretchMax = TsAug + "stretch_max";
    public const string YoloTaskSetAugRotationMaxDegrees = TsAug + "rotation_max_degrees";
    public const string YoloTaskSetAugLeftStretchMax = TsAug + "left_stretch_max";
    public const string YoloTaskSetAugRightStretchMax = TsAug + "right_stretch_max";
    public const string YoloTaskSetAugFlipHorizontal = TsAug + "flip_horizontal";
    public const string YoloTaskSetAugBrightnessMax = TsAug + "brightness_max";
    public const string YoloTaskSetAugContrastMax = TsAug + "contrast_max";
    public const string YoloTaskSetAugBlurProbability = TsAug + "blur_probability";
    public const string YoloTaskSetAugBlurMaxKernel = TsAug + "blur_max_kernel";
    public const string YoloTaskSetAugEdgeFeather = TsAug + "edge_feather";

    public const string YoloTaskSetSynImagesPerTarget = TsSyn + "images_per_target";
    public const string YoloTaskSetSynValPercent = TsSyn + "val_percent";
    public const string YoloTaskSetSynSeed = TsSyn + "seed";
    public const string YoloTaskSetSynMinObjects = TsSyn + "min_objects_per_image";
    public const string YoloTaskSetSynMaxObjects = TsSyn + "max_objects_per_image";
    public const string YoloTaskSetSynCrossTargetProbability = TsSyn + "cross_target_probability";
    public const string YoloTaskSetSynNegativePercent = TsSyn + "negative_percent";
    public const string YoloTaskSetSynMaxOverlapIou = TsSyn + "max_overlap_iou";
    public const string YoloTaskSetSynMinVisibleFraction = TsSyn + "min_visible_fraction";
    public const string YoloTaskSetSynScaleMode = TsSyn + "scale_mode";
    public const string YoloTaskSetSynRelativeMin = TsSyn + "relative_min";
    public const string YoloTaskSetSynRelativeMax = TsSyn + "relative_max";
    public const string YoloTaskSetSynOutputMaxSide = TsSyn + "output_max_side";
    public const string YoloTaskSetSynJpegQuality = TsSyn + "jpeg_quality";
    public const string YoloTaskSetSynVideoFrameInterval = TsSyn + "video_frame_interval";
    public const string YoloTaskSetSynVideoMaxFrames = TsSyn + "video_max_frames";

    /// <summary>ui.yolo_taskset.issue.&lt;snake_case code&gt;; text may contain {subject}.</summary>
    public static string YoloTaskSetIssue(TaskSetIssueCode code) =>
        TsIssue + Regex.Replace(code.ToString(), "(?<=[a-z0-9])([A-Z])", "_$1").ToLowerInvariant();
}
