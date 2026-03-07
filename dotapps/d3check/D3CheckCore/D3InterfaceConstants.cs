namespace DotApps.d3check.Core;

/// <summary>
/// Template names and region ratio for D3 interface detection. 1:1 with Python
/// providor.constants.d3 and share.scaled_template_matcher_base.LEFT_REGION_RATIO.
/// </summary>
public static class D3InterfaceConstants
{
    /// <summary>Match center in left this fraction of image width = blacksmith (bag opened) or kanai. 1:1 Python LEFT_REGION_RATIO = 0.3.</summary>
    public const double LeftRegionRatio = 0.3;

    /// <summary>Template name for bag-opened indicator (left 30% -> blacksmith). 1:1 Python BAG_OPENED_INDICATOR_TEMPLATE_NAME.</summary>
    public const string BagOpenedIndicatorTemplateName = "bag_opened_indicator";

    /// <summary>Template name for Kanai Cube left panel indicator. 1:1 Python KANAI_CUBE_LEFT_PANEL_INDICATOR_TEMPLATE_NAME.</summary>
    public const string KanaiCubeLeftPanelIndicatorTemplateName = "kanai_cube_left_panel_indicator";

    /// <summary>Default match threshold when config not set. 1:1 Python template config threshold 0.8.</summary>
    public const double DefaultMatchThreshold = 0.8;
}
