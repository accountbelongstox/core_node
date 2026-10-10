// PY-REF: dotapps/d3d4tester/reference/py_d3check/share/scaled_template_matcher_base.py
// PY-REF: dotapps/d3d4tester/reference/py_d3check/d4utils/d4_scaled_template_matcher.py
using System.Text;
using DotCore.Foundations;
using DotCore.Utils.ImagePreprocess;
using OpenCvSharp;

namespace DotCore.TemplateMatcher;

/// <summary>Per-template config. 1:1 Python template config dict (path, threshold=0.8, use_alpha=False, match_method="ORB").</summary>
public sealed record TemplateMatchConfig
{
    public string Path { get; init; } = "";
    public double Threshold { get; init; } = TemplateMatcherConstants.DefaultMatchThreshold;
    public bool UseAlpha { get; init; }
    public TemplateMatchMethod MatchMethod { get; init; } = TemplateMatchMethod.Orb;
}

/// <summary>Scaled match outcome. 1:1 Python dict (total_matches, matches, error, region_used, region_source).</summary>
public sealed record ScaledMatchResult
{
    public IReadOnlyList<TemplateMatchResult> Matches { get; init; } = Array.Empty<TemplateMatchResult>();
    public int TotalMatches => Matches.Count;
    public string? Error { get; init; }
    public string? RegionUsed { get; init; }
    public string? RegionSource { get; init; }

    /// <summary>First match or null.</summary>
    public TemplateMatchResult? FirstMatch => Matches.Count > 0 ? Matches[0] : null;

    internal static ScaledMatchResult Fail(string error) => new() { Error = error };
}

/// <summary>
/// Arguments of the after-match hook. 1:1 Python on_after_match kwargs. Target/Template Mats are only valid during the callback.
/// </summary>
public sealed record AfterMatchContext(
    string TemplateName,
    ScaledMatchResult Result,
    Mat Target,
    Mat Template,
    TemplateMatchMethod MatchMethod,
    double ExpectedThreshold,
    TemplateMatchResult? FirstMatch);

/// <summary>
/// Template matcher that scales templates from a standard resolution to the actual window (cached per scale).
/// 1:1 Python dotapps/d3d4tester/reference/py_d3check/share/scaled_template_matcher_base.py (ScaledTemplateMatcherBase + helpers) and the generic
/// parts of d4utils/d4_scaled_template_matcher.py (match_template_auto_scale, region match, region debug image).
/// Game constants (standard size, template table, region lookup) are supplied by the app through the constructor.
/// Fixes Python bug: region matching re-scaled the crop against the full standard resolution; regions now match without the second auto-scale.
/// </summary>
public class ScaledTemplateMatcher
{
    private readonly object _cacheLock = new();
    private readonly Dictionary<string, Mat> _originalTemplateCache = new();
    private readonly Dictionary<(string, double, double), Mat> _templateCache = new();
    private readonly Func<(double ScaleX, double ScaleY)> _getScaleFactors;
    private readonly Func<string, TemplateMatchConfig?> _getTemplateConfig;
    private readonly Func<TemplateMatchMethod, ImageMatcher> _getMatcher;
    private readonly Action<AfterMatchContext>? _onAfterMatch;

    private static readonly Scalar DebugMatchColor = new(0, 255, 0);
    private static readonly Scalar DebugNoMatchColor = new(0, 0, 255);
    private const string RegionDebugFilePrefix = "region_match_";

    public int StandardWidth { get; }
    public int StandardHeight { get; }
    public string LogPrefix { get; }

    /// <param name="standardWidth">Standard resolution width the templates were cut at.</param>
    /// <param name="standardHeight">Standard resolution height.</param>
    /// <param name="getScaleFactors">Current (scaleX, scaleY), e.g. the app's global scale.</param>
    /// <param name="getTemplateConfig">Template config by name; null when unknown.</param>
    /// <param name="getMatcher">Matcher per method; default = <see cref="ImageMatcherRegistry.GetForMethod"/> with this standard resolution (0.80 / 4 / 10000).</param>
    /// <param name="logPrefix">Log prefix.</param>
    /// <param name="onAfterMatch">Hook after <see cref="MatchTemplate(Mat,string,bool)"/>; exceptions are swallowed.</param>
    public ScaledTemplateMatcher(
        int standardWidth,
        int standardHeight,
        Func<(double ScaleX, double ScaleY)> getScaleFactors,
        Func<string, TemplateMatchConfig?> getTemplateConfig,
        Func<TemplateMatchMethod, ImageMatcher>? getMatcher = null,
        string logPrefix = "[ScaledMatcher]",
        Action<AfterMatchContext>? onAfterMatch = null)
    {
        StandardWidth = standardWidth;
        StandardHeight = standardHeight;
        _getScaleFactors = getScaleFactors ?? throw new ArgumentNullException(nameof(getScaleFactors));
        _getTemplateConfig = getTemplateConfig ?? throw new ArgumentNullException(nameof(getTemplateConfig));
        _getMatcher = getMatcher ?? (m => ImageMatcherRegistry.GetForMethod(m, standardWidth, standardHeight));
        LogPrefix = logPrefix;
        _onAfterMatch = onAfterMatch;
    }

    /// <summary>Current scale factors from the provider.</summary>
    public (double ScaleX, double ScaleY) GetScaleFactors() => _getScaleFactors();

    /// <summary>Template config by name.</summary>
    public TemplateMatchConfig? GetTemplateConfig(string templateName) => _getTemplateConfig(templateName);

    /// <summary>Original (unscaled, IMREAD_UNCHANGED) template from cache or disk. Owned by the cache; do not dispose. 1:1 _load_original_template.</summary>
    public Mat? LoadOriginalTemplate(string templateName)
    {
        lock (_cacheLock)
        {
            if (_originalTemplateCache.TryGetValue(templateName, out var cached))
            {
                ColorPrinter.Gray($"{LogPrefix} Using cached original template: {templateName}");
                return cached;
            }
        }
        var cfg = _getTemplateConfig(templateName);
        if (cfg == null)
        {
            ColorPrinter.Yellow($"{LogPrefix} Template not found: {templateName}");
            return null;
        }
        if (string.IsNullOrEmpty(cfg.Path) || !File.Exists(cfg.Path))
        {
            ColorPrinter.Yellow($"{LogPrefix} Template file not found: {cfg.Path}");
            return null;
        }
        try
        {
            ColorPrinter.Blue($"{LogPrefix} Loading original template from disk: {templateName}");
            var img = ImageConvert.LoadMat(cfg.Path, ImreadModes.Unchanged);
            if (img.Empty())
            {
                img.Dispose();
                ColorPrinter.Red($"{LogPrefix} Failed to load template: {cfg.Path}");
                return null;
            }
            lock (_cacheLock)
            {
                if (_originalTemplateCache.TryGetValue(templateName, out var raced))
                {
                    img.Dispose();
                    return raced;
                }
                _originalTemplateCache[templateName] = img;
            }
            ColorPrinter.Green($"{LogPrefix} Cached original template: {templateName}");
            return img;
        }
        catch (Exception e)
        {
            ColorPrinter.Red($"{LogPrefix} Error loading template {templateName}: {e.Message}");
            return null;
        }
    }

    /// <summary>Template scaled by (scaleX, scaleY), cached by rounded scale. Owned by the cache; do not dispose. 1:1 _get_scaled_template_image.</summary>
    public Mat? GetScaledTemplateImage(string templateName, double scaleX, double scaleY, bool forceRefresh = false, bool silent = false)
    {
        var key = (templateName, Math.Round(scaleX, TemplateMatcherConstants.ScaleCacheDecimals), Math.Round(scaleY, TemplateMatcherConstants.ScaleCacheDecimals));
        lock (_cacheLock)
        {
            if (!forceRefresh && _templateCache.TryGetValue(key, out var cached))
            {
                if (!silent) ColorPrinter.Gray($"{LogPrefix} Using cached scaled template: {templateName}");
                return cached;
            }
        }
        var original = LoadOriginalTemplate(templateName);
        if (original == null) return null;
        try
        {
            Mat scaled = IsUnitScale(scaleX, scaleY) ? original : ResizeByScale(original, scaleX, scaleY);
            lock (_cacheLock)
            {
                if (_templateCache.TryGetValue(key, out var old) && !ReferenceEquals(old, scaled) && !IsOriginal(old))
                    old.Dispose();
                _templateCache[key] = scaled;
            }
            return scaled;
        }
        catch (Exception e)
        {
            ColorPrinter.Red($"{LogPrefix} Error scaling template {templateName}: {e.Message}");
            return null;
        }
    }

    /// <summary>Match one template at the provider scale, run the after-match hook and log a schematic. 1:1 match_template.</summary>
    public ScaledMatchResult MatchTemplate(Mat target, string templateName, bool forceRefreshScale = false)
    {
        ColorPrinter.Blue($"\n{LogPrefix} Matching template: {templateName}");
        var (scaleX, scaleY) = _getScaleFactors();
        var scaledTemplate = GetScaledTemplateImage(templateName, scaleX, scaleY, forceRefreshScale);
        if (scaledTemplate == null) return ScaledMatchResult.Fail("Failed to scale template");
        if (target == null || target.Empty()) return ScaledMatchResult.Fail("Failed to load target image");
        var cfg = _getTemplateConfig(templateName);
        if (cfg == null) return ScaledMatchResult.Fail($"Template config not found: {templateName}");
        var match = _getMatcher(cfg.MatchMethod).MatchSingleTemplate(target, scaledTemplate, templateName, cfg.Threshold, cfg.UseAlpha, cfg.MatchMethod);
        var result = match.Success ? new ScaledMatchResult { Matches = new[] { match } } : new ScaledMatchResult();
        if (_onAfterMatch != null)
        {
            try
            {
                _onAfterMatch(new AfterMatchContext(templateName, result, target, scaledTemplate, cfg.MatchMethod, cfg.Threshold, result.FirstMatch));
            }
            catch
            {
                // 1:1 Python: hook errors never break matching
            }
        }
        if (result.FirstMatch is { Center: not null } first)
            ColorPrinter.Gray(FormatMatchSchematic(target.Width, target.Height, new[] { first.Center.Value }, templateName));
        return result;
    }

    /// <summary>Match one template in an image file.</summary>
    public ScaledMatchResult MatchTemplate(string targetImagePath, string templateName, bool forceRefreshScale = false)
    {
        using var target = LoadTarget(targetImagePath);
        return target == null ? ScaledMatchResult.Fail("Failed to load target image") : MatchTemplate(target, templateName, forceRefreshScale);
    }

    /// <summary>Match one template in a bitmap (alpha kept).</summary>
    public ScaledMatchResult MatchTemplate(System.Drawing.Bitmap target, string templateName, bool forceRefreshScale = false)
    {
        using var mat = ImageConvert.BitmapToMat(target);
        return MatchTemplate(mat, templateName, forceRefreshScale);
    }

    /// <summary>Match at an explicit scale (no hook). Base for app auto-scale/multi-state flows. 1:1 _match_single_with_scale.</summary>
    public ScaledMatchResult MatchSingleWithScale(Mat target, string templateName, double scaleX, double scaleY, bool silent = false)
    {
        var scaledTemplate = GetScaledTemplateImage(templateName, scaleX, scaleY, false, silent);
        if (scaledTemplate == null) return ScaledMatchResult.Fail("Failed to scale template");
        var cfg = _getTemplateConfig(templateName);
        if (cfg == null) return ScaledMatchResult.Fail($"Template config not found: {templateName}");
        var match = _getMatcher(cfg.MatchMethod).MatchSingleTemplate(target, scaledTemplate, templateName, cfg.Threshold, cfg.UseAlpha, cfg.MatchMethod, silent);
        if (!match.Success) return new ScaledMatchResult();
        if (!silent && match.Center is { } c)
            ColorPrinter.Gray(FormatMatchSchematic(target.Width, target.Height, new[] { c }, templateName));
        return new ScaledMatchResult { Matches = new[] { match } };
    }

    /// <summary>Scale from target size vs standard resolution, then match. 1:1 D4 match_template_auto_scale.</summary>
    public ScaledMatchResult MatchTemplateAutoScale(Mat target, string templateName)
    {
        if (target == null || target.Empty()) return ScaledMatchResult.Fail("Failed to load target image");
        double scaleX = target.Width / (double)StandardWidth;
        double scaleY = target.Height / (double)StandardHeight;
        ColorPrinter.Gray($"{LogPrefix} Auto scale from image {target.Width}x{target.Height} (std {StandardWidth}x{StandardHeight}): ({scaleX:F4}, {scaleY:F4})");
        return MatchSingleWithScale(target, templateName, scaleX, scaleY);
    }

    /// <summary>Match several templates at the provider scale. 1:1 match_multiple_templates (method from config; Python omitted it, default ORB).</summary>
    public ScaledMatchResult MatchMultipleTemplates(Mat target, IEnumerable<string> templateNames, bool forceRefreshScale = false)
    {
        if (target == null || target.Empty()) return ScaledMatchResult.Fail("Failed to load target image");
        var (scaleX, scaleY) = _getScaleFactors();
        var all = new List<TemplateMatchResult>();
        foreach (var name in templateNames)
        {
            var scaledTemplate = GetScaledTemplateImage(name, scaleX, scaleY, forceRefreshScale);
            if (scaledTemplate == null) continue;
            var cfg = _getTemplateConfig(name);
            if (cfg == null) continue;
            var match = _getMatcher(cfg.MatchMethod).MatchSingleTemplate(target, scaledTemplate, name, cfg.Threshold, cfg.UseAlpha, cfg.MatchMethod);
            if (match.Success) all.Add(match);
        }
        return new ScaledMatchResult { Matches = all };
    }

    /// <summary>Match the unscaled template in a given image (e.g. a region crop). 1:1 match_template_in_image / match_template_in_region (D3 alias).</summary>
    public ScaledMatchResult MatchTemplateInImage(Mat target, string templateName)
    {
        if (target == null || target.Empty()) return ScaledMatchResult.Fail("Failed to load target image");
        var template = LoadOriginalTemplate(templateName);
        if (template == null) return ScaledMatchResult.Fail("Failed to load template");
        var cfg = _getTemplateConfig(templateName);
        if (cfg == null) return ScaledMatchResult.Fail($"Template config not found: {templateName}");
        var match = _getMatcher(cfg.MatchMethod).MatchSingleTemplate(target, template, templateName, cfg.Threshold, cfg.UseAlpha, cfg.MatchMethod);
        return match.Success ? new ScaledMatchResult { Matches = new[] { match } } : new ScaledMatchResult();
    }

    /// <summary>
    /// Match the provider-scaled template inside a region image supplied by the app (shared crop or crop of the full image).
    /// 1:1 D4 match_template_in_region; saves a region debug image when <paramref name="debugOutputDir"/> is set.
    /// </summary>
    public ScaledMatchResult MatchTemplateInRegion(
        string templateName,
        Mat? regionImage,
        string regionName,
        string regionSource,
        string? debugOutputDir = null,
        bool forceRefreshScale = false)
    {
        ColorPrinter.Blue($"\n{LogPrefix} Matching template '{templateName}' in region '{regionName}'");
        ScaledMatchResult Tag(ScaledMatchResult r) => r with { RegionUsed = regionName, RegionSource = regionSource };
        if (regionImage == null || regionImage.Empty())
            return Tag(ScaledMatchResult.Fail($"Failed to get region image for '{regionName}'"));
        var (scaleX, scaleY) = _getScaleFactors();
        var scaledTemplate = GetScaledTemplateImage(templateName, scaleX, scaleY, forceRefreshScale);
        if (scaledTemplate == null)
            return Tag(ScaledMatchResult.Fail($"Failed to get scaled template: {templateName}"));
        var cfg = _getTemplateConfig(templateName);
        if (cfg == null)
            return Tag(ScaledMatchResult.Fail($"Template config not found: {templateName}"));
        ColorPrinter.Gray($"{LogPrefix} Calling {cfg.MatchMethod.ToName()} matcher in region (threshold: {cfg.Threshold}, alpha: {cfg.UseAlpha})");
        var match = _getMatcher(cfg.MatchMethod).MatchSingleTemplate(regionImage, scaledTemplate, templateName, cfg.Threshold, cfg.UseAlpha, cfg.MatchMethod, autoScale: false);
        if (!string.IsNullOrEmpty(debugOutputDir))
            SaveRegionDebugImage(regionImage, match, templateName, regionName, debugOutputDir);
        if (match.Success)
        {
            ColorPrinter.Green($"{LogPrefix} Region match found: {templateName} in {regionName}");
            return Tag(new ScaledMatchResult { Matches = new[] { match } });
        }
        ColorPrinter.Yellow($"{LogPrefix} No match found: {templateName} in {regionName}");
        return Tag(new ScaledMatchResult());
    }

    /// <summary>Annotated region debug image (polygon + template/region/status/confidence lines). Returns the saved path. 1:1 _save_region_debug_image.</summary>
    public string? SaveRegionDebugImage(Mat regionImage, TemplateMatchResult match, string templateName, string regionName, string outputDir)
    {
        using var debug = ImageConvert.ToBgr(regionImage);
        var color = match.Success ? DebugMatchColor : DebugNoMatchColor;
        if (match.Success && match.Polygon != null)
            ImageAnnotate.DrawPolygon(debug, match.Polygon, color, 2);
        var lines = new List<string> { $"Template: {templateName}", $"Region: {regionName}", match.Success ? "MATCH FOUND" : "NO MATCH" };
        if (match.Success) lines.Add($"Confidence: {match.Score:F3}");
        for (int i = 0; i < lines.Count; i++)
            Cv2.PutText(debug, lines[i], new OpenCvSharp.Point(10, 30 * (i + 1)), HersheyFonts.HersheySimplex, 0.6, color, 2);
        var path = System.IO.Path.Combine(outputDir, $"{RegionDebugFilePrefix}{regionName}_{templateName}_{DateTime.Now.ToString(TemplateMatcherConstants.DebugTimestampFormat)}.png");
        if (!ImageConvert.SaveMat(debug, path)) return null;
        ColorPrinter.Green($"{LogPrefix} Region debug image saved: {path}");
        return path;
    }

    /// <summary>Clear original and scaled template caches. 1:1 clear_cache.</summary>
    public void ClearCache()
    {
        lock (_cacheLock)
        {
            foreach (var m in _templateCache.Values)
                if (!IsOriginal(m)) m.Dispose();
            foreach (var m in _originalTemplateCache.Values) m.Dispose();
            _templateCache.Clear();
            _originalTemplateCache.Clear();
        }
        ColorPrinter.Blue($"{LogPrefix} All template caches cleared");
    }

    /// <summary>Load a template file and scale it by window / standard resolution (IMREAD_UNCHANGED). Caller disposes. 1:1 load_template_and_scale_by_resolution.</summary>
    public static Mat? LoadTemplateAndScaleByResolution(string templatePath, int windowWidth, int windowHeight, int standardWidth, int standardHeight)
    {
        if (!File.Exists(templatePath)) return null;
        var img = ImageConvert.LoadMat(templatePath, ImreadModes.Unchanged);
        if (img.Empty())
        {
            img.Dispose();
            return null;
        }
        double scaleX = windowWidth / (double)standardWidth;
        double scaleY = windowHeight / (double)standardHeight;
        if (IsUnitScale(scaleX, scaleY)) return img;
        using (img) return ResizeByScale(img, scaleX, scaleY);
    }

    /// <summary>True if the match center x is in the left <paramref name="ratio"/> of the image. 1:1 is_match_center_in_left_region.</summary>
    public static bool IsMatchCenterInLeftRegion(TemplateMatchResult match, int imageWidth, double ratio = TemplateMatcherConstants.LeftRegionRatio)
    {
        if (imageWidth <= 0 || match?.Center is not { } c) return false;
        return c.X < imageWidth * ratio;
    }

    /// <summary>
    /// Text schematic: a box for the target and '*' at match centers; with <paramref name="regionInParent"/>
    /// (parentW, parentH, left, top, width, height) an inner box marks the crop. 1:1 format_match_schematic.
    /// </summary>
    public static string FormatMatchSchematic(
        int targetWidth,
        int targetHeight,
        IReadOnlyList<Point2f> centers,
        string templateName = "",
        int gridCols = TemplateMatcherConstants.SchematicGridCols,
        int gridRows = TemplateMatcherConstants.SchematicGridRows,
        (int ParentW, int ParentH, int Left, int Top, int Width, int Height)? regionInParent = null)
    {
        if (targetWidth <= 0 || targetHeight <= 0)
            return $"[MatchSchematic] {templateName} target {targetWidth}x{targetHeight} (invalid)";
        var border = "+" + new string('-', gridCols) + "+";
        var points = centers.Select(c => $"({c.X}, {c.Y})");
        var sb = new StringBuilder();
        if (regionInParent is { } r)
        {
            if (r.ParentW <= 0 || r.ParentH <= 0)
                return $"[MatchSchematic] {templateName} region_in_parent invalid (parent {r.ParentW}x{r.ParentH})";
            int ToGx(double x) => Math.Max(0, Math.Min(gridCols - 1, (int)Math.Round(x / r.ParentW * gridCols, MidpointRounding.ToEven)));
            int ToGy(double y) => Math.Max(0, Math.Min(gridRows - 1, (int)Math.Round(y / r.ParentH * gridRows, MidpointRounding.ToEven)));
            int innerLeft = Math.Max(ToGx(r.Left), 1);
            int innerTop = Math.Max(ToGy(r.Top), 1);
            int innerRight = Math.Min(ToGx(r.Left + r.Width), gridCols - 2);
            int innerBottom = Math.Min(ToGy(r.Top + r.Height), gridRows - 2);
            var cells = centers.Select(c => (ToGx(r.Left + c.X), ToGy(r.Top + c.Y))).ToHashSet();
            sb.Append($"[MatchSchematic] {templateName}  parent {r.ParentW}x{r.ParentH}  region=({r.Left},{r.Top},{r.Width}x{r.Height})  center(s) in crop [{string.Join(", ", points)}]\n");
            sb.Append(border).Append('\n');
            for (int ry = 0; ry < gridRows; ry++)
            {
                for (int col = 0; col < gridCols; col++)
                {
                    bool outerRow = ry == 0 || ry == gridRows - 1;
                    bool outer = outerRow || col == 0 || col == gridCols - 1;
                    char ch;
                    if (outer)
                        ch = outerRow && (col == 0 || col == gridCols - 1) ? '+' : outerRow ? '-' : '|';
                    else if (innerLeft <= col && col <= innerRight && innerTop <= ry && ry <= innerBottom)
                    {
                        bool cornerCol = col == innerLeft || col == innerRight;
                        bool edgeRow = ry == innerTop || ry == innerBottom;
                        ch = cornerCol && edgeRow ? '+' : edgeRow ? '-' : cornerCol ? '|' : cells.Contains((col, ry)) ? '*' : '.';
                    }
                    else
                        ch = ' ';
                    sb.Append(ch);
                }
                sb.Append('\n');
            }
            sb.Append(border);
            return sb.ToString();
        }

        var grid = centers.Select(c => (
            X: Math.Max(0, Math.Min(gridCols - 1, (int)Math.Round(c.X / targetWidth * gridCols, MidpointRounding.ToEven))),
            Y: Math.Max(0, Math.Min(gridRows - 1, (int)Math.Round(c.Y / targetHeight * gridRows, MidpointRounding.ToEven))))).ToList();
        sb.Append($"[MatchSchematic] {templateName}  target {targetWidth}x{targetHeight}");
        if (grid.Count > 0) sb.Append($"  center(s) [{string.Join(", ", grid.Select(g => $"({g.X}, {g.Y})"))}]");
        sb.Append('\n').Append(border).Append('\n');
        for (int ry = 0; ry < gridRows; ry++)
        {
            var row = new char[gridCols];
            Array.Fill(row, ' ');
            foreach (var g in grid)
                if (g.Y == ry) row[g.X] = '*';
            sb.Append('|').Append(row).Append("|\n");
        }
        sb.Append(border);
        return sb.ToString();
    }

    private bool IsOriginal(Mat m)
    {
        foreach (var o in _originalTemplateCache.Values)
            if (ReferenceEquals(o, m)) return true;
        return false;
    }

    private static bool IsUnitScale(double scaleX, double scaleY) =>
        Math.Abs(scaleX - 1.0) < TemplateMatcherConstants.ScaleEpsilon && Math.Abs(scaleY - 1.0) < TemplateMatcherConstants.ScaleEpsilon;

    private static Mat ResizeByScale(Mat img, double scaleX, double scaleY)
    {
        int newW = Math.Max(1, (int)(img.Width * scaleX));
        int newH = Math.Max(1, (int)(img.Height * scaleY));
        var interp = scaleX < 1.0 || scaleY < 1.0 ? InterpolationFlags.Area : InterpolationFlags.Cubic;
        return img.Resize(new OpenCvSharp.Size(newW, newH), 0, 0, interp);
    }

    private Mat? LoadTarget(string path)
    {
        var img = ImageConvert.LoadMat(path, ImreadModes.Unchanged);
        if (!img.Empty()) return img;
        img.Dispose();
        ColorPrinter.Red($"{LogPrefix} Failed to load image from path: {path}");
        return null;
    }
}
