// PY-REF: pyapps/d3-check/d3utils/ocr_helper.py
namespace DotCore.Utils.Ocr;

/// <summary>
/// Bounding-box helpers for OCR results. Bbox = (MinX, MinY, MaxX, MaxY) in image coordinates.
/// 1:1 Python pyapps/d3-check/d3utils/ocr_helper.py (_position_to_bbox, bbox_center, bbox_first_char_center, bbox_left_center);
/// Union and SortByLine are generic additions for multi-box reading order.
/// </summary>
public static class OcrBbox
{
    public const int DefaultFirstCharCount = 3;
    public const double DefaultLeftXOffset = 2.0;
    public const double DefaultLineTolerance = 0.5;

    /// <summary>Convert a quadrilateral position (list of points) to bbox; null if empty.</summary>
    public static (double MinX, double MinY, double MaxX, double MaxY)? FromPosition(IReadOnlyList<(double X, double Y)>? position)
    {
        if (position == null || position.Count == 0) return null;
        double minX = double.MaxValue, minY = double.MaxValue, maxX = double.MinValue, maxY = double.MinValue;
        foreach (var p in position)
        {
            if (p.X < minX) minX = p.X;
            if (p.Y < minY) minY = p.Y;
            if (p.X > maxX) maxX = p.X;
            if (p.Y > maxY) maxY = p.Y;
        }
        return (minX, minY, maxX, maxY);
    }

    /// <summary>Center (cx, cy) of bbox. 1:1 Python bbox_center.</summary>
    public static (double X, double Y) Center((double MinX, double MinY, double MaxX, double MaxY) bbox)
    {
        return ((bbox.MinX + bbox.MaxX) / 2, (bbox.MinY + bbox.MaxY) / 2);
    }

    /// <summary>Center of the left 1/numChars part of bbox (first character). 1:1 Python bbox_first_char_center.</summary>
    public static (double X, double Y) FirstCharCenter((double MinX, double MinY, double MaxX, double MaxY) bbox, int numChars = DefaultFirstCharCount)
    {
        double w = bbox.MaxX - bbox.MinX;
        double left = bbox.MinX;
        double right = bbox.MinX + w / numChars;
        return ((left + right) / 2, (bbox.MinY + bbox.MaxY) / 2);
    }

    /// <summary>Left edge + offset at 50% height. 1:1 Python bbox_left_center.</summary>
    public static (double X, double Y) LeftCenter((double MinX, double MinY, double MaxX, double MaxY) bbox, double xOffset = DefaultLeftXOffset)
    {
        return (bbox.MinX + xOffset, (bbox.MinY + bbox.MaxY) / 2);
    }

    /// <summary>Smallest bbox containing all given boxes; null if none.</summary>
    public static (double MinX, double MinY, double MaxX, double MaxY)? Union(IEnumerable<(double MinX, double MinY, double MaxX, double MaxY)> boxes)
    {
        (double MinX, double MinY, double MaxX, double MaxY)? acc = null;
        foreach (var b in boxes ?? Array.Empty<(double, double, double, double)>())
        {
            acc = acc == null
                ? b
                : (Math.Min(acc.Value.MinX, b.MinX), Math.Min(acc.Value.MinY, b.MinY), Math.Max(acc.Value.MaxX, b.MaxX), Math.Max(acc.Value.MaxY, b.MaxY));
        }
        return acc;
    }

    /// <summary>
    /// Reading order: group items into lines by vertical center (new line when the center is more than
    /// lineTolerance * line height below the line's first center), lines top to bottom, items left to right.
    /// </summary>
    public static IReadOnlyList<IReadOnlyList<T>> SortByLine<T>(IEnumerable<T> items, Func<T, (double MinX, double MinY, double MaxX, double MaxY)> bboxOf, double lineTolerance = DefaultLineTolerance)
    {
        var lines = new List<IReadOnlyList<T>>();
        if (items == null || bboxOf == null) return lines;
        var ordered = items.Select(i => (Item: i, Box: bboxOf(i))).OrderBy(t => (t.Box.MinY + t.Box.MaxY) / 2).ToList();
        var current = new List<(T Item, (double MinX, double MinY, double MaxX, double MaxY) Box)>();
        double lineCenter = 0, lineHeight = 0;
        foreach (var entry in ordered)
        {
            double cy = (entry.Box.MinY + entry.Box.MaxY) / 2;
            double h = Math.Max(1.0, entry.Box.MaxY - entry.Box.MinY);
            if (current.Count > 0 && cy - lineCenter > lineTolerance * Math.Max(lineHeight, h))
            {
                lines.Add(current.OrderBy(t => t.Box.MinX).Select(t => t.Item).ToList());
                current = new List<(T, (double, double, double, double))>();
            }
            if (current.Count == 0)
            {
                lineCenter = cy;
                lineHeight = h;
            }
            current.Add(entry);
        }
        if (current.Count > 0)
            lines.Add(current.OrderBy(t => t.Box.MinX).Select(t => t.Item).ToList());
        return lines;
    }

    /// <summary>Word boxes in reading order (lines top to bottom, left to right); boxes without position are skipped.</summary>
    public static IReadOnlyList<IReadOnlyList<OcrWordBox>> SortByLine(IEnumerable<OcrWordBox> boxes, double lineTolerance = DefaultLineTolerance)
    {
        var withBox = (boxes ?? Array.Empty<OcrWordBox>()).Where(b => FromPosition(b.Position) != null);
        return SortByLine(withBox, b => FromPosition(b.Position)!.Value, lineTolerance);
    }
}
