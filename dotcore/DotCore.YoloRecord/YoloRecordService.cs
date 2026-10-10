// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/yolo_record.py
// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/yolo_train_flow.py
using System.Drawing;
using System.Globalization;
using DotCore.ScreenCapture;
using DotCore.VocAnnotator;
using OpenCvSharp;
using OpenCvSharp.Extensions;

namespace DotCore.YoloRecord;

/// <summary>
/// Native YOLO record session: capture window by hwnd at FrameFPS, resize to FrameWidth x FrameHeight, write to segment/record/{segment timestamp}/
/// (frame_XXXXXX.jpg or video.avi when OutputAsVideo, data.csv timestamps when LogTimestamp). Frames are written only while a record segment is active.
/// 1:1 Python dotapps/d3d4tester/reference/py_d3check/d3utils/yolo_record.py run_gameaisdk_start_record / start_record_segment / end_record_segment / stop_record / is_recording,
/// replacing the embedded GameAISDK RecordSession (its Debug action-box overlay window has no native equivalent and is ignored).
/// </summary>
public sealed class YoloRecordService
{
    public const string ErrorAlreadyRecording = "already_recording";
    public const string ErrorProjectPathRequired = "project_path_required";
    public const string ErrorWindowsHwndRequired = "windows_hwnd_required";
    public const string TimestampCsvName = "data.csv";
    public const string SegmentDirFormat = "yyyy-MM-dd_HH-mm-ss";
    public const string VideoFourcc = "MJPG";
    private const int MinIntervalMs = 1;

    private readonly object _sync = new();
    private CancellationTokenSource? _cts;
    private Task? _recordTask;
    private string? _segmentRecordDir;
    private VideoWriter? _videoWriter;
    private StreamWriter? _timestampWriter;
    private int _segmentFrameIndex;
    private int _totalFrames;
    private YoloRecordConfig _config = new();
    private int _width;
    private int _height;

    public Action<string>? OnLog { get; set; }

    /// <summary>True when the capture loop is running.</summary>
    public bool IsRecording => _recordTask != null && !_recordTask.IsCompleted;

    /// <summary>Segment dir (project/seg_0_...) of the current session; record output is under its record/.</summary>
    public string? SegmentPath { get; private set; }

    public bool IsSegmentActive
    {
        get { lock (_sync) return _segmentRecordDir != null; }
    }

    /// <summary>Start a session: create a new segment under projectPath (unified layout) and begin capturing. Returns (ok, error code or message, projectPath).</summary>
    public (bool Ok, string Error, string? ProjectPath) StartRecord(string? projectPath, IntPtr hwnd, int width, int height, YoloRecordConfig config)
    {
        if (IsRecording)
            return (false, ErrorAlreadyRecording, null);
        if (string.IsNullOrWhiteSpace(projectPath))
            return (false, ErrorProjectPathRequired, null);
        if (hwnd == IntPtr.Zero)
            return (false, ErrorWindowsHwndRequired, null);
        var projectAbs = YoloDataLayout.TrimSeparators(Path.GetFullPath(projectPath));
        string segmentPath = projectAbs;
        try
        {
            var (ct, name) = YoloDataLayout.ParseProjectPathToClientProject(projectAbs);
            if (!string.IsNullOrEmpty(ct) && !string.IsNullOrEmpty(name))
                segmentPath = YoloDataLayout.EnsureSegmentDirs3(ct, name, YoloSegmentLayout.MakeSegmentId());
            else
                Directory.CreateDirectory(projectAbs);
            Directory.CreateDirectory(Path.Combine(segmentPath, YoloSegmentLayout.RecordSubdir));
        }
        catch (Exception ex)
        {
            return (false, ex.Message, null);
        }

        _config = config ?? new YoloRecordConfig();
        _width = width > 0 ? width : YoloRecordConfig.DefaultFrameWidth;
        _height = height > 0 ? height : YoloRecordConfig.DefaultFrameHeight;
        _totalFrames = 0;
        SegmentPath = segmentPath;
        var fps = Math.Clamp(_config.FrameFps, YoloRecordConfig.MinFrameFps, YoloRecordConfig.MaxFrameFps);
        var intervalMs = Math.Max(MinIntervalMs, 1000 / fps);
        _cts = new CancellationTokenSource();
        var token = _cts.Token;
        _recordTask = Task.Run(() => RecordLoop(hwnd, intervalMs, token), token);
        return (true, "", projectAbs);
    }

    /// <summary>Begin writing a new record/{timestamp}/ sub-dir. False when not recording.</summary>
    public bool StartSegment()
    {
        if (!IsRecording || SegmentPath == null) return false;
        lock (_sync)
        {
            CloseSegmentLocked();
            var dir = Path.Combine(SegmentPath, YoloSegmentLayout.RecordSubdir, DateTime.Now.ToString(SegmentDirFormat, CultureInfo.InvariantCulture));
            Directory.CreateDirectory(dir);
            _segmentRecordDir = dir;
            _segmentFrameIndex = 0;
            var fps = Math.Clamp(_config.FrameFps, YoloRecordConfig.MinFrameFps, YoloRecordConfig.MaxFrameFps);
            if (_config.OutputAsVideo)
                _videoWriter = new VideoWriter(Path.Combine(dir, YoloSegmentLayout.VideoFileName), FourCC.FromString(VideoFourcc), fps, new OpenCvSharp.Size(_width, _height));
            if (_config.LogTimestamp)
                _timestampWriter = new StreamWriter(Path.Combine(dir, TimestampCsvName));
        }
        return true;
    }

    /// <summary>Close the active record sub-dir. False when not recording.</summary>
    public bool EndSegment()
    {
        if (!IsRecording) return false;
        lock (_sync) CloseSegmentLocked();
        return true;
    }

    /// <summary>End then start a segment. 1:1 flow1_new_segment.</summary>
    public bool NewSegment()
    {
        EndSegment();
        return StartSegment();
    }

    /// <summary>End segment and stop the capture loop.</summary>
    public async Task StopRecordAsync()
    {
        var cts = _cts;
        var task = _recordTask;
        cts?.Cancel();
        if (task != null)
        {
            try { await task.ConfigureAwait(false); }
            catch (OperationCanceledException) { }
        }
        lock (_sync) CloseSegmentLocked();
        _recordTask = null;
        _cts = null;
        cts?.Dispose();
    }

    private void RecordLoop(IntPtr hwnd, int intervalMs, CancellationToken token)
    {
        var provider = ScreenCaptureService.GetScreenshotProvider();
        while (!token.IsCancellationRequested)
        {
            if (IsSegmentActive)
            {
                try
                {
                    using Bitmap? bmp = provider.CaptureWindow(hwnd);
                    if (bmp != null)
                        WriteFrame(bmp);
                }
                catch (Exception ex)
                {
                    OnLog?.Invoke("Capture error: " + ex.Message);
                }
            }
            try
            {
                Task.Delay(intervalMs, token).GetAwaiter().GetResult();
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
        OnLog?.Invoke($"Stopped. {_totalFrames} frames in {Path.Combine(SegmentPath ?? "", YoloSegmentLayout.RecordSubdir)}");
    }

    private Mat Letterbox(Mat scaled)
    {
        var canvas = new Mat(new OpenCvSharp.Size(_width, _height), scaled.Type(), Scalar.All(0));
        int x = (_width - scaled.Width) / 2, y = (_height - scaled.Height) / 2;
        scaled.CopyTo(new Mat(canvas, new Rect(x, y, scaled.Width, scaled.Height)));
        return canvas;
    }

    private void WriteFrame(Bitmap bmp)
    {
        using var src = BitmapConverter.ToMat(bmp);
        using var bgr = new Mat();
        if (src.Channels() == 4)
            Cv2.CvtColor(src, bgr, ColorConversionCodes.BGRA2BGR);
        else
            src.CopyTo(bgr);
        // Keep the window aspect: fit inside FrameWidth x FrameHeight (a stretched frame would distort every object);
        // the video writer needs a constant size, so video frames are letterboxed into it.
        double fit = Math.Min(_width / (double)bgr.Width, _height / (double)bgr.Height);
        var fitted = new OpenCvSharp.Size(Math.Max(1, (int)Math.Round(bgr.Width * fit)), Math.Max(1, (int)Math.Round(bgr.Height * fit)));
        using var scaled = new Mat();
        Cv2.Resize(bgr, scaled, fitted, 0, 0, fit < 1 ? InterpolationFlags.Area : InterpolationFlags.Linear);
        using var resized = _videoWriter == null ? scaled.Clone() : Letterbox(scaled);
        lock (_sync)
        {
            if (_segmentRecordDir == null) return;
            var name = $"frame_{_segmentFrameIndex:D6}{YoloSegmentLayout.JpgExtension}";
            if (_videoWriter != null)
                _videoWriter.Write(resized);
            else
                Cv2.ImWrite(Path.Combine(_segmentRecordDir, name), resized);
            _timestampWriter?.WriteLine(string.Create(CultureInfo.InvariantCulture, $"{_segmentFrameIndex},{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}"));
            _segmentFrameIndex++;
            _totalFrames++;
        }
    }

    private void CloseSegmentLocked()
    {
        _videoWriter?.Release();
        _videoWriter?.Dispose();
        _videoWriter = null;
        _timestampWriter?.Dispose();
        _timestampWriter = null;
        _segmentRecordDir = null;
    }
}
