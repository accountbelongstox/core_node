// PY-REF: pyapps/d3-check/train.py
// PY-REF: pycore/pyutils/ultralytics/training.py
using System.Globalization;
using System.Text.RegularExpressions;

namespace DotCore.YoloTrain;

/// <summary>
/// Ultralytics detection training settings mapped 1:1 to `yolo detect train key=value` arguments.
/// Batch -1 = Ultralytics AutoBatch (CUDA only); Device "cpu", "0", "0,1" or "mps".
/// Python passed the same keys to YOLO(model).train(**kwargs).
/// </summary>
public sealed record YoloTrainParameters
{
    public const string DefaultModel = "yolov8n.pt";
    public const string CacheOff = "false";
    public const string CacheRam = "ram";
    public const string CacheDisk = "disk";
    public const string DeviceCpu = "cpu";
    public const string DeviceMps = "mps";
    public const string OptimizerAuto = "auto";
    public const int AutoBatch = -1;
    public const int ImgszStride = 32;
    public const int MinImgsz = 128;
    public const int MaxImgsz = 4096;

    public static readonly IReadOnlyList<string> Models = new[]
    {
        "yolov8n.pt", "yolov8s.pt", "yolov8m.pt", "yolov8l.pt", "yolov8x.pt",
        "yolo11n.pt", "yolo11s.pt", "yolo11m.pt", "yolo11l.pt", "yolo11x.pt",
    };

    public static readonly IReadOnlyList<string> CacheModes = new[] { CacheOff, CacheRam, CacheDisk };

    public static readonly IReadOnlyList<string> Optimizers = new[] { OptimizerAuto, "SGD", "Adam", "AdamW", "NAdam", "RAdam", "RMSProp" };

    private static readonly Regex ExtraKey = new(@"^[a-z][a-z0-9_]*$", RegexOptions.Compiled);

    public string Model { get; init; } = DefaultModel;
    public int Epochs { get; init; } = 100;
    public int Imgsz { get; init; } = 640;
    public int Batch { get; init; } = 16;
    public string Device { get; init; } = DeviceCpu;
    public int Workers { get; init; } = 4;
    public int Patience { get; init; } = 30;
    public string Cache { get; init; } = CacheOff;
    public bool Amp { get; init; } = true;
    public string Optimizer { get; init; } = OptimizerAuto;
    public double Lr0 { get; init; } = 0.01;
    public int Seed { get; init; }
    public int CloseMosaic { get; init; } = 10;
    public string ExtraArguments { get; init; } = "";

    /// <summary>Imgsz rounded to the model stride and clamped.</summary>
    public static int NormalizeImgsz(int imgsz) =>
        Math.Clamp((int)Math.Round(imgsz / (double)ImgszStride) * ImgszStride, MinImgsz, MaxImgsz);

    /// <summary>Model size letter (n/s/m/l/x) of a stock checkpoint name, 'n' when unknown.</summary>
    public static char ModelScale(string model)
    {
        var stem = Path.GetFileNameWithoutExtension(model ?? "");
        return stem.Length > 0 && "nsmlx".Contains(stem[^1]) ? stem[^1] : 'n';
    }

    /// <summary>Stock checkpoint of the same family (yolov8 / yolo11) with another size letter; custom weights are returned unchanged.</summary>
    public static string WithScale(string model, char scale)
    {
        var name = Path.GetFileName(model ?? "");
        if (!Models.Contains(name)) return model ?? DefaultModel;
        var stem = Path.GetFileNameWithoutExtension(name);
        return stem[..^1] + scale + Path.GetExtension(name);
    }

    /// <summary>key=value tokens from ExtraArguments (invalid tokens are returned in Rejected).</summary>
    public (IReadOnlyList<string> Accepted, IReadOnlyList<string> Rejected) ParseExtraArguments()
    {
        var accepted = new List<string>();
        var rejected = new List<string>();
        foreach (var token in (ExtraArguments ?? "").Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries))
        {
            int eq = token.IndexOf('=');
            if (eq > 0 && eq < token.Length - 1 && ExtraKey.IsMatch(token[..eq])) accepted.Add(token);
            else rejected.Add(token);
        }
        return (accepted, rejected);
    }

    /// <summary>`detect train ...` argument list for the yolo CLI (one argv element per key=value).</summary>
    public IReadOnlyList<string> ToTrainArguments(string dataYamlPath, string projectDir, string runName)
    {
        var args = new List<string>
        {
            "detect", "train",
            Kv("data", dataYamlPath),
            Kv("model", Model),
            Kv("epochs", Epochs),
            Kv("imgsz", NormalizeImgsz(Imgsz)),
            Kv("batch", Batch),
            Kv("device", Device),
            Kv("workers", Workers),
            Kv("patience", Patience),
            Kv("cache", Cache),
            Kv("amp", Amp),
            Kv("optimizer", Optimizer),
            Kv("lr0", Lr0),
            Kv("seed", Seed),
            Kv("close_mosaic", CloseMosaic),
            Kv("project", projectDir),
            Kv("name", runName),
            Kv("exist_ok", false),
        };
        args.AddRange(ParseExtraArguments().Accepted);
        return args;
    }

    /// <summary>Single-line command text for logs.</summary>
    public static string FormatCommand(string exe, IEnumerable<string> args) =>
        exe + " " + string.Join(" ", args.Select(a => a.Contains(' ') ? "\"" + a + "\"" : a));

    private static string Kv(string key, object value) => key + "=" + value switch
    {
        bool b => b ? "True" : "False",
        double d => d.ToString(CultureInfo.InvariantCulture),
        IFormattable f => f.ToString(null, CultureInfo.InvariantCulture),
        _ => value.ToString(),
    };
}
