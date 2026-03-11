using System.Text.Json;

namespace DotCore.VocAnnotator;

/// <summary>
/// Unified annotation IO: JSON shapes (rectangle, polygon, ellipse, circle) and VOC XML export.
/// Logic 1:1 with pycore pyutils voc_annotator annotation_io.
/// </summary>
public static class AnnotationIo
{
    public const string ShapeTypeRectangle = "rectangle";
    public const string ShapeTypePolygon = "polygon";
    public const string ShapeTypeEllipse = "ellipse";
    public const string ShapeTypeCircle = "circle";

    /// <summary>Shape dict: shape_type, label, points (list of [x,y]), difficult (0/1).</summary>
    public static (int XMin, int YMin, int XMax, int YMax)? ShapeToBbox(JsonElement shape)
    {
        var pts = GetPoints(shape);
        if (pts.Count < 2) return null;
        var st = shape.TryGetProperty("shape_type", out var typeEl) ? typeEl.GetString() : null;
        if (st == ShapeTypeRectangle && pts.Count >= 2)
        {
            var x1 = pts[0].X; var y1 = pts[0].Y; var x2 = pts[1].X; var y2 = pts[1].Y;
            return ((int)Math.Min(x1, x2), (int)Math.Min(y1, y2), (int)Math.Max(x1, x2), (int)Math.Max(y1, y2));
        }
        double minX = pts[0].X, minY = pts[0].Y, maxX = pts[0].X, maxY = pts[0].Y;
        for (var i = 1; i < pts.Count; i++)
        {
            minX = Math.Min(minX, pts[i].X); minY = Math.Min(minY, pts[i].Y);
            maxX = Math.Max(maxX, pts[i].X); maxY = Math.Max(maxY, pts[i].Y);
        }
        return ((int)minX, (int)minY, (int)maxX, (int)maxY);
    }

    private static List<(double X, double Y)> GetPoints(JsonElement shape)
    {
        var list = new List<(double, double)>();
        if (!shape.TryGetProperty("points", out var pts) || pts.ValueKind != JsonValueKind.Array)
            return list;
        foreach (var p in pts.EnumerateArray())
        {
            if (p.ValueKind != JsonValueKind.Array) continue;
            var arr = p.EnumerateArray().ToList();
            if (arr.Count >= 2 && arr[0].TryGetDouble(out var x) && arr[1].TryGetDouble(out var y))
                list.Add((x, y));
        }
        return list;
    }

    public static IReadOnlyList<VocIo.VocBox> ShapesToBoxes(IReadOnlyList<JsonElement> shapes)
    {
        var out_ = new List<VocIo.VocBox>();
        foreach (var s in shapes)
        {
            var bbox = ShapeToBbox(s);
            if (bbox == null) continue;
            var (xmin, ymin, xmax, ymax) = bbox.Value;
            var label = s.TryGetProperty("label", out var l) ? l.GetString()?.Trim() ?? "" : "";
            var difficult = s.TryGetProperty("difficult", out var d) && d.TryGetInt32(out var di) ? di : 0;
            out_.Add(new VocIo.VocBox(label, xmin, ymin, xmax, ymax, difficult));
        }
        return out_;
    }

    public static IReadOnlyList<Dictionary<string, object>> BoxesToShapes(IReadOnlyList<VocIo.VocBox> boxes)
    {
        return boxes.Select(b => new Dictionary<string, object>
        {
            ["shape_type"] = ShapeTypeRectangle,
            ["label"] = b.ClassName,
            ["points"] = new[] { new[] { b.XMin, b.YMin }, new[] { b.XMax, b.YMax } },
            ["difficult"] = b.Difficult
        }).ToList<Dictionary<string, object>>();
    }

    private static string JsonPathForImage(string imagePath, string saveDir)
    {
        var baseName = Path.GetFileNameWithoutExtension(imagePath);
        return Path.Combine(saveDir, baseName + ".json");
    }

    private static string XmlPathForImage(string imagePath, string saveDir)
    {
        var baseName = Path.GetFileNameWithoutExtension(imagePath);
        return Path.Combine(saveDir, baseName + ".xml");
    }

    /// <summary>Load shapes for one image: prefer JSON; fallback to VOC XML (rectangles only).</summary>
    public static IReadOnlyList<Dictionary<string, object>> LoadAnnotations(string imagePath, string saveDir)
    {
        var jsonPath = JsonPathForImage(imagePath, saveDir);
        if (File.Exists(jsonPath))
        {
            try
            {
                var json = File.ReadAllText(jsonPath);
                var doc = JsonDocument.Parse(json);
                if (doc.RootElement.TryGetProperty("shapes", out var shapesEl) && shapesEl.ValueKind == JsonValueKind.Array)
                {
                    var list = new List<Dictionary<string, object>>();
                    foreach (var s in shapesEl.EnumerateArray())
                        list.Add(JsonElementToShapeDict(s));
                    return list;
                }
            }
            catch { /* ignore */ }
        }
        var boxes = VocIo.ReadBoxesFromVoc(XmlPathForImage(imagePath, saveDir));
        return BoxesToShapes(boxes).Select(d => d).ToList();
    }

    /// <summary>Get image size from our annotation JSON when present (for batch export without loading image). Returns null if no JSON or no imageSize.</summary>
    public static (int W, int H)? TryGetImageSizeFromAnnotationFile(string imagePath, string saveDir)
    {
        var jsonPath = JsonPathForImage(imagePath, saveDir);
        if (!File.Exists(jsonPath)) return null;
        try
        {
            var json = File.ReadAllText(jsonPath);
            var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("imageSize", out var arr) || arr.ValueKind != JsonValueKind.Array)
                return null;
            var list = arr.EnumerateArray().ToList();
            if (list.Count >= 2 && list[0].TryGetInt32(out var w) && list[1].TryGetInt32(out var h) && w > 0 && h > 0)
                return (w, h);
        }
        catch { /* ignore */ }
        return null;
    }

    private static Dictionary<string, object> JsonElementToShapeDict(JsonElement s)
    {
        var d = new Dictionary<string, object>();
        if (s.TryGetProperty("shape_type", out var v)) d["shape_type"] = v.GetString() ?? "";
        if (s.TryGetProperty("label", out var l)) d["label"] = l.GetString() ?? "";
        if (s.TryGetProperty("difficult", out var df)) d["difficult"] = df.TryGetInt32(out var di) ? di : 0;
        if (s.TryGetProperty("points", out var pts) && pts.ValueKind == JsonValueKind.Array)
        {
            var arr = new List<double[]>();
            foreach (var p in pts.EnumerateArray())
                if (p.ValueKind == JsonValueKind.Array)
                {
                    var xy = p.EnumerateArray().Select(e => e.GetDouble()).ToArray();
                    if (xy.Length >= 2) arr.Add(xy);
                }
            d["points"] = arr;
        }
        return d;
    }

    /// <summary>Save shapes to JSON; if writeVoc, also write VOC XML from rectangle shapes.</summary>
    public static void SaveAnnotations(string imagePath, string saveDir, (int W, int H) imageSize, IReadOnlyList<Dictionary<string, object>> shapes, bool writeVoc = true)
    {
        var baseName = Path.GetFileNameWithoutExtension(imagePath);
        var jsonPath = Path.Combine(saveDir, baseName + ".json");
        var data = new Dictionary<string, object>
        {
            ["imagePath"] = Path.GetFileName(imagePath),
            ["imageSize"] = new[] { imageSize.W, imageSize.H },
            ["shapes"] = shapes.Select(s => s).ToList()
        };
        Directory.CreateDirectory(saveDir);
        File.WriteAllText(jsonPath, JsonSerializer.Serialize(data, new JsonSerializerOptions { WriteIndented = true }));

        if (writeVoc)
        {
            var boxes = new List<VocIo.VocBox>();
            foreach (var s in shapes)
            {
                var bbox = ShapeDictToBbox(s);
                if (bbox == null) continue;
                var (xmin, ymin, xmax, ymax) = bbox.Value;
                var label = s.TryGetValue("label", out var lv) ? lv?.ToString()?.Trim() ?? "" : "";
                var difficult = s.TryGetValue("difficult", out var dv) && dv is int dvi ? dvi : 0;
                boxes.Add(new VocIo.VocBox(label, xmin, ymin, xmax, ymax, difficult));
            }
            VocIo.WriteVocXml(Path.Combine(saveDir, baseName + ".xml"), imagePath, (imageSize.W, imageSize.H), boxes);
        }
    }

    /// <summary>Bbox from shape dict (points, label, difficult).</summary>
    private static (int XMin, int YMin, int XMax, int YMax)? ShapeDictToBbox(Dictionary<string, object> shape)
    {
        if (!shape.TryGetValue("points", out var ptsObj)) return null;
        var pts = new List<(double X, double Y)>();
        if (ptsObj is System.Collections.IEnumerable en)
        {
            foreach (var p in en)
            {
                if (p is double[] arr && arr.Length >= 2)
                    pts.Add((arr[0], arr[1]));
            }
        }
        if (pts.Count < 2) return null;
        double minX = pts[0].X, minY = pts[0].Y, maxX = pts[0].X, maxY = pts[0].Y;
        for (var i = 1; i < pts.Count; i++)
        {
            minX = Math.Min(minX, pts[i].X); minY = Math.Min(minY, pts[i].Y);
            maxX = Math.Max(maxX, pts[i].X); maxY = Math.Max(maxY, pts[i].Y);
        }
        return ((int)minX, (int)minY, (int)maxX, (int)maxY);
    }

    /// <summary>Write one YOLO detection .txt file (Ultralytics format: class x_center y_center width height normalized [0,1]). Skips difficult and label not in classes. Returns line count.</summary>
    public static int ExportYoloDetectionTxt(string txtPath, (int W, int H) imageSize, IReadOnlyList<Dictionary<string, object>> shapes, IReadOnlyList<string> classes)
    {
        var (w, h) = imageSize;
        if (w <= 0 || h <= 0 || classes == null || classes.Count == 0) return 0;
        var lines = new List<string>();
        double dw = 1.0 / w, dh = 1.0 / h;
        foreach (var s in shapes)
        {
            if (s.TryGetValue("difficult", out var dv) && dv is int dvi && dvi == 1) continue;
            var label = (s.TryGetValue("label", out var lv) ? lv?.ToString() : null)?.Trim() ?? "";
            int idx = -1;
            for (int i = 0; i < classes.Count; i++)
                if (string.Equals(classes[i], label, StringComparison.Ordinal)) { idx = i; break; }
            if (idx < 0) continue;
            var bbox = ShapeDictToBbox(s);
            if (bbox == null) continue;
            var (xmin, ymin, xmax, ymax) = bbox.Value;
            double xc = (xmin + xmax) / 2.0, yc = (ymin + ymax) / 2.0;
            double bw = xmax - xmin, bh = ymax - ymin;
            lines.Add(FormattableString.Invariant($"{idx} {xc * dw:F6} {yc * dh:F6} {bw * dw:F6} {bh * dh:F6}"));
        }
        if (lines.Count == 0) return 0;
        var dir = Path.GetDirectoryName(txtPath);
        if (!string.IsNullOrEmpty(dir))
            Directory.CreateDirectory(dir);
        File.WriteAllText(txtPath, string.Join("\n", lines) + "\n");
        return lines.Count;
    }
}
