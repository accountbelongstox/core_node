namespace DotCore.VocAnnotator;

/// <summary>
/// One axis-aligned detection box in image pixels (min corner inclusive, max corner exclusive).
/// Confidence is the model score of a pseudo-label (null for manual boxes).
/// </summary>
public sealed record AnnotationBox(string Label, double XMin, double YMin, double XMax, double YMax, bool Difficult = false, double? Confidence = null)
{
    public double Width => XMax - XMin;

    public double Height => YMax - YMin;

    public double Area => Math.Max(0, Width) * Math.Max(0, Height);

    /// <summary>Box from two arbitrary corners.</summary>
    public static AnnotationBox FromCorners(string label, double x1, double y1, double x2, double y2, bool difficult = false) =>
        new(label, Math.Min(x1, x2), Math.Min(y1, y2), Math.Max(x1, x2), Math.Max(y1, y2), difficult);

    /// <summary>Box clamped into the image [0,width]x[0,height].</summary>
    public AnnotationBox ClampTo(int width, int height) => this with
    {
        XMin = Math.Clamp(XMin, 0, Math.Max(0, width)),
        YMin = Math.Clamp(YMin, 0, Math.Max(0, height)),
        XMax = Math.Clamp(XMax, 0, Math.Max(0, width)),
        YMax = Math.Clamp(YMax, 0, Math.Max(0, height)),
    };

    /// <summary>Corners rounded to whole pixels (VOC stores integers).</summary>
    public AnnotationBox RoundToPixels() => this with
    {
        XMin = Math.Round(XMin), YMin = Math.Round(YMin), XMax = Math.Round(XMax), YMax = Math.Round(YMax),
    };

    public AnnotationBox Offset(double dx, double dy) => this with { XMin = XMin + dx, YMin = YMin + dy, XMax = XMax + dx, YMax = YMax + dy };

    public bool IsValid(double minSize) => Width >= minSize && Height >= minSize;

    public bool Contains(double x, double y) => x >= XMin && x <= XMax && y >= YMin && y <= YMax;

    /// <summary>Intersection over union with another box.</summary>
    public double IoU(AnnotationBox other)
    {
        var ix = Math.Max(0, Math.Min(XMax, other.XMax) - Math.Max(XMin, other.XMin));
        var iy = Math.Max(0, Math.Min(YMax, other.YMax) - Math.Max(YMin, other.YMin));
        var inter = ix * iy;
        var union = Area + other.Area - inter;
        return union <= 0 ? 0 : inter / union;
    }
}

/// <summary>
/// Provenance of an image annotation ("source" in the JSON): "manual", or "model:&lt;run&gt;@&lt;confidence threshold&gt;" for pseudo-labels.
/// Files without provenance are reviewed manual annotations.
/// </summary>
public static class AnnotationSources
{
    public const string Manual = "manual";
    public const string ModelPrefix = "model:";
    private const char ConfidenceSeparator = '@';

    public static string Model(string run, double confidenceThreshold) =>
        ModelPrefix + run + ConfidenceSeparator + confidenceThreshold.ToString("0.###", System.Globalization.CultureInfo.InvariantCulture);

    public static bool IsModel(string? source) => source?.StartsWith(ModelPrefix, StringComparison.Ordinal) == true;
}

/// <summary>
/// Annotation of one image: source path, pixel size and boxes. An empty box list is a reviewed image without objects.
/// Reviewed is false only for model pseudo-labels nobody has confirmed yet (dataset assembly excludes them by default).
/// </summary>
public sealed class ImageAnnotation
{
    public ImageAnnotation(string imagePath, int width, int height, IEnumerable<AnnotationBox>? boxes = null)
    {
        ImagePath = imagePath;
        Width = width;
        Height = height;
        Boxes = boxes?.ToList() ?? new List<AnnotationBox>();
    }

    public string ImagePath { get; }

    public int Width { get; }

    public int Height { get; }

    public List<AnnotationBox> Boxes { get; }

    /// <summary>AnnotationSources.Manual or AnnotationSources.Model(...).</summary>
    public string Source { get; init; } = AnnotationSources.Manual;

    public bool Reviewed { get; init; } = true;
}

/// <summary>What AnnotationIo.Save writes besides the JSON file.</summary>
public sealed record AnnotationSaveOptions(bool WriteVoc = true, bool WriteYoloTxt = false, IReadOnlyList<string>? Classes = null, string? YoloLabelsDir = null);
