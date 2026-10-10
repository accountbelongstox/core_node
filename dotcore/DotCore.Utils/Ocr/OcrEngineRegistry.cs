// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/cnocr_engine_registry.py
// PY-REF: dotapps/d3d4tester/reference/py_d3check/share/d4_ocr_config.py
using DotCore.Foundations;

namespace DotCore.Utils.Ocr;

/// <summary>
/// Keyed owner of the OCR engines (general, number, document, ...) plus the app's task -> model key map.
/// Engines are created lazily per model key and cached; access is serialized.
/// 1:1 Python pycore/pyutils/ocr_cluster/cnocr_engine_registry.py (CnOCREngines, _get_engine_for_model_key,
/// _ensure_cnocr_loaded_and_engines_initialized) and dotapps/d3d4tester/reference/py_d3check/d3utils/cnocr_engine_registry.py (get_cnocr_engine_*).
/// PaddleOCRSharp has one multilingual model, so en/cht/naive/document alias the general engine and number is the
/// general engine filtered by cand alphabet (CnOCR profile names have no Paddle equivalent).
/// </summary>
public sealed class OcrEngineRegistry
{
    public const string ModelGeneral = "general";
    public const string ModelNumber = "number";
    public const string ModelDocument = "document";
    public const string ModelNaive = "naive";
    public const string ModelGeneralEn = "general_en";
    public const string ModelGeneralCht = "general_cht";
    public const string NumberCandAlphabet = "0123456789";

    private const string LogTag = "[OCR]";

    /// <summary>Model keys pre-initialized at startup (Python: general, general_en, general_cht).</summary>
    public static readonly IReadOnlyList<string> StartupModelKeys = new[] { ModelGeneral, ModelGeneralEn, ModelGeneralCht };

    private static readonly Lazy<OcrEngineRegistry> LazyInstance = new(() => new OcrEngineRegistry());

    private readonly object _lock = new();
    private readonly Dictionary<string, IOcrEngine?> _enginesByModel = new(StringComparer.Ordinal);
    private readonly Dictionary<string, string> _taskToModel = new(StringComparer.Ordinal);
    private readonly Dictionary<string, string> _modelAliases = new(StringComparer.Ordinal)
    {
        [ModelDocument] = ModelGeneral,
        [ModelNaive] = ModelGeneral,
        [ModelGeneralEn] = ModelGeneral,
        [ModelGeneralCht] = ModelGeneral,
    };
    private readonly HashSet<string> _knownModels = new(StringComparer.Ordinal)
    {
        ModelGeneral, ModelNumber, ModelDocument, ModelNaive, ModelGeneralEn, ModelGeneralCht
    };
    private Func<string, IOcrEngine?> _engineFactory;
    private bool _usingDefaultFactory = true;

    private OcrEngineRegistry()
    {
        _engineFactory = CreateDefaultEngine;
    }

    public static OcrEngineRegistry Instance => LazyInstance.Value;

    /// <summary>Replaces the engine factory (model key -> uninitialized engine). Clears cached engines.</summary>
    public void SetEngineFactory(Func<string, IOcrEngine?> factory)
    {
        ArgumentNullException.ThrowIfNull(factory);
        lock (_lock)
        {
            _engineFactory = factory;
            _usingDefaultFactory = false;
            _enginesByModel.Clear();
        }
    }

    /// <summary>Maps a model key to another model key that shares its engine. Clears the cached alias entry.</summary>
    public void SetModelAlias(string modelKey, string targetModelKey)
    {
        lock (_lock)
        {
            _knownModels.Add(modelKey);
            _knownModels.Add(targetModelKey);
            _modelAliases[modelKey] = targetModelKey;
            _enginesByModel.Remove(modelKey);
        }
    }

    /// <summary>Registers task name -> model key entries (Python share.d4_ocr_config OCRConfig.TASK_CONFIGS).</summary>
    public void RegisterTasks(IReadOnlyDictionary<string, string> taskToModelKey)
    {
        if (taskToModelKey == null) return;
        lock (_lock)
        {
            foreach (var kv in taskToModelKey)
                _taskToModel[kv.Key] = kv.Value;
        }
    }

    /// <summary>Model key for a task; unknown task -> general.</summary>
    public string ResolveModelKey(string taskName)
    {
        lock (_lock)
            return _taskToModel.TryGetValue(taskName ?? "", out var key) ? key : ModelGeneral;
    }

    /// <summary>Load and pre-initialize the startup engines, then print status. 1:1 Python ensure_cnocr_loaded_and_engines_initialized.</summary>
    public bool EnsureLoaded()
    {
        lock (_lock)
        {
            foreach (var modelKey in StartupModelKeys)
            {
                if (GetEngineCore(modelKey) == null)
                    ColorPrinter.Yellow($"{LogTag} Engine {modelKey} not available after init");
            }
            PrintInitStatus();
            return GetEngineCore(ModelGeneral) != null;
        }
    }

    /// <summary>Default engine (same as general).</summary>
    public IOcrEngine? Default() => ForModelKey(ModelGeneral);

    public IOcrEngine? General() => ForModelKey(ModelGeneral);

    public IOcrEngine? Number() => ForModelKey(ModelNumber);

    public IOcrEngine? Document() => ForModelKey(ModelDocument);

    /// <summary>Engine for a model key: general, number, document, ...</summary>
    public IOcrEngine? ForModelKey(string modelKey)
    {
        lock (_lock)
            return GetEngineCore(modelKey);
    }

    /// <summary>Engine for a task name via the registered task map. 1:1 Python get_cnocr_engine_for_task.</summary>
    public IOcrEngine? ForTask(string taskName) => ForModelKey(ResolveModelKey(taskName));

    private IOcrEngine? GetEngineCore(string modelKey)
    {
        var resolveKey = _modelAliases.TryGetValue(modelKey ?? "", out var alias) ? alias : modelKey ?? "";
        if (_enginesByModel.TryGetValue(resolveKey, out var cached) && cached != null)
            return cached;
        if (!_knownModels.Contains(resolveKey))
        {
            ColorPrinter.Yellow($"{LogTag} Unknown model key: {resolveKey}");
            return null;
        }

        IOcrEngine? engine;
        if (resolveKey == ModelNumber && _usingDefaultFactory)
        {
            var general = GetEngineCore(ModelGeneral);
            engine = general == null ? null : new CandAlphabetOcrEngine(general, NumberCandAlphabet);
        }
        else
        {
            try
            {
                engine = _engineFactory(resolveKey);
                if (engine != null && !engine.IsInitialized && !engine.Init())
                    engine = null;
            }
            catch (Exception ex)
            {
                ColorPrinter.Red($"{LogTag} Engine create error for {resolveKey}: {ex.Message}");
                engine = null;
            }
        }

        if (engine == null)
        {
            ColorPrinter.Yellow($"{LogTag} Init failed for model: {resolveKey}");
            return null;
        }
        _enginesByModel[resolveKey] = engine;
        return engine;
    }

    private void PrintInitStatus()
    {
        ColorPrinter.Blue($"{LogTag} --- OCR init ---");
        foreach (var key in StartupModelKeys)
        {
            var resolveKey = _modelAliases.TryGetValue(key, out var alias) ? alias : key;
            if (_enginesByModel.TryGetValue(resolveKey, out var eng) && eng != null)
                ColorPrinter.Blue($"{LogTag}   {key}: engine={eng.GetType().Name} (model={resolveKey})");
            else
                ColorPrinter.Gray($"{LogTag}   {key}: not loaded");
        }
    }

    private static IOcrEngine? CreateDefaultEngine(string modelKey)
    {
        if (!OperatingSystem.IsWindows())
            return null;
        return new PaddleOcrEngine();
    }
}
