// PY-REF: none (DOT-only)
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;

namespace DotCore.YoloTrain;

public enum YoloRunStatus
{
    Running,
    Completed,
    Cancelled,
    Failed,
}

/// <summary>What a run was trained from: SourceKind project (Id = project dir relative to the data root), task_set (Id = task set id) or dataset.</summary>
public sealed record YoloRunSource(string Kind, string Id, string Name)
{
    public const string KindProject = "project";
    public const string KindTaskSet = "task_set";
    public const string KindDataset = "dataset";
}

/// <summary>ONNX export settings (Ultralytics export keys).</summary>
public sealed record YoloExportOptions
{
    public int Imgsz { get; init; } = 640;
    public bool Half { get; init; }
    public bool Dynamic { get; init; }
    public bool Simplify { get; init; } = true;
    public int? Opset { get; init; }
}

/// <summary>Validation metrics from `yolo detect val` (all classes plus per class).</summary>
public sealed record YoloValMetrics(int Images, int Instances, double Precision, double Recall, double MAP50, double MAP50To95,
    IReadOnlyDictionary<string, YoloClassValMetrics> PerClass);

public sealed record YoloClassValMetrics(int Images, int Instances, double Precision, double Recall, double MAP50, double MAP50To95);

/// <summary>One evaluation of a run on real annotated data (not the synthetic val split).</summary>
public sealed record YoloRealEval(DateTime CreatedUtc, IReadOnlyList<string> Sources, string DatasetDir, int Imgsz, YoloValMetrics Metrics);

/// <summary>
/// {run}/run_info.json: source, dataset, classes, parameters, effective imgsz, Ultralytics version, best/final epoch metrics,
/// ONNX export, real-data evaluations and the inference profile copied from the dataset manifest ("inference", design §11).
/// </summary>
public sealed record YoloRunInfo
{
    public const string FileName = "run_info.json";
    public const int CurrentSchema = 1;

    public static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DictionaryKeyPolicy = null,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseLower) },
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    public int Schema { get; init; } = CurrentSchema;
    public string RunName { get; init; } = "";
    public YoloRunStatus Status { get; init; }
    public DateTime CreatedUtc { get; init; }
    public DateTime UpdatedUtc { get; init; }
    public YoloRunSource? Source { get; init; }
    public string? DatasetDir { get; init; }
    public string? DataYaml { get; init; }
    public IReadOnlyList<string> Classes { get; init; } = Array.Empty<string>();
    public YoloTrainParameters? Parameters { get; init; }

    /// <summary>Imgsz Ultralytics trained with (stride-normalized).</summary>
    public int Imgsz { get; init; }

    /// <summary>Absolute model argument the run started from (stock checkpoint or a previous run's best.pt).</summary>
    public string? BaseModel { get; init; }

    /// <summary>Run dir of the base model when fine-tuned from a previous run.</summary>
    public string? StartFromRun { get; init; }

    public string? UltralyticsVersion { get; init; }
    public string? Python { get; init; }
    public int Resumes { get; init; }
    public int EpochsCompleted { get; init; }
    public YoloEpochMetrics? BestEpoch { get; init; }
    public YoloEpochMetrics? FinalEpoch { get; init; }
    public string? Onnx { get; init; }
    public YoloExportOptions? Export { get; init; }
    public IReadOnlyList<YoloRealEval> RealEvals { get; init; } = Array.Empty<YoloRealEval>();

    /// <summary>Dataset manifest "inference" object verbatim (TaskSet SynthesisInferenceInfo shape); null for annotated datasets.</summary>
    public JsonObject? Inference { get; init; }

    public string? Error { get; init; }

    public static string PathFor(string runDir) => Path.Combine(runDir, FileName);

    public static YoloRunInfo? Load(string runDir)
    {
        var path = PathFor(runDir);
        if (!File.Exists(path)) return null;
        try
        {
            return JsonSerializer.Deserialize<YoloRunInfo>(File.ReadAllText(path), JsonOptions);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException or NotSupportedException)
        {
            return null;
        }
    }

    /// <summary>Atomic write (temp file + replace).</summary>
    public void Save(string runDir)
    {
        Directory.CreateDirectory(runDir);
        var path = PathFor(runDir);
        var tmp = path + ".tmp";
        File.WriteAllText(tmp, JsonSerializer.Serialize(this with { UpdatedUtc = DateTime.UtcNow }, JsonOptions));
        File.Move(tmp, path, overwrite: true);
    }

    /// <summary>Metrics from {run}/results.csv: completed epochs, best (fitness) and final row.</summary>
    public YoloRunInfo WithResults(string runDir)
    {
        var rows = YoloResultsCsv.Read(runDir);
        return rows.Count == 0 ? this : this with { EpochsCompleted = rows[^1].Epoch, BestEpoch = YoloResultsCsv.Best(rows), FinalEpoch = rows[^1] };
    }
}
