// PY-REF: none (DOT-only)
using DotCore.Common.Geometry;
using DotCore.Foundations;
using DotCore.TemplateMatcher;
using OpenCvSharp;

namespace DotApps.d3d4tester.Core;

/// <summary>Client area of a D3 capture: its origin inside the captured image and its size (image px); maps reference points both ways.</summary>
public readonly record struct D3ClientArea(int X, int Y, int Width, int Height)
{
    /// <summary>Reference px -> image px (D3 scales its UI with the client height).</summary>
    public double Scale => D3UiLayout.Frame.Scale(Width, Height).Y;

    public (int X, int Y) ToImage(RefPoint point)
    {
        var (x, y) = D3UiLayout.Frame.ToPixel(point, Width, Height);
        return (X + x, Y + y);
    }

    /// <summary>Reference rectangle -> image rectangle, clipped to an image of the given size.</summary>
    public Rect ToImage(RefRect rect, int imageCols, int imageRows)
    {
        var a = D3UiLayout.Frame.ToActual(rect, Width, Height);
        return new Rect(X + (int)Math.Round(a.X), Y + (int)Math.Round(a.Y), (int)Math.Round(a.Width), (int)Math.Round(a.Height))
            .Intersect(new Rect(0, 0, imageCols, imageRows));
    }

    public RefPoint ToRef((int X, int Y) imagePoint) => D3UiLayout.Frame.ToReference(new RefPoint(imagePoint.X - X, imagePoint.Y - Y), Width, Height);

    public RefRect ToRef(Rect imageRect) =>
        D3UiLayout.Frame.ToReference(new RefRect(imageRect.X - X, imageRect.Y - Y, imageRect.Width, imageRect.Height), Width, Height);
}

/// <summary>
/// Learned layout of the D3 UI shared by the whole app: one <see cref="LayoutCache"/> in reference units of the 1072x603 client (the UI
/// scales with the client height and is centered horizontally), file Templates/d3_ui_layout.json next to the templates (versioned with
/// the code). Buttons and dialog elements are calibrated once from a capture (the first whole-image hit) and from then on located at
/// their cached places, converted to the current window size by the frame ratio. Keys: "template/&lt;name&gt;@&lt;dialog&gt;" for
/// <see cref="Locate"/>, other areas by convention "&lt;area&gt;/.../&lt;name&gt;".
/// </summary>
public static class D3UiLayout
{
    public const double RefClientWidth = 1072.0;
    public const double RefClientHeight = 603.0;
    public static readonly ReferenceFrame Frame = new(RefClientWidth, RefClientHeight, ScaleMode.HeightCentered);

    public const string FileName = "d3_ui_layout.json";
    public const string TemplatePrefix = "template/";
    private const char DialogSeparator = '@';
    /// <summary>Extra room (reference px) around a calibrated place, on top of the element's own size.</summary>
    private const double HitMarginRefPx = 40;
    /// <summary>Two hits closer than this (reference px) are the same place of an element.</summary>
    private const double SamePlaceRefPx = 12;
    private const string LogTag = "[D3UiLayout]";

    private static readonly object LoadLock = new();
    private static LayoutCache? _shared;

    public static string FilePath => Path.Combine(D3TemplatePaths.GetTemplateDir(), FileName);

    /// <summary>The shared cache, read from <see cref="FilePath"/> on first use.</summary>
    public static LayoutCache Shared
    {
        get
        {
            if (_shared is { } cache) return cache;
            lock (LoadLock)
            {
                if (_shared != null) return _shared;
                var loaded = LayoutCache.Load(FilePath, Frame);
                if (loaded.LoadError is { } error) ColorPrinter.Yellow($"{LogTag} {FilePath} not used: {error}");
                else ColorPrinter.Gray($"{LogTag} {loaded.Count} calibrated position(s) from {FilePath}");
                _shared = loaded;
                return loaded;
            }
        }
    }

    /// <summary>Write the shared cache when it changed (IO errors are logged).</summary>
    public static void Save()
    {
        try
        {
            if (Shared.Save()) ColorPrinter.Gray($"{LogTag} saved {Shared.Count} position(s) to {FilePath}");
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            ColorPrinter.Yellow($"{LogTag} not saved: {ex.Message}");
        }
    }

    /// <summary>Cache key of a template inside one dialog (the same button may sit elsewhere in another dialog).</summary>
    public static string TemplateKey(string template, string dialog) => TemplatePrefix + template + DialogSeparator + dialog;

    /// <summary>
    /// Find a template on a D3 capture. Calibrated key: only its cached places are searched (all sizes, in a box of the element plus a
    /// margin), so absence is decided there as well. The whole image is searched while the key is not calibrated yet, or when
    /// <paramref name="fullSearch"/> is set (the caller saw the cache fail); such a hit is learned as a (new) place. Null when not found.
    /// </summary>
    public static TemplateMatchResult? Locate(Mat image, D3ClientArea client, ScaledTemplate template, IReadOnlyList<int> widths, double threshold,
        string key, bool fullSearch = false)
    {
        var matcher = TemplateMatcherService.GetTemplateMatcher();
        var places = Shared.Variants(key);
        foreach (var place in places)
        {
            var near = client.ToImage(place.Inflate(Math.Max(place.Width, place.Height) + HitMarginRefPx), image.Cols, image.Rows);
            if (near.Width <= 0 || near.Height <= 0) continue;
            using var area = new Mat(image, near);
            var n = matcher.MatchMultiScale(area, template, widths, threshold, key);
            if (n.Success)
                return n with { X = n.X + near.X, Y = n.Y + near.Y, Center = n.Center is { } c ? new Point2f(c.X + near.X, c.Y + near.Y) : null };
        }
        if (places.Count > 0 && !fullSearch) return null;
        var m = matcher.MatchMultiScale(image, template, widths, threshold, key);
        if (!m.Success) return null;
        if (Shared.LearnVariant(key, client.ToRef(new Rect(m.X, m.Y, m.Width, m.Height)), SamePlaceRefPx))
            ColorPrinter.Gray($"{LogTag} calibrated {key}");
        return m;
    }
}
