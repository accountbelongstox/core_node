using System;
using System.Drawing;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using DotCore.ScreenCapture;

namespace DotCore.YoloRecord;

/// <summary>
/// YOLO recording: capture window by hwnd, write frames to segment/record/. Same behavior as GameAISDK/Python RecordSession; segment layout matches YoloSegmentLayout (record/, frames/) for UI consistency.
/// </summary>
public sealed class YoloRecordService
{
    public Action<string>? OnLog { get; set; }

    /// <summary>True when capture loop is running.</summary>
    public bool IsRecording => _recordTask != null && !_recordTask.IsCompleted;

    private CancellationTokenSource? _cts;
    private Task? _recordTask;
    private int _frameIndex;

    /// <summary>Start recording: create segment dir (projectPath/yyyyMMdd_HHmmss/record/), capture loop writes frame_XXXXX.png. Returns (success, segmentPath, error).</summary>
    public (bool Success, string? SegmentPath, string? Error) StartRecording(string projectPath, IntPtr hwnd, int fps)
    {
        if (string.IsNullOrWhiteSpace(projectPath) || !Directory.Exists(projectPath))
            return (false, null, "project_path required and must be an existing directory");
        if (hwnd == IntPtr.Zero)
            return (false, null, "window handle required");
        if (_recordTask != null && !_recordTask.IsCompleted)
            return (false, null, "already recording");

        string segmentId = DateTime.Now.ToString("yyyyMMdd_HHmmss");
        string segmentPath = Path.Combine(projectPath, segmentId);
        try
        {
            Directory.CreateDirectory(segmentPath);
            string recordDir = Path.Combine(segmentPath, YoloSegmentLayout.RecordSubdir);
            Directory.CreateDirectory(recordDir);
        }
        catch (Exception ex)
        {
            return (false, null, ex.Message);
        }

        _frameIndex = 0;
        int intervalMs = fps > 0 ? 1000 / fps : 500;
        _cts = new CancellationTokenSource();
        var token = _cts.Token;
        _recordTask = Task.Run(() => RecordLoop(hwnd, segmentPath, intervalMs, token), token);
        return (true, segmentPath, null);
    }

    /// <summary>Stop recording and flush.</summary>
    public async Task StopRecordingAsync()
    {
        _cts?.Cancel();
        if (_recordTask != null)
        {
            try
            {
                await _recordTask.ConfigureAwait(false);
            }
            catch (OperationCanceledException) { }
            _recordTask = null;
        }
        _cts = null;
    }

    private void RecordLoop(IntPtr hwnd, string segmentPath, int intervalMs, CancellationToken token)
    {
        string recordDir = Path.Combine(segmentPath, YoloSegmentLayout.RecordSubdir);
        try
        {
            while (!token.IsCancellationRequested)
            {
                try
                {
                    var provider = ScreenCaptureService.GetScreenshotProvider();
                    var data = provider.Gen(hwnd);
                    Bitmap? toSave = data?.GameWindowImage ?? data?.FullscreenImage;
                    if (toSave != null)
                    {
                        _frameIndex++;
                        string name = $"frame_{_frameIndex:D5}.png";
                        string path = Path.Combine(recordDir, name);
                        ScreenCaptureService.SaveToFile(toSave, path);
                    }
                }
                catch (Exception ex)
                {
                    OnLog?.Invoke("Capture error: " + ex.Message);
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
        }
        finally
        {
            OnLog?.Invoke($"Stopped. {_frameIndex} frames in {recordDir}");
        }
    }
}
