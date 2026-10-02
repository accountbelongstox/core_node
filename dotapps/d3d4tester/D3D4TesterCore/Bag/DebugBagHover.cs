// PY-REF: pyapps/d3-check/d3utils/debug_bag_hover.py
// PY-REF: pyapps/d3-check/providor/constants/common.py
using System.Drawing;
using DotCore.Foundations;
using DotCore.ScreenCapture;
using DotCore.Utils.ImagePreprocess;
using DotCore.Utils.Input;
using OpenCvSharp;

namespace DotApps.d3d4tester.Core.Bag;

/// <summary>Bag debug temp dirs. 1:1 Python providor.constants.common TMP_DIR (system cache / pytools / tmp) and DEBUG_BAG_LINE_DIR.</summary>
public static class BagPaths
{
    private const string PytoolsDirName = "pytools";
    private const string TmpDirName = "tmp";
    private const string DebugBagLineDirName = "debug_bag_line";

    /// <summary>TMP_DIR.</summary>
    public static string TmpDir => Path.Combine(Path.GetTempPath(), PytoolsDirName, TmpDirName);

    /// <summary>DEBUG_BAG_LINE_DIR.</summary>
    public static string DebugBagLineDir => Path.Combine(TmpDir, DebugBagLineDirName);
}

/// <summary>
/// Debug tool: reuse (or collect) bag layout, hover each item slot, capture the search region natively, detect primal/ancient line, log results.
/// 1:1 Python pyapps/d3-check/d3utils/debug_bag_hover.py (run_debug_bag_hover, _search_region_bounds, _draw_dots_on_matched, _save_region_temp_image).
/// </summary>
public static class DebugBagHover
{
    private const int HoverSettleBeforeCaptureMs = 300;
    private const int FocusSettleMs = 200;
    private const int PerSlotPauseMs = 150;
    private const double FocusClickDurationSec = 0.0;
    private const double FocusClickPauseAfterMoveSec = 0.0;
    private const bool FocusClickReturnToOriginal = true;
    private const int DotRadius = 2;
    private const double SearchLengthRatio = 0.5;
    private const double MarginYRatio = 1.5;
    private const int SearchRightPadPx = 10;

    /// <summary>When false, region images are saved under DebugBagLineDir (Python FLOW_IMAGES_IN_MEMORY_ONLY = True default).</summary>
    public static bool FlowImagesInMemoryOnly { get; set; } = true;

    /// <summary>Slot search region in window coords and its left edge / center. 1:1 _search_region_bounds.</summary>
    public static (int XMin, int YMin, int XMax, int YMax, double LeftEdgeX, double CenterY) SearchRegionBounds(
        (int X, int Y) topLeft, double slotWidth, double slotHeight, int r, int c, int windowW, int windowH)
    {
        double leftEdgeX = topLeft.X + c * slotWidth;
        double searchLength = SearchLengthRatio * slotWidth;
        double centerY = topLeft.Y + (r + 0.5) * slotHeight;
        double marginY = MarginYRatio * slotHeight;
        int xMin = Math.Max(0, (int)(leftEdgeX - searchLength));
        int xMax = Math.Min(windowW, (int)leftEdgeX + SearchRightPadPx);
        int yMin = Math.Max(0, (int)(centerY - marginY));
        int yMax = Math.Min(windowH, (int)(centerY + marginY) + 1);
        return (xMin, yMin, xMax, yMax, leftEdgeX, centerY);
    }

    /// <summary>Green dots on primal pixels, white on ancient (BGR in place). 1:1 _draw_dots_on_matched.</summary>
    private static void DrawDotsOnMatched(Mat img, IReadOnlyList<(int X, int Y)> primal, IReadOnlyList<(int X, int Y)> ancient)
    {
        var idx = img.GetGenericIndexer<Vec3b>();
        void Dot((int X, int Y) p, Vec3b color)
        {
            for (int dy = -DotRadius; dy <= DotRadius; dy++)
                for (int dx = -DotRadius; dx <= DotRadius; dx++)
                {
                    if (dx * dx + dy * dy > DotRadius * DotRadius) continue;
                    int ny = p.Y + dy, nx = p.X + dx;
                    if (ny >= 0 && ny < img.Height && nx >= 0 && nx < img.Width) idx[ny, nx] = color;
                }
        }
        foreach (var p in primal) Dot(p, new Vec3b(0, 255, 0));
        foreach (var p in ancient) Dot(p, new Vec3b(255, 255, 255));
    }

    /// <summary>
    /// Hover each item slot (left-to-right, top-to-bottom) and log type / quality / line; restore the cursor at the end.
    /// When the interface is blacksmith and onBlacksmithDebug is set, it runs first (real salvage). 1:1 run_debug_bag_hover.
    /// </summary>
    public static bool Run(Action? onBlacksmithDebug = null)
    {
        var shared = GameInterfaceData.Instance;
        var coords = shared.BagCoordinates;
        var layout = shared.BagLayout;
        if (coords == null || layout == null || layout.Items.Count == 0)
        {
            ColorPrinter.Blue("[DebugBagHover] No bag data, refreshing from screenshot (collect_bag_info_quik)...");
            D3InterfaceManager.Instance.CollectBagInfoQuik(forceRefresh: false, saveScreenshot: false, forceNewCapture: true);
            coords = shared.BagCoordinates;
            layout = shared.BagLayout;
        }
        else
        {
            ColorPrinter.Blue("[DebugBagHover] Reusing existing bag layout (no new capture)");
        }
        if (coords == null || layout == null || layout.Items.Count == 0)
        {
            ColorPrinter.Red("[DebugBagHover] Still no bag coordinates/layout");
            return false;
        }

        var interfaceType = shared.InterfaceType;
        ColorPrinter.Blue($"[DebugBagHover] Interface: {interfaceType ?? "none (bag only or unknown)"}");
        if (interfaceType == D3InterfaceDetection.InterfaceBlacksmith && onBlacksmithDebug != null)
            onBlacksmithDebug();

        var provider = ScreenCaptureService.GetScreenshotProvider();
        provider.ClearWindowCache();
        var titles = D3WindowConstants.DiabloIIIWindowTitles;
        var options = new ScreenCaptureOptions
        {
            WindowTitles = titles,
            WindowOnly = true,
            FindWindows = _ => D3WindowFinder.FindWindows(),
            UseWindowCache = false,
        };
        (int X, int Y) windowOffset;
        int windowW, windowH;
        var sd = provider.Gen(options);
        if (sd?.GameWindowImage != null && shared.UpdateFromScreenshot(sd))
        {
            windowOffset = shared.WindowOffset;
            (windowW, windowH) = shared.GameWindowSize;
            ColorPrinter.Blue("[DebugBagHover] Window position from real-time capture (no cache)");
        }
        else
        {
            windowOffset = shared.WindowOffset;
            windowW = 0;
            windowH = 0;
            ColorPrinter.Yellow("[DebugBagHover] Real-time capture failed, using shared window_offset");
        }

        var topLeft = coords.TopLeft;
        int rows = coords.Rows, cols = coords.Cols;
        double slotWidth = coords.Width / (double)cols;
        double slotHeight = coords.Height / (double)rows;
        var clicker = ClickHandler.Instance;
        var originalPos = clicker.GetMousePosition();
        ColorPrinter.Blue($"[DebugBagHover] Grid {rows}x{cols} TopLeft=({topLeft.X}, {topLeft.Y}) Size={coords.Width}x{coords.Height} window_offset=({windowOffset.X}, {windowOffset.Y})");

        var (focusCx, focusCy) = D3StandardCoordinates.GetScaledGameFocusClickPoint();
        clicker.Click(windowOffset.X + focusCx, windowOffset.Y + focusCy, MouseButton.Left, FocusClickDurationSec,
            FocusClickReturnToOriginal, directClick: true, pauseAfterMove: FocusClickPauseAfterMoveSec);
        Thread.Sleep(FocusSettleMs);

        var slots = new List<(int R, int C, BagItemInfo Info)>();
        for (int r = 0; r < rows; r++)
            for (int c = 0; c < cols; c++)
                if (layout.Items.TryGetValue((r, c), out var info) && info.Type is BagSlotValues.TypeItem1Slot or BagSlotValues.TypeItem2Slot)
                    slots.Add((r, c, info));
        var debugOutDir = Path.Combine(BagPaths.DebugBagLineDir, $"run_{DateTime.Now:yyyyMMdd_HHmmss}");
        ColorPrinter.Blue($"[DebugBagHover] Region temp images -> {debugOutDir}");

        if (windowW <= 0 || windowH <= 0)
            (windowW, windowH) = shared.GameWindowSize;
        if (windowW <= 0 || windowH <= 0)
        {
            ColorPrinter.Yellow("[DebugBagHover] Game window size unknown; one full capture to get size");
            var one = provider.Gen(options);
            if (one?.GameWindowImage != null)
            {
                windowW = one.GameWindowImage.Width;
                windowH = one.GameWindowImage.Height;
                shared.UpdateFromScreenshot(one);
            }
        }
        ColorPrinter.Blue($"[DebugBagHover] Hovering {slots.Count} slots; native region capture per slot (realtime window, no fullscreen crop).");

        double searchLength = SearchLengthRatio * slotWidth;
        try
        {
            foreach (var (r, c, info) in slots)
            {
                int itemX = (int)(windowOffset.X + topLeft.X + (c + 0.5) * slotWidth);
                int itemY = (int)(windowOffset.Y + topLeft.Y + (r + 0.5) * slotHeight);
                clicker.MoveMouseTo(itemX, itemY);
                Thread.Sleep(HoverSettleBeforeCaptureMs);

                var (xMin, yMin, xMax, yMax, leftEdgeX, centerY) = SearchRegionBounds(topLeft, slotWidth, slotHeight, r, c, windowW, windowH);
                int regionW = xMax - xMin, regionH = yMax - yMin;
                string lineStr = "normal_legendary";
                string safeLabel = "normal_legendary";
                using Bitmap? regionBmp = provider.CaptureRegion(windowOffset.X + xMin, windowOffset.Y + yMin, regionW, regionH);
                if (regionBmp != null && regionW > 0 && regionH > 0)
                {
                    using var crop = ImageConvert.NormalizeToBgr(regionBmp);
                    var line = SlotQuality.FindLineInCrop(crop, leftEdgeX - xMin, centerY - yMin, searchLength);
                    if (line.Kind == SlotQuality.KindOrange && line.Height != null)
                    {
                        lineStr = $"primal line height {line.Height}";
                        safeLabel = $"primal_ancient_line_{line.Height}";
                    }
                    else if (line.Kind == SlotQuality.KindAncient && line.Height != null)
                    {
                        lineStr = $"ancient line height {line.Height}";
                        safeLabel = $"ancient_line_{line.Height}";
                    }
                    else if (line.PrimalPoints.Count > 0)
                    {
                        lineStr = $"primal ({line.PrimalPoints.Count} dots)";
                        safeLabel = "primal_dots";
                    }
                    else if (line.AncientPoints.Count > 0)
                    {
                        lineStr = $"ancient ({line.AncientPoints.Count} dots)";
                        safeLabel = "ancient_dots";
                    }
                    if (line.PrimalPoints.Count > 0 || line.AncientPoints.Count > 0)
                        DrawDotsOnMatched(crop, line.PrimalPoints, line.AncientPoints);
                    if (!FlowImagesInMemoryOnly)
                    {
                        var tempPath = Path.Combine(debugOutDir, $"slot_r{r}_c{c}_{safeLabel}.png");
                        if (ImageConvert.SaveMat(crop, tempPath))
                            ColorPrinter.Gray($"    -> {Path.GetFileName(tempPath)}");
                    }
                }
                else if (regionBmp == null)
                {
                    ColorPrinter.Yellow($"    [DebugBagHover] Native region capture failed for ({r},{c})");
                }
                ColorPrinter.Green($"  ({r},{c}) {info.Type} {info.Quality}  {lineStr}");
                Thread.Sleep(PerSlotPauseMs);
            }
        }
        finally
        {
            clicker.MoveMouseTo(originalPos.X, originalPos.Y);
            ColorPrinter.Blue($"[DebugBagHover] Mouse restored to ({originalPos.X}, {originalPos.Y})");
        }
        return true;
    }
}
