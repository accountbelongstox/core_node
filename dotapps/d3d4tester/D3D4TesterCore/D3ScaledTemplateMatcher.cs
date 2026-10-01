using System.Drawing;
using DotCore.Foundations;
using DotCore.TemplateMatcher;
using DotCore.Utils.ImagePreprocess;
using OpenCvSharp;

namespace DotApps.d3d4tester.Core;

/// <summary>C3 multi-state match outcome. 1:1 Python match_all_d3_states dict.</summary>
public sealed record D3StatesMatch(bool Disconnected, bool StartGameButton, bool GameTool, bool Connecting);

/// <summary>
/// D3 scaled template matcher (1300x800 standard, global scale, D3 template table, match-debug hook).
/// 1:1 Python pyapps/d3-check/d3utils/d3_scaled_template_matcher.py.
/// </summary>
public sealed class D3ScaledTemplateMatcher : ScaledTemplateMatcher
{
    private const string Prefix = "[D3ScaledMatcher]";
    private const double FeatureRatioThresh = 0.80;
    private const int FeatureMinInliers = 4;
    private const int FeatureNFeatures = 10000;
    /// <summary>Min good matches for d3_disconnected (avoid connecting misjudged as disconnected). 1:1 D3_DISCONNECTED_MIN_GOOD_MATCHES.</summary>
    public const int DisconnectedMinGoodMatches = 20;
    /// <summary>Min good matches for start/game_tool/connecting.</summary>
    public const int StateMinGoodMatches = 4;

    private static readonly Lazy<D3ScaledTemplateMatcher> LazyInstance = new(() => new D3ScaledTemplateMatcher());

    /// <summary>Singleton. 1:1 get_d3_scaled_template_matcher.</summary>
    public static D3ScaledTemplateMatcher Instance => LazyInstance.Value;

    private D3ScaledTemplateMatcher()
        : base(
            D3ScaleConstants.D3StandardResolutionWidth,
            D3ScaleConstants.D3StandardResolutionHeight,
            () => GameInterfaceData.Instance.GetGlobalScale(),
            D3TemplateConfig.GetConfig,
            m => ImageMatcherRegistry.GetForMethod(m, D3ScaleConstants.D3StandardResolutionWidth, D3ScaleConstants.D3StandardResolutionHeight, FeatureRatioThresh, FeatureMinInliers, FeatureNFeatures),
            Prefix,
            MatchDebugNotify.NotifyMatch)
    {
        ColorPrinter.Green("[D3ScaledTemplateMatcher] Initialized");
    }

    /// <summary>Auto-scale match on a bitmap (scale = image size / D3 standard). 1:1 match_template_auto_scale.</summary>
    public ScaledMatchResult MatchTemplateAutoScale(Bitmap target, string templateName)
    {
        using var mat = ImageConvert.BitmapToMat(target);
        return MatchTemplateAutoScale(mat, templateName);
    }

    /// <summary>
    /// C3 template match. Priority disconnected -> game_tool -> start_game_button -> connecting -> no match;
    /// game_tool is dropped while connecting has more matches (still loading). 1:1 match_all_d3_states.
    /// </summary>
    public D3StatesMatch MatchAllD3States(Mat? target, IReadOnlyList<string>? templateNames = null)
    {
        var names = templateNames ?? new[]
        {
            D3TemplateNames.D3Disconnected, D3TemplateNames.D3StartGameButton, D3TemplateNames.D3GameTool,
            D3TemplateNames.D3Connecting, D3TemplateNames.D3ConnectingAlt,
        };
        if (target == null || target.Empty())
        {
            ColorPrinter.Gray($"{LogPrefix} C3 match: no image | disconnected=- start=- game_tool=- connecting=- | export: no_match");
            return new D3StatesMatch(false, false, false, false);
        }
        double scaleX = target.Width / (double)StandardWidth;
        double scaleY = target.Height / (double)StandardHeight;
        var values = new Dictionary<string, int>();
        foreach (var name in names)
        {
            var r = MatchSingleWithScale(target, name, scaleX, scaleY, silent: true);
            values[name] = r.FirstMatch?.NumMatches ?? 0;
        }
        int Get(string n) => values.TryGetValue(n, out var v) ? v : 0;
        int connectingVal = Math.Max(Get(D3TemplateNames.D3Connecting), Get(D3TemplateNames.D3ConnectingAlt));
        int dVal = Get(D3TemplateNames.D3Disconnected);
        int sVal = Get(D3TemplateNames.D3StartGameButton);
        int gVal = Get(D3TemplateNames.D3GameTool);
        bool dOk = dVal >= DisconnectedMinGoodMatches;
        bool sOk = sVal >= StateMinGoodMatches;
        bool gOk = gVal >= StateMinGoodMatches;
        bool cOk = connectingVal >= StateMinGoodMatches;
        if (gOk && cOk && connectingVal > gVal) gOk = false;
        string export = dOk ? "disconnected" : gOk ? "game_tool" : sOk ? "start_game_button" : cOk ? "connecting" : "no_match";
        static string Mark(bool ok) => ok ? "✓" : "";
        ColorPrinter.Gray($"{LogPrefix} C3 match: disconnected={dVal}{Mark(dOk)} start={sVal}{Mark(sOk)} game_tool={gVal}{Mark(gOk)} connecting={connectingVal}{Mark(cOk)} | export: {export}");
        return new D3StatesMatch(dOk, sOk, gOk, cOk);
    }

    /// <summary>Bitmap overload of <see cref="MatchAllD3States(Mat?, IReadOnlyList{string}?)"/>.</summary>
    public D3StatesMatch MatchAllD3States(Bitmap? target, IReadOnlyList<string>? templateNames = null)
    {
        if (target == null) return MatchAllD3States((Mat?)null, templateNames);
        using var mat = ImageConvert.BitmapToMat(target);
        return MatchAllD3States(mat, templateNames);
    }
}
