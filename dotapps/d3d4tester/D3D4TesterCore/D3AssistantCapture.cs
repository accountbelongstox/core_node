// PY-REF: pyapps/d3-check/d3utils/collectors/ui_region_collector_optimized.py
using System.Drawing;
using DotCore.Foundations;
using DotCore.ScreenCapture;
using DotCore.Utils.ImagePreprocess;
using DotApps.d3d4tester.Core.Bag;
using OpenCvSharp;
using Point = OpenCvSharp.Point;

namespace DotApps.d3d4tester.Core;

/// <summary>
/// Helper for assistant macro: find D3 window and capture game window image. 1:1 with Python
/// UIRegionCollectorOptimized (pyapps/d3-check/d3utils/collectors/ui_region_collector_optimized.py).
/// Uses D3WindowFinder (config exe first, then title with browser/editor skip). Interface detection and collect_bag are separate.
/// </summary>
public static class D3AssistantCapture
{
    private const string UiRegionSourceOptimized = "window_cache_optimized";
    private const string TimestampFormat = D3PathConstants.FileTimestampMsFormat;
    private const string DebugUiPrefix = "debug_ui_optimized_";
    private const string AnnotatedPrefix = "optimized_detection_";
    private const int AnnotateRectThickness = 3;
    private const int AnnotateLabelOffset = 10;
    private const int AnnotateLabelTop = 30;
    private const double AnnotateLabelScale = 0.8;
    private const int AnnotateInfoTop = 30;
    private const int AnnotateInfoLineHeight = 25;
    private const double AnnotateInfoScale = 0.6;
    private const int AnnotateTextThickness = 2;

    /// <summary>Python DEBUG: save a raw copy of the UI capture when images are not in-memory only.</summary>
    public static bool DebugSaveUiCapture { get; set; }

    /// <summary>
    /// Find first D3 window handle. 1:1 Python D3Manager.find_windows: by config exe path then by title with skip.
    /// Returns IntPtr.Zero if not found. Call D3WindowFinder.SetConfigPathProvider from app before use.
    /// </summary>
    public static IntPtr FindD3WindowHandle() => D3WindowFinder.FindFirstHandle();

    /// <summary>
    /// Capture the D3 window, store image/offset/scale and the UI region in shared data. 1:1 Python
    /// UIRegionCollectorOptimized.collect (window cache -> UIRegion source window_cache_optimized, error state, annotated save).
    /// </summary>
    public static UiRegion? CollectUiRegion(bool forceNewCapture = true, bool saveScreenshot = false)
    {
        var timestamp = DateTime.Now.ToString(TimestampFormat);
        var shared = GameInterfaceData.Instance;
        var provider = ScreenCaptureService.GetScreenshotProvider();
        ScreenshotData? data = null;
        if (forceNewCapture)
        {
            data = provider.Gen(new ScreenCaptureOptions
            {
                WindowTitles = D3WindowConstants.DiabloIIIWindowTitles,
                WindowOnly = true,
                FindWindows = _ => D3WindowFinder.FindWindows(),
            });
            if (data != null) shared.UpdateFromScreenshot(data);
        }
        else if (shared.HasGameWindowImage)
        {
            var (w, h) = shared.GameWindowSize;
            var (ox, oy) = shared.WindowOffset;
            data = new ScreenshotData { GameWindowSize = (w, h), WindowOffset = (ox, oy), GameWindowRect = new Rectangle(ox, oy, w, h), Timestamp = timestamp };
        }
        if (data == null)
        {
            ColorPrinter.Red("[UIRegion] Failed to get screenshot");
            SetError(shared, "Failed to get screenshot", timestamp);
            return null;
        }
        if (!data.GameWindowSize.HasValue)
        {
            ColorPrinter.Red("[UIRegion] Window not found in cache");
            SetError(shared, "Window not found in cache", timestamp);
            return null;
        }
        var (gw, gh) = data.GameWindowSize.Value;
        var (left, top) = data.GameWindowRect is { } rect ? (rect.X, rect.Y) : data.WindowOffset;
        var region = new UiRegion(left, top, gw, gh, left, top, false, UiRegionSourceOptimized);
        shared.UiRegion = region;
        shared.Timestamp = timestamp;
        shared.Error = null;
        if (!shared.HasGameWindowImage)
        {
            ColorPrinter.Red("[UIRegion] Game window image is NULL");
            SetError(shared, "Game window image is NULL", timestamp);
            return null;
        }
        ColorPrinter.Green($"[UIRegion] ({region.X},{region.Y}) {region.Width}x{region.Height} offset ({region.UiOffsetX},{region.UiOffsetY}) source={region.Source}");

        if (!DebugBagHover.FlowImagesInMemoryOnly && DebugSaveUiCapture && data.GameWindowImage != null)
        {
            var debugPath = Path.Combine(BagPaths.TmpDir, $"{DebugUiPrefix}{timestamp}.png");
            Directory.CreateDirectory(BagPaths.TmpDir);
            data.GameWindowImage.Save(debugPath);
            ColorPrinter.Gray($"[DEBUG] Saved UI region (optimized): {debugPath}");
        }
        if (saveScreenshot)
            SaveAnnotatedScreenshot(shared, region, string.IsNullOrEmpty(data.Timestamp) ? timestamp : data.Timestamp);
        return region;
    }

    private static void SetError(GameInterfaceData shared, string error, string timestamp)
    {
        shared.Error = error;
        shared.Timestamp = timestamp;
    }

    /// <summary>1:1 _save_annotated_screenshot (game window image, region at 0,0).</summary>
    private static void SaveAnnotatedScreenshot(GameInterfaceData shared, UiRegion region, string timestamp)
    {
        ColorPrinter.Blue("[Save] Creating annotated screenshot...");
        using Bitmap? bmp = shared.CloneGameWindowImage();
        if (bmp == null)
        {
            ColorPrinter.Yellow("[Save] No image available for annotation");
            return;
        }
        using var img = ImageConvert.NormalizeToBgr(bmp);
        var green = new Scalar(0, 255, 0);
        ImageAnnotate.DrawRectangle(img, new Point(0, 0), new Point(region.Width, region.Height), green, AnnotateRectThickness);
        ImageAnnotate.DrawText(img, $"UI Region (Cache): {region.Width}x{region.Height}", new Point(AnnotateLabelOffset, AnnotateLabelTop), green, AnnotateLabelScale, AnnotateTextThickness);
        string[] lines =
        {
            $"Source: {region.Source}",
            "Window: (cached)",
            $"Position: ({region.X}, {region.Y})",
            $"Size: {region.Width}x{region.Height}",
            $"Timestamp: {timestamp}",
        };
        for (int i = 0; i < lines.Length; i++)
            ImageAnnotate.DrawText(img, lines[i], new Point(AnnotateLabelOffset, AnnotateInfoTop + i * AnnotateInfoLineHeight),
                new Scalar(255, 255, 255), AnnotateInfoScale, AnnotateTextThickness, new Scalar(0, 0, 0));
        var path = Path.Combine(BagPaths.TmpDir, $"{AnnotatedPrefix}{timestamp}.png");
        if (ImageConvert.SaveMat(img, path))
            ColorPrinter.Green($"[Save] Annotated screenshot saved: {path}");
    }
}
