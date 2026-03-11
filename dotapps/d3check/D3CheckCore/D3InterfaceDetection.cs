using System.Drawing;
using DotCore.Foundations;
using DotCore.TemplateMatcher;

namespace DotApps.d3check.Core;

/// <summary>
/// Detect D3 interface type from full game window image: template match + left 30% rule.
/// 1:1 with Python d3utils.interface_detection.detect_interface_type_from_full_window.
/// </summary>
public static class D3InterfaceDetection
{
    /// <summary>
    /// Detect interface type from full window bitmap. When wantBlacksmith, try bag_opened_indicator first (left 30% -> blacksmith);
    /// then try kanai_cube_left_panel_indicator (left 30% -> kanai_cube). Returns null if no match.
    /// When debugAttempts is non-null, appends one entry per template attempted (name, path, exists, result, inLeft30) for DEBUG image.
    /// </summary>
    public static string? DetectInterfaceTypeFromFullWindow(
        Bitmap? fullWindowImage,
        bool wantBlacksmith,
        double threshold = D3InterfaceConstants.DefaultMatchThreshold,
        IList<InterfaceDetectionAttempt>? debugAttempts = null)
    {
        if (fullWindowImage == null || fullWindowImage.Width <= 0)
        {
            ColorPrinter.Gray("[DEBUG][InterfaceDetection] fullWindowImage null or zero width");
            return null;
        }
        int imageWidth = fullWindowImage.Width;
        int imageHeight = fullWindowImage.Height;
        var (scaleX, scaleY) = GameInterfaceData.Instance.GetGlobalScale();
        var scaleInfo = GameInterfaceData.Instance.GetScaleDebugInfo();
        ColorPrinter.Gray($"[DEBUG][InterfaceDetection] image {imageWidth}x{imageHeight} scale=({scaleX:F4},{scaleY:F4}) wantBlacksmith={wantBlacksmith}");
        ColorPrinter.Gray($"[DEBUG][InterfaceDetection] scale derivation (1:1 Python update_global_scale): isWindowed={scaleInfo.IsWindowed} gameWindow={scaleInfo.GameWindowW}x{scaleInfo.GameWindowH} effectiveActual={scaleInfo.EffectiveActualW:F0}x{scaleInfo.EffectiveActualH:F0} effectiveStandard={scaleInfo.EffectiveStandardW:F0}x{scaleInfo.EffectiveStandardH:F0} (windowed: outer minus TitleBar={D3ScaleConstants.TitleBarHeight} Left+Right={D3ScaleConstants.WindowBorderLeft + D3ScaleConstants.WindowBorderRight} Bottom={D3ScaleConstants.WindowBorderBottom}; fullscreen: +threshold)");

        var matcher = TemplateMatcherService.GetTemplateMatcher();
        string templateDir = D3TemplatePaths.GetTemplateDir();
        ColorPrinter.Gray($"[DEBUG][InterfaceDetection] templateDir={templateDir}");

        if (wantBlacksmith)
        {
            var bagPath = D3TemplatePaths.GetTemplatePath(D3InterfaceConstants.BagOpenedIndicatorTemplateName);
            bool bagExists = File.Exists(bagPath);
            ColorPrinter.Gray($"[DEBUG][InterfaceDetection] Attempting template: {D3InterfaceConstants.BagOpenedIndicatorTemplateName} path={bagPath} exists={bagExists}");
            debugAttempts?.Add(new InterfaceDetectionAttempt { TemplateName = D3InterfaceConstants.BagOpenedIndicatorTemplateName, TemplatePath = bagPath, TemplateExists = bagExists });
            if (bagExists)
            {
                var result = MatchScaledTemplate(fullWindowImage, bagPath, scaleX, scaleY, matcher, threshold, D3InterfaceConstants.BagOpenedIndicatorTemplateName);
                if (debugAttempts != null && debugAttempts.Count > 0)
                {
                    var last = debugAttempts[debugAttempts.Count - 1];
                    last.MatchResult = result;
                    last.InLeft30 = result != null && IsMatchCenterInLeftRegion(result.CenterX, imageWidth);
                }
                if (result != null && result.Success && IsMatchCenterInLeftRegion(result.CenterX, imageWidth))
                {
                    ColorPrinter.Green($"[AutoUseInterface] Found bag_opened_indicator (blacksmith) in left 30% -> blacksmith flow");
                    return "blacksmith";
                }
                ColorPrinter.Gray($"[DEBUG][InterfaceDetection] bag_opened_indicator: exists={result != null} success={result?.Success} inLeft30={result != null && IsMatchCenterInLeftRegion(result.CenterX, imageWidth)}");
            }
        }

        var kanaiPath = D3TemplatePaths.GetTemplatePath(D3InterfaceConstants.KanaiCubeLeftPanelIndicatorTemplateName);
        bool kanaiExists = File.Exists(kanaiPath);
        ColorPrinter.Gray($"[DEBUG][InterfaceDetection] Attempting template: {D3InterfaceConstants.KanaiCubeLeftPanelIndicatorTemplateName} path={kanaiPath} exists={kanaiExists}");
        debugAttempts?.Add(new InterfaceDetectionAttempt { TemplateName = D3InterfaceConstants.KanaiCubeLeftPanelIndicatorTemplateName, TemplatePath = kanaiPath, TemplateExists = kanaiExists });
        if (kanaiExists)
        {
            var result = MatchScaledTemplate(fullWindowImage, kanaiPath, scaleX, scaleY, matcher, threshold, D3InterfaceConstants.KanaiCubeLeftPanelIndicatorTemplateName);
            if (debugAttempts != null && debugAttempts.Count > 0)
            {
                var last = debugAttempts[debugAttempts.Count - 1];
                last.MatchResult = result;
                last.InLeft30 = result != null && IsMatchCenterInLeftRegion(result.CenterX, imageWidth);
            }
            if (result != null && result.Success && IsMatchCenterInLeftRegion(result.CenterX, imageWidth))
            {
                ColorPrinter.Green($"[AutoUseInterface] Found kanai_cube_left_panel_indicator in left 30% -> Kanai Cube flow");
                return "kanai_cube";
            }
            ColorPrinter.Gray($"[DEBUG][InterfaceDetection] kanai_cube_left_panel_indicator: exists={result != null} success={result?.Success} centerX={result?.CenterX} inLeft30={result != null && IsMatchCenterInLeftRegion(result.CenterX, imageWidth)}");
        }

        return null;
    }

    /// <summary>True iff centerX is in the left ratio of image width. 1:1 Python is_match_center_in_left_region.</summary>
    public static bool IsMatchCenterInLeftRegion(int centerX, int imageWidth, double ratio = D3InterfaceConstants.LeftRegionRatio)
    {
        if (imageWidth <= 0) return false;
        return centerX < imageWidth * ratio;
    }

    private static TemplateMatchResult? MatchScaledTemplate(
        Bitmap sourceImage,
        string templatePath,
        double scaleX,
        double scaleY,
        TemplateMatcherService matcher,
        double threshold,
        string templateName)
    {
        ColorPrinter.Gray($"[DEBUG][InterfaceDetection] Using template file: {templatePath}");
        using var template = LoadBitmapFromFile(templatePath);
        if (template == null) return null;
        using var scaled = ScaleBitmap(template, scaleX, scaleY);
        if (scaled == null) return null;
        ColorPrinter.Gray($"[DEBUG][InterfaceDetection] sourceImage size: {sourceImage.Width}x{sourceImage.Height}, scaledTemplate size: {scaled.Width}x{scaled.Height} (template {templateName})");
        var result = matcher.Match(sourceImage, scaled, threshold, templateName);
        ColorPrinter.Gray($"[DEBUG][InterfaceDetection] Match {templateName} scale=({scaleX:F4},{scaleY:F4}) success={result.Success} center=({result.CenterX},{result.CenterY}) score={result.Score:F3}");
        return result;
    }

    private static Bitmap? LoadBitmapFromFile(string path)
    {
        if (string.IsNullOrEmpty(path) || !File.Exists(path)) return null;
        try
        {
            return new Bitmap(path);
        }
        catch (Exception ex)
        {
            ColorPrinter.Yellow($"[InterfaceDetection] Failed to load template {path}: {ex.Message}");
            return null;
        }
    }

    private static Bitmap? ScaleBitmap(Bitmap source, double scaleX, double scaleY)
    {
        if (source == null || source.Width <= 0 || source.Height <= 0) return null;
        int newW = Math.Max(1, (int)(source.Width * scaleX));
        int newH = Math.Max(1, (int)(source.Height * scaleY));
        try
        {
            var scaled = new Bitmap(newW, newH);
            using (var g = Graphics.FromImage(scaled))
            {
                g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                g.DrawImage(source, 0, 0, newW, newH);
            }
            return scaled;
        }
        catch (Exception ex)
        {
            ColorPrinter.Yellow($"[InterfaceDetection] Failed to scale template: {ex.Message}");
            return null;
        }
    }
}
