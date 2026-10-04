using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Xml.Linq;

namespace DotCore.VocAnnotator;

/// <summary>
/// Annotation files of one image: JSON shapes (primary, labelme-style schema shared with Python), Pascal VOC XML and YOLO txt (derived).
/// Rectangles are edited natively; polygon / ellipse / circle shapes from Python files load as their bounding box.
/// Logic 1:1 with pycore pyutils voc_annotator annotation_io (file names, JSON keys, VOC export, YOLO line format).
/// </summary>
public static class AnnotationIo
{
    public const string ShapeTypeRectangle = "rectangle";
    public const string ShapeTypePolygon = "polygon";
    public const string ShapeTypeEllipse = "ellipse";
    public const string ShapeTypeCircle = "circle";
    public const string JsonExtension = ".json";
    public const string XmlExtension = ".xml";
    public const string YoloTxtExtension = ".txt";

    private const string KeyImagePath = "imagePath";
    private const string KeyImageSize = "imageSize";
    private const string KeyShapes = "shapes";
    private const string KeyShapeType = "shape_type";
    private const string KeyLabel = "label";
    private const string KeyPoints = "points";
    private const string KeyDifficult = "difficult";
    private const string VocRoot = "annotation";
    private const string VocObject = "object";
    private const string VocName = "name";
    private const int CoordinateDecimals = 2;

    private static readonly JsonSerializerOptions WriteOptions = new() { WriteIndented = true };

    public static readonly IReadOnlySet<string> ImageExtensions =
        new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".jpg", ".jpeg", ".png", ".bmp", ".gif", ".tif", ".tiff", ".webp" };

    public static bool IsImageFile(string path) => ImageExtensions.Contains(Path.GetExtension(path));

    /// <summary>Image files directly under dir, ordered by file name (ordinal).</summary>
    public static IReadOnlyList<string> ListImages(string? dir)
    {
        if (string.IsNullOrWhiteSpace(dir) || !Directory.Exists(dir)) return Array.Empty<string>();
        try
        {
            return Directory.EnumerateFiles(dir).Where(IsImageFile).OrderBy(Path.GetFileName, StringComparer.Ordinal).ToList();
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            return Array.Empty<string>();
        }
    }

    public static string JsonPath(string imagePath, string annotationDir) =>
        Path.Combine(annotationDir, Path.GetFileNameWithoutExtension(imagePath) + JsonExtension);

    public static string XmlPath(string imagePath, string annotationDir) =>
        Path.Combine(annotationDir, Path.GetFileNameWithoutExtension(imagePath) + XmlExtension);

    public static string YoloTxtPath(string imagePath, string labelsDir) =>
        Path.Combine(labelsDir, Path.GetFileNameWithoutExtension(imagePath) + YoloTxtExtension);

    /// <summary>True for a JSON shapes document or a VOC annotation XML (not for other JSON/XML such as project config).</summary>
    public static bool IsAnnotationFile(string path) => Path.GetExtension(path).ToLowerInvariant() switch
    {
        JsonExtension => TryReadShapesDocument(path) != null,
        XmlExtension => TryLoadVoc(path) != null,
        _ => false,
    };

    /// <summary>True when the image has a JSON or VOC annotation (an empty one marks a reviewed image without objects).</summary>
    public static bool HasAnnotation(string imagePath, string annotationDir) =>
        File.Exists(JsonPath(imagePath, annotationDir)) || File.Exists(XmlPath(imagePath, annotationDir));

    /// <summary>Annotation of one image: JSON first, else VOC XML; null when neither exists. Size falls back to the image header.</summary>
    public static ImageAnnotation? Load(string imagePath, string annotationDir)
    {
        var json = JsonPath(imagePath, annotationDir);
        if (File.Exists(json) && TryLoadJson(imagePath, json) is { } fromJson)
            return fromJson;
        var xml = XmlPath(imagePath, annotationDir);
        if (!File.Exists(xml)) return null;
        var size = VocIo.ReadImageSize(xml) ?? ImageHeaderReader.ReadSize(imagePath) ?? (0, 0);
        var boxes = VocIo.ReadBoxesFromVoc(xml).Select(b => new AnnotationBox(b.ClassName, b.XMin, b.YMin, b.XMax, b.YMax, b.Difficult != 0));
        return new ImageAnnotation(imagePath, size.Width, size.Height, boxes);
    }

    /// <summary>Write the JSON annotation (always) plus VOC XML and YOLO txt per options.</summary>
    public static void Save(ImageAnnotation annotation, string annotationDir, AnnotationSaveOptions? options = null)
    {
        options ??= new AnnotationSaveOptions();
        Directory.CreateDirectory(annotationDir);
        var shapes = new JsonArray();
        foreach (var b in annotation.Boxes)
        {
            shapes.Add(new JsonObject
            {
                [KeyShapeType] = ShapeTypeRectangle,
                [KeyLabel] = b.Label,
                [KeyPoints] = new JsonArray(
                    new JsonArray(Round(b.XMin), Round(b.YMin)),
                    new JsonArray(Round(b.XMax), Round(b.YMax))),
                [KeyDifficult] = b.Difficult ? 1 : 0,
            });
        }
        var root = new JsonObject
        {
            [KeyImagePath] = Path.GetFileName(annotation.ImagePath),
            [KeyImageSize] = new JsonArray(annotation.Width, annotation.Height),
            [KeyShapes] = shapes,
        };
        File.WriteAllText(JsonPath(annotation.ImagePath, annotationDir), root.ToJsonString(WriteOptions));

        if (options.WriteVoc)
        {
            var vocBoxes = annotation.Boxes.Select(b => b.RoundToPixels())
                .Select(b => new VocIo.VocBox(b.Label, (int)b.XMin, (int)b.YMin, (int)b.XMax, (int)b.YMax, b.Difficult ? 1 : 0))
                .ToList();
            VocIo.WriteVocXml(XmlPath(annotation.ImagePath, annotationDir), annotation.ImagePath, (annotation.Width, annotation.Height), vocBoxes);
        }

        if (options.WriteYoloTxt && options.Classes is { Count: > 0 } classes)
        {
            var labelsDir = string.IsNullOrWhiteSpace(options.YoloLabelsDir) ? annotationDir : options.YoloLabelsDir;
            Directory.CreateDirectory(labelsDir);
            var lines = FormatYoloLines(annotation, classes);
            File.WriteAllText(YoloTxtPath(annotation.ImagePath, labelsDir), lines.Count == 0 ? "" : string.Join("\n", lines) + "\n");
        }
    }

    /// <summary>Remove the JSON and VOC files of the image (back to unlabeled).</summary>
    public static void Delete(string imagePath, string annotationDir)
    {
        foreach (var path in new[] { JsonPath(imagePath, annotationDir), XmlPath(imagePath, annotationDir) })
            if (File.Exists(path)) File.Delete(path);
    }

    /// <summary>
    /// Ultralytics detection lines: "class xc yc w h" normalized to [0,1]. Boxes whose label is not in classes are skipped,
    /// difficult boxes too when skipDifficult.
    /// </summary>
    public static IReadOnlyList<string> FormatYoloLines(ImageAnnotation annotation, IReadOnlyList<string> classes, bool skipDifficult = true)
    {
        var lines = new List<string>();
        if (annotation.Width <= 0 || annotation.Height <= 0) return lines;
        double dw = 1.0 / annotation.Width, dh = 1.0 / annotation.Height;
        foreach (var raw in annotation.Boxes)
        {
            if (skipDifficult && raw.Difficult) continue;
            int idx = IndexOf(classes, raw.Label);
            if (idx < 0) continue;
            var b = raw.ClampTo(annotation.Width, annotation.Height);
            if (b.Width <= 0 || b.Height <= 0) continue;
            double xc = (b.XMin + b.XMax) / 2.0, yc = (b.YMin + b.YMax) / 2.0;
            lines.Add(FormattableString.Invariant($"{idx} {xc * dw:F6} {yc * dh:F6} {b.Width * dw:F6} {b.Height * dh:F6}"));
        }
        return lines;
    }

    /// <summary>Boxes per label over every annotation under dir (JSON, or VOC when no JSON sibling).</summary>
    public static Dictionary<string, int> CountLabels(string dir, bool recursive)
    {
        var counts = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var (_, labels) in EnumerateAnnotationLabels(dir, recursive))
            foreach (var l in labels)
                counts[l] = counts.TryGetValue(l, out var n) ? n + 1 : 1;
        return counts;
    }

    /// <summary>
    /// Rename (newLabel set) or remove (newLabel null) every box with oldLabel in the JSON and VOC files under dir.
    /// Other JSON content is preserved. Returns the number of boxes changed (JSON boxes, VOC-only files counted separately).
    /// </summary>
    public static int ReplaceLabel(string dir, string oldLabel, string? newLabel, bool recursive)
    {
        if (string.IsNullOrWhiteSpace(dir) || !Directory.Exists(dir)) return 0;
        int changed = 0;
        var option = recursive ? SearchOption.AllDirectories : SearchOption.TopDirectoryOnly;
        foreach (var json in SafeEnumerate(dir, "*" + JsonExtension, option))
        {
            if (TryReadShapesDocument(json) is not { } root || root[KeyShapes] is not JsonArray shapes) continue;
            int fileChanged = 0;
            for (int i = shapes.Count - 1; i >= 0; i--)
            {
                if (shapes[i] is not JsonObject shape || (string?)shape[KeyLabel] != oldLabel) continue;
                if (newLabel == null) shapes.RemoveAt(i);
                else shape[KeyLabel] = newLabel;
                fileChanged++;
            }
            if (fileChanged == 0) continue;
            File.WriteAllText(json, root.ToJsonString(WriteOptions));
            changed += fileChanged;
        }
        foreach (var xml in SafeEnumerate(dir, "*" + XmlExtension, option))
        {
            var doc = TryLoadVoc(xml);
            if (doc?.Root == null) continue;
            var hit = doc.Root.Elements(VocObject).Where(o => o.Element(VocName)?.Value.Trim() == oldLabel).ToList();
            if (hit.Count == 0) continue;
            foreach (var o in hit)
            {
                if (newLabel == null) o.Remove();
                else o.Element(VocName)!.Value = newLabel;
            }
            doc.Save(xml);
            if (!File.Exists(Path.ChangeExtension(xml, JsonExtension))) changed += hit.Count;
        }
        return changed;
    }

    private static IEnumerable<(string File, IReadOnlyList<string> Labels)> EnumerateAnnotationLabels(string dir, bool recursive)
    {
        if (string.IsNullOrWhiteSpace(dir) || !Directory.Exists(dir)) yield break;
        var option = recursive ? SearchOption.AllDirectories : SearchOption.TopDirectoryOnly;
        foreach (var json in SafeEnumerate(dir, "*" + JsonExtension, option))
        {
            if (TryReadShapesDocument(json)?[KeyShapes] is not JsonArray shapes) continue;
            yield return (json, shapes.OfType<JsonObject>().Select(s => ((string?)s[KeyLabel] ?? "").Trim()).ToList());
        }
        foreach (var xml in SafeEnumerate(dir, "*" + XmlExtension, option))
        {
            if (File.Exists(Path.ChangeExtension(xml, JsonExtension))) continue;
            var root = TryLoadVoc(xml)?.Root;
            if (root == null) continue;
            yield return (xml, root.Elements(VocObject).Select(o => o.Element(VocName)?.Value.Trim() ?? "").ToList());
        }
    }

    private static ImageAnnotation? TryLoadJson(string imagePath, string jsonPath)
    {
        if (TryReadShapesDocument(jsonPath) is not { } root) return null;
        int w = 0, h = 0;
        if (root[KeyImageSize] is JsonArray size && size.Count >= 2)
        {
            w = ToInt(size[0]);
            h = ToInt(size[1]);
        }
        if (w <= 0 || h <= 0)
            (w, h) = ImageHeaderReader.ReadSize(imagePath) ?? (0, 0);
        var boxes = new List<AnnotationBox>();
        if (root[KeyShapes] is JsonArray shapes)
        {
            foreach (var node in shapes.OfType<JsonObject>())
            {
                if (ShapeToBox(node) is { } box) boxes.Add(box);
            }
        }
        return new ImageAnnotation(imagePath, w, h, boxes);
    }

    private static AnnotationBox? ShapeToBox(JsonObject shape)
    {
        var points = new List<(double X, double Y)>();
        if (shape[KeyPoints] is JsonArray pts)
        {
            foreach (var p in pts.OfType<JsonArray>())
                if (p.Count >= 2) points.Add((ToDouble(p[0]), ToDouble(p[1])));
        }
        if (points.Count < 2) return null;
        var label = ((string?)shape[KeyLabel] ?? "").Trim();
        var difficult = ToInt(shape[KeyDifficult]) != 0;
        var type = (string?)shape[KeyShapeType];
        if (type == ShapeTypeCircle)
        {
            var (cx, cy) = points[0];
            var r = Math.Sqrt(Math.Pow(points[1].X - cx, 2) + Math.Pow(points[1].Y - cy, 2));
            return new AnnotationBox(label, cx - r, cy - r, cx + r, cy + r, difficult);
        }
        return new AnnotationBox(label, points.Min(p => p.X), points.Min(p => p.Y), points.Max(p => p.X), points.Max(p => p.Y), difficult);
    }

    private static JsonObject? TryReadShapesDocument(string jsonPath)
    {
        try
        {
            return JsonNode.Parse(File.ReadAllText(jsonPath)) is JsonObject obj && obj[KeyShapes] is JsonArray ? obj : null;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException)
        {
            return null;
        }
    }

    private static XDocument? TryLoadVoc(string xmlPath)
    {
        try
        {
            var doc = XDocument.Load(xmlPath);
            return doc.Root?.Name.LocalName == VocRoot ? doc : null;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or System.Xml.XmlException)
        {
            return null;
        }
    }

    private static IEnumerable<string> SafeEnumerate(string dir, string pattern, SearchOption option)
    {
        try
        {
            return Directory.EnumerateFiles(dir, pattern, option).ToList();
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            return Array.Empty<string>();
        }
    }

    private static int IndexOf(IReadOnlyList<string> classes, string label)
    {
        var trimmed = label.Trim();
        for (int i = 0; i < classes.Count; i++)
            if (string.Equals(classes[i], trimmed, StringComparison.Ordinal)) return i;
        return -1;
    }

    private static double Round(double v) => Math.Round(v, CoordinateDecimals);

    private static double ToDouble(JsonNode? node)
    {
        if (node is JsonValue v)
        {
            if (v.TryGetValue<double>(out var d)) return d;
            if (v.TryGetValue<string>(out var s) && double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out d)) return d;
        }
        return 0;
    }

    private static int ToInt(JsonNode? node)
    {
        if (node is JsonValue v)
        {
            if (v.TryGetValue<int>(out var i)) return i;
            if (v.TryGetValue<double>(out var d)) return (int)d;
            if (v.TryGetValue<bool>(out var b)) return b ? 1 : 0;
        }
        return 0;
    }
}
