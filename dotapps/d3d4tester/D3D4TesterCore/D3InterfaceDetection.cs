// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/interface_detection.py
// PY-REF: dotapps/d3d4tester/reference/py_d3check/share/scaled_template_matcher_base.py
using System.Drawing;
using DotCore.Foundations;
using DotCore.TemplateMatcher;
using DotCore.Utils.ImagePreprocess;

namespace DotApps.d3d4tester.Core;

/// <summary>Interface detection result: "blacksmith" | "kanai_cube" | null plus matched template details (reused as button detections).</summary>
public sealed record InterfaceDetectionResult(string? InterfaceType, IReadOnlyDictionary<string, TemplateMatchResult> MatchDetails);

/// <summary>
/// Detect D3 interface type from the full game window: scaled template match + left 30% rule.
/// 1:1 Python dotapps/d3d4tester/reference/py_d3check/d3utils/interface_detection.py detect_interface_type_from_full_window.
/// </summary>
public static class D3InterfaceDetection
{
    public const string InterfaceBlacksmith = "blacksmith";
    public const string InterfaceKanaiCube = "kanai_cube";

    /// <summary>
    /// When wantBlacksmith, bag_opened_indicator centered in the left 30% -> "blacksmith"; then kanai_cube_left_panel_indicator
    /// in the left 30% -> "kanai_cube". debugAttempts (optional) receives one entry per template tried for the DEBUG image.
    /// </summary>
    public static InterfaceDetectionResult DetectInterfaceTypeFromFullWindow(
        Bitmap? fullWindowImage,
        bool wantBlacksmith,
        D3ScaledTemplateMatcher? matcher = null,
        IList<InterfaceDetectionAttempt>? debugAttempts = null)
    {
        var details = new Dictionary<string, TemplateMatchResult>();
        if (fullWindowImage == null || fullWindowImage.Width <= 0)
            return new InterfaceDetectionResult(null, details);
        matcher ??= D3ScaledTemplateMatcher.Instance;
        int width = fullWindowImage.Width;
        using var target = ImageConvert.BitmapToMat(fullWindowImage);

        if (wantBlacksmith && TryMatchLeft(matcher, target, width, D3TemplateNames.BagOpenedIndicator, debugAttempts) is { } bag)
        {
            details[D3TemplateNames.BagOpenedIndicator] = bag;
            return new InterfaceDetectionResult(InterfaceBlacksmith, details);
        }
        if (TryMatchLeft(matcher, target, width, D3TemplateNames.KanaiCubeLeftPanelIndicator, debugAttempts) is { } kanai)
        {
            details[D3TemplateNames.KanaiCubeLeftPanelIndicator] = kanai;
            return new InterfaceDetectionResult(InterfaceKanaiCube, details);
        }
        return new InterfaceDetectionResult(null, details);
    }

    /// <summary>True iff centerX is in the left ratio of image width. 1:1 Python is_match_center_in_left_region.</summary>
    public static bool IsMatchCenterInLeftRegion(int centerX, int imageWidth, double ratio = D3InterfaceConstants.LeftRegionRatio)
    {
        if (imageWidth <= 0) return false;
        return centerX < imageWidth * ratio;
    }

    private static TemplateMatchResult? TryMatchLeft(D3ScaledTemplateMatcher matcher, OpenCvSharp.Mat target, int width, string templateName, IList<InterfaceDetectionAttempt>? debugAttempts)
    {
        var path = D3TemplateConfig.GetTemplatePath(templateName) ?? "";
        var attempt = new InterfaceDetectionAttempt { TemplateName = templateName, TemplatePath = path, TemplateExists = File.Exists(path) };
        debugAttempts?.Add(attempt);
        var r = matcher.MatchTemplate(target, templateName);
        var match = r.FirstMatch;
        bool inLeft = match != null && ScaledTemplateMatcher.IsMatchCenterInLeftRegion(match, width);
        attempt.MatchResult = match;
        attempt.InLeft30 = inLeft;
        ColorPrinter.Gray($"[DEBUG][InterfaceDetection] {templateName}: matched={match?.Success == true} center=({match?.CenterX},{match?.CenterY}) inLeft30={inLeft}");
        return match is { Success: true } && inLeft ? match : null;
    }
}
