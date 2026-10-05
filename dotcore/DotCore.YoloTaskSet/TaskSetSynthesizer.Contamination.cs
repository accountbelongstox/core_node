// PY-REF: none (DOT-only)
using System.Collections.Concurrent;
using System.Globalization;
using System.Text.Json;
using DotCore.Foundations;
using DotCore.VocAnnotator;
using OpenCvSharp;

namespace DotCore.YoloTaskSet;

/// <summary>Background contamination check (S6): template matching of every variant over scenes, common images and sampled video frames.</summary>
public static partial class TaskSetSynthesizer
{
    public const string ContaminationCacheFileName = "contamination.json";

    private const int MinTemplateSide = 6;
    private const int MaxHitsPerTemplate = 20;
    private const double AlphaTemplateThreshold = 127;
    private const double ScoreCeiling = 1.0001;
    private const double TemplateMinStdDev = 2.0;
    private const double HitMergeIou = 0.3;
    private const double KnownBoxIou = 0.3;
    private const int ScoreScale = 1000;

    private sealed record TemplateRef(int TargetIndex, VariantRef Variant, Mat Bgra);

    private sealed record Hit(int X, int Y, int Width, int Height, double Score)
    {
        public Rect Rect => new(X, Y, Width, Height);
    }

    public static IReadOnlyList<ContaminationHit> FindContamination(TaskSet set, string taskSetDir, IProgress<SynthesisProgress>? progress, CancellationToken ct) =>
        FindContamination(set, taskSetDir, Inspect(set, taskSetDir), progress, ct);

    /// <summary>The BackgroundContainsTarget issue of a hit.</summary>
    public static TaskSetIssue ToIssue(ContaminationHit h)
    {
        var resource = h.Frame == null ? h.ResourceFile : h.ResourceFile + FrameKeySeparator + h.Frame;
        var subject = string.Create(CultureInfo.InvariantCulture, $"{resource}@{h.X},{h.Y},{h.Width},{h.Height} {h.Score:0.00}");
        return new TaskSetIssue(TaskSetIssueCode.BackgroundContainsTarget, subject, false);
    }

    private static List<ContaminationHit> FindContamination(TaskSet set, string taskSetDir, Inspection inspection, IProgress<SynthesisProgress>? progress, CancellationToken ct)
    {
        var s = set.Synthesis.Normalized();
        var backgrounds = inspection.Scenes.SelectMany(x => x).Concat(inspection.CommonImages).DistinctBy(b => b.Key).ToList();
        foreach (var video in inspection.CommonVideos)
        {
            var frames = VideoBackgrounds(taskSetDir, video, s, new List<TaskSetIssue>(), ct);
            backgrounds.AddRange(SampleEvenly(frames, s.ContaminationVideoFrames));
        }

        var templates = new List<TemplateRef>();
        for (int t = 0; t < inspection.Variants.Count; t++)
            foreach (var v in inspection.Variants[t])
                if (TaskSetImageIo.ReadBgra(v.Path) is { } mat) templates.Add(new TemplateRef(t, v, mat));

        var cachePath = Path.Combine(taskSetDir, TaskSetStore.CacheSubdir, ContaminationCacheFileName);
        var cache = LoadContaminationCache(cachePath);
        var used = new ConcurrentDictionary<string, int[][]>(StringComparer.Ordinal);
        var hits = new ConcurrentBag<ContaminationHit>();
        int done = 0;
        try
        {
            var options = new ParallelOptions { CancellationToken = ct, MaxDegreeOfParallelism = Math.Max(1, Environment.ProcessorCount / 2) };
            Parallel.ForEach(backgrounds, options, bg =>
            {
                foreach (var h in MatchBackground(set, s, bg, templates, cache, used, ct)) hits.Add(h);
                progress?.Report(new SynthesisProgress(Interlocked.Increment(ref done), backgrounds.Count));
            });
        }
        finally
        {
            foreach (var t in templates) t.Bgra.Dispose();
        }
        SaveContaminationCache(cachePath, used);
        return hits.OrderBy(h => h.ResourceFile, StringComparer.Ordinal).ThenBy(h => h.Frame, StringComparer.Ordinal)
            .ThenByDescending(h => h.Score).ToList();
    }

    private static IEnumerable<T> SampleEvenly<T>(IReadOnlyList<T> items, int count)
    {
        if (count <= 0 || items.Count == 0) yield break;
        if (items.Count <= count)
        {
            foreach (var i in items) yield return i;
            yield break;
        }
        for (int i = 0; i < count; i++) yield return items[(int)((long)i * items.Count / count)];
    }

    private static IEnumerable<double> TemplateScales(SynthesisSettings s, double ratio) =>
        s.UsesDpiSteps ? s.DpiSteps.Select(step => ratio * step) : new[] { ratio };

    private static List<ContaminationHit> MatchBackground(TaskSet set, SynthesisSettings s, Background bg, List<TemplateRef> templates,
        IReadOnlyDictionary<string, int[][]> cache, ConcurrentDictionary<string, int[][]> used, CancellationToken ct)
    {
        Mat? gray = null;
        var perTarget = new Dictionary<int, List<(Hit Hit, TemplateRef Template)>>();
        try
        {
            foreach (var t in templates)
                foreach (var scale in TemplateScales(s, bg.Resource.EffectivePixelScale / t.Variant.Resource.EffectivePixelScale))
                {
                    ct.ThrowIfCancellationRequested();
                    var key = ContaminationKey(bg.Path, t.Variant.Path, scale, s.ContaminationThreshold);
                    if (!cache.TryGetValue(key, out var raw))
                    {
                        gray ??= ReadGray(bg.Path);
                        raw = gray == null ? Array.Empty<int[]>() : MatchTemplate(gray, t.Bgra, scale, s.ContaminationThreshold);
                    }
                    used[key] = raw;
                    if (!perTarget.TryGetValue(t.TargetIndex, out var list)) perTarget[t.TargetIndex] = list = new();
                    list.AddRange(raw.Where(r => r.Length == 5).Select(r => (new Hit(r[0], r[1], r[2], r[3], r[4] / (double)ScoreScale), t)));
                }
        }
        finally
        {
            gray?.Dispose();
        }

        var known = (bg.Resource.Boxes ?? new List<ResourceBox>()).Select(b => new AnnotationBox("", b.X, b.Y, b.X + b.Width, b.Y + b.Height)).ToList();
        var result = new List<ContaminationHit>();
        string? frame = bg.Resource.Kind == TaskResourceKind.Video ? Path.GetFileName(bg.Path) : null;
        foreach (var (targetIndex, list) in perTarget)
        {
            var kept = new List<(Hit Hit, TemplateRef Template)>();
            foreach (var c in list.OrderByDescending(x => x.Hit.Score))
            {
                var box = new AnnotationBox("", c.Hit.X, c.Hit.Y, c.Hit.X + c.Hit.Width, c.Hit.Y + c.Hit.Height);
                if (kept.Any(k => new AnnotationBox("", k.Hit.X, k.Hit.Y, k.Hit.X + k.Hit.Width, k.Hit.Y + k.Hit.Height).IoU(box) > HitMergeIou)) continue;
                double cx = (box.XMin + box.XMax) / 2, cy = (box.YMin + box.YMax) / 2;
                if (known.Any(k => k.IoU(box) > KnownBoxIou || k.Contains(cx, cy))) continue;
                kept.Add(c);
            }
            var target = set.Targets[targetIndex];
            result.AddRange(kept.Select(k => new ContaminationHit(bg.Resource.Id, bg.Resource.File, frame, target.Id, target.Name, k.Template.Variant.Resource.Id,
                k.Hit.X, k.Hit.Y, k.Hit.Width, k.Hit.Height, k.Hit.Score)));
        }
        return result;
    }

    private static Mat? ReadGray(string path)
    {
        using var bgr = TaskSetImageIo.ReadBgr(path, 0);
        if (bgr == null) return null;
        var gray = new Mat();
        Cv2.CvtColor(bgr, gray, ColorConversionCodes.BGR2GRAY);
        return gray;
    }

    /// <summary>Peaks of TM_CCOEFF_NORMED (alpha-masked for transparent variants) at or above the threshold: [x, y, w, h, score × 1000].</summary>
    private static int[][] MatchTemplate(Mat gray, Mat variantBgra, double scale, double threshold)
    {
        var size = new Size(Math.Max(1, (int)Math.Round(variantBgra.Width * scale)), Math.Max(1, (int)Math.Round(variantBgra.Height * scale)));
        if (Math.Min(size.Width, size.Height) < MinTemplateSide || size.Width > gray.Width || size.Height > gray.Height) return Array.Empty<int[]>();
        using var scaled = new Mat();
        var interpolation = size.Width * size.Height < variantBgra.Width * variantBgra.Height ? InterpolationFlags.Area : InterpolationFlags.Nearest;
        Cv2.Resize(variantBgra, scaled, size, 0, 0, interpolation);
        using var tpl = new Mat();
        Cv2.CvtColor(scaled, tpl, ColorConversionCodes.BGRA2GRAY);
        using var alpha = new Mat();
        Cv2.ExtractChannel(scaled, alpha, 3);
        Cv2.MinMaxLoc(alpha, out double alphaMin, out _);
        using var mask = new Mat();
        bool masked = alphaMin < AlphaTemplateThreshold;
        if (masked)
        {
            Cv2.Threshold(alpha, mask, AlphaTemplateThreshold, byte.MaxValue, ThresholdTypes.Binary);
            if (Cv2.CountNonZero(mask) < MinTemplateSide * MinTemplateSide) return Array.Empty<int[]>();
        }
        InputArray? templateMask = masked ? (InputArray)mask : null;
        Cv2.MeanStdDev(tpl, out _, out var std, templateMask);
        if (std.Val0 < TemplateMinStdDev) return Array.Empty<int[]>();

        using var result = new Mat();
        Cv2.MatchTemplate(gray, tpl, result, TemplateMatchModes.CCoeffNormed, templateMask);
        Cv2.PatchNaNs(result, 0);
        Cv2.Threshold(result, result, ScoreCeiling, 0, ThresholdTypes.TozeroInv);
        var hits = new List<int[]>();
        for (int i = 0; i < MaxHitsPerTemplate; i++)
        {
            Cv2.MinMaxLoc(result, out _, out double max, out _, out var loc);
            if (max < threshold) break;
            hits.Add(new[] { loc.X, loc.Y, size.Width, size.Height, (int)Math.Round(max * ScoreScale) });
            Cv2.Rectangle(result, new Rect(loc.X - size.Width / 2, loc.Y - size.Height / 2, size.Width, size.Height), Scalar.All(-1), -1);
        }
        return hits.ToArray();
    }

    private static string ContaminationKey(string bgPath, string variantPath, double scale, double threshold)
    {
        static string Stamp(string p)
        {
            var info = new FileInfo(p);
            return info.Exists ? info.Length.ToString(CultureInfo.InvariantCulture) + ":" + info.LastWriteTimeUtc.Ticks.ToString(CultureInfo.InvariantCulture) : "-";
        }
        return string.Create(CultureInfo.InvariantCulture, $"{bgPath}|{Stamp(bgPath)}|{variantPath}|{Stamp(variantPath)}|{scale:0.####}|{threshold:0.###}");
    }

    private static Dictionary<string, int[][]> LoadContaminationCache(string path)
    {
        try
        {
            if (File.Exists(path))
                return JsonSerializer.Deserialize<Dictionary<string, int[][]>>(File.ReadAllText(path)) ?? new Dictionary<string, int[][]>();
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException)
        {
            ColorPrinter.Gray($"[YoloTaskSet] contamination cache ignored: {ex.Message}");
        }
        return new Dictionary<string, int[][]>(StringComparer.Ordinal);
    }

    private static void SaveContaminationCache(string path, IReadOnlyDictionary<string, int[][]> entries)
    {
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            File.WriteAllText(path, JsonSerializer.Serialize(entries.OrderBy(kv => kv.Key, StringComparer.Ordinal).ToDictionary(kv => kv.Key, kv => kv.Value)));
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            ColorPrinter.Gray($"[YoloTaskSet] contamination cache not saved: {ex.Message}");
        }
    }
}
