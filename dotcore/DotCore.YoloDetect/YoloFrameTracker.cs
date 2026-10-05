// PY-REF: none (DOT-only)
using OpenCvSharp;

namespace DotCore.YoloDetect;

/// <summary>
/// Tracker settings: detections at or above HighConfidence start and update tracks, those between LowConfidence and
/// HighConfidence only extend existing tracks (ByteTrack second pass). A track is reported after MinHits matches and
/// dropped after MaxMisses unmatched frames. Smoothing is the weight of a new detection in the box average (1 = none).
/// Pairs below MatchIou still match when the center shift is within MaxCenterShift x the larger track side (small, fast
/// objects have no box overlap between frames); 0 disables this fallback.
/// </summary>
public sealed record YoloTrackerOptions(
    float MatchIou = 0.3f,
    int MinHits = 3,
    int MaxMisses = 15,
    float HighConfidence = 0.5f,
    float LowConfidence = 0.1f,
    bool PerClass = true,
    float Smoothing = 0.6f,
    float MaxCenterShift = 1.0f)
{
    public static YoloTrackerOptions Default { get; } = new();
}

/// <summary>A confirmed track; Misses &gt; 0 means the box is predicted (object not seen this frame).</summary>
public sealed record YoloTrack(int TrackId, int ClassId, string ClassName, float Confidence, Rect Box, int Hits, int Misses, int Age)
{
    public Point Center => new(Box.X + Box.Width / 2, Box.Y + Box.Height / 2);
}

/// <summary>IoU multi-object tracker (ByteTrack-lite: two-stage matching, constant-velocity prediction). Not thread-safe.</summary>
public sealed class YoloFrameTracker
{
    private const double VelocityBlend = 0.5;

    private sealed class State
    {
        public int Id;
        public int ClassId;
        public string ClassName = string.Empty;
        public float Confidence;
        public double Cx, Cy, W, H, Vx, Vy;
        public int Hits, Misses, Age;

        public Rect Box => new((int)Math.Round(Cx - W / 2), (int)Math.Round(Cy - H / 2), (int)Math.Round(W), (int)Math.Round(H));
    }

    private readonly List<State> _tracks = new();
    private int _nextId = 1;

    public YoloTrackerOptions Options { get; set; }

    public YoloFrameTracker(YoloTrackerOptions? options = null) => Options = options ?? YoloTrackerOptions.Default;

    /// <summary>Confirmed tracks after the last Update (including coasting ones).</summary>
    public IReadOnlyList<YoloTrack> Tracks => Snapshot();

    public void Reset()
    {
        _tracks.Clear();
        _nextId = 1;
    }

    /// <summary>Advances one frame with that frame's detections and returns the confirmed tracks.</summary>
    public IReadOnlyList<YoloTrack> Update(IReadOnlyList<YoloDetection> detections)
    {
        var o = Options;
        foreach (var t in _tracks)
        {
            t.Cx += t.Vx;
            t.Cy += t.Vy;
            t.Age++;
        }

        var high = detections.Where(d => d.Confidence >= o.HighConfidence).ToList();
        var low = detections.Where(d => d.Confidence >= o.LowConfidence && d.Confidence < o.HighConfidence).ToList();
        var unmatched = new HashSet<State>(_tracks);
        var leftover = Match(unmatched, high, o);
        Match(unmatched, low, o);

        foreach (var t in unmatched) t.Misses++;
        _tracks.RemoveAll(t => unmatched.Contains(t) && (t.Id == 0 || t.Misses > o.MaxMisses));

        foreach (var d in leftover)
        {
            var t = new State
            {
                ClassId = d.ClassId, ClassName = d.ClassName, Confidence = d.Confidence,
                Cx = d.Box.X + d.Box.Width / 2.0, Cy = d.Box.Y + d.Box.Height / 2.0, W = d.Box.Width, H = d.Box.Height,
                Hits = 1,
            };
            Confirm(t, o);
            _tracks.Add(t);
        }
        return Snapshot();
    }

    /// <summary>Greedy highest-IoU matching; matched tracks leave the unmatched set, returns the unmatched detections.</summary>
    private List<YoloDetection> Match(HashSet<State> unmatched, List<YoloDetection> detections, YoloTrackerOptions o)
    {
        var pairs = new List<(double Score, State Track, int Det)>();
        foreach (var t in unmatched)
        {
            var box = t.Box;
            double reach = o.MaxCenterShift * Math.Max(t.W, t.H);
            for (int i = 0; i < detections.Count; i++)
            {
                if (o.PerClass && detections[i].ClassId != t.ClassId) continue;
                var d = detections[i].Box;
                double iou = Iou(box, d);
                if (iou >= o.MatchIou)
                {
                    pairs.Add((1 + iou, t, i));
                    continue;
                }
                double shift = Math.Sqrt(Math.Pow(d.X + d.Width / 2.0 - t.Cx, 2) + Math.Pow(d.Y + d.Height / 2.0 - t.Cy, 2));
                if (reach > 0 && shift <= reach) pairs.Add((1 - shift / reach, t, i));
            }
        }
        var usedDets = new HashSet<int>();
        foreach (var (_, t, i) in pairs.OrderByDescending(p => p.Score))
        {
            if (!unmatched.Contains(t) || usedDets.Contains(i)) continue;
            unmatched.Remove(t);
            usedDets.Add(i);
            Apply(t, detections[i], o);
        }
        return detections.Where((_, i) => !usedDets.Contains(i)).ToList();
    }

    private void Apply(State t, YoloDetection d, YoloTrackerOptions o)
    {
        double a = Math.Clamp(o.Smoothing, 0.05, 1.0);
        int gap = t.Misses + 1;
        double prevCx = t.Cx - t.Vx * gap, prevCy = t.Cy - t.Vy * gap;
        double dx = d.Box.X + d.Box.Width / 2.0, dy = d.Box.Y + d.Box.Height / 2.0;
        t.Cx += a * (dx - t.Cx);
        t.Cy += a * (dy - t.Cy);
        t.W += a * (d.Box.Width - t.W);
        t.H += a * (d.Box.Height - t.H);
        t.Vx = VelocityBlend * t.Vx + (1 - VelocityBlend) * (t.Cx - prevCx) / gap;
        t.Vy = VelocityBlend * t.Vy + (1 - VelocityBlend) * (t.Cy - prevCy) / gap;
        t.Confidence = d.Confidence;
        t.ClassName = d.ClassName;
        t.Hits++;
        t.Misses = 0;
        Confirm(t, o);
    }

    private void Confirm(State t, YoloTrackerOptions o)
    {
        if (t.Id == 0 && t.Hits >= Math.Max(1, o.MinHits)) t.Id = _nextId++;
    }

    private IReadOnlyList<YoloTrack> Snapshot() => _tracks
        .Where(t => t.Id != 0)
        .Select(t => new YoloTrack(t.Id, t.ClassId, t.ClassName, t.Confidence, t.Box, t.Hits, t.Misses, t.Age))
        .ToList();

    private static double Iou(Rect a, Rect b)
    {
        var inter = a.Intersect(b);
        if (inter.Width <= 0 || inter.Height <= 0) return 0;
        double i = (double)inter.Width * inter.Height;
        return i / ((double)a.Width * a.Height + (double)b.Width * b.Height - i);
    }
}
