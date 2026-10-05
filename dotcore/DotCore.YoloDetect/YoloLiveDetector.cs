// PY-REF: none (DOT-only)
using System.Diagnostics;
using OpenCvSharp;

namespace DotCore.YoloDetect;

/// <summary>Live loop settings; TargetFps &lt;= 0 runs as fast as the detector allows.</summary>
public sealed record YoloLiveOptions(
    double TargetFps = 10,
    YoloInferenceProfile? Profile = null,
    bool Track = true,
    YoloTrackerOptions? Tracker = null)
{
    public static YoloLiveOptions Default { get; } = new();
}

/// <summary>
/// One live result. Image is the provider's frame, disposed after the event handlers return (Clone to keep).
/// Fps is the measured processing rate; LatencyMs = CaptureMs + InferenceMs (+ tracking).
/// </summary>
public sealed record LiveDetectionFrame(long Sequence, DateTime TimestampUtc, Mat Image, IReadOnlyList<YoloDetection> Detections,
    IReadOnlyList<YoloTrack> Tracks, double Fps, double LatencyMs, double CaptureMs, double InferenceMs, YoloDetectTiming Timing);

/// <summary>
/// Pulls frames from a provider (screen region, camera, ...) on a background thread at a target rate, detects with one
/// shared session and tracks. The provider returns an owned Mat or null to skip a tick. Events fire on the loop thread.
/// An exception from the provider or detector raises Faulted and stops the loop.
/// </summary>
public sealed class YoloLiveDetector : IDisposable
{
    private const double FpsSmoothing = 0.2;
    private const int JoinTimeoutMs = 5000;

    private readonly YoloOnnxDetector _detector;
    private readonly Func<Mat?> _frameProvider;
    private readonly object _gate = new();
    private Thread? _thread;
    private CancellationTokenSource? _cts;
    private YoloFrameTracker? _tracker;
    private volatile bool _resetTracks;

    public YoloLiveOptions Options { get; set; }

    public bool IsRunning => _thread is { IsAlive: true };

    public event EventHandler<LiveDetectionFrame>? FrameProcessed;

    public event EventHandler<Exception>? Faulted;

    public YoloLiveDetector(YoloOnnxDetector detector, Func<Mat?> frameProvider, YoloLiveOptions? options = null)
    {
        _detector = detector;
        _frameProvider = frameProvider;
        Options = options ?? YoloLiveOptions.Default;
    }

    public void Start()
    {
        lock (_gate)
        {
            if (IsRunning) return;
            _cts = new CancellationTokenSource();
            var token = _cts.Token;
            _thread = new Thread(() => Loop(token)) { IsBackground = true, Name = nameof(YoloLiveDetector) };
            _thread.Start();
        }
    }

    /// <summary>Signals the loop and waits for it (no wait when called from an event handler on the loop thread).</summary>
    public void Stop()
    {
        Thread? thread;
        lock (_gate)
        {
            _cts?.Cancel();
            thread = _thread;
        }
        if (thread != null && thread != Thread.CurrentThread) thread.Join(JoinTimeoutMs);
    }

    /// <summary>Drops all tracks at the next frame (new ids start from 1).</summary>
    public void ResetTracks() => _resetTracks = true;

    public void Dispose()
    {
        Stop();
        _cts?.Dispose();
    }

    private void Loop(CancellationToken token)
    {
        var watch = new Stopwatch();
        long sequence = 0;
        double lastTickMs = -1, intervalEma = 0;
        var clock = Stopwatch.StartNew();
        try
        {
            while (!token.IsCancellationRequested)
            {
                var o = Options;
                double tickStart = clock.Elapsed.TotalMilliseconds;
                watch.Restart();
                using var frame = _frameProvider();
                double captureMs = watch.Elapsed.TotalMilliseconds;
                if (frame != null && !frame.Empty())
                {
                    watch.Restart();
                    var result = _detector.DetectTimed(frame, o.Profile ?? YoloInferenceProfile.Default);
                    var detections = result.Detections;
                    double inferenceMs = watch.Elapsed.TotalMilliseconds;
                    var tracks = UpdateTracks(o, detections);
                    double latencyMs = captureMs + watch.Elapsed.TotalMilliseconds;

                    double now = clock.Elapsed.TotalMilliseconds;
                    if (lastTickMs >= 0)
                    {
                        double interval = now - lastTickMs;
                        intervalEma = intervalEma <= 0 ? interval : intervalEma + FpsSmoothing * (interval - intervalEma);
                    }
                    lastTickMs = now;
                    double fps = intervalEma > 0 ? 1000.0 / intervalEma : 0;
                    FrameProcessed?.Invoke(this, new LiveDetectionFrame(++sequence, DateTime.UtcNow, frame, detections, tracks,
                        fps, latencyMs, captureMs, inferenceMs, result.Timing));
                }

                if (o.TargetFps > 0)
                {
                    int wait = (int)(1000.0 / o.TargetFps - (clock.Elapsed.TotalMilliseconds - tickStart));
                    if (wait > 0) token.WaitHandle.WaitOne(wait);
                }
            }
        }
        catch (Exception ex)
        {
            Faulted?.Invoke(this, ex);
        }
    }

    private IReadOnlyList<YoloTrack> UpdateTracks(YoloLiveOptions o, IReadOnlyList<YoloDetection> detections)
    {
        if (!o.Track)
        {
            _tracker = null;
            return Array.Empty<YoloTrack>();
        }
        if (_resetTracks)
        {
            _resetTracks = false;
            _tracker = null;
        }
        _tracker ??= new YoloFrameTracker(o.Tracker);
        _tracker.Options = o.Tracker ?? YoloTrackerOptions.Default;
        return _tracker.Update(detections);
    }
}
