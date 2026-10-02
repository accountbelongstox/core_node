using System.IO;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.D4;
using DotCore.Foundations;
using DotCore.TemplateMatcher;
using DotCore.Utils.ImagePreprocess;
using OpenCvSharp;

namespace DotApps.d3d4tester.Windows.CoordinatePicker;

/// <summary>One template match on the picker image (match rectangle and center in image pixels).</summary>
public sealed record TemplateMatchEntry(string TemplateName, TemplateMatchConfig Config, int X, int Y, int Width, int Height, int CenterX, int CenterY);

/// <summary>
/// Picker-side template matching: templates per client type grouped by category, selection, draw modes, match and draw on a copy of the
/// screenshot, reset. Singleton. 1:1 Python ui/components/template_matcher_helper.py.
/// Fixes Python bug: match_templates called the non-existent ImageMatcher.find_all_matches; each selected template is matched once with
/// the shared ImageMatcher and its threshold/method/alpha config.
/// </summary>
public sealed class TemplateMatcherHelper
{
    private const string LogPrefix = "[TEMPLATE_MATCHER]";
    private const string BattlenetTemplateSubdir = "battlenet";
    private const string BattlenetCategory = "battlenet_login";
    private const string D4Category = "d4_map";
    private const double BattlenetThreshold = 0.75;
    private const int LineThickness = 2;
    private const int PointRadius = 5;
    private const int TextOffsetY = 15;
    private const int PointTextOffsetX = 10;
    private const double TextFontScale = 0.5;
    private const int TextThickness = 1;
    private static readonly string[] DrawColors = { "red", "green", "blue", "yellow", "cyan", "magenta", "white", "orange" };

    /// <summary>1:1 Python BATTLENET_TEMPLATE_CONFIGS (name, file under templates/battlenet, method).</summary>
    private static readonly (string Name, string File, TemplateMatchMethod Method)[] BattlenetTemplates =
    {
        ("battlenet_d3_small_map", "d3_small_map.png", TemplateMatchMethod.Sift),
        ("battlenet_play_button_zh", "play_button_zh.png", TemplateMatchMethod.TmCCoeffNormed),
        ("battlenet_play_button_en", "play_button_en.png", TemplateMatchMethod.TmCCoeffNormed),
    };

    private Mat? _original;
    private Mat? _display;
    private Mat? _backup;

    private TemplateMatcherHelper() { }

    public static TemplateMatcherHelper Instance { get; } = new();

    /// <summary>Annotated image after DrawMatchesOnImage; null when nothing is drawn (show the original).</summary>
    public Mat? DisplayImage => _display;

    public List<TemplateMatchEntry> Matches { get; } = new();

    public List<string> SelectedTemplates { get; } = new();

    public Dictionary<CoordinatePickType, bool> MatchModes { get; } = new()
    {
        [CoordinatePickType.Point] = false,
        [CoordinatePickType.Rect] = false,
        [CoordinatePickType.Circle] = false,
    };

    /// <summary>Set the image and its backups (copies). 1:1 set_image.</summary>
    public void SetImage(Mat image)
    {
        ReplaceImages(image.Clone(), image.Clone(), image.Clone());
        ColorPrinter.Green($"{LogPrefix} Image set and backups created");
    }

    /// <summary>Drop the drawn image so the picker shows the original screenshot again (after a refresh).</summary>
    public void ClearDisplayImage()
    {
        _display?.Dispose();
        _display = null;
    }

    /// <summary>Template names grouped by category, in table order. 1:1 get_available_templates.</summary>
    public IReadOnlyDictionary<string, List<string>> GetAvailableTemplates(string clientType)
    {
        var byCategory = new Dictionary<string, List<string>>();
        foreach (var (name, category) in Catalog(clientType))
        {
            if (!byCategory.TryGetValue(category, out var list)) byCategory[category] = list = new List<string>();
            list.Add(name);
        }
        return byCategory;
    }

    /// <summary>1:1 select_template.</summary>
    public void SelectTemplate(string templateName, bool selected)
    {
        if (selected)
        {
            if (SelectedTemplates.Contains(templateName)) return;
            SelectedTemplates.Add(templateName);
            ColorPrinter.Blue($"{LogPrefix} Template selected: {templateName}");
        }
        else if (SelectedTemplates.Remove(templateName))
        {
            ColorPrinter.Blue($"{LogPrefix} Template deselected: {templateName}");
        }
    }

    /// <summary>1:1 set_match_modes.</summary>
    public void SetMatchModes(bool point, bool rect, bool circle)
    {
        MatchModes[CoordinatePickType.Point] = point;
        MatchModes[CoordinatePickType.Rect] = rect;
        MatchModes[CoordinatePickType.Circle] = circle;
        ColorPrinter.Blue($"{LogPrefix} Match modes set: point={point}, rect={rect}, circle={circle}");
    }

    /// <summary>Match every selected template on the original image. True when at least one match. 1:1 match_templates.</summary>
    public bool MatchTemplates(string clientType)
    {
        if (_original == null || SelectedTemplates.Count == 0)
        {
            ColorPrinter.Yellow($"{LogPrefix} No image or templates selected");
            return false;
        }
        Matches.Clear();
        var matcher = ImageMatcherRegistry.GetDefault();
        foreach (var name in SelectedTemplates)
        {
            var config = GetConfig(clientType, name);
            if (config == null)
            {
                ColorPrinter.Yellow($"{LogPrefix} Template not found: {name}");
                continue;
            }
            if (!File.Exists(config.Path))
            {
                ColorPrinter.Yellow($"{LogPrefix} Template file not found: {config.Path}");
                continue;
            }
            using var template = ImageConvert.LoadMat(config.Path, config.UseAlpha ? ImreadModes.Unchanged : ImreadModes.Color);
            if (template.Empty())
            {
                ColorPrinter.Yellow($"{LogPrefix} Template file not found: {config.Path}");
                continue;
            }
            var result = matcher.MatchSingleTemplate(_original, template, name, config.Threshold, config.UseAlpha, config.MatchMethod, silent: true, autoScale: false);
            int found = result.Success ? 1 : 0;
            if (result.Success)
                Matches.Add(new TemplateMatchEntry(name, config, result.X, result.Y, result.Width, result.Height, result.CenterX, result.CenterY));
            ColorPrinter.Green($"{LogPrefix} Found {found} matches for {name}");
        }
        return Matches.Count > 0;
    }

    /// <summary>Draw matches on the display image: rect mode = box, circle mode = circle of half the larger side, else a dot. 1:1 draw_matches_on_image.</summary>
    public bool DrawMatchesOnImage()
    {
        if (_display == null || Matches.Count == 0)
        {
            ColorPrinter.Yellow($"{LogPrefix} No image or matches to draw");
            return false;
        }
        for (int i = 0; i < Matches.Count; i++)
        {
            var m = Matches[i];
            var color = ImageAnnotate.GetAnnotationColor(DrawColors[i % DrawColors.Length]);
            if (MatchModes[CoordinatePickType.Rect])
            {
                ImageAnnotate.DrawRectangle(_display, new Point(m.X, m.Y), new Point(m.X + m.Width, m.Y + m.Height), color, LineThickness);
                ImageAnnotate.DrawText(_display, m.TemplateName, new Point(m.X, m.Y - TextOffsetY), color, TextFontScale, TextThickness);
            }
            else if (MatchModes[CoordinatePickType.Circle])
            {
                int radius = Math.Max(m.Width, m.Height) / 2;
                ImageAnnotate.DrawCircle(_display, new Point(m.CenterX, m.CenterY), radius, color, LineThickness);
                ImageAnnotate.DrawText(_display, m.TemplateName, new Point(m.CenterX, m.CenterY - TextOffsetY), color, TextFontScale, TextThickness);
            }
            else
            {
                ImageAnnotate.DrawCircle(_display, new Point(m.CenterX, m.CenterY), PointRadius, color, LineThickness, filled: true);
                ImageAnnotate.DrawText(_display, m.TemplateName, new Point(m.CenterX + PointTextOffsetX, m.CenterY), color, TextFontScale, TextThickness);
            }
        }
        ColorPrinter.Green($"{LogPrefix} Drew {Matches.Count} matches on image");
        return true;
    }

    /// <summary>Display image back to the backup. 1:1 reset_image.</summary>
    public bool ResetImage()
    {
        if (_backup == null) return false;
        _display?.Dispose();
        _display = _backup.Clone();
        ColorPrinter.Blue($"{LogPrefix} Image reset to original state");
        return true;
    }

    /// <summary>1:1 clear_matches.</summary>
    public void ClearMatches()
    {
        Matches.Clear();
        SelectedTemplates.Clear();
        ColorPrinter.Blue($"{LogPrefix} Matches and templates cleared");
    }

    /// <summary>Match data for export. 1:1 get_matches_data.</summary>
    public IReadOnlyList<(string Template, int X, int Y, int Width, int Height, double Threshold, string Method)> GetMatchesData() =>
        Matches.Select(m => (m.TemplateName, m.X, m.Y, m.Width, m.Height, m.Config.Threshold, m.Config.MatchMethod.ToName())).ToList();

    private void ReplaceImages(Mat original, Mat display, Mat backup)
    {
        _original?.Dispose();
        _display?.Dispose();
        _backup?.Dispose();
        _original = original;
        _display = display;
        _backup = backup;
    }

    /// <summary>(name, category) per client: D4 = D4_TEMPLATE_CONFIGS, D3 = D3_TEMPLATE_CONFIGS, else BATTLENET_TEMPLATE_CONFIGS.</summary>
    private static IEnumerable<(string Name, string Category)> Catalog(string clientType)
    {
        if (clientType == AppConstants.ClientTypeD4Game)
            return new[] { (D4Constants.SmallMapTemplateName, D4Category) };
        if (clientType == AppConstants.ClientTypeD3Game)
            return D3TemplateConfig.Names.Select(n => (n, D3TemplateConfig.GetCategory(n) ?? ""));
        return BattlenetTemplates.Select(t => (t.Name, BattlenetCategory));
    }

    private static TemplateMatchConfig? GetConfig(string clientType, string name)
    {
        if (clientType == AppConstants.ClientTypeD4Game)
        {
            return name == D4Constants.SmallMapTemplateName
                ? new TemplateMatchConfig
                {
                    Path = Path.Combine(D3TemplatePaths.GetTemplateDir(), D4Constants.SmallMapTemplateSubDir, D4Constants.SmallMapTemplateFile),
                    Threshold = D4Constants.SmallMapThreshold,
                    MatchMethod = D4Constants.SmallMapMatchMethod,
                }
                : null;
        }
        if (clientType == AppConstants.ClientTypeD3Game)
            return D3TemplateConfig.GetConfig(name);
        foreach (var t in BattlenetTemplates)
        {
            if (t.Name != name) continue;
            return new TemplateMatchConfig
            {
                Path = Path.Combine(D3TemplatePaths.GetTemplateDir(), BattlenetTemplateSubdir, t.File),
                Threshold = BattlenetThreshold,
                MatchMethod = t.Method,
            };
        }
        return null;
    }
}
