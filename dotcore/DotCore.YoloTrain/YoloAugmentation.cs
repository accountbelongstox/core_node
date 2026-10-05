// PY-REF: none (DOT-only)
using System.Globalization;

namespace DotCore.YoloTrain;

/// <summary>
/// Ultralytics augmentation hyper-parameters (train keys of the same name). Null = Ultralytics default
/// (fliplr 0.5, flipud 0, degrees 0, translate 0.1, scale 0.5, shear 0, perspective 0, mosaic 1, mixup 0, hsv 0.015/0.7/0.4, erasing 0.4).
/// </summary>
public sealed record YoloAugmentation
{
    public double? Fliplr { get; init; }
    public double? Flipud { get; init; }
    public double? Degrees { get; init; }
    public double? Translate { get; init; }
    public double? Scale { get; init; }
    public double? Shear { get; init; }
    public double? Perspective { get; init; }
    public double? Mosaic { get; init; }
    public double? Mixup { get; init; }
    public double? HsvH { get; init; }
    public double? HsvS { get; init; }
    public double? HsvV { get; init; }
    public double? Erasing { get; init; }

    public static YoloAugmentation UltralyticsDefaults { get; } = new();

    /// <summary>Ultralytics key names, one per property.</summary>
    public static readonly IReadOnlyList<string> Keys = new[]
    {
        "fliplr", "flipud", "degrees", "translate", "scale", "shear", "perspective", "mosaic", "mixup", "hsv_h", "hsv_s", "hsv_v", "erasing",
    };

    public bool IsDefault => Values().All(v => v.Value == null);

    /// <summary>(key, value) for every hyper-parameter in Keys order; value null = not passed.</summary>
    public IReadOnlyList<(string Key, double? Value)> Values() => new (string, double?)[]
    {
        ("fliplr", Fliplr), ("flipud", Flipud), ("degrees", Degrees), ("translate", Translate), ("scale", Scale),
        ("shear", Shear), ("perspective", Perspective), ("mosaic", Mosaic), ("mixup", Mixup),
        ("hsv_h", HsvH), ("hsv_s", HsvS), ("hsv_v", HsvV), ("erasing", Erasing),
    };

    /// <summary>key=value tokens for the set values.</summary>
    public IReadOnlyList<string> ToArguments() =>
        Values().Where(v => v.Value != null).Select(v => v.Key + "=" + v.Value!.Value.ToString(CultureInfo.InvariantCulture)).ToList();

    /// <summary>Space-separated key=value tokens (config string), "" when all defaults.</summary>
    public string ToTokens() => string.Join(" ", ToArguments());

    /// <summary>Inverse of Values(); unknown keys are ignored, a null value keeps the Ultralytics default.</summary>
    public static YoloAugmentation FromValues(IEnumerable<(string Key, double? Value)> values)
    {
        var map = new Dictionary<string, double?>(StringComparer.Ordinal);
        foreach (var (key, value) in values)
            if (Keys.Contains(key)) map[key] = value;
        double? Get(string key) => map.TryGetValue(key, out var v) ? v : null;
        return new YoloAugmentation
        {
            Fliplr = Get("fliplr"), Flipud = Get("flipud"), Degrees = Get("degrees"), Translate = Get("translate"), Scale = Get("scale"),
            Shear = Get("shear"), Perspective = Get("perspective"), Mosaic = Get("mosaic"), Mixup = Get("mixup"),
            HsvH = Get("hsv_h"), HsvS = Get("hsv_s"), HsvV = Get("hsv_v"), Erasing = Get("erasing"),
        };
    }

    /// <summary>Parses "fliplr=0 scale=0.1" (ToTokens output); malformed tokens and unknown keys are ignored.</summary>
    public static YoloAugmentation Parse(string? tokens) =>
        FromValues((tokens ?? "").Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)
            .Select(t => t.Split('=', 2))
            .Where(p => p.Length == 2 && double.TryParse(p[1], NumberStyles.Float, CultureInfo.InvariantCulture, out _))
            .Select(p => (p[0], (double?)double.Parse(p[1], NumberStyles.Float, CultureInfo.InvariantCulture))));
}
