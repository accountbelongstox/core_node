// PY-REF: none (DOT-only)
using System.Collections.Concurrent;
using OpenCvSharp;

namespace DotCore.TemplateMatcher;

/// <summary>
/// An icon with transparent surroundings (item / gem art) for matching on a game background: BGR art cut to the bounding box of its
/// visible pixels and a 3-channel mask of them (alpha >= <see cref="AlphaVisible"/>; images without alpha: any channel above
/// <see cref="DarkLevel"/>). Resized copies are cached per height; thread-safe. Loaded files are cached by path (<see cref="Load"/>).
/// </summary>
public sealed class MaskedIcon : IDisposable
{
    public const int AlphaVisible = 128;
    public const int DarkLevel = 16;
    private const int MinSidePx = 4;
    private static readonly ConcurrentDictionary<string, Lazy<MaskedIcon?>> Files = new(StringComparer.OrdinalIgnoreCase);

    private readonly Mat _bgr;
    private readonly Mat _mask;
    private readonly ConcurrentDictionary<int, Lazy<(Mat Bgr, Mat Mask)>> _sized = new();

    private MaskedIcon(string path, Mat bgr, Mat mask)
    {
        Path = path;
        _bgr = bgr;
        _mask = mask;
    }

    public string Path { get; }

    public int Cols => _bgr.Cols;

    public int Rows => _bgr.Rows;

    /// <summary>Height / width of the visible art (about 2 for weapons and armor, about 1 for rings, amulets, belts, gems).</summary>
    public double Aspect => _bgr.Rows / (double)_bgr.Cols;

    /// <summary>Visible art and mask resized to the given height (aspect kept, INTER_AREA), created once.</summary>
    public (Mat Bgr, Mat Mask) Sized(int height) => _sized.GetOrAdd(height, h => new Lazy<(Mat, Mat)>(() =>
    {
        var size = new Size(Math.Max(1, (int)Math.Round(_bgr.Cols * (double)h / _bgr.Rows)), h);
        var bgr = _bgr.Resize(size, 0, 0, InterpolationFlags.Area);
        using var soft = _mask.Resize(size, 0, 0, InterpolationFlags.Area);
        var mask = soft.Threshold(AlphaVisible - 1, 255, ThresholdTypes.Binary);
        return (bgr, mask);
    })).Value;

    /// <summary>Icon of an image file (cached by path); null when unreadable or without visible pixels.</summary>
    public static MaskedIcon? Load(string path) => Files.GetOrAdd(path, p => new Lazy<MaskedIcon?>(() => Read(p))).Value;

    /// <summary>Icon of an in-memory image (BGR, BGRA or gray; the caller keeps ownership); null when it has no visible pixels.</summary>
    public static MaskedIcon? FromImage(Mat image, string name) => Cut(image, name);

    private static MaskedIcon? Read(string path)
    {
        if (!File.Exists(path)) return null;
        using var image = Cv2.ImRead(path, ImreadModes.Unchanged);
        return image.Empty() ? null : Cut(image, path);
    }

    private static MaskedIcon? Cut(Mat image, string name)
    {
        using var bgr = ScaledTemplate.ToBgr(image);
        using var alpha = image.Channels() == 4 ? image.ExtractChannel(3) : VisibleByBrightness(bgr);
        using var visible = alpha.Threshold(AlphaVisible - 1, 255, ThresholdTypes.Binary);
        var box = Cv2.BoundingRect(visible);
        if (box.Width < MinSidePx || box.Height < MinSidePx) return null;
        using var mask1 = new Mat(visible, box);
        var mask = new Mat();
        Cv2.Merge(new[] { mask1, mask1, mask1 }, mask);
        return new MaskedIcon(name, new Mat(bgr, box).Clone(), mask);
    }

    private static Mat VisibleByBrightness(Mat bgr)
    {
        using var max = new Mat();
        var channels = bgr.Split();
        Cv2.Max(channels[0], channels[1], max);
        var result = new Mat();
        Cv2.Max(max, channels[2], result);
        foreach (var c in channels) c.Dispose();
        Cv2.Threshold(result, result, DarkLevel, 255, ThresholdTypes.Binary);
        return result;
    }

    public void Dispose()
    {
        foreach (var sized in _sized.Values)
            if (sized.IsValueCreated)
            {
                sized.Value.Bgr.Dispose();
                sized.Value.Mask.Dispose();
            }
        _sized.Clear();
        _bgr.Dispose();
        _mask.Dispose();
    }
}

/// <summary>
/// Which of many <see cref="MaskedIcon"/>s a small image region shows (an inventory cell): each icon is resized to a few sizes relative
/// to its fit in the region (aspect kept) and matched with masked TM_CCOEFF_NORMED (only the icon's visible pixels count, so the cell
/// background does not); the best position and size give the icon's score. Candidates are scored in parallel.
/// </summary>
public static class MaskedIconMatcher
{
    /// <summary>Icon size / its fitted size in the region tried by default (the art fills most of an inventory cell).</summary>
    public static readonly IReadOnlyList<double> DefaultFitRatios = new[] { 0.72, 0.8, 0.88, 0.96 };

    /// <summary>Best masked score of one icon on the region (BGR); -1 when the icon does not fit at any tried size.</summary>
    public static double Score(Mat region, MaskedIcon icon, IReadOnlyList<double>? fitRatios = null)
    {
        double best = -1;
        double fit = Math.Min(region.Rows / (double)icon.Rows, region.Cols / (double)icon.Cols);
        foreach (double ratio in fitRatios ?? DefaultFitRatios)
        {
            int h = (int)Math.Floor(icon.Rows * fit * ratio);
            if (h < 4) continue;
            var (bgr, mask) = icon.Sized(h);
            if (bgr.Cols > region.Cols || bgr.Rows > region.Rows) continue;
            using var result = new Mat();
            Cv2.MatchTemplate(region, bgr, result, TemplateMatchModes.CCoeffNormed, mask);
            Cv2.PatchNaNs(result, -1);
            Cv2.MinMaxLoc(result, out _, out double max);
            if (max <= 1.0001 && max > best) best = max;
        }
        return best;
    }

    /// <summary>Candidates ranked by score (best first), at most <paramref name="top"/>; candidates without an icon are skipped.</summary>
    public static IReadOnlyList<(T Item, double Score)> Rank<T>(Mat region, IEnumerable<T> candidates, Func<T, MaskedIcon?> icon, int top = 3,
        IReadOnlyList<double>? fitRatios = null)
    {
        using var bgr = ScaledTemplate.ToBgr(region);
        var scored = new ConcurrentBag<(T Item, double Score)>();
        Parallel.ForEach(candidates, c =>
        {
            if (icon(c) is not { } i) return;
            double s = Score(bgr, i, fitRatios);
            if (s > -1) scored.Add((c, s));
        });
        return scored.OrderByDescending(s => s.Score).Take(Math.Max(1, top)).ToList();
    }
}
