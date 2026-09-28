using System.Xml.Linq;

namespace DotCore.VocAnnotator;

/// <summary>
/// Pascal VOC XML read/write (GameAISDK-compatible). One XML per image; bndbox in pixel coords (xmin, ymin, xmax, ymax).
/// Logic 1:1 with pycore pyutils voc_annotator voc_io.
/// </summary>
public static class VocIo
{
    /// <summary>One box: (class_name, xmin, ymin, xmax, ymax, difficult).</summary>
    public sealed record VocBox(string ClassName, int XMin, int YMin, int XMax, int YMax, int Difficult);

    /// <summary>Read VOC XML; return list of boxes. difficult 0/1; bndbox in pixels.</summary>
    public static IReadOnlyList<VocBox> ReadBoxesFromVoc(string xmlPath)
    {
        if (string.IsNullOrWhiteSpace(xmlPath) || !File.Exists(xmlPath))
            return Array.Empty<VocBox>();
        try
        {
            var doc = XDocument.Load(xmlPath);
            var root = doc.Root;
            if (root == null) return Array.Empty<VocBox>();
            var list = new List<VocBox>();
            foreach (var obj in root.Elements("object"))
            {
                var nameEl = obj.Element("name");
                var name = nameEl?.Value?.Trim() ?? "";
                var difficultEl = obj.Element("difficult");
                int difficult = 0;
                if (difficultEl?.Value != null && int.TryParse(difficultEl.Value, out var d))
                    difficult = d;
                var bnd = obj.Element("bndbox");
                if (bnd == null) continue;
                var xminEl = bnd.Element("xmin");
                var yminEl = bnd.Element("ymin");
                var xmaxEl = bnd.Element("xmax");
                var ymaxEl = bnd.Element("ymax");
                if (xminEl?.Value == null || yminEl?.Value == null || xmaxEl?.Value == null || ymaxEl?.Value == null)
                    continue;
                if (!int.TryParse(xminEl.Value, out var xmin) || !int.TryParse(yminEl.Value, out var ymin)
                    || !int.TryParse(xmaxEl.Value, out var xmax) || !int.TryParse(ymaxEl.Value, out var ymax))
                    continue;
                list.Add(new VocBox(name, xmin, ymin, xmax, ymax, difficult));
            }
            return list;
        }
        catch
        {
            return Array.Empty<VocBox>();
        }
    }

    /// <summary>Write one VOC XML file (GameAISDK format). Image size (width, height); boxes from AnnotationIo.VocBox or (class, xmin, ymin, xmax, ymax, difficult).</summary>
    public static void WriteVocXml(string xmlPath, string imagePath, (int Width, int Height) imageSize, IReadOnlyList<VocBox> boxes, int depth = 3)
    {
        var (w, h) = imageSize;
        var folder = Path.GetFileName(Path.GetDirectoryName(imagePath) ?? "");
        var filename = Path.GetFileName(imagePath);
        var pathAbs = Path.GetFullPath(imagePath);

        var root = new XElement("annotation",
            new XElement("folder", folder),
            new XElement("filename", filename),
            new XElement("path", pathAbs),
            new XElement("source", new XElement("database", "Unknown")),
            new XElement("size",
                new XElement("width", w),
                new XElement("height", h),
                new XElement("depth", depth)),
            new XElement("segmented", "0"));

        foreach (var b in boxes)
        {
            root.Add(new XElement("object",
                new XElement("name", b.ClassName),
                new XElement("pose", "Unspecified"),
                new XElement("truncated", "0"),
                new XElement("difficult", b.Difficult),
                new XElement("bndbox",
                    new XElement("xmin", b.XMin),
                    new XElement("ymin", b.YMin),
                    new XElement("xmax", b.XMax),
                    new XElement("ymax", b.YMax))));
        }

        var doc = new XDocument(new XDeclaration("1.0", "utf-8", null), root);
        var dir = Path.GetDirectoryName(xmlPath);
        if (!string.IsNullOrEmpty(dir))
            Directory.CreateDirectory(dir);
        using var writer = System.Xml.XmlWriter.Create(xmlPath, new System.Xml.XmlWriterSettings { Indent = true, OmitXmlDeclaration = false, Encoding = System.Text.Encoding.UTF8 });
        doc.Save(writer);
    }
}
