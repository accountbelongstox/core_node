using System.Globalization;
using System.Text.Json;
using DotCore.Common;

namespace DotCore.VocAnnotatorUI;

/// <summary>
/// Annotator texts (ui.voc_annotator.*) shipped as embedded I18n/i18n_voc_annotator_{lang}.json.
/// Host apps merge GetStrings(lang) into their own provider and call UseProvider so language switches follow the app;
/// without a host provider a standalone provider is created for the current UI culture.
/// </summary>
public static class AnnotatorI18n
{
    public static readonly IReadOnlyList<string> Languages = new[] { "zh", "en" };
    private const string ResourcePrefix = "DotCore.VocAnnotatorUI.I18n.i18n_voc_annotator_";
    private const string FallbackLanguage = "en";

    private static II18nProvider? _provider;

    public static II18nProvider Provider => _provider ??= CreateProvider(CultureInfo.CurrentUICulture.TwoLetterISOLanguageName);

    public static void UseProvider(II18nProvider provider) => _provider = provider;

    internal static string T(string key) => Provider.GetUiText(key);

    /// <summary>Flat "ui.voc_annotator.*" texts of one language (empty when the language is not shipped).</summary>
    public static IReadOnlyDictionary<string, string> GetStrings(string language)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        using var stream = typeof(AnnotatorI18n).Assembly.GetManifestResourceStream(ResourcePrefix + language + ".json");
        if (stream == null) return result;
        using var doc = JsonDocument.Parse(stream);
        Flatten(doc.RootElement, "", result);
        return result;
    }

    /// <summary>Standalone provider with every shipped language; unknown languages fall back to English.</summary>
    public static DefaultI18nProvider CreateProvider(string language)
    {
        var provider = new DefaultI18nProvider(FallbackLanguage);
        foreach (var lang in Languages)
            provider.SetStringsForLanguage(lang, GetStrings(lang));
        provider.SetLanguage(Languages.Contains(language) ? language : FallbackLanguage);
        return provider;
    }

    private static void Flatten(JsonElement node, string prefix, Dictionary<string, string> result)
    {
        foreach (var prop in node.EnumerateObject())
        {
            var key = prefix.Length == 0 ? prop.Name : prefix + "." + prop.Name;
            if (prop.Value.ValueKind == JsonValueKind.Object) Flatten(prop.Value, key, result);
            else if (prop.Value.ValueKind == JsonValueKind.String) result[key] = prop.Value.GetString() ?? "";
        }
    }
}

/// <summary>Annotator i18n keys (ui.voc_annotator.*).</summary>
public static class AnnotatorI18nKeys
{
    private const string P = "ui.voc_annotator.";
    public const string WindowTitle = P + "window_title";
    public const string OpenImagesDir = P + "open_images_dir";
    public const string SetSaveDir = P + "set_save_dir";
    public const string PrevImage = P + "prev_image";
    public const string NextImage = P + "next_image";
    public const string NextUnlabeled = P + "next_unlabeled";
    public const string DrawMode = P + "draw_mode";
    public const string DeleteBox = P + "delete_box";
    public const string DuplicateBox = P + "duplicate_box";
    public const string CopyPrevious = P + "copy_previous";
    public const string Undo = P + "undo";
    public const string Redo = P + "redo";
    public const string Save = P + "save";
    public const string ClearBoxes = P + "clear_boxes";
    public const string ResetAnnotation = P + "reset_annotation";
    public const string AutoLabel = P + "auto_label";
    public const string AutoLabelAll = P + "auto_label_all";
    public const string CancelTask = P + "cancel_task";
    public const string ZoomFit = P + "zoom_fit";
    public const string ZoomActual = P + "zoom_actual";
    public const string ZoomIn = P + "zoom_in";
    public const string ZoomOut = P + "zoom_out";
    public const string ToggleLabels = P + "toggle_labels";
    public const string Settings = P + "settings";
    public const string Help = P + "help";
    public const string Images = P + "images";
    public const string FilterAll = P + "filter_all";
    public const string FilterLabeled = P + "filter_labeled";
    public const string FilterUnlabeled = P + "filter_unlabeled";
    public const string FilterUnreviewed = P + "filter_unreviewed";
    public const string SearchPlaceholder = P + "search_placeholder";
    public const string ProgressFormat = P + "progress_format";
    public const string ProgressFormatUnreviewed = P + "progress_format_unreviewed";
    public const string Classes = P + "classes";
    public const string ClassAdd = P + "class_add";
    public const string ClassRename = P + "class_rename";
    public const string ClassDelete = P + "class_delete";
    public const string ClassColor = P + "class_color";
    public const string ClassUp = P + "class_up";
    public const string ClassDown = P + "class_down";
    public const string CurrentClass = P + "current_class";
    public const string Boxes = P + "boxes";
    public const string BoxClass = P + "box_class";
    public const string BoxDifficult = P + "box_difficult";
    public const string NoImage = P + "no_image";
    public const string StatusIndex = P + "status_index";
    public const string StatusSize = P + "status_size";
    public const string StatusZoom = P + "status_zoom";
    public const string StatusCursor = P + "status_cursor";
    public const string StatusBoxes = P + "status_boxes";
    public const string StatusDirty = P + "status_dirty";
    public const string StatusSaved = P + "status_saved";
    public const string StatusUnreviewed = P + "status_unreviewed";
    public const string StatusClassesAdded = P + "status_classes_added";
    public const string MenuDelete = P + "menu_delete";
    public const string MenuDuplicate = P + "menu_duplicate";
    public const string MenuDifficult = P + "menu_difficult";
    public const string MenuSetClass = P + "menu_set_class";
    public const string SaveNeedDir = P + "save_need_dir";
    public const string SaveFailed = P + "save_failed";
    public const string LoadFailed = P + "load_failed";
    public const string ConfirmUnsaved = P + "confirm_unsaved";
    public const string ConfirmClear = P + "confirm_clear";
    public const string ConfirmReset = P + "confirm_reset";
    public const string ClassNamePrompt = P + "class_name_prompt";
    public const string ClassAddTitle = P + "class_add_title";
    public const string ClassRenameTitle = P + "class_rename_title";
    public const string ClassExists = P + "class_exists";
    public const string ClassInvalid = P + "class_invalid";
    public const string ConfirmDeleteClass = P + "confirm_delete_class";
    public const string ClassRenamed = P + "class_renamed";
    public const string ClassDeleted = P + "class_deleted";
    public const string ClassOperationFailed = P + "class_operation_failed";
    public const string NoProject = P + "no_project";
    public const string NoPrevious = P + "no_previous";
    public const string CopiedPrevious = P + "copied_previous";
    public const string AutoLabelNoModel = P + "auto_label_no_model";
    public const string AutoLabelModelMissing = P + "auto_label_model_missing";
    public const string AutoLabelModelClasses = P + "auto_label_model_classes";
    public const string AutoLabelDone = P + "auto_label_done";
    public const string AutoLabelAllDone = P + "auto_label_all_done";
    public const string AutoLabelRunning = P + "auto_label_running";
    public const string AutoLabelFailed = P + "auto_label_failed";
    public const string AutoLabelDropped = P + "auto_label_dropped";
    public const string Cancelled = P + "cancelled";
    public const string Scanning = P + "scanning";
    public const string ErrorTitle = P + "error_title";
    public const string WarningTitle = P + "warning_title";
    public const string ConfirmTitle = P + "confirm_title";
    public const string Ok = P + "ok";
    public const string Cancel = P + "cancel";
    public const string HelpTitle = P + "help_title";
    public const string HelpText = P + "help_text";
    public const string SettingsTitle = P + "settings_title";
    public const string SectionEditing = P + "section_editing";
    public const string SectionDisplay = P + "section_display";
    public const string SectionFiles = P + "section_files";
    public const string SectionAi = P + "section_ai";
    public const string SettingAutoSave = P + "setting_auto_save";
    public const string SettingCopyPrevious = P + "setting_copy_previous";
    public const string SettingMinBoxSize = P + "setting_min_box_size";
    public const string SettingShowLabels = P + "setting_show_labels";
    public const string SettingShowCrosshair = P + "setting_show_crosshair";
    public const string SettingFillOpacity = P + "setting_fill_opacity";
    public const string SettingLineWidth = P + "setting_line_width";
    public const string SettingFitOnOpen = P + "setting_fit_on_open";
    public const string SettingImageSort = P + "setting_image_sort";
    public const string SortName = P + "sort_name";
    public const string SortModified = P + "sort_modified";
    public const string SettingWriteVoc = P + "setting_write_voc";
    public const string SettingWriteYolo = P + "setting_write_yolo";
    public const string SettingModelPath = P + "setting_model_path";
    public const string SettingModelHint = P + "setting_model_hint";
    public const string SettingBrowse = P + "setting_browse";
    public const string SettingConfidence = P + "setting_confidence";
    public const string SettingIou = P + "setting_iou";
    public const string SettingMode = P + "setting_mode";
    public const string ModeMerge = P + "mode_merge";
    public const string ModeReplace = P + "mode_replace";
    public const string ModeEmptyOnly = P + "mode_empty_only";
    public const string SettingAddClasses = P + "setting_add_classes";
    public const string SettingAutoLabelOnOpen = P + "setting_auto_label_on_open";
    public const string OnnxFilter = P + "onnx_filter";
}
