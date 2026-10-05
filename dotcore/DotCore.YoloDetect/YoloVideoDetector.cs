// PY-REF: none (DOT-only)
using System.Diagnostics;
using OpenCvSharp;

namespace DotCore.YoloDetect;

/// <summary>Video pass settings: every FrameStep-th frame from StartFrame up to EndFrame (exclusive, &lt; 0 = end of video).</summary>
public sealed record YoloVideoOptions(
    int FrameStep = 1,
    int StartFrame = 0,
    int EndFrame = -1,
    YoloInferenceProfile? Profile = null,
    bool Track = true,
    YoloTrackerOptions? Tracker = null)
{
    public static YoloVideoOptions Default { get; } = new();
}

/// <summary>
/// One processed video frame. Image is owned by the enumerator and valid until the next iteration (Clone to keep).
/// InferenceMs = detection + tracking wall time; Timing splits the detection part.
/// </summary>
public sealed record YoloVideoFrame(int FrameIndex, TimeSpan Timestamp, Mat Image, IReadOnlyList<YoloDetection> Detections,
    IReadOnlyList<YoloTrack> Tracks, double InferenceMs, YoloDetectTiming Timing);

/// <summary>Runs a detector over a video file frame by frame (one shared session), optionally tracking objects.</summary>
public sealed class YoloVideoDetector
{
    private readonly YoloOnnxDetector _detector;

    public YoloVideoDetector(YoloOnnxDetector detector) => _detector = detector;

    /// <summary>Lazily decodes and detects; stops at the end range, end of file or cancellation (no exception).</summary>
    public IEnumerable<YoloVideoFrame> Run(string videoPath, YoloVideoOptions? options = null, CancellationToken ct = default)
    {
        var o = options ?? YoloVideoOptions.Default;
        var profile = o.Profile ?? YoloInferenceProfile.Default;
        int step = Math.Max(1, o.FrameStep);
        var tracker = o.Track ? new YoloFrameTracker(o.Tracker) : null;

        using var capture = new VideoCapture(videoPath);
        if (!capture.IsOpened()) yield break;
        double fps = capture.Fps;
        int index = Math.Max(0, o.StartFrame);
        if (index > 0) capture.Set(VideoCaptureProperties.PosFrames, index);
        using var frame = new Mat();
        var watch = new Stopwatch();
        while (!ct.IsCancellationRequested && (o.EndFrame < 0 || index < o.EndFrame))
        {
            double posMsec = capture.Get(VideoCaptureProperties.PosMsec);
            if (!capture.Read(frame) || frame.Empty()) yield break;
            watch.Restart();
            var result = _detector.DetectTimed(frame, profile);
            var tracks = tracker?.Update(result.Detections) ?? Array.Empty<YoloTrack>();
            watch.Stop();
            var timestamp = fps > 0 ? TimeSpan.FromSeconds(index / fps) : TimeSpan.FromMilliseconds(posMsec);
            yield return new YoloVideoFrame(index, timestamp, frame, result.Detections, tracks, watch.Elapsed.TotalMilliseconds, result.Timing);

            for (int skip = 1; skip < step; skip++)
            {
                if (ct.IsCancellationRequested || !capture.Grab()) yield break;
            }
            index += step;
        }
    }
}
