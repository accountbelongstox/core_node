// PY-REF: none (DOT-only)
using System.Numerics;
using DotCore.Foundations;
using OpenCvSharp;
using OpenCvSharp.Tracking;

namespace DotCore.YoloTaskSet;

public enum TrackDirection
{
    Forward,
    Backward,
}

/// <summary>Auto tries CSRT, then KCF, then normalized template matching.</summary>
public enum VariantTrackerKind
{
    Auto,
    Csrt,
    Kcf,
    Template,
}

/// <summary>Region of the tracked object in one frame; Confidence is the normalized similarity (0..1) to the start crop.</summary>
public sealed record TrackedRegion(int FrameIndex, VariantRegion Region, double Confidence);

/// <summary>
/// Track output (starts with the start frame); Lost when tracking stopped before maxCount / the end of the video;
/// Recoveries = frames where the OpenCV tracker failed or drifted and template matching re-found the object.
/// </summary>
public sealed record TrackResult(IReadOnlyList<TrackedRegion> Regions, VariantTrackerKind Tracker, bool Lost, int Recoveries = 0);

public static partial class VariantExtractor
{
    public const double DefaultMinTrackConfidence = 0.3;
    public const int DefaultDedupeDistance = 6;

    private const double TemplateSearchMargin = 1.0;
    private const double TemplateRetryScore = 0.5;
    private const double FlatTemplateStdDev = 2.0;
    private const int HashWidth = 9;
    private const int HashHeight = 8;
    private const byte HashMatte = 128;

    /// <summary>Opens the video once and tracks; see the reader overload.</summary>
    public static TrackResult Track(string videoPath, int startFrame, VariantRegion region, int step, int maxCount, TrackDirection direction,
        CancellationToken ct, IProgress<WorkProgress>? progress = null, VariantTrackerKind tracker = VariantTrackerKind.Auto,
        double minConfidence = DefaultMinTrackConfidence)
    {
        using var reader = new VideoFrameReader(videoPath);
        return Track(reader, startFrame, region, step, maxCount, direction, ct, progress, tracker, minConfidence);
    }

    /// <summary>
    /// Follows region from startFrame every step frames (forward or backward) for at most maxCount regions (start included).
    /// Stops early when the tracker fails or the similarity to the start crop drops below minConfidence.
    /// </summary>
    public static TrackResult Track(VideoFrameReader reader, int startFrame, VariantRegion region, int step, int maxCount, TrackDirection direction,
        CancellationToken ct, IProgress<WorkProgress>? progress = null, VariantTrackerKind tracker = VariantTrackerKind.Auto,
        double minConfidence = DefaultMinTrackConfidence)
    {
        step = Math.Max(1, step);
        maxCount = Math.Max(1, maxCount);
        var results = new List<TrackedRegion>();
        using var first = reader.ReadBgr(startFrame);
        if (first == null) return new TrackResult(results, tracker, true);
        var box = ToRect(region) & new Rect(0, 0, first.Width, first.Height);
        if (box.Width <= 0 || box.Height <= 0) return new TrackResult(results, tracker, true);
        using var template = new Mat(first, box).Clone();
        results.Add(new TrackedRegion(startFrame, ToRegion(box), 1.0));

        var (cvTracker, kind) = CreateTracker(tracker, first, box);
        int frameCount = reader.Info?.FrameCount ?? 0;
        int delta = direction == TrackDirection.Forward ? step : -step;
        bool lost = false;
        int recoveries = 0;
        try
        {
            for (int frame = startFrame + delta; results.Count < maxCount; frame += delta)
            {
                ct.ThrowIfCancellationRequested();
                if (frame < 0 || (frameCount > 0 && frame >= frameCount)) break;
                using var image = reader.ReadBgr(frame);
                if (image == null) break;
                var bounds = new Rect(0, 0, image.Width, image.Height);
                Rect next = box;
                double confidence = 0;
                bool ok = false;
                if (cvTracker != null)
                {
                    try
                    {
                        ok = cvTracker.Update(image, ref next);
                    }
                    catch (Exception ex) when (ex is OpenCVException or OpenCvSharpException)
                    {
                        ok = false;
                    }
                    next &= bounds;
                    ok = ok && next.Width > 0 && next.Height > 0;
                    if (ok) confidence = Similarity(template, image, next);
                    if (!ok || confidence < minConfidence)
                    {
                        var (found, score) = MatchNear(image, template, box);
                        if (score > confidence && score >= minConfidence)
                        {
                            (next, confidence, ok) = (found, score, true);
                            recoveries++;
                            cvTracker.Dispose();
                            cvTracker = CreateTracker(kind, image, next).Tracker;
                        }
                    }
                }
                else
                {
                    (next, confidence) = MatchNear(image, template, box);
                    ok = true;
                }
                if (!ok || confidence < minConfidence)
                {
                    lost = true;
                    break;
                }
                box = next;
                results.Add(new TrackedRegion(frame, ToRegion(box), confidence));
                progress?.Report(new WorkProgress(results.Count, maxCount));
            }
        }
        finally
        {
            cvTracker?.Dispose();
        }
        return new TrackResult(results, kind, lost, recoveries);
    }

    /// <summary>The same region on frames first..last every `every` frames (clamped to frameCount when it is known, i.e. &gt; 0).</summary>
    public static IReadOnlyList<TrackedRegion> FixedBox(VariantRegion region, int firstFrame, int lastFrame, int every, int frameCount = 0)
    {
        every = Math.Max(1, every);
        if (lastFrame < firstFrame) (firstFrame, lastFrame) = (lastFrame, firstFrame);
        firstFrame = Math.Max(0, firstFrame);
        if (frameCount > 0) lastFrame = Math.Min(lastFrame, frameCount - 1);
        var list = new List<TrackedRegion>();
        for (int f = firstFrame; f <= lastFrame; f += every) list.Add(new TrackedRegion(f, region, 1.0));
        return list;
    }

    /// <summary>64-bit difference hash (dHash) of an 8-bit gray / BGR / BGRA image; alpha is composited over mid gray.</summary>
    public static ulong PerceptualHash(Mat image)
    {
        using var bgra = ToBgra(image) ?? throw new ArgumentException("Unsupported image", nameof(image));
        using var gray = new Mat();
        using (var flat = Flatten(bgra)) Cv2.CvtColor(flat, gray, ColorConversionCodes.BGR2GRAY);
        using var small = new Mat();
        Cv2.Resize(gray, small, new Size(HashWidth, HashHeight), 0, 0, InterpolationFlags.Area);
        ulong hash = 0;
        int bit = 0;
        for (int y = 0; y < HashHeight; y++)
            for (int x = 0; x < HashWidth - 1; x++, bit++)
                if (small.At<byte>(y, x) < small.At<byte>(y, x + 1)) hash |= 1UL << bit;
        return hash;
    }

    /// <summary>dHash of encoded image bytes (e.g. a cut PNG); null when undecodable.</summary>
    public static ulong? PerceptualHash(byte[] encoded)
    {
        try
        {
            using var mat = Cv2.ImDecode(encoded, ImreadModes.Unchanged);
            return mat.Empty() ? null : PerceptualHash(mat);
        }
        catch (Exception ex) when (ex is OpenCVException or OpenCvSharpException or ArgumentException)
        {
            return null;
        }
    }

    public static int HashDistance(ulong a, ulong b) => BitOperations.PopCount(a ^ b);

    /// <summary>Indices to keep, in order: an item is dropped when its hash is closer than minDistance bits to an already kept one.</summary>
    public static IReadOnlyList<int> Dedupe(IReadOnlyList<ulong> hashes, int minDistance = DefaultDedupeDistance)
    {
        var kept = new List<int>();
        for (int i = 0; i < hashes.Count; i++)
            if (kept.All(k => HashDistance(hashes[k], hashes[i]) >= minDistance)) kept.Add(i);
        return kept;
    }

    private static Mat Flatten(Mat bgra)
    {
        using var matte = new Mat(bgra.Size(), MatType.CV_8UC3, Scalar.All(HashMatte));
        var channels = Cv2.Split(bgra);
        try
        {
            using var bgr = new Mat();
            Cv2.Merge(channels[..3], bgr);
            using var alpha = new Mat();
            channels[3].ConvertTo(alpha, MatType.CV_32F, 1.0 / byte.MaxValue);
            using var alpha3 = new Mat();
            Cv2.Merge(new[] { alpha, alpha, alpha }, alpha3);
            using var fg = new Mat();
            using var bg = new Mat();
            bgr.ConvertTo(fg, MatType.CV_32FC3);
            matte.ConvertTo(bg, MatType.CV_32FC3);
            using var inverse = new Mat();
            Cv2.Subtract(Scalar.All(1.0), alpha3, inverse);
            using var a = fg.Mul(alpha3).ToMat();
            using var b = bg.Mul(inverse).ToMat();
            using var sum = new Mat();
            Cv2.Add(a, b, sum);
            var result = new Mat();
            sum.ConvertTo(result, MatType.CV_8UC3);
            return result;
        }
        finally
        {
            foreach (var c in channels) c.Dispose();
        }
    }

    private static (Tracker? Tracker, VariantTrackerKind Kind) CreateTracker(VariantTrackerKind requested, Mat first, Rect box)
    {
        var order = requested switch
        {
            VariantTrackerKind.Auto => new[] { VariantTrackerKind.Csrt, VariantTrackerKind.Kcf },
            VariantTrackerKind.Template => Array.Empty<VariantTrackerKind>(),
            _ => new[] { requested },
        };
        foreach (var kind in order)
        {
            Tracker? tracker = null;
            try
            {
                tracker = kind == VariantTrackerKind.Csrt ? TrackerCSRT.Create() : TrackerKCF.Create();
                tracker.Init(first, box);
                return (tracker, kind);
            }
            catch (Exception ex) when (ex is OpenCVException or OpenCvSharpException or DllNotFoundException or EntryPointNotFoundException)
            {
                tracker?.Dispose();
                ColorPrinter.Gray($"[YoloTaskSet] tracker {kind} unavailable, falling back: {ex.Message}");
            }
        }
        return (null, VariantTrackerKind.Template);
    }

    /// <summary>Best TM_CCOEFF_NORMED match of the start crop near the last box, else over the whole frame (size kept).</summary>
    private static (Rect Box, double Score) MatchNear(Mat image, Mat template, Rect last)
    {
        var bounds = new Rect(0, 0, image.Width, image.Height);
        int mx = (int)Math.Ceiling(last.Width * TemplateSearchMargin), my = (int)Math.Ceiling(last.Height * TemplateSearchMargin);
        var window = new Rect(last.X - mx, last.Y - my, last.Width + 2 * mx, last.Height + 2 * my) & bounds;
        var (box, score) = MatchIn(image, template, window);
        if (score < TemplateRetryScore && window != bounds)
        {
            var (fullBox, fullScore) = MatchIn(image, template, bounds);
            if (fullScore > score) (box, score) = (fullBox, fullScore);
        }
        return (box, score);
    }

    private static (Rect Box, double Score) MatchIn(Mat image, Mat template, Rect window)
    {
        if (window.Width < template.Width || window.Height < template.Height) return (default, 0);
        using var area = new Mat(image, window);
        using var scores = new Mat();
        Cv2.MatchTemplate(area, template, scores, TemplateMatchModes.CCoeffNormed);
        Cv2.MinMaxLoc(scores, out _, out double max, out _, out Point loc);
        var box = new Rect(window.X + loc.X, window.Y + loc.Y, template.Width, template.Height);
        if (double.IsNaN(max) || double.IsInfinity(max)) max = Similarity(template, image, box);
        return (box, Math.Clamp(max, 0, 1));
    }

    /// <summary>NCC of the box (resized to the template size) and the template; for flat templates 1 - mean abs difference.</summary>
    private static double Similarity(Mat template, Mat image, Rect box)
    {
        using var patch = new Mat();
        using (var roi = new Mat(image, box)) Cv2.Resize(roi, patch, template.Size(), 0, 0, InterpolationFlags.Area);
        Cv2.MeanStdDev(template, out _, out var std);
        if (Math.Max(std.Val0, Math.Max(std.Val1, std.Val2)) < FlatTemplateStdDev)
        {
            using var diff = new Mat();
            Cv2.Absdiff(template, patch, diff);
            var mean = Cv2.Mean(diff);
            return 1 - (mean.Val0 + mean.Val1 + mean.Val2) / (3.0 * byte.MaxValue);
        }
        using var score = new Mat();
        Cv2.MatchTemplate(patch, template, score, TemplateMatchModes.CCoeffNormed);
        double v = score.At<float>(0, 0);
        return double.IsNaN(v) ? 0 : Math.Clamp(v, 0, 1);
    }
}
