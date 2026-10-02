// PY-REF: pyapps/d3-check/d3utils/d3u_common/image_annotator_helper.py
using DotCore.Foundations;
using OpenCvSharp;

namespace DotCore.Utils.ImagePreprocess;

/// <summary>
/// In-place drawing helpers on BGR Mats (colors are BGR Scalars). 1:1 Python pycore/pyutils/image_tools/image_annotator.py
/// (ImageAnnotator) plus the generic parts of pyapps/d3-check/d3utils/d3u_common/image_annotator_helper.py
/// (ANNOTATION_COLORS / COLOR_SEQUENCE color table, draw_info_texts, draw_grid_overlay, crosshair and match marker).
/// </summary>
public static class ImageAnnotate
{
    private const HersheyFonts Font = HersheyFonts.HersheySimplex;
    private const double LabelFontScale = 0.6;
    private const int LabelThickness = 2;
    private const int LabelOffsetY = 10;
    private const int LabelPadding = 5;
    private const int TextBackgroundPadding = 5;
    private const int CrosshairHalfLength = 15;
    private const int MatchCenterRadius = 8;
    private const int MatchPolygonThickness = 3;
    private const string LogPrefix = "[ImageAnnotatorHelper]";

    /// <summary>Default palette color (green) when a name is unknown.</summary>
    public static readonly Scalar DefaultColor = new(0, 255, 0);

    /// <summary>Built-in annotation palette (BGR). 1:1 ANNOTATION_COLORS.</summary>
    public static readonly IReadOnlyDictionary<string, Scalar> AnnotationColors = new Dictionary<string, Scalar>(StringComparer.OrdinalIgnoreCase)
    {
        ["green"] = new(0, 255, 0),
        ["red"] = new(0, 0, 255),
        ["blue"] = new(255, 0, 0),
        ["yellow"] = new(0, 255, 255),
        ["cyan"] = new(255, 255, 0),
        ["magenta"] = new(255, 0, 255),
        ["orange"] = new(0, 165, 255),
        ["purple"] = new(128, 0, 255),
        ["pink"] = new(203, 192, 255),
        ["lime"] = new(0, 255, 128),
        ["white"] = new(255, 255, 255),
        ["gray"] = new(128, 128, 128),
        ["dark_gray"] = new(80, 80, 80),
        ["spring_green"] = new(0, 255, 127),
        ["sky_blue"] = new(235, 206, 135),
        ["violet"] = new(211, 0, 148),
        ["gold"] = new(0, 215, 255),
        ["coral"] = new(80, 127, 255),
        ["turquoise"] = new(208, 224, 64),
        ["salmon"] = new(114, 128, 250),
        ["khaki"] = new(140, 230, 240),
        ["lavender"] = new(250, 230, 230),
        ["mint"] = new(170, 255, 195),
        ["peach"] = new(180, 229, 255),
        ["aqua"] = new(212, 255, 127),
        ["rose"] = new(143, 143, 255),
        ["navy"] = new(128, 0, 0),
        ["olive"] = new(0, 128, 128),
        ["teal"] = new(128, 128, 0),
        ["maroon"] = new(0, 0, 128),
        ["indigo"] = new(130, 0, 75),
        ["crimson"] = new(60, 20, 220),
        ["forest_green"] = new(34, 139, 34),
    };

    /// <summary>Auto-assignment order. 1:1 COLOR_SEQUENCE.</summary>
    public static readonly IReadOnlyList<string> ColorSequence = new[]
    {
        "magenta", "yellow", "cyan", "orange", "purple",
        "lime", "pink", "green", "blue", "red",
        "spring_green", "sky_blue", "violet", "gold", "coral",
        "turquoise", "salmon", "khaki", "mint", "peach",
        "aqua", "rose", "navy", "olive", "teal",
        "maroon", "indigo", "crimson", "forest_green", "lavender"
    };

    /// <summary>Default pie chart colors. 1:1 draw_pie_chart default_colors.</summary>
    public static readonly IReadOnlyDictionary<string, Scalar> DefaultPieColors = new Dictionary<string, Scalar>
    {
        ["yellow"] = new(0, 255, 255),
        ["blue"] = new(255, 0, 0),
        ["dark_gold"] = new(0, 140, 180),
        ["green"] = new(0, 255, 0),
        ["black"] = new(50, 50, 50),
        ["other"] = new(200, 200, 200),
    };

    /// <summary>One text line for <see cref="DrawInfoTexts"/>. BackgroundColorName is looked up in the palette (gray fallback).</summary>
    public sealed record InfoText(string Text, string BackgroundColorName = "gray", double? FontScale = null, int Thickness = 2, Scalar? BackgroundColor = null);

    /// <summary>Palette color by name. 1:1 get_annotation_color.</summary>
    public static Scalar GetAnnotationColor(string colorName, Scalar? fallback = null) =>
        colorName != null && AnnotationColors.TryGetValue(colorName, out var c) ? c : fallback ?? DefaultColor;

    /// <summary>Color by index cycling the sequence. 1:1 get_auto_color.</summary>
    public static Scalar GetAutoColor(int index) => GetAnnotationColor(ColorSequence[((index % ColorSequence.Count) + ColorSequence.Count) % ColorSequence.Count]);

    /// <summary>Rectangle with optional label on a filled background above it. 1:1 draw_rectangle.</summary>
    public static void DrawRectangle(Mat image, Point topLeft, Point bottomRight, Scalar? color = null, int thickness = 2, string? label = null, Scalar? labelColor = null)
    {
        var c = color ?? new Scalar(0, 0, 255);
        Cv2.Rectangle(image, topLeft, bottomRight, c, thickness);
        if (string.IsNullOrEmpty(label)) return;
        var size = Cv2.GetTextSize(label, Font, LabelFontScale, LabelThickness, out _);
        var pos = new Point(topLeft.X, topLeft.Y - LabelOffsetY);
        Cv2.Rectangle(image, new Point(pos.X, pos.Y - size.Height - LabelPadding), new Point(pos.X + size.Width, pos.Y + LabelPadding), c, -1);
        Cv2.PutText(image, label, pos, Font, LabelFontScale, labelColor ?? new Scalar(0, 255, 0), LabelThickness);
    }

    /// <summary>Circle (filled when requested). 1:1 draw_circle.</summary>
    public static void DrawCircle(Mat image, Point center, int radius, Scalar? color = null, int thickness = 2, bool filled = false) =>
        Cv2.Circle(image, center, radius, color ?? new Scalar(255, 0, 0), filled ? -1 : thickness);

    /// <summary>Closed polygon outline or fill. 1:1 draw_polygon.</summary>
    public static void DrawPolygon(Mat image, IEnumerable<Point> points, Scalar? color = null, int thickness = 2, bool filled = false)
    {
        var pts = new[] { points.ToArray() };
        var c = color ?? new Scalar(0, 255, 255);
        if (filled) Cv2.FillPoly(image, pts, c);
        else Cv2.Polylines(image, pts, true, c, thickness);
    }

    /// <summary>Polygon from float corners (e.g. a match polygon), truncated to int.</summary>
    public static void DrawPolygon(Mat image, IEnumerable<Point2f> points, Scalar? color = null, int thickness = 2, bool filled = false) =>
        DrawPolygon(image, points.Select(p => new Point((int)p.X, (int)p.Y)), color, thickness, filled);

    /// <summary>Line. 1:1 draw_line.</summary>
    public static void DrawLine(Mat image, Point start, Point end, Scalar? color = null, int thickness = 2) =>
        Cv2.Line(image, start, end, color ?? new Scalar(255, 255, 0), thickness);

    /// <summary>Text at baseline-left position with optional padded background. 1:1 draw_text.</summary>
    public static void DrawText(Mat image, string text, Point position, Scalar? color = null, double fontScale = 0.7, int thickness = 2, Scalar? backgroundColor = null)
    {
        if (backgroundColor.HasValue)
        {
            var size = Cv2.GetTextSize(text, Font, fontScale, thickness, out _);
            Cv2.Rectangle(image,
                new Point(position.X - TextBackgroundPadding, position.Y - size.Height - TextBackgroundPadding),
                new Point(position.X + size.Width + TextBackgroundPadding, position.Y + TextBackgroundPadding),
                backgroundColor.Value, -1);
        }
        Cv2.PutText(image, text, position, Font, fontScale, color ?? new Scalar(255, 255, 255), thickness);
    }

    /// <summary>Paste (or alpha-blend) another image at a top-left position, cropped to bounds. 1:1 draw_image.</summary>
    public static void DrawImage(Mat image, Mat overlay, Point position, double alpha = 1.0)
    {
        int x = position.X, y = position.Y;
        if (x < 0 || y < 0) return;
        int w = Math.Min(overlay.Width, image.Width - x);
        int h = Math.Min(overlay.Height, image.Height - y);
        if (w <= 0 || h <= 0) return;
        using var src = new Mat(overlay, new Rect(0, 0, w, h));
        using var roi = new Mat(image, new Rect(x, y, w, h));
        using var converted = MatchChannels(src, image.Channels());
        if (alpha < 1.0)
        {
            using var blended = new Mat();
            Cv2.AddWeighted(converted, alpha, roi, 1 - alpha, 0, blended);
            blended.CopyTo(roi);
        }
        else
        {
            converted.CopyTo(roi);
        }
    }

    /// <summary>Grid lines inside a rectangle. 1:1 draw_grid.</summary>
    public static void DrawGrid(Mat image, Point topLeft, Point bottomRight, int rows, int cols, Scalar? color = null, int thickness = 1)
    {
        var c = color ?? new Scalar(128, 128, 128);
        double cellWidth = (bottomRight.X - topLeft.X) / (double)cols;
        double cellHeight = (bottomRight.Y - topLeft.Y) / (double)rows;
        for (int i = 0; i <= cols; i++)
        {
            int x = (int)(topLeft.X + i * cellWidth);
            Cv2.Line(image, new Point(x, topLeft.Y), new Point(x, bottomRight.Y), c, thickness);
        }
        for (int i = 0; i <= rows; i++)
        {
            int y = (int)(topLeft.Y + i * cellHeight);
            Cv2.Line(image, new Point(topLeft.X, y), new Point(bottomRight.X, y), c, thickness);
        }
    }

    /// <summary>Grid covering the whole image. 1:1 draw_grid_full.</summary>
    public static void DrawGridFull(Mat image, int rows, int cols, Scalar? color = null, int thickness = 1) =>
        DrawGrid(image, new Point(0, 0), new Point(image.Width, image.Height), rows, cols, color ?? new Scalar(0, 255, 0), thickness);

    /// <summary>Grid overlay by palette color name; full image when a corner is null. 1:1 draw_grid_overlay.</summary>
    public static void DrawGridOverlay(Mat image, int rows, int cols, Point? topLeft = null, Point? bottomRight = null, string gridColor = "gray", int thickness = 1)
    {
        try
        {
            if (topLeft == null || bottomRight == null)
                DrawGridFull(image, rows, cols, GetAnnotationColor(gridColor), thickness);
            else
                DrawGrid(image, topLeft.Value, bottomRight.Value, rows, cols, GetAnnotationColor(gridColor), thickness);
        }
        catch (Exception e)
        {
            ColorPrinter.Red($"{LogPrefix} Error drawing grid overlay: {e.Message}");
        }
    }

    /// <summary>Crosshair centered on a point (white, half length 15, thickness 2 by default). 1:1 draw_match_result crosshair.</summary>
    public static void DrawCrosshair(Mat image, Point center, int halfLength = CrosshairHalfLength, Scalar? color = null, int thickness = 2)
    {
        var c = color ?? new Scalar(255, 255, 255);
        Cv2.Line(image, new Point(center.X - halfLength, center.Y), new Point(center.X + halfLength, center.Y), c, thickness);
        Cv2.Line(image, new Point(center.X, center.Y - halfLength), new Point(center.X, center.Y + halfLength), c, thickness);
    }

    /// <summary>Stacked text lines at x=10 with backgrounds; returns the next y. 1:1 draw_info_texts.</summary>
    public static int DrawInfoTexts(Mat image, IEnumerable<InfoText> items, int startY = 30, int lineHeight = 40, double defaultFontScale = 0.6, Scalar? defaultColor = null)
    {
        int currentY = startY;
        foreach (var item in items)
        {
            var bg = item.BackgroundColor ?? GetAnnotationColor(item.BackgroundColorName, new Scalar(128, 128, 128));
            DrawText(image, item.Text, new Point(10, currentY), defaultColor ?? new Scalar(255, 255, 255), item.FontScale ?? defaultFontScale, item.Thickness, bg);
            currentY += lineHeight;
        }
        return currentY;
    }

    /// <summary>Match marker: polygon, filled center, crosshair, "name (score)" label and coordinate text. 1:1 draw_match_result (without template paste).</summary>
    public static void DrawMatchMarker(Mat image, Point center, string name, double score, IEnumerable<Point2f>? polygon = null, Scalar? color = null)
    {
        var c = color ?? new Scalar(0, 255, 0);
        if (polygon != null) DrawPolygon(image, polygon, c, MatchPolygonThickness);
        DrawCircle(image, center, MatchCenterRadius, c, filled: true);
        DrawCrosshair(image, center);
        DrawText(image, $"{name} ({score:F3})", new Point(center.X + 15, center.Y - 10), new Scalar(255, 255, 255), 0.5, 2, c);
        DrawText(image, $"({center.X}, {center.Y})", new Point(center.X + 20, center.Y + 20), new Scalar(255, 255, 0), 0.5, 1, new Scalar(0, 0, 0));
    }

    /// <summary>Pie chart of label percentages (0..100) drawn clockwise from 0 degrees. 1:1 draw_pie_chart.</summary>
    public static void DrawPieChart(Mat image, Point center, int radius, IEnumerable<KeyValuePair<string, double>> percentages, IReadOnlyDictionary<string, Scalar>? colors = null, Scalar? backgroundColor = null)
    {
        var palette = colors ?? DefaultPieColors;
        Cv2.Circle(image, center, radius, backgroundColor ?? new Scalar(255, 255, 255), -1);
        int startAngle = 0;
        foreach (var (label, percentage) in percentages)
        {
            if (percentage <= 0) continue;
            int angle = (int)(percentage * 3.6);
            var c = palette.TryGetValue(label, out var pc) ? pc : new Scalar(200, 200, 200);
            int endAngle = startAngle + angle;
            Cv2.Ellipse(image, center, new Size(radius, radius), 0, startAngle, endAngle, c, -1);
            startAngle = endAngle;
        }
        Cv2.Circle(image, center, radius, new Scalar(100, 100, 100), 1);
    }

    /// <summary>Save annotated image (non-ASCII path safe). 1:1 save.</summary>
    public static bool Save(Mat image, string outputPath) => ImageConvert.SaveMat(image, outputPath);

    private static Mat MatchChannels(Mat src, int channels)
    {
        if (src.Channels() == channels) return src.Clone();
        return channels switch
        {
            1 => ImageConvert.ToGray(src),
            4 => ImageConvert.ToBgra(src),
            _ => ImageConvert.ToBgr(src)
        };
    }
}
