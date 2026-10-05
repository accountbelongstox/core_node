// PY-REF: none (DOT-only)
using DotCore.Foundations;
using OpenCvSharp;

namespace DotCore.YoloTaskSet;

/// <summary>
/// One open source (video, or a still image as a single frame) with sequential/seek access and an LRU of decoded frames.
/// Returned Mats are copies owned by the caller. Thread-safe.
/// </summary>
public sealed class VideoFrameReader : IDisposable
{
    public const int DefaultCacheCapacity = 8;

    // Forward gaps up to this many frames are grabbed instead of seeking (a seek decodes from the previous keyframe).
    private const int SequentialGapLimit = 48;

    private readonly object _gate = new();
    private readonly int _capacity;
    private readonly LinkedList<(int Index, Mat Frame)> _lru = new();
    private readonly Dictionary<int, LinkedListNode<(int Index, Mat Frame)>> _cache = new();
    private VideoCapture? _capture;
    private Mat? _image;
    private int _next;
    private bool _seekExact = true;
    private bool _disposed;

    public VideoFrameReader(string sourcePath, int cacheCapacity = DefaultCacheCapacity)
    {
        SourcePath = Path.GetFullPath(sourcePath);
        IsVideo = TaskSetStore.IsSupportedVideo(SourcePath);
        _capacity = Math.Max(1, cacheCapacity);
        if (IsVideo)
        {
            _capture = Open();
            if (_capture != null)
                Info = new VideoInfo(Math.Max(0, _capture.FrameCount), _capture.Fps, _capture.FrameWidth, _capture.FrameHeight);
        }
        else
        {
            using var bgra = TaskSetImageIo.ReadBgra(SourcePath);
            if (bgra != null)
            {
                _image = bgra.Clone();
                Info = new VideoInfo(1, 0, bgra.Width, bgra.Height);
            }
        }
    }

    public string SourcePath { get; }

    public bool IsVideo { get; }

    public bool IsOpened => Info != null;

    /// <summary>Stills report FrameCount 1 and Fps 0; null when the source cannot be opened.</summary>
    public VideoInfo? Info { get; }

    /// <summary>8-bit BGR frame, or null past the end / when unreadable. Stills ignore frameIndex.</summary>
    public Mat? ReadBgr(int frameIndex)
    {
        lock (_gate)
        {
            ObjectDisposedException.ThrowIf(_disposed, this);
            if (_image != null)
            {
                var bgr = new Mat();
                Cv2.CvtColor(_image, bgr, ColorConversionCodes.BGRA2BGR);
                return bgr;
            }
            var frame = Fetch(Math.Max(0, frameIndex));
            return frame?.Clone();
        }
    }

    /// <summary>8-bit BGRA frame (stills keep their alpha), or null.</summary>
    public Mat? ReadBgra(int frameIndex)
    {
        lock (_gate)
        {
            ObjectDisposedException.ThrowIf(_disposed, this);
            if (_image != null) return _image.Clone();
            var frame = Fetch(Math.Max(0, frameIndex));
            if (frame == null) return null;
            var bgra = new Mat();
            Cv2.CvtColor(frame, bgra, ColorConversionCodes.BGR2BGRA);
            return bgra;
        }
    }

    public byte[]? ReadPng(int frameIndex)
    {
        using var bgra = ReadBgra(frameIndex);
        return bgra == null ? null : TaskSetImageIo.EncodePng(bgra);
    }

    public void Dispose()
    {
        lock (_gate)
        {
            if (_disposed) return;
            _disposed = true;
            foreach (var (_, frame) in _lru) frame.Dispose();
            _lru.Clear();
            _cache.Clear();
            _capture?.Dispose();
            _capture = null;
            _image?.Dispose();
            _image = null;
        }
    }

    private Mat? Fetch(int index)
    {
        if (_cache.TryGetValue(index, out var node))
        {
            _lru.Remove(node);
            _lru.AddFirst(node);
            return node.Value.Frame;
        }
        if (_capture == null) return null;
        Mat? frame;
        try
        {
            frame = Decode(index);
        }
        catch (Exception ex) when (ex is OpenCVException or OpenCvSharpException)
        {
            ColorPrinter.Yellow($"[YoloTaskSet] cannot read frame {index} of {SourcePath}: {ex.Message}");
            Reopen();
            return null;
        }
        if (frame == null) return null;
        _cache[index] = _lru.AddFirst((index, frame));
        while (_lru.Count > _capacity)
        {
            var last = _lru.Last!;
            _lru.RemoveLast();
            _cache.Remove(last.Value.Index);
            last.Value.Frame.Dispose();
        }
        return frame;
    }

    private Mat? Decode(int index)
    {
        if (index >= _next && index - _next <= SequentialGapLimit) return ReadForward(index);
        if (_seekExact)
        {
            if (_capture!.Set(VideoCaptureProperties.PosFrames, index))
            {
                var frame = new Mat();
                if (_capture.Read(frame) && !frame.Empty() && (int)Math.Round(_capture.Get(VideoCaptureProperties.PosFrames)) == index + 1)
                {
                    _next = index + 1;
                    return frame;
                }
                frame.Dispose();
            }
            _seekExact = false;
            Reopen();
        }
        else if (index < _next)
        {
            Reopen();
        }
        return ReadForward(index);
    }

    private Mat? ReadForward(int index)
    {
        if (_capture == null) return null;
        while (_next < index)
        {
            if (!_capture.Grab()) return null;
            _next++;
        }
        var frame = new Mat();
        if (_capture.Read(frame) && !frame.Empty())
        {
            _next = index + 1;
            return frame;
        }
        frame.Dispose();
        return null;
    }

    private void Reopen()
    {
        _capture?.Dispose();
        _capture = Open();
        _next = 0;
    }

    private VideoCapture? Open()
    {
        try
        {
            var capture = new VideoCapture(SourcePath);
            if (capture.IsOpened()) return capture;
            capture.Dispose();
        }
        catch (Exception ex) when (ex is OpenCVException or OpenCvSharpException)
        {
            ColorPrinter.Yellow($"[YoloTaskSet] cannot open video {SourcePath}: {ex.Message}");
        }
        return null;
    }
}
