// PY-REF: none (DOT-only)
using System.Globalization;
using System.Text.Json;
using DotCore.Foundations;
using OpenCvSharp;

namespace DotCore.YoloTaskSet;

/// <summary>Every Nth video frame as background images (Ultralytics trains on images only), cached losslessly as PNG.</summary>
public static class VideoFrameExtractor
{
    public const string MarkerFileName = "_frames.json";
    private const string FrameFilePrefix = "frame_";
    private const string FrameFileExtension = ".png";
    private const string FrameNumberFormat = "D7";

    private sealed record CacheMarker(long SourceLength, long SourceTicksUtc, int Interval, int Max, List<string> Frames, string? Format = null);

    /// <summary>Frames ExtractToCache would produce (from the container frame count; 0 when unreadable).</summary>
    public static int EstimateFrames(string path, int interval, int max)
    {
        interval = Math.Max(1, interval);
        try
        {
            using var capture = new VideoCapture(path);
            if (!capture.IsOpened()) return 0;
            int count = capture.FrameCount;
            if (count <= 0) return 0;
            return Math.Min((count + interval - 1) / interval, Math.Max(1, max));
        }
        catch (Exception ex) when (ex is OpenCVException or OpenCvSharpException)
        {
            return 0;
        }
    }

    /// <summary>Frame 0, interval, 2*interval, ... (at most max) as PNG files in cacheDir; a complete cache for the same settings is reused.</summary>
    public static IReadOnlyList<string> ExtractToCache(string videoPath, string cacheDir, int interval, int max, CancellationToken ct)
    {
        interval = Math.Max(1, interval);
        max = Math.Max(1, max);
        var info = new FileInfo(videoPath);
        if (!info.Exists) return Array.Empty<string>();
        var markerPath = Path.Combine(cacheDir, MarkerFileName);
        var cached = ReadMarker(markerPath);
        if (cached != null && cached.SourceLength == info.Length && cached.SourceTicksUtc == info.LastWriteTimeUtc.Ticks
            && cached.Interval == interval && cached.Max == max && cached.Format == FrameFileExtension)
        {
            var paths = cached.Frames.Select(f => Path.Combine(cacheDir, f)).ToList();
            if (paths.All(File.Exists)) return paths;
        }

        if (Directory.Exists(cacheDir)) Directory.Delete(cacheDir, recursive: true);
        Directory.CreateDirectory(cacheDir);
        var frames = new List<string>();
        using (var capture = new VideoCapture(videoPath))
        {
            if (!capture.IsOpened())
            {
                ColorPrinter.Yellow($"[YoloTaskSet] cannot open video {videoPath}");
                return Array.Empty<string>();
            }
            using var frame = new Mat();
            for (int index = 0; frames.Count < max; index++)
            {
                ct.ThrowIfCancellationRequested();
                if (index % interval != 0)
                {
                    if (!capture.Grab()) break;
                    continue;
                }
                if (!capture.Read(frame) || frame.Empty()) break;
                var name = FrameFilePrefix + index.ToString(FrameNumberFormat, CultureInfo.InvariantCulture) + FrameFileExtension;
                File.WriteAllBytes(Path.Combine(cacheDir, name), TaskSetImageIo.EncodePng(frame));
                frames.Add(name);
            }
        }
        var marker = new CacheMarker(info.Length, info.LastWriteTimeUtc.Ticks, interval, max, frames, FrameFileExtension);
        File.WriteAllText(markerPath, JsonSerializer.Serialize(marker, TaskSetStore.JsonOptions));
        ColorPrinter.Gray($"[YoloTaskSet] extracted {frames.Count} frames from {videoPath}");
        return frames.Select(f => Path.Combine(cacheDir, f)).ToList();
    }

    private static CacheMarker? ReadMarker(string path)
    {
        try
        {
            return File.Exists(path) ? JsonSerializer.Deserialize<CacheMarker>(File.ReadAllText(path), TaskSetStore.JsonOptions) : null;
        }
        catch (Exception ex) when (ex is JsonException or IOException or UnauthorizedAccessException or NotSupportedException)
        {
            return null;
        }
    }
}
