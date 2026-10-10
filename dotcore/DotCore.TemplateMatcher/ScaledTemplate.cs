// PY-REF: none (DOT-only)
using System.Collections.Concurrent;
using OpenCvSharp;

namespace DotCore.TemplateMatcher;

/// <summary>
/// BGR template with its resized copies (aspect kept, INTER_AREA) cached per width, for repeated multi-scale matching of the same
/// template; thread-safe. Owns its images: dispose it when no match uses it any more.
/// </summary>
public sealed class ScaledTemplate : IDisposable
{
    private readonly Mat _bgr;
    private readonly ConcurrentDictionary<int, Lazy<Mat>> _sized = new();

    public ScaledTemplate(Mat template) => _bgr = ToBgr(template);

    public int Cols => _bgr.Cols;

    public int Rows => _bgr.Rows;

    public bool Empty => _bgr.Empty();

    /// <summary>Template height at the given width (aspect kept).</summary>
    public int HeightFor(int width) => Math.Max(1, (int)Math.Round(_bgr.Rows * (double)width / _bgr.Cols));

    /// <summary>The template resized to the given width, created once.</summary>
    public Mat Sized(int width) =>
        _sized.GetOrAdd(width, w => new Lazy<Mat>(() => _bgr.Resize(new Size(w, HeightFor(w)), 0, 0, InterpolationFlags.Area))).Value;

    internal static Mat ToBgr(Mat image) => image.Channels() switch
    {
        4 => image.CvtColor(ColorConversionCodes.BGRA2BGR),
        1 => image.CvtColor(ColorConversionCodes.GRAY2BGR),
        _ => image.Clone(),
    };

    public void Dispose()
    {
        foreach (var sized in _sized.Values)
            if (sized.IsValueCreated) sized.Value.Dispose();
        _sized.Clear();
        _bgr.Dispose();
    }
}
