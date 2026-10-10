// PY-REF: none (DOT-only)
using System.Globalization;
using DotCore.Foundations;
using DotCore.VocAnnotator;
using DotCore.YoloTrain;
using OpenCvSharp;

namespace DotCore.YoloTaskSet;

/// <summary>
/// Shared recorded segments (design §12): annotated frames as backgrounds with real positives and as real labeled images, plus
/// source-anchored placement of fixed UI targets.
/// </summary>
public static partial class TaskSetSynthesizer
{
    private const string RealStemPrefix = "seg_";
    private const string SegmentKeyPrefix = "segments/";
    private const string SegmentGroupBlock = "#b";

    /// <summary>One annotated segment frame; Group = split unit (segment + frame block), shared by its background and real-image use.</summary>
    private sealed record SegmentFrame(string ImagePath, ImageAnnotation Annotation, string Group, string Key);

    /// <summary>Center of a source-anchored paste in image pixels plus the random offset range.</summary>
    private readonly record struct SourceAnchorPoint(int CenterX, int CenterY, int JitterX, int JitterY);

    private static void InspectSegments(TaskSet set, SynthesisSettings s, IReadOnlySet<string> classes, Inspection result)
    {
        foreach (var source in set.SegmentSources)
        {
            if (!source.Backgrounds && !source.RealImages) continue;
            var dir = TaskSetStore.ResolveSegmentDir(source);
            var framesDir = TaskSetStore.SegmentFramesDir(dir);
            var name = Path.GetFileName(dir.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar));
            var images = Directory.Exists(framesDir) ? AnnotationIo.ListImages(framesDir) : Array.Empty<string>();
            int before = result.RealFrames.Count + result.SegmentBackgrounds.Count;
            for (int i = 0; i < images.Count; i += source.EffectiveFrameStep)
            {
                if (AnnotationIo.Load(images[i], framesDir) is not { } annotation) continue;
                int w = annotation.Width, h = annotation.Height;
                if (w <= 0 || h <= 0)
                {
                    if (TaskSetImageIo.ReadSize(images[i]) is not { } size) continue;
                    (w, h) = size;
                    annotation = new ImageAnnotation(images[i], w, h, annotation.Boxes);
                }
                var group = string.Create(CultureInfo.InvariantCulture, $"{SegmentKeyPrefix}{name}{SegmentGroupBlock}{i / s.SegmentBlockFrames}");
                var key = SegmentKeyPrefix + name + "/" + Path.GetFileName(images[i]);
                var frame = new SegmentFrame(images[i], annotation, group, key);
                if (source.RealImages) result.RealFrames.Add(frame);
                if (source.Backgrounds) result.SegmentBackgrounds.Add(new Background(images[i], key, group, SegmentResource(frame, classes), w, h));
            }
            if (result.RealFrames.Count + result.SegmentBackgrounds.Count == before)
                result.Issues.Add(new TaskSetIssue(TaskSetIssueCode.SegmentUnreadable, source.SegmentDir, false));
        }
    }

    /// <summary>In-memory background resource of a segment frame: target boxes are real positives, difficult / other boxes are masked.</summary>
    private static TaskResource SegmentResource(SegmentFrame frame, IReadOnlySet<string> classes) => new()
    {
        Id = frame.Group,
        Kind = TaskResourceKind.Image,
        File = frame.ImagePath,
        OriginalPath = frame.ImagePath,
        Boxes = frame.Annotation.Boxes.Select(b => b.RoundToPixels()).Select(b => new ResourceBox
        {
            X = (int)b.XMin, Y = (int)b.YMin, Width = (int)(b.XMax - b.XMin), Height = (int)(b.YMax - b.YMin),
            Label = b.Label.Trim(), Mask = b.Difficult || !classes.Contains(b.Label.Trim()),
        }).Where(b => !b.IsEmpty).ToList(),
    };

    /// <summary>The cut region of a variant with a known source size (source placement); null otherwise.</summary>
    private static VariantRegion? SourceRegionOf(TaskResource r) =>
        r.HasSourceSize && VariantExtractor.TryParseSourceRef(r.OriginalPath, out _, out _, out var region) && region.Width > 0 && region.Height > 0
            ? region : null;

    /// <summary>Source-placed targets draw from their variants with a known source region; others (or when none) from all.</summary>
    private static VariantEntry PickVariant(IReadOnlyList<VariantEntry> variants, TaskTarget target, Random rng)
    {
        if (target.PlacesAtSource)
        {
            var anchored = variants.Where(v => v.SourceRegion != null).ToList();
            if (anchored.Count > 0) return anchored[rng.Next(anchored.Count)];
        }
        return variants[rng.Next(variants.Count)];
    }

    /// <summary>Source region center mapped from source-frame fractions to the background, then into the (window / scaled) image.</summary>
    private static SourceAnchorPoint? SourceAnchor(VariantEntry entry, Background bg, double f, Point origin, Size image, double jitter)
    {
        if (entry.SourceRegion is not { } r || !entry.Resource.HasSourceSize || bg.Width <= 0 || bg.Height <= 0) return null;
        double cx = (r.X + r.Width / 2.0) / entry.Resource.SourceWidth * bg.Width;
        double cy = (r.Y + r.Height / 2.0) / entry.Resource.SourceHeight * bg.Height;
        return new SourceAnchorPoint((int)Math.Round((cx - origin.X) * f), (int)Math.Round((cy - origin.Y) * f),
            (int)Math.Round(jitter * image.Width), (int)Math.Round(jitter * image.Height));
    }

    /// <summary>
    /// Real segment frames into the split of their frame block (stable hash, as the backgrounds): target boxes labeled, difficult boxes
    /// inpainted; other labels stay unlabeled background.
    /// </summary>
    private static List<JobOutcome> WriteRealFrames(Context ctx, string dir, CancellationToken ct)
    {
        var outcomes = new List<JobOutcome>();
        if (ctx.RealFrames.Count == 0) return outcomes;
        var s = ctx.Settings;
        var val = ValGroups(ctx.RealFrames.Select(f => f.Group).ToList(), s);
        var counts = new int[ctx.Classes.Count];
        int index = 0;
        foreach (var frame in ctx.RealFrames)
        {
            ct.ThrowIfCancellationRequested();
            var split = val.Contains(frame.Group) ? YoloSplit.Val : YoloSplit.Train;
            var stem = RealStemPrefix + (++index).ToString(StemNumberFormat, CultureInfo.InvariantCulture);
            var imagePath = Path.Combine(dir, YoloDataYaml.SplitImagesDir(split), stem + s.OutputExtension);
            var labelPath = Path.Combine(dir, YoloDataYaml.SplitLabelsDir(split), stem + AnnotationIo.YoloTxtExtension);
            try
            {
                using var image = TaskSetImageIo.ReadBgr(frame.ImagePath, 0);
                if (image == null)
                {
                    ColorPrinter.Yellow($"[YoloTaskSet] unreadable segment frame skipped: {frame.ImagePath}");
                    continue;
                }
                var masks = frame.Annotation.Boxes.Where(b => b.Difficult).Select(b => b.RoundToPixels())
                    .Select(b => new Rect((int)b.XMin, (int)b.YMin, (int)(b.XMax - b.XMin), (int)(b.YMax - b.YMin))).ToList();
                if (masks.Count > 0) InpaintRects(image, masks);
                var labeled = frame.Annotation.Boxes.Where(b => !b.Difficult && IndexOf(ctx.Classes, b.Label.Trim()) >= 0)
                    .Select(b => b with { Label = b.Label.Trim() }).ToList();
                File.WriteAllBytes(imagePath, TaskSetImageIo.Encode(image, s.IsPng, s.JpegQuality));
                var annotation = new ImageAnnotation(imagePath, image.Width, image.Height, labeled);
                var lines = AnnotationIo.FormatYoloLines(annotation, ctx.Classes, skipDifficult: true);
                File.WriteAllText(labelPath, lines.Count == 0 ? "" : string.Join("\n", lines) + "\n");
                var classCounts = new int[ctx.Classes.Count];
                foreach (var b in labeled) classCounts[IndexOf(ctx.Classes, b.Label)]++;
                int minSide = labeled.Count == 0 ? 0 : labeled.Min(b => (int)Math.Min(b.Width, b.Height));
                int maxSide = labeled.Count == 0 ? 0 : labeled.Max(b => (int)Math.Max(b.Width, b.Height));
                outcomes.Add(new JobOutcome(split, frame.Key, classCounts, image.Width, image.Height, minSide, maxSide, false));
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or OpenCVException)
            {
                ColorPrinter.Yellow($"[YoloTaskSet] segment frame {frame.ImagePath} skipped: {ex.Message}");
                TryDeleteFile(imagePath);
                TryDeleteFile(labelPath);
            }
        }
        return outcomes;
    }

    private static void InpaintRects(Mat image, IReadOnlyList<Rect> rects)
    {
        var bounds = new Rect(0, 0, image.Width, image.Height);
        using var mask = new Mat(image.Size(), MatType.CV_8UC1, Scalar.All(0));
        foreach (var m in rects)
        {
            var grown = new Rect(m.X - InpaintMargin, m.Y - InpaintMargin, m.Width + 2 * InpaintMargin, m.Height + 2 * InpaintMargin) & bounds;
            if (grown.Width > 0 && grown.Height > 0) Cv2.Rectangle(mask, grown, Scalar.All(byte.MaxValue), -1);
        }
        using var repaired = new Mat();
        Cv2.Inpaint(image, mask, repaired, InpaintRadius, InpaintMethod.Telea);
        repaired.CopyTo(image);
    }

    /// <summary>Planned real-image split counts (Estimate).</summary>
    private static (int Train, int Val) RealSplitCounts(IReadOnlyList<SegmentFrame> frames, SynthesisSettings s)
    {
        var val = ValGroups(frames.Select(f => f.Group).ToList(), s);
        int v = frames.Count(f => val.Contains(f.Group));
        return (frames.Count - v, v);
    }
}
