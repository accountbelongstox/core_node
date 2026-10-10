// PY-REF: none (DOT-only)
using DotCore.ScreenCapture;
using DotCore.Utils;
using DotCore.Utils.ImagePreprocess;
using OpenCvSharp;

namespace DotApps.d3d4tester.Core.D4.Agent;

/// <summary>
/// One captured frame: BGR game window image (owned by the receiver), its screen offset, timestamp, window handle and whether the
/// image includes the window frame (windowed mode; standard coordinates are then scaled with the D4 borders).
/// </summary>
public sealed record D4Frame(Mat Image, (int X, int Y) ScreenOffset, TimeSpan Timestamp, IntPtr Hwnd, bool Windowed) : IDisposable
{
    public (int Width, int Height) Size => (Image.Width, Image.Height);

    public (int X, int Y) Scale(int x, int y) => D4StandardCoords.Scale(x, y, Size, Windowed);

    public Rect Scale(D4StdRegion region)
    {
        var (x1, y1) = Scale(region.X1, region.Y1);
        var (x2, y2) = Scale(region.X2, region.Y2);
        x1 = Math.Clamp(x1, 0, Image.Width);
        y1 = Math.Clamp(y1, 0, Image.Height);
        x2 = Math.Clamp(x2, 0, Image.Width);
        y2 = Math.Clamp(y2, 0, Image.Height);
        return new Rect(x1, y1, Math.Max(0, x2 - x1), Math.Max(0, y2 - y1));
    }

    public void Dispose() => Image.Dispose();
}

/// <summary>Frame input of the agent: the live D4 window or a recorded video (offline replay).</summary>
public interface ID4FrameSource : IDisposable
{
    /// <summary>True when the source can end (video); a live source only ends when stopped.</summary>
    bool IsFinite { get; }

    /// <summary>Next frame, or null: end of video, or no D4 window right now (live).</summary>
    D4Frame? Next();
}

/// <summary>Window-only capture of the Diablo IV client through the shared screenshot provider (same lookup as the D4 pipeline).</summary>
public sealed class D4LiveFrameSource : ID4FrameSource
{
    private readonly DateTime _started = DateTime.UtcNow;

    public bool IsFinite => false;

    public D4Frame? Next()
    {
        var window = D4Manager.Instance.FindFirstWindow();
        if (window == null || window.Hwnd == IntPtr.Zero) return null;
        var shot = ScreenCaptureService.GetScreenshotProvider().Gen(new ScreenCaptureOptions
        {
            WindowTitles = D4Constants.WindowTitles,
            WindowOnly = true,
        });
        if (shot?.GameWindowImage == null) return null;
        var image = ImageConvert.NormalizeToBgr(shot.GameWindowImage);
        var (fw, fh) = shot.FullscreenSize;
        bool windowed = fw - image.Width >= D4Constants.WindowedThreshold && fh - image.Height >= D4Constants.WindowedThreshold;
        return new D4Frame(image, shot.WindowOffset, DateTime.UtcNow - _started, window.Hwnd, windowed);
    }

    public static bool IsForeground(IntPtr hwnd) => WindowInputHelper.IsForegroundWindow(hwnd);

    public void Dispose()
    {
    }
}

/// <summary>Every FrameStep-th frame of a recorded video (decoded on the agent thread; timestamps from the video frame rate).</summary>
public sealed class D4VideoFrameSource : ID4FrameSource
{
    private readonly VideoCapture _capture;
    private readonly int _step;
    private readonly double _fps;
    private int _index;

    public D4VideoFrameSource(string path, int frameStep)
    {
        if (!File.Exists(path)) throw new FileNotFoundException(null, path);
        _capture = new VideoCapture(path);
        if (!_capture.IsOpened()) throw new InvalidOperationException($"Cannot open video: {path}");
        _step = Math.Max(1, frameStep);
        _fps = _capture.Fps;
        FrameCount = (int)_capture.Get(VideoCaptureProperties.FrameCount);
    }

    public bool IsFinite => true;

    public int FrameCount { get; }

    public D4Frame? Next()
    {
        var image = new Mat();
        if (!_capture.Read(image) || image.Empty())
        {
            image.Dispose();
            return null;
        }
        var timestamp = _fps > 0 ? TimeSpan.FromSeconds(_index / _fps) : TimeSpan.Zero;
        for (int skip = 1; skip < _step; skip++)
        {
            if (!_capture.Grab()) break;
        }
        _index += _step;
        return new D4Frame(image, (0, 0), timestamp, IntPtr.Zero, false);
    }

    public void Dispose() => _capture.Dispose();
}
