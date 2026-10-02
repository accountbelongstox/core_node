using System.Drawing;

namespace DotApps.d3d4tester.Core.Kanai;

/// <summary>Kanai Cube UI detection only (no blacksmith logic). 1:1 Python pyapps/d3-check/d3utils/kanai/detection.py.</summary>
public static class KanaiDetection
{
    /// <summary>True when the Kanai Cube left panel indicator matches. 1:1 detect_kanai_left_panel.</summary>
    public static bool DetectLeftPanel(Bitmap? gameWindowImage)
    {
        if (gameWindowImage == null) return false;
        var match = D3ScaledTemplateMatcher.Instance.MatchTemplate(gameWindowImage, D3TemplateNames.KanaiCubeLeftPanelIndicator).FirstMatch;
        return match is { Success: true };
    }

    /// <summary>True when the right page indicator matches, otherwise null (unknown). 1:1 detect_kanai_right_page_opened.</summary>
    public static bool? DetectRightPageOpened(Bitmap? gameWindowImage)
    {
        if (gameWindowImage == null) return null;
        var match = D3ScaledTemplateMatcher.Instance.MatchTemplate(gameWindowImage, D3TemplateNames.KanaiRightPageIndicator).FirstMatch;
        return match is { Success: true } ? true : null;
    }
}
