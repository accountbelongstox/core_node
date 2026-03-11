using System.Numerics;
using System.IO;
using SixLabors.Fonts;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Drawing.Processing;
using SixLabors.ImageSharp.Formats.Gif;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;
using Font = SixLabors.Fonts.Font;
using FontFamily = SixLabors.Fonts.FontFamily;
using Color = SixLabors.ImageSharp.Color;
using PointF = SixLabors.ImageSharp.PointF;
using Size = SixLabors.ImageSharp.Size;

namespace GifTextOverlay;

public enum BackgroundMode
{
    GifFrame,
    RandomFromFolder,
    SpecifiedImage
}

public class GifProcessor
{
    private static readonly string[] SystemFontCandidates =
    [
        "C:/Windows/Fonts/impact.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/arial.ttf",
    ];

    private static readonly string[] FontExtensions = [".ttf", ".otf", ".ttc"];

    public static string FindFont()
    {
        var list = ScanFonts();
        return list.Count > 0 ? list[0] : SystemFontCandidates.FirstOrDefault(File.Exists) ?? SystemFontCandidates[^1];
    }

    /// <summary>Recursively scan ttfs dir for valid font files; exclude non-font files.</summary>
    public static IReadOnlyList<string> ScanFonts()
    {
        var baseDir = AppDomain.CurrentDomain.BaseDirectory;
        var ttfsDir = Path.Combine(baseDir, "ttfs");
        if (!Directory.Exists(ttfsDir)) return [];

        var result = new List<string>();
        var collection = new FontCollection();
        foreach (var path in Directory.GetFiles(ttfsDir, "*", SearchOption.AllDirectories))
        {
            var ext = Path.GetExtension(path);
            if (!FontExtensions.Contains(ext, StringComparer.OrdinalIgnoreCase)) continue;
            try
            {
                collection.Add(path);
                result.Add(path);
            }
            catch
            {
                // Invalid font, skip
            }
        }
        return result.OrderBy(Path.GetFileName).ToList();
    }

    public static IReadOnlyList<string> ScanGifs(string dir, bool recursive = false)
    {
        if (!Directory.Exists(dir)) return [];
        var opt = recursive ? SearchOption.AllDirectories : SearchOption.TopDirectoryOnly;
        return Directory.GetFiles(dir, "*.gif", opt)
            .OrderBy(Path.GetFileName)
            .ToList();
    }

    public static IReadOnlyList<string> ScanBackgroundImages(string dir)
    {
        if (!Directory.Exists(dir)) return [];
        var exts = new[] { "*.jpg", "*.jpeg", "*.png", "*.bmp", "*.gif" };
        return exts.SelectMany(e => Directory.GetFiles(dir, e, SearchOption.TopDirectoryOnly))
            .OrderBy(Path.GetFileName)
            .ToList();
    }

    public static (List<SixLabors.ImageSharp.Image<Rgba32>> Frames, List<int> Delays) LoadGifFrames(string path)
    {
        var frames = new List<SixLabors.ImageSharp.Image<Rgba32>>();
        var delays = new List<int>();
        using var img = SixLabors.ImageSharp.Image.Load<Rgba32>(path);
        for (int i = 0; i < img.Frames.Count; i++)
        {
            var clonedImg = img.Frames.CloneFrame(i);
            var rootFrame = clonedImg.Frames.RootFrame;
            int delay = 100;
            if (rootFrame.Metadata.TryGetGifMetadata(out var gfm) && gfm.FrameDelay > 0)
                delay = gfm.FrameDelay;
            delays.Add(delay);
            frames.Add(clonedImg);
        }
        return (frames, delays);
    }

    public static SixLabors.ImageSharp.Image<Rgba32> LoadBackgroundImage(string path)
    {
        return SixLabors.ImageSharp.Image.Load<Rgba32>(path);
    }

    public static SixLabors.ImageSharp.Image<Rgba32> CreateTextFrame(
        SixLabors.ImageSharp.Image<Rgba32> background,
        IReadOnlyList<TextAreaItem> items)
    {
        var canvas = background.Clone(ctx =>
        {
            foreach (var item in items)
            {
                if (string.IsNullOrWhiteSpace(item.Text)) continue;
                var (font, x, y) = ComputeTextLayout(background, item);
                if (item.PresetIndex == Presets.CustomPresetIndex && item.CustomEffect != null)
                    DrawCustomEffect(ctx, item.Text, font, x, y, item.CustomEffect, item.LetterSpacing, item.FontStretch);
                else if (item.PresetIndex >= 0 && item.PresetIndex < Presets.All.Length)
                    DrawPreset(ctx, item.Text, font, x, y, Presets.All[item.PresetIndex], item.LetterSpacing, item.FontStretch);
            }
        });
        return canvas;
    }

    public static (Font Font, float X, float Y) ComputeTextLayout(
        SixLabors.ImageSharp.Image<Rgba32> background,
        TextAreaItem item)
    {
        var w = background.Width;
        var h = background.Height;
        var pos = item.Position;

        float leftPx = w * Math.Clamp(pos.LeftPct, 0, 50) / 100f;
        float topPx = h * Math.Clamp(pos.TopPct, 0, 50) / 100f;
        float rightPx = w * Math.Clamp(pos.RightPct, 0, 50) / 100f;
        float bottomPx = h * Math.Clamp(pos.BottomPct, 0, 50) / 100f;
        float contentW = Math.Max(1, w - leftPx - rightPx);
        float contentH = Math.Max(1, h - topPx - bottomPx);

        var fontPath = !string.IsNullOrEmpty(item.FontPath) && File.Exists(item.FontPath)
            ? item.FontPath
            : FindFont();
        var collection = new FontCollection();
        var family = collection.Add(fontPath);

        Font font;
        if (item.AutoFontSize || !item.ManualFontSize.HasValue)
        {
            var targetW = (int)(contentW * 0.95);
            (font, _) = BinarySearchFontSize(family, item.Text, targetW);
        }
        else
        {
            var fontSize = Math.Clamp(item.ManualFontSize.Value, 8, 500);
            font = family.CreateFont(fontSize);
        }

        var opts = new TextOptions(font) { WrappingLength = contentW };
        var bounds = TextMeasurer.MeasureAdvance(item.Text, opts);
        float totalW = bounds.Width;
        if (item.LetterSpacing != 0 && item.Text.Length > 1)
            totalW += (item.Text.Length - 1) * item.LetterSpacing;
        if (item.FontStretch != 1f && item.FontStretch > 0)
            totalW *= item.FontStretch;
        float x = pos.HAlign switch
        {
            0 => leftPx,
            2 => leftPx + contentW - totalW,
            _ => leftPx + (contentW - totalW) / 2f
        };
        float y = pos.VAlign switch
        {
            0 => topPx,
            2 => topPx + contentH - bounds.Height,
            _ => topPx + (contentH - bounds.Height) / 2f
        };
        return (font, x, y);
    }

    private static void DrawWithTypography(IImageProcessingContext ctx, string text, Font font, float x, float y, float letterSpacing, float fontStretch, Action<DrawingOptions, string, float, float> draw)
    {
        var opts = new DrawingOptions();
        if (Math.Abs(fontStretch - 1f) > 0.001f && fontStretch > 0)
            opts.Transform = Matrix3x2.CreateTranslation(x, y) * Matrix3x2.CreateScale(fontStretch, 1f) * Matrix3x2.CreateTranslation(-x, -y);

        if (Math.Abs(letterSpacing) < 0.001f)
        {
            draw(opts, text, x, y);
            return;
        }
        var to = new TextOptions(font);
        if (!TextMeasurer.TryMeasureCharacterAdvances(text, to, out var advances))
        {
            draw(opts, text, x, y);
            return;
        }
        float cx = x;
        for (int i = 0; i < text.Length && i < advances.Length; i++)
        {
            var run = i + 1 < text.Length && char.IsSurrogatePair(text[i], text[i + 1]) ? text.Substring(i, 2) : text[i].ToString();
            draw(opts, run, cx, y);
            cx += advances[i].Bounds.Width + letterSpacing;
            if (run.Length > 1) i++;
        }
    }

    private static void DrawCustomEffect(IImageProcessingContext ctx, string text, Font font, float x, float y, CustomEffectOptions c, float letterSpacing = 0, float fontStretch = 1f)
    {
        void DrawOne(DrawingOptions opts, string t, float px, float py)
        {
            if (c.ShadowColor != null && (c.ShadowDx != 0 || c.ShadowDy != 0 || c.ShadowRadius > 0))
                DrawShadowLayer(ctx, t, font, px, py, c.ShadowDx, c.ShadowDy, c.ShadowColor, Math.Max(1, c.ShadowRadius));
            if (c.OutlineColor != null && c.OutlineWidth > 0)
                DrawStroke(ctx, t, font, px, py, c.OutlineColor, c.OutlineWidth);
            var colors = c.FillColors ?? [];
            if (colors.Count > 1)
            {
                var b = TextMeasurer.MeasureAdvance(text, new TextOptions(font));
                float tw = b.Width + (letterSpacing != 0 && text.Length > 1 ? (text.Length - 1) * letterSpacing : 0);
                if (fontStretch != 1f && fontStretch > 0) tw *= fontStretch;
                var stops = colors.Select((col, i) => new ColorStop(i / (float)Math.Max(1, colors.Count - 1), ParseColor(col))).ToArray();
                var brush = new LinearGradientBrush(new PointF(x, y), new PointF(x + tw, y), GradientRepetitionMode.None, stops);
                ctx.DrawText(opts, t, font, brush, new PointF(px, py));
            }
            else
            {
                var fill = colors.Count > 0 ? ParseColor(colors[0]) : ParseColor("white");
                ctx.DrawText(opts, t, font, fill, new PointF(px, py));
            }
        }
        DrawWithTypography(ctx, text, font, x, y, letterSpacing, fontStretch, DrawOne);
    }

    private static (Font Font, int Size) BinarySearchFontSize(FontFamily family, string text, int targetW)
    {
        int lo = 8, hi = 800;
        Font? best = null;
        int bestSize = lo;
        while (lo < hi - 1)
        {
            int mid = (lo + hi) / 2;
            var f = family.CreateFont(mid);
            var opts = new TextOptions(f);
            var m = TextMeasurer.MeasureAdvance(text, opts);
            if (m.Width <= targetW)
            {
                lo = mid;
                best = f;
                bestSize = mid;
            }
            else
            {
                hi = mid;
            }
        }
        return (best ?? family.CreateFont(lo), bestSize);
    }

    private static void DrawPreset(IImageProcessingContext ctx, string text, Font font, float x, float y, TextPreset p, float letterSpacing = 0, float fontStretch = 1f)
    {
        void DrawOne(DrawingOptions opts, string t, float px, float py)
        {
            if (p.Name == "neon_glow")
            {
                foreach (var r in new[] { 2, 4, 8 })
                    DrawShadowLayer(ctx, t, font, px, py, 0, 0, "#00FFAA", r);
            }
            else if (p.Name == "ice")
            {
                foreach (var r in new[] { 3, 6 })
                    DrawShadowLayer(ctx, t, font, px, py, 0, 0, "white", r);
            }
            else if (p.Name == "emboss")
            {
                DrawShadowLayer(ctx, t, font, px, py, -2, -2, "white", 1);
                DrawShadowLayer(ctx, t, font, px, py, 2, 2, "black", 1);
            }
            else if (p.Shadow is { } s)
            {
                DrawShadowLayer(ctx, t, font, px, py, s.Dx, s.Dy, s.Color, s.Radius);
            }
            if (p.Outline != null && p.OutlineWidth > 0)
                DrawStroke(ctx, t, font, px, py, p.Outline, p.OutlineWidth);
            ctx.DrawText(opts, t, font, ParseColor(p.Fill), new PointF(px, py));
        }
        DrawWithTypography(ctx, text, font, x, y, letterSpacing, fontStretch, DrawOne);
    }

    private static Color ParseColor(string s)
    {
        if (s.StartsWith("#")) s = s.TrimStart('#');
        return Color.TryParse(s, out var c) ? c : Color.White;
    }

    private static void DrawShadowLayer(IImageProcessingContext ctx, string text, Font font, float x, float y, int dx, int dy, string color, int radius)
    {
        var c = ParseColor(color);
        for (int r = Math.Max(0, radius - 1); r <= radius; r++)
        {
            for (int ox = -1; ox <= 1; ox++)
            for (int oy = -1; oy <= 1; oy++)
                ctx.DrawText(new DrawingOptions(), text, font, c, new PointF(x + dx + ox * r, y + dy + oy * r));
        }
    }

    private static void DrawStroke(IImageProcessingContext ctx, string text, Font font, float x, float y, string color, int width)
    {
        var c = ParseColor(color);
        for (int dx = -width; dx <= width; dx++)
        for (int dy = -width; dy <= width; dy++)
            if (dx != 0 || dy != 0)
                ctx.DrawText(new DrawingOptions(), text, font, c, new PointF(x + dx, y + dy));
    }

    public static void SaveAnimatedGif(IReadOnlyList<ImageFrame<Rgba32>> frameRefs, IReadOnlyList<int> delays, string outPath)
    {
        if (frameRefs.Count == 0) return;
        var first = frameRefs[0];
        using var output = new SixLabors.ImageSharp.Image<Rgba32>(first.Width, first.Height);
        output.Metadata.GetGifMetadata().RepeatCount = 0;
        for (int i = 0; i < frameRefs.Count; i++)
        {
            using var clone = CloneFrameToImage(frameRefs[i]);
            var root = clone.Frames.RootFrame;
            if (root.Metadata.TryGetGifMetadata(out var gfm))
                gfm.FrameDelay = Math.Max(1, delays[i]);
            output.Frames.AddFrame(root);
        }
        output.Frames.RemoveFrame(0);
        output.SaveAsGif(outPath);
    }

    /// <summary>Returns a new single-frame Image (caller must dispose).</summary>
    public static SixLabors.ImageSharp.Image<Rgba32> CloneFrameToImage(ImageFrame<Rgba32> frame)
    {
        using var img = new SixLabors.ImageSharp.Image<Rgba32>(frame.Width, frame.Height);
        img.Frames.AddFrame(frame);
        img.Frames.RemoveFrame(0);
        return img.Frames.CloneFrame(0);
    }

    public static SixLabors.ImageSharp.Image<Rgba32> CreatePreviewBackground(int w = 400, int h = 300)
    {
        var img = new SixLabors.ImageSharp.Image<Rgba32>(w, h);
        img.Mutate(ctx => ctx.BackgroundColor(SixLabors.ImageSharp.Color.FromRgba(60, 60, 60, 255)));
        return img;
    }

    public static SixLabors.ImageSharp.Image<Rgba32> ResizeToFit(SixLabors.ImageSharp.Image<Rgba32> src, int targetW, int targetH)
    {
        if (src.Width == targetW && src.Height == targetH) return src.CloneAs<Rgba32>();
        return src.Clone(ctx => ctx.Resize(new ResizeOptions
        {
            Size = new Size(targetW, targetH),
            Mode = ResizeMode.Stretch
        }));
    }
}
