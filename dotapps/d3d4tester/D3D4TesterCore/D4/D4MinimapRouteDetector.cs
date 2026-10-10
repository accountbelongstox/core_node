// PY-REF: scripts/analysis/d4_minimap_path.py
using DotCore.Foundations;
using DotCore.MinimapPath;
using OpenCvSharp;

namespace DotApps.d3d4tester.Core.D4;

/// <summary>
/// Pinned-route recognition on the D4 minimap over DotCore <see cref="MinimapRouteRecognizer"/> with the D4 tuning
/// (<see cref="D4Constants.MinimapRoute"/>); the minimap is located by color, falling back to the scaled standard Minimap region.
/// 1:1 Python scripts/analysis/d4_minimap_path.py main.
/// </summary>
public sealed class D4MinimapRouteDetector
{
    private const string LogPrefix = "[D4MinimapRouteDetector]";

    private static readonly Lazy<D4MinimapRouteDetector> LazyInstance = new(() => new D4MinimapRouteDetector());

    private D4MinimapRouteDetector()
    {
        ColorPrinter.Blue($"{LogPrefix} Initialized");
    }

    public static D4MinimapRouteDetector Instance => LazyInstance.Value;

    /// <summary>Recognize the route in the current frame and store it in <see cref="D4InterfaceData.MinimapRoute"/>.</summary>
    public MinimapRouteResult DetectMinimapRoute(D4InterfaceData data, Mat gameWindowBgr, bool debug)
    {
        if (gameWindowBgr == null || gameWindowBgr.Empty())
        {
            ColorPrinter.Yellow($"{LogPrefix} No screenshot data available");
            return Store(data, MinimapRouteResult.Fail(null, MinimapRouteRecognizer.ErrorNoImage));
        }

        var size = (gameWindowBgr.Width, gameWindowBgr.Height);
        bool windowed = data.IsWindowedMode();
        var start = D4StandardCoords.Scale(D4StandardCoords.Minimap.Start, size, windowed);
        var end = D4StandardCoords.Scale(D4StandardCoords.Minimap.End, size, windowed);

        var result = Recognize(gameWindowBgr, new Rect(start.X, start.Y, end.X - start.X, end.Y - start.Y));
        if (!result.Success)
            ColorPrinter.Yellow($"{LogPrefix} Route recognition failed: {result.Error}");
        else if (!result.HasRoute)
            ColorPrinter.Gray($"{LogPrefix} No route on minimap");
        else
            ColorPrinter.Green($"{LogPrefix} Route: {result.Dots.Count} dots, {result.Waypoints.Count} waypoints, heading {result.HeadingDegrees:F1} deg");

        if (debug && result.Success)
        {
            using var annotated = MinimapRouteAnnotator.Draw(gameWindowBgr, result);
            var path = D4ImageCrop.Save(annotated, D4ImageCrop.TimestampedPath(D4Constants.AnnotatedDir, D4Constants.MinimapRouteDebugPrefix), LogPrefix);
            if (path != null)
            {
                ColorPrinter.Green($"{LogPrefix} Debug image saved: {path}");
                result = result with { DebugImagePath = path };
            }
        }
        return Store(data, result);
    }

    /// <summary>Recognize the route in a game window frame without storing it; <paramref name="minimapRegion"/> is the scaled standard Minimap region.</summary>
    public MinimapRouteResult Recognize(Mat gameWindowBgr, Rect minimapRegion) =>
        MinimapRouteRecognizer.RecognizeAuto(gameWindowBgr, D4Constants.MinimapRoute, minimapRegion);

    private static MinimapRouteResult Store(D4InterfaceData data, MinimapRouteResult result)
    {
        data.MinimapRoute = result;
        return result;
    }
}
