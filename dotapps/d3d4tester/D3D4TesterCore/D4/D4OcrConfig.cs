using DotCore.Utils.Ocr;

namespace DotApps.d3d4tester.Core.D4;

/// <summary>
/// D4 OCR task -> model key map. 1:1 Python pyapps/d3-check/share/d4_ocr_config.py OCRConfig.TASK_CONFIGS
/// (CnOCR model names map to the shared OcrEngineRegistry model keys).
/// </summary>
public static class D4OcrConfig
{
    public const string TaskMapName = "map_name";
    public const string TaskBrowserLogin = "browser_login";
    public const string TaskQuestText = "quest_text";
    public const string TaskItemName = "item_name";
    public const string TaskDamageNumber = "damage_number";
    public const string TaskHealthValue = "health_value";
    public const string TaskTierInput = "tier_input";
    public const string TaskDocument = "document";
    public const string TaskEnglish = "english";
    public const string TaskTraditional = "traditional";

    public static readonly IReadOnlyDictionary<string, string> TaskToModelKey = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        [TaskMapName] = OcrEngineRegistry.ModelGeneral,
        [TaskBrowserLogin] = OcrEngineRegistry.ModelGeneral,
        [TaskQuestText] = OcrEngineRegistry.ModelGeneral,
        [TaskItemName] = OcrEngineRegistry.ModelGeneral,
        [TaskDamageNumber] = OcrEngineRegistry.ModelNumber,
        [TaskHealthValue] = OcrEngineRegistry.ModelNumber,
        [TaskTierInput] = OcrEngineRegistry.ModelNumber,
        [TaskDocument] = OcrEngineRegistry.ModelDocument,
        [TaskEnglish] = OcrEngineRegistry.ModelGeneralEn,
        [TaskTraditional] = OcrEngineRegistry.ModelGeneralCht,
    };

    private static int _registered;

    /// <summary>Register the D4 task map in the shared OCR registry (idempotent).</summary>
    public static void EnsureRegistered()
    {
        if (Interlocked.Exchange(ref _registered, 1) == 1) return;
        OcrEngineRegistry.Instance.RegisterTasks(TaskToModelKey);
    }

    /// <summary>OCR engine for a D4 task (registers the task map first). 1:1 get_cnocr_engine_for_task.</summary>
    public static IOcrEngine? EngineForTask(string taskName)
    {
        EnsureRegistered();
        return OcrEngineRegistry.Instance.ForTask(taskName);
    }
}
