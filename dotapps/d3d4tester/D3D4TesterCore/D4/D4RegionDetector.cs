// PY-REF: pyapps/d3-check/controller/d4func/region_detector.py
using DotCore.Foundations;
using OpenCvSharp;

namespace DotApps.d3d4tester.Core.D4;

/// <summary>
/// Step 2 orchestration: team health, small map, window regions, then crops of all 20 regions + the Min Tier Click 10x10 point.
/// 1:1 Python pyapps/d3-check/controller/d4func/region_detector.py.
/// Fixes Python bug: crops only ran while detected_regions was None (never after the first tick); they now run every tick unless the debug window is paused.
/// </summary>
public sealed class D4RegionDetector
{
    private const string LogPrefix = "[RegionDetector]";

    private static readonly Lazy<D4RegionDetector> LazyInstance = new(() => new D4RegionDetector());

    private D4RegionDetector()
    {
        ColorPrinter.Blue($"{LogPrefix} Initialized");
    }

    public static D4RegionDetector Instance => LazyInstance.Value;

    /// <summary>Run detectors on the captured frame; success = window regions detected. 1:1 detect_regions_from_shared_data.</summary>
    public D4RegionDetectionResult DetectRegionsFromSharedData(D4InterfaceData data, bool debug)
    {
        ColorPrinter.Blue($"{LogPrefix} Detecting regions from shared data...");
        using var frame = data.CloneGameWindowImage();
        ColorPrinter.Blue($"{LogPrefix} Screenshot data from shared memory: {frame != null}");
        if (frame == null)
        {
            ColorPrinter.Yellow($"{LogPrefix} No screenshot data in shared memory");
            return new D4RegionDetectionResult(false, null, null, null, data.RegionImageCount, "No screenshot data");
        }

        var teamHealth = DetectTeamHealth(data, frame, debug);
        var smallMap = DetectSmallMap(data, frame, debug);
        bool windowed = data.IsWindowedMode();
        var size = data.GameWindowSize;
        ColorPrinter.Blue($"{LogPrefix} Detecting regions and updating data...");
        var regions = D4WindowRegionDetector.Instance.DetectRegions(size, windowed, frame, debug);
        bool success = D4WindowRegionDetector.Instance.UpdateInterfaceData(data, regions);
        if (regions.AnnotatedPath != null)
            ColorPrinter.Blue($"{LogPrefix} Annotated screenshot saved for DEBUG mode");

        ColorPrinter.Blue($"{LogPrefix} About to extract all regions to share...");
        ExtractAllRegionsToShare(data, frame, size, windowed);
        ColorPrinter.Blue($"{LogPrefix} Finished extracting all regions to share");
        if (success) ColorPrinter.Green($"{LogPrefix} Region detection successful");
        else ColorPrinter.Yellow($"{LogPrefix} Region detection failed");
        return new D4RegionDetectionResult(success, teamHealth, smallMap, regions, data.RegionImageCount);
    }

    /// <summary>Crop every region and point square into the shared region images (skipped while paused). 1:1 _extract_all_regions_to_share.</summary>
    public void ExtractAllRegionsToShare(D4InterfaceData data, Mat frame, (int Width, int Height) gameWindowSize, bool isWindowed)
    {
        if (data.DebugWindowPaused)
        {
            ColorPrinter.Gray($"{LogPrefix} Debug window paused - skipping region extraction");
            return;
        }
        var images = new Dictionary<string, Mat>(StringComparer.Ordinal);
        foreach (var r in D4StandardCoords.CropRegions)
        {
            var s = D4StandardCoords.Scale(r.Start, gameWindowSize, isWindowed);
            var e = D4StandardCoords.Scale(r.End, gameWindowSize, isWindowed);
            var crop = D4ImageCrop.Crop(frame, s, e);
            if (crop == null) continue;
            images[r.Name] = crop;
        }
        int half = D4Constants.PointCropSquareSize / 2;
        foreach (var p in D4StandardCoords.CropPoints)
        {
            var c = D4StandardCoords.Scale(p.Coord, gameWindowSize, isWindowed);
            var s = (Math.Max(0, c.X - half), Math.Max(0, c.Y - half));
            var e = (Math.Min(frame.Width, c.X + half), Math.Min(frame.Height, c.Y + half));
            var crop = D4ImageCrop.Crop(frame, s, e);
            if (crop == null) continue;
            images[p.Name] = crop;
        }
        int total = D4StandardCoords.CropRegions.Count + D4StandardCoords.CropPoints.Count;
        data.SetRegionImages(images);
        ColorPrinter.Green($"{LogPrefix} Extracted {images.Count}/{total} regions to detected_regions");
    }

    private D4TeamHealthResult DetectTeamHealth(D4InterfaceData data, Mat frame, bool debug)
    {
        ColorPrinter.Blue($"{LogPrefix} Detecting team health bars...");
        var result = D4TeamHealthDetector.Instance.DetectTeamHealth(data, frame, debug);
        if (result.Success)
        {
            ColorPrinter.Green($"{LogPrefix} Team health detection successful: {result.TotalMembers} members detected");
            ColorPrinter.Green($"{LogPrefix} Groups: G1:{result.Group1Members}, G2:{result.Group2Members}");
            ColorPrinter.Green($"{LogPrefix} Maps: Local:{result.LocalMapMembers}, Non-Local:{result.NonLocalMapMembers}");
        }
        else
        {
            ColorPrinter.Yellow($"{LogPrefix} Team health detection failed: {result.Error}");
        }
        return result;
    }

    private D4SmallMapResult DetectSmallMap(D4InterfaceData data, Mat frame, bool debug)
    {
        ColorPrinter.Blue($"{LogPrefix} Detecting small map...");
        var result = D4SmallMapDetector.Instance.DetectSmallMap(data, frame, debug);
        if (result.Success)
            ColorPrinter.Green($"{LogPrefix} Small map detection successful: {result.LocationType} (confidence: {result.Confidence:F3})");
        else
            ColorPrinter.Yellow($"{LogPrefix} Small map detection failed: {result.Error}");
        return result;
    }
}
