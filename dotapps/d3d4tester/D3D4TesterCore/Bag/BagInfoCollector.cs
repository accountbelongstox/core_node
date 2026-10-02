// PY-REF: pyapps/d3-check/d3utils/collectors/bag_info_collector.py
using System.Drawing;
using DotCore.Foundations;
using DotCore.TemplateMatcher;
using DotCore.Utils.ImagePreprocess;
using OpenCvSharp;
using CvPoint = OpenCvSharp.Point;

namespace DotApps.d3d4tester.Core.Bag;

/// <summary>Bag crop offset from ui_analysis.bag_offset (standard space values + use_in_calculation flag).</summary>
public sealed record BagOffsetSettings(bool UseInCalculation, int Top, int Left, int Bottom, int Right)
{
    public static readonly BagOffsetSettings None = new(false, 0, 0, 0, 0);
}

/// <summary>
/// Collect bag coordinates (scaled standard region + optional offset), layout and interface buttons from the shared game window image,
/// and write them to <see cref="GameInterfaceData"/>. 1:1 Python pyapps/d3-check/d3utils/collectors/bag_info_collector.py.
/// Fixes Python bug: offsets were scaled with the border formula ((v-border)*s+border), so a zero offset shifted the bag when scale != 1; offsets now scale as v*s.
/// </summary>
public sealed class BagInfoCollector
{
    private const string StandardCoordinatesName = "standard_coordinates";
    private const string ConversionButtonKey = "conversion_button";
    private const string MaterialButtonKey = "material_button";
    private const string StateEnabled = "enabled";
    private const string StateDisabled = "disabled";
    private const int TextLineHeight = 40;
    private const int LegendLineHeight = 35;

    private static readonly Lazy<BagInfoCollector> LazyInstance = new(() => new BagInfoCollector());

    private static readonly Scalar White = new(255, 255, 255);
    private static readonly Scalar Gray = new(128, 128, 128);
    private static readonly Scalar DarkGray = new(64, 64, 64);
    private static readonly Scalar Green = new(0, 255, 0);
    private static readonly Scalar Red = new(0, 0, 255);
    private static readonly Scalar Magenta = new(255, 0, 255);
    private static readonly Scalar Cyan = new(255, 255, 0);
    private static readonly Scalar Orange = new(255, 165, 0);
    private static readonly Scalar InterfaceIndicatorColor = new(255, 128, 0);
    private static readonly Scalar DefaultTemplateColor = new(128, 128, 128);

    private static readonly IReadOnlyDictionary<string, Scalar> TemplateColorMap = new Dictionary<string, Scalar>
    {
        [D3TemplateNames.BagOpenedIndicator] = new(255, 200, 0),
        [D3TemplateNames.KanaiCubeLeftPanelIndicator] = new(128, 0, 128),
        [D3TemplateNames.KanaiRightPageIndicator] = new(0, 128, 255),
        [ConversionButtonKey] = new(0, 255, 0),
        [MaterialButtonKey] = new(255, 0, 255),
    };

    private static readonly IReadOnlyDictionary<string, string> QualityColorNames = new Dictionary<string, string>
    {
        [BagSlotValues.QualityEmpty] = "dark_gray",
        [BagSlotValues.QualityLegendarySet] = "green",
        [BagSlotValues.QualityLegendary] = "orange",
        [BagSlotValues.QualityRare] = "yellow",
        [BagSlotValues.QualityMagic] = "blue",
        [BagSlotValues.QualityUnknown] = "gray",
    };

    private readonly D3ScaledTemplateMatcher _matcher = D3ScaledTemplateMatcher.Instance;
    private readonly BagLayoutDetector _layoutDetector = BagLayoutDetector.Instance;

    /// <summary>App-supplied ui_analysis.bag_offset reader (Core has no config access). Null = no offset.</summary>
    public static Func<BagOffsetSettings>? BagOffsetProvider { get; set; }

    private BagInfoCollector()
    {
        ColorPrinter.Green("[BagInfoCollector] Initialized with ScaledTemplateMatcher");
    }

    /// <summary>Singleton. 1:1 get_bag_info_collector.</summary>
    public static BagInfoCollector Instance => LazyInstance.Value;

    /// <summary>Last layout result (with color analysis) for visualization.</summary>
    public BagLayoutResult? LastLayoutResult { get; private set; }

    /// <summary>Collect bag info from the shared game window image and update shared data. 1:1 collect.</summary>
    public BagCoordinates? Collect(bool forceRefresh = false, bool saveScreenshot = false)
    {
        ColorPrinter.Blue("\n[BagInfoCollector] Collecting bag information...");
        var shared = GameInterfaceData.Instance;
        if (!shared.HasUiRegion())
        {
            ColorPrinter.Red("[BagInfoCollector] No UI region in shared data");
            ColorPrinter.Yellow("[BagInfoCollector] Please call UI region collector first");
            return null;
        }
        if (!forceRefresh && shared.HasBagData())
        {
            ColorPrinter.Green("[BagInfoCollector] Using existing bag data from shared data");
            return shared.BagCoordinates;
        }
        using Bitmap? gameWindow = shared.CloneGameWindowImage();
        if (gameWindow == null)
        {
            ColorPrinter.Red("[BagInfoCollector] No game window image in shared data");
            ColorPrinter.Yellow("[BagInfoCollector] UI region collector must be called first to capture screenshot");
            return null;
        }
        using var screenshot = ImageConvert.NormalizeToBgr(gameWindow);
        ColorPrinter.Gray($"[BagInfoCollector] Game window image array shape: ({screenshot.Height}, {screenshot.Width}, 3)");
        try
        {
            ColorPrinter.Blue("[BagInfoCollector] Step 1: Checking if bag is opened...");
            if (!CheckBagOpened(screenshot))
            {
                ColorPrinter.Yellow("[BagInfoCollector] Bag is not opened - stopping collection");
                return null;
            }
            ColorPrinter.Green("[BagInfoCollector] Bag is opened - proceeding with border detection");

            var border = DetectBagBorder();
            if (border == null)
            {
                ColorPrinter.Yellow("[BagInfoCollector] Bag border not detected");
                shared.BagButtomMatch = null;
                shared.BagLeftMatch = null;
                SaveComprehensiveDetectionResult(screenshot, false, saveScreenshot);
                return null;
            }
            var bagCoords = CalculateBagCoordinates(border.Value);
            var bagLayout = DetectBagLayout(screenshot, bagCoords);
            DetectInterfaceButtons(gameWindow, shared);

            shared.BagCoordinates = bagCoords;
            shared.BagLayout = bagLayout;
            shared.BagButtomMatch = null;
            shared.BagLeftMatch = null;
            ColorPrinter.Green($"[BagInfoCollector] Bag detected: ({bagCoords.TopLeft.X}, {bagCoords.TopLeft.Y}) -> ({bagCoords.BottomRight.X}, {bagCoords.BottomRight.Y})");
            ColorPrinter.Green($"[BagInfoCollector] Grid: {bagCoords.Rows}x{bagCoords.Cols} ({bagCoords.TotalSlots} slots)");
            SaveComprehensiveDetectionResult(screenshot, true, saveScreenshot);
            return bagCoords;
        }
        catch (Exception e)
        {
            ColorPrinter.Red($"[BagInfoCollector] Error in collect: {e.Message}");
            return null;
        }
    }

    /// <summary>bag_opened_indicator anywhere in the window = bag open. 1:1 _check_bag_opened.</summary>
    private bool CheckBagOpened(Mat screenshot)
    {
        try
        {
            var name = D3TemplateNames.BagOpenedIndicator;
            ColorPrinter.Blue($"[BagInfoCollector] Detecting {name}...");
            var path = D3TemplateConfig.GetTemplatePath(name);
            if (path == null || !File.Exists(path))
            {
                ColorPrinter.Gray($"[BagInfoCollector] {name} template not found");
                return false;
            }
            if (_matcher.MatchTemplate(screenshot, name).TotalMatches > 0)
            {
                ColorPrinter.Green($"[BagInfoCollector] {name} FOUND - Bag is opened");
                return true;
            }
            ColorPrinter.Yellow($"[BagInfoCollector] {name} NOT FOUND - Bag is closed");
            return false;
        }
        catch (Exception e)
        {
            ColorPrinter.Red($"[BagInfoCollector] Error checking bag opened: {e.Message}");
            return false;
        }
    }

    /// <summary>Bag region from scaled standard coordinates (synthetic match). 1:1 _detect_bag_border.</summary>
    private static ((int X, int Y) TopLeft, (int X, int Y) BottomRight)? DetectBagBorder()
    {
        try
        {
            ColorPrinter.Blue("[BagInfoCollector] Getting bag region from standard coordinates...");
            var (tl, br) = D3StandardCoordinates.GetScaledBagRegion();
            ColorPrinter.Green("[BagInfoCollector] Bag region (standard coordinates):");
            ColorPrinter.Green($"  Top-left: ({tl.X}, {tl.Y})");
            ColorPrinter.Green($"  Bottom-right: ({br.X}, {br.Y})");
            ColorPrinter.Green($"  Width: {br.X - tl.X}, Height: {br.Y - tl.Y}");
            return (tl, br);
        }
        catch (Exception e)
        {
            ColorPrinter.Red($"[BagInfoCollector] Error getting bag coordinates: {e.Message}");
            return null;
        }
    }

    /// <summary>Apply ui_analysis.bag_offset (only when use_in_calculation) and build 6x10 coordinates. 1:1 _calculate_bag_coordinates.</summary>
    private static BagCoordinates CalculateBagCoordinates(((int X, int Y) TopLeft, (int X, int Y) BottomRight) border)
    {
        var offset = BagOffsetProvider?.Invoke() ?? BagOffsetSettings.None;
        bool useOffset = offset.UseInCalculation;
        if (!useOffset) offset = BagOffsetSettings.None;
        var (scaleX, scaleY) = GameInterfaceData.Instance.GetGlobalScale();
        int left = border.TopLeft.X + (int)(offset.Left * scaleX);
        int top = border.TopLeft.Y + (int)(offset.Top * scaleY);
        int right = border.BottomRight.X - (int)(offset.Right * scaleX);
        int bottom = border.BottomRight.Y - (int)(offset.Bottom * scaleY);
        ColorPrinter.Blue("[BagInfoCollector] Standard coordinates" + (useOffset ? " with offset" : " (offset skipped):"));
        ColorPrinter.Blue($"  Bag region: ({left}, {top}) -> ({right}, {bottom})");
        ColorPrinter.Blue($"  Dimensions: {right - left}x{bottom - top}");
        var coords = new BagCoordinates((left, top), (right, bottom), right - left, bottom - top,
            BagSlotValues.DefaultRows, BagSlotValues.DefaultCols, BagSlotValues.DefaultRows * BagSlotValues.DefaultCols);
        if (left < 0 || top < 0)
            ColorPrinter.Red($"[BagInfoCollector] ERROR: Negative bag coordinates! ({left}, {top})");
        if (right <= left || bottom <= top)
            ColorPrinter.Red($"[BagInfoCollector] ERROR: Invalid bag dimensions! Width={right - left}, Height={bottom - top}");
        return coords;
    }

    /// <summary>Crop the bag region and run the layout detector. 1:1 _detect_bag_layout.</summary>
    private BagLayout? DetectBagLayout(Mat screenshot, BagCoordinates coords)
    {
        try
        {
            ColorPrinter.Blue("[BagInfoCollector] Detecting bag layout...");
            int x1 = Math.Clamp(coords.TopLeft.X, 0, screenshot.Width), y1 = Math.Clamp(coords.TopLeft.Y, 0, screenshot.Height);
            int x2 = Math.Clamp(coords.BottomRight.X, 0, screenshot.Width), y2 = Math.Clamp(coords.BottomRight.Y, 0, screenshot.Height);
            if (x2 <= x1 || y2 <= y1)
            {
                ColorPrinter.Yellow("[BagInfoCollector] Bag layout detection failed");
                return null;
            }
            using var bagRegion = new Mat(screenshot, new Rect(x1, y1, x2 - x1, y2 - y1));
            LastLayoutResult = _layoutDetector.DetectLayout(bagRegion);
            ColorPrinter.Green("[BagInfoCollector] Bag layout detected");
            return LastLayoutResult.Layout;
        }
        catch (Exception e)
        {
            ColorPrinter.Red($"[BagInfoCollector] Error detecting bag layout: {e.Message}");
            return null;
        }
    }

    /// <summary>Interface type (left 30% rule), button detections and Kanai right page state. 1:1 _detect_interface_buttons.</summary>
    private void DetectInterfaceButtons(Bitmap gameWindow, GameInterfaceData shared)
    {
        ColorPrinter.Blue("\n[BagInfoCollector] Detecting interface type...");
        var detection = D3InterfaceDetection.DetectInterfaceTypeFromFullWindow(gameWindow, wantBlacksmith: true, matcher: _matcher);
        var interfaceType = detection.InterfaceType;
        shared.InterfaceType = interfaceType;
        var buttons = new Dictionary<string, DetectionResult>();
        foreach (var (name, match) in detection.MatchDetails)
            buttons[name] = new DetectionResult(match, Reliable: true);
        if (interfaceType == D3InterfaceDetection.InterfaceBlacksmith)
            ColorPrinter.Green($"[BagInfoCollector] {D3TemplateNames.BagOpenedIndicator} FOUND in left 30% -> Blacksmith interface detected");
        else if (interfaceType == D3InterfaceDetection.InterfaceKanaiCube)
            ColorPrinter.Green("[BagInfoCollector] kanai_cube_left_panel_indicator FOUND in left 30% -> Kanai Cube interface detected");
        if (interfaceType != null)
        {
            ColorPrinter.Green($"[BagInfoCollector] Interface type: {interfaceType}");
            ColorPrinter.Green($"[BagInfoCollector] Interface detection complete: {interfaceType}");
        }
        else
        {
            ColorPrinter.Yellow("[BagInfoCollector] No functional interface detected");
            ColorPrinter.Yellow("[BagInfoCollector]   - Not in Blacksmith (no indicators found)");
            ColorPrinter.Yellow("[BagInfoCollector]   - Not in Kanai Cube (no conversion button found)");
        }

        if (interfaceType == D3InterfaceDetection.InterfaceKanaiCube)
        {
            ColorPrinter.Blue("[BagInfoCollector] Detecting if Kanai's Cube right page is opened...");
            var name = D3TemplateNames.KanaiRightPageIndicator;
            var path = D3TemplateConfig.GetTemplatePath(name);
            if (path != null && File.Exists(path))
            {
                if (_matcher.MatchTemplate(gameWindow, name).TotalMatches > 0)
                {
                    shared.KanaiRightPageOpened = true;
                    ColorPrinter.Green("[BagInfoCollector] Kanai's Cube right page is OPENED");
                }
                else
                {
                    shared.KanaiRightPageOpened = false;
                    ColorPrinter.Yellow("[BagInfoCollector] Kanai's Cube right page is CLOSED");
                }
            }
            else
            {
                ColorPrinter.Gray($"[BagInfoCollector] {name} template not found");
                shared.KanaiRightPageOpened = null;
            }
        }
        shared.ButtonDetections = buttons;
    }

    private static void SaveComprehensiveDetectionResult(Mat screenshot, bool detectionSuccess, bool saveToDisk)
    {
        if (!saveToDisk) return;
        try
        {
            using var annotated = ImageConvert.ToBgr(screenshot);
            DrawComprehensiveDetectionAnnotation(annotated, detectionSuccess);
            var path = Path.Combine(BagPaths.TmpDir, $"bag_comprehensive_{DateTime.Now:yyyyMMdd_HHmmss}.png");
            if (ImageConvert.SaveMat(annotated, path))
                ColorPrinter.Green($"[BagInfoCollector] Saved comprehensive result: {path}");
        }
        catch (Exception e)
        {
            ColorPrinter.Red($"[BagInfoCollector] Error in comprehensive detection result: {e.Message}");
        }
    }

    /// <summary>Annotated detection image (BGR, caller disposes) from the current shared state; no file written. 1:1 get_annotated_detection_image.</summary>
    public Mat? GetAnnotatedDetectionImage(Mat? screenshot, bool detectionSuccess)
    {
        if (screenshot == null || screenshot.Empty()) return null;
        try
        {
            var annotated = ImageConvert.ToBgr(screenshot);
            DrawComprehensiveDetectionAnnotation(annotated, detectionSuccess);
            return annotated;
        }
        catch (Exception e)
        {
            ColorPrinter.Red($"[BagInfoCollector] get_annotated_detection_image: {e.Message}");
            return null;
        }
    }

    /// <summary>Status, scale, offsets, bag rect + layout grid, all detections, legend. 1:1 _draw_comprehensive_detection_annotation.</summary>
    private static void DrawComprehensiveDetectionAnnotation(Mat img, bool detectionSuccess)
    {
        var shared = GameInterfaceData.Instance;
        var bagCoords = shared.BagCoordinates;
        var bagLayout = shared.BagLayout;
        var buttons = shared.ButtonDetections;
        var (scaleX, scaleY) = shared.GetGlobalScale();
        var bagDetectionColor = detectionSuccess ? Green : Red;

        int textY = 30;
        ImageAnnotate.DrawText(img, detectionSuccess ? "Bag Detection: SUCCESS" : "Bag Detection: FAILED", new CvPoint(10, textY), White, 0.8, 2, bagDetectionColor);
        textY += TextLineHeight;
        ImageAnnotate.DrawText(img, $"Resolution Scale: {scaleX:P2} x {scaleY:P2}", new CvPoint(10, textY), White, 0.6, 2, Gray);
        textY += TextLineHeight;
        var offset = BagOffsetProvider?.Invoke() ?? BagOffsetSettings.None;
        ImageAnnotate.DrawText(img, $"Offset Config: L={offset.Left}, R={offset.Right}, T={offset.Top}, B={offset.Bottom}", new CvPoint(10, textY), White, 0.5, 1, DarkGray);
        int sL = (int)(offset.Left * scaleX), sR = (int)(offset.Right * scaleX), sT = (int)(offset.Top * scaleY), sB = (int)(offset.Bottom * scaleY);
        ImageAnnotate.DrawText(img, $"Scaled Offset: L={sL}, R={sR}, T={sT}, B={sB}", new CvPoint(10, 135), White, 0.5, 1, DarkGray);
        if (detectionSuccess && bagCoords != null)
        {
            int borderW = bagCoords.Width + sL + sR, borderH = bagCoords.Height + sT + sB;
            double Pct(int v, int total) => total > 0 ? v / (double)total * 100 : 0;
            ImageAnnotate.DrawText(img, $"Offset %: L={Pct(sL, borderW):F1}% R={Pct(sR, borderW):F1}% T={Pct(sT, borderH):F1}% B={Pct(sB, borderH):F1}%", new CvPoint(10, 165), White, 0.5, 1, new Scalar(64, 128, 64));
            ImageAnnotate.DrawText(img, $"Bag Size: {bagCoords.Width}x{bagCoords.Height}px ({bagCoords.Rows}x{bagCoords.Cols} grid)", new CvPoint(10, 195), White, 0.5, 1, new Scalar(128, 64, 128));
        }

        DrawMatchOrNotFound(img, shared.BagButtomMatch, D3TemplateNames.BagButtom, Green, 200);
        var bagLeft = shared.BagLeftMatch;
        DrawMatchOrNotFound(img, bagLeft, D3TemplateNames.BagLeft, Orange, 240);
        if (bagLeft?.Polygon is { Count: >= 4 } poly)
        {
            var bl = new CvPoint((int)poly[3].X, (int)poly[3].Y);
            var brp = new CvPoint((int)poly[2].X, (int)poly[2].Y);
            ImageAnnotate.DrawLine(img, bl, brp, Cyan, 3);
            ImageAnnotate.DrawText(img, "bag_left BOTTOM = bag TOP", new CvPoint(bl.X, bl.Y + 20), Cyan, 0.5, 2, new Scalar(0, 0, 0));
        }

        if (detectionSuccess && bagCoords != null)
        {
            ImageAnnotate.DrawRectangle(img, new CvPoint(bagCoords.TopLeft.X, bagCoords.TopLeft.Y), new CvPoint(bagCoords.BottomRight.X, bagCoords.BottomRight.Y),
                Magenta, 3, $"Bag: {bagCoords.Width}x{bagCoords.Height}");
            if (bagLayout != null)
            {
                ColorPrinter.Blue("[BagInfoCollector] Drawing bag layout grid...");
                DrawBagLayoutGrid(img, bagCoords, bagLayout);
            }
        }

        DrawAllDetectionResults(img, buttons);

        int legendX = 10, legendY = 230;
        ImageAnnotate.DrawText(img, "Detection Results:", new CvPoint(legendX, legendY), White, 0.7, 2, new Scalar(50, 50, 50));
        legendY += LegendLineHeight;
        DetectionResult? indicator = null;
        bool found = buttons != null && buttons.TryGetValue(D3TemplateNames.BagOpenedIndicator, out indicator);
        DrawLegendRow(img, legendX, legendY, InterfaceIndicatorColor, $"blacksmith: {(found ? StatusText(indicator, D3TemplateNames.BagOpenedIndicator) : "NOT FOUND")}", found ? Green : Gray);
        legendY += LegendLineHeight;

        DetectionResult? conv = null;
        bool convFound = buttons != null && buttons.TryGetValue(ConversionButtonKey, out conv) && conv != null;
        var convColor = Gray;
        string convStatus = "NOT FOUND";
        if (convFound)
        {
            convColor = conv!.State == StateEnabled ? Green : Red;
            convStatus = StatusText(conv, ConversionButtonKey, conv.State != null ? $"FOUND ({conv.State.ToUpperInvariant()})" : "FOUND");
        }
        DrawLegendRow(img, legendX, legendY, convColor, $"Conversion Button: {convStatus}", convColor);
        legendY += LegendLineHeight;

        DetectionResult? mat = null;
        bool matFound = buttons != null && buttons.TryGetValue(MaterialButtonKey, out mat) && mat != null;
        var matColor = matFound ? Magenta : Gray;
        DrawLegendRow(img, legendX, legendY, matColor, $"Material Button: {(matFound ? StatusText(mat, MaterialButtonKey) : "NOT FOUND")}", matColor);
    }

    private static void DrawLegendRow(Mat img, int x, int y, Scalar boxColor, string text, Scalar background)
    {
        ImageAnnotate.DrawRectangle(img, new CvPoint(x, y - 20), new CvPoint(x + 25, y - 5), boxColor, -1);
        ImageAnnotate.DrawText(img, text, new CvPoint(x + 35, y), White, 0.5, 1, background);
    }

    private static void DrawMatchOrNotFound(Mat img, TemplateMatchResult? match, string name, Scalar color, int notFoundY)
    {
        if (match != null)
            ImageAnnotate.DrawMatchMarker(img, new CvPoint(match.CenterX, match.CenterY), name, match.Score, match.Polygon, color);
        else
            ImageAnnotate.DrawText(img, $"{name}: NOT FOUND", new CvPoint(10, notFoundY), White, 0.6, 2, Red);
    }

    /// <summary>"FOUND (x, y)" (with conversion state) or the default status. 1:1 _get_status_text_with_coordinates.</summary>
    private static string StatusText(DetectionResult? result, string templateName, string defaultStatus = "FOUND")
    {
        if (result?.Match == null) return defaultStatus;
        int cx = result.Match.CenterX, cy = result.Match.CenterY;
        if (templateName == ConversionButtonKey)
            return $"FOUND{(result.State != null ? $" ({result.State.ToUpperInvariant()})" : "")} ({cx}, {cy})";
        return $"FOUND ({cx}, {cy})";
    }

    /// <summary>Polygon, center dot and label for each detection (bag templates skipped). 1:1 _draw_all_detection_results.</summary>
    private static void DrawAllDetectionResults(Mat img, IReadOnlyDictionary<string, DetectionResult>? buttons)
    {
        if (buttons == null || buttons.Count == 0)
        {
            ColorPrinter.Gray("[BagInfoCollector] No button detections to draw");
            return;
        }
        ColorPrinter.Blue($"[BagInfoCollector] Drawing detection boxes for {buttons.Count} templates");
        int drawn = 0;
        foreach (var (name, result) in buttons)
        {
            if (result?.Match == null || name == D3TemplateNames.BagButtom || name == D3TemplateNames.BagLeft) continue;
            var color = TemplateColorMap.TryGetValue(name, out var c) ? c : DefaultTemplateColor;
            if (name == ConversionButtonKey)
                color = result.State == StateEnabled ? Green : result.State == StateDisabled ? Red : Cyan;
            if (result.Match.Polygon is { Count: > 0 } poly)
            {
                ImageAnnotate.DrawPolygon(img, poly, color, 3);
                ColorPrinter.Green($"[BagInfoCollector] Drew polygon for {name}");
            }
            int cx = result.Match.CenterX, cy = result.Match.CenterY;
            ImageAnnotate.DrawCircle(img, new CvPoint(cx, cy), 8, color, filled: true);
            ImageAnnotate.DrawText(img, name.Replace('_', ' ').ToUpperInvariant(), new CvPoint(cx + 15, cy), White, 0.6, 2, color);
            ColorPrinter.Green($"[BagInfoCollector] Drew center and label for {name} at ({cx}, {cy})");
            drawn++;
        }
        ColorPrinter.Green($"[BagInfoCollector] Successfully drew detection boxes for {drawn} templates");
    }

    /// <summary>Grid lines and per-slot quality markers. 1:1 image_annotator_helper._draw_bag_layout_grid.</summary>
    private static void DrawBagLayoutGrid(Mat img, BagCoordinates coords, BagLayout layout)
    {
        try
        {
            double slotW = coords.SlotWidth, slotH = coords.SlotHeight;
            var (tlx, tly) = coords.TopLeft;
            ColorPrinter.Blue("[ImageAnnotatorHelper] Drawing grid lines...");
            var gridColor = ImageAnnotate.GetAnnotationColor("gray");
            for (int col = 0; col <= coords.Cols; col++)
            {
                int x = (int)(tlx + col * slotW);
                ImageAnnotate.DrawLine(img, new CvPoint(x, tly), new CvPoint(x, tly + coords.Height), gridColor, 1);
            }
            for (int row = 0; row <= coords.Rows; row++)
            {
                int y = (int)(tly + row * slotH);
                ImageAnnotate.DrawLine(img, new CvPoint(tlx, y), new CvPoint(tlx + coords.Width, y), gridColor, 1);
            }
            ColorPrinter.Blue("[ImageAnnotatorHelper] Drawing slot information...");
            for (int row = 0; row < coords.Rows; row++)
                for (int col = 0; col < coords.Cols; col++)
                {
                    if (row >= layout.Layout.Count || col >= layout.Layout[row].Count) continue;
                    if (layout.Layout[row][col] == BagSlotValues.LayoutItem2SlotBottom) continue;
                    if (!layout.Items.TryGetValue((row, col), out var info)) continue;
                    int cx = (int)(tlx + (col + 0.5) * slotW), cy = (int)(tly + (row + 0.5) * slotH);
                    var color = QualityColorNames.TryGetValue(info.Quality, out var cn) ? ImageAnnotate.GetAnnotationColor(cn) : Gray;
                    string letter = info.Quality.Length > 0 ? info.Quality[..1].ToUpperInvariant() : "";
                    if (info.Type == BagSlotValues.TypeEmpty)
                        ImageAnnotate.DrawCircle(img, new CvPoint(cx, cy), 5, color, 2);
                    else if (info.Type == BagSlotValues.TypeItem1Slot)
                    {
                        ImageAnnotate.DrawCircle(img, new CvPoint(cx, cy), 8, color, filled: true);
                        ImageAnnotate.DrawText(img, letter, new CvPoint(cx - 5, cy + 5), White, 0.4, 1);
                    }
                    else if (info.Type == BagSlotValues.TypeItem2Slot)
                    {
                        ImageAnnotate.DrawRectangle(img, new CvPoint((int)(tlx + col * slotW + 5), (int)(tly + row * slotH + 5)),
                            new CvPoint((int)(tlx + (col + 1) * slotW - 5), (int)(tly + (row + 2) * slotH - 5)), color, 3);
                        ImageAnnotate.DrawText(img, letter, new CvPoint(cx - 5, (int)(tly + (row + 1) * slotH) + 5), White, 0.5, 2);
                    }
                }
            ColorPrinter.Green("[ImageAnnotatorHelper] Bag layout grid drawn successfully");
        }
        catch (Exception e)
        {
            ColorPrinter.Red($"[ImageAnnotatorHelper] Error drawing bag layout grid: {e.Message}");
        }
    }
}
