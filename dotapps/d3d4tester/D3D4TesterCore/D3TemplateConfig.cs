using DotCore.TemplateMatcher;

namespace DotApps.d3d4tester.Core;

/// <summary>D3 template names. 1:1 Python providor.constants.d3 *_TEMPLATE_NAME and D3_TEMPLATE_CONFIGS keys.</summary>
public static class D3TemplateNames
{
    public const string BagOpenedIndicator = "bag_opened_indicator";
    public const string BagLeft = "bag_left";
    public const string BagRight = "bag_right";
    public const string BagButtom = "bag_buttom";
    public const string BlacksmithIndicator1 = "blacksmith_indicator_1";
    public const string BlacksmithIndicator2 = "blacksmith_indicator_2";
    public const string BlacksmithSidebarTab1 = "blacksmith_sidebar_tab_1";
    public const string BlacksmithSidebarTab2 = "blacksmith_sidebar_tab_2";
    public const string BlacksmithSalvageButton = "blacksmith_salvage_button";
    public const string KanaiRightPanelOpenedIndicator = "kanai_right_panel_opened_indicator";
    public const string KanaiRightPageIndicator = "kanai_right_page_indicator";
    public const string KanaiCubeLeftPanelIndicator = "kanai_cube_left_panel_indicator";
    public const string KanaiRightPanelToggleIcon = "kanai_right_panel_toggle_icon";
    public const string KanaiNextPageIcon = "kanai_next_page_icon";
    public const string D3StartGameButton = "d3_start_game_button";
    public const string D3GameTool = "d3_game_tool";
    public const string D3BountyProgress = "d3_bounty_progress";
    public const string D3Disconnected = "d3_disconnected";
    public const string D3Connecting = "d3_connecting";
    public const string D3ConnectingAlt = "d3_connecting_alt";
    public const string ItemPrimalAncient = "item_primal_ancient";
    public const string ItemAncientSet = "item_ancient_set";
    public const string ItemLegendary = "item_legendary";
    public const string ItemRareYellow = "item_rare_yellow";
    public const string ItemRareBlue = "item_rare_blue";
    public const string SlotEmpty = "slot_empty";
    public const string SlotInterferenceColors = "slot_interference_colors";
    public const string QualityYellowColors = "quality_yellow_colors";
    public const string GameAnchorBottomLeft1 = "game_anchor_bottom_left_1";
    public const string GameAnchorBottomLeft2 = "game_anchor_bottom_left_2";
    public const string GameAnchorBottomLeft3 = "game_anchor_bottom_left_3";
    public const string GameAnchorBottomRight = "game_anchor_bottom_right";
}

/// <summary>
/// D3 template table (file, threshold, alpha, method, category). 1:1 Python providor.providor_index D3_TEMPLATE_CONFIGS
/// and get_template_path / get_template_threshold / get_template_use_alpha / get_template_match_method.
/// </summary>
public static class D3TemplateConfig
{
    private const double DefaultThreshold = 0.8;
    private const string JpgExtension = ".jpg";

    private sealed record Entry(double Threshold, bool UseAlpha, TemplateMatchMethod Method, string Category, string Extension = D3TemplatePaths.TemplateExtension);

    private static readonly IReadOnlyDictionary<string, Entry> Table = new Dictionary<string, Entry>
    {
        [D3TemplateNames.BagOpenedIndicator] = new(0.80, false, TemplateMatchMethod.Sift, "bag"),
        [D3TemplateNames.BagLeft] = new(0.7, false, TemplateMatchMethod.Sift, "bag"),
        [D3TemplateNames.BagRight] = new(0.7, false, TemplateMatchMethod.Orb, "bag"),
        [D3TemplateNames.BagButtom] = new(0.8, false, TemplateMatchMethod.Sift, "bag"),
        [D3TemplateNames.BlacksmithIndicator1] = new(0.85, false, TemplateMatchMethod.Orb, "interface_indicator"),
        [D3TemplateNames.BlacksmithIndicator2] = new(0.85, false, TemplateMatchMethod.Orb, "interface_indicator"),
        [D3TemplateNames.BlacksmithSidebarTab1] = new(0.81, false, TemplateMatchMethod.Sift, "button"),
        [D3TemplateNames.BlacksmithSidebarTab2] = new(0.81, false, TemplateMatchMethod.Sift, "button"),
        [D3TemplateNames.BlacksmithSalvageButton] = new(0.81, false, TemplateMatchMethod.Sift, "button"),
        [D3TemplateNames.KanaiRightPanelOpenedIndicator] = new(0.80, false, TemplateMatchMethod.Sift, "interface_indicator"),
        [D3TemplateNames.KanaiRightPageIndicator] = new(0.8, false, TemplateMatchMethod.Sift, "interface_indicator"),
        [D3TemplateNames.KanaiCubeLeftPanelIndicator] = new(0.80, false, TemplateMatchMethod.Sift, "interface_indicator"),
        [D3TemplateNames.KanaiRightPanelToggleIcon] = new(0.75, false, TemplateMatchMethod.Sift, "icon"),
        [D3TemplateNames.KanaiNextPageIcon] = new(0.75, false, TemplateMatchMethod.Orb, "icon"),
        [D3TemplateNames.D3StartGameButton] = new(0.75, false, TemplateMatchMethod.Sift, "button"),
        [D3TemplateNames.D3GameTool] = new(0.75, false, TemplateMatchMethod.Sift, "interface_indicator"),
        [D3TemplateNames.D3BountyProgress] = new(0.75, false, TemplateMatchMethod.Sift, "interface_indicator"),
        [D3TemplateNames.D3Disconnected] = new(0.70, false, TemplateMatchMethod.Sift, "interface_indicator"),
        [D3TemplateNames.D3Connecting] = new(0.70, false, TemplateMatchMethod.Sift, "interface_indicator"),
        [D3TemplateNames.D3ConnectingAlt] = new(0.70, false, TemplateMatchMethod.Sift, "interface_indicator"),
        [D3TemplateNames.ItemPrimalAncient] = new(0.8, false, TemplateMatchMethod.Orb, "item_quality"),
        [D3TemplateNames.ItemAncientSet] = new(0.8, false, TemplateMatchMethod.Orb, "item_quality"),
        [D3TemplateNames.ItemLegendary] = new(0.8, false, TemplateMatchMethod.Orb, "item_quality"),
        [D3TemplateNames.ItemRareYellow] = new(0.8, false, TemplateMatchMethod.Orb, "item_quality"),
        [D3TemplateNames.ItemRareBlue] = new(0.8, false, TemplateMatchMethod.Orb, "item_quality"),
        [D3TemplateNames.SlotEmpty] = new(0.8, false, TemplateMatchMethod.Orb, "slot"),
        [D3TemplateNames.SlotInterferenceColors] = new(DefaultThreshold, false, TemplateMatchMethod.Orb, "slot"),
        [D3TemplateNames.QualityYellowColors] = new(DefaultThreshold, false, TemplateMatchMethod.Orb, "quality_colors", JpgExtension),
        [D3TemplateNames.GameAnchorBottomLeft1] = new(0.8, false, TemplateMatchMethod.Orb, "game_anchor"),
        [D3TemplateNames.GameAnchorBottomLeft2] = new(0.8, false, TemplateMatchMethod.Orb, "game_anchor"),
        [D3TemplateNames.GameAnchorBottomLeft3] = new(0.8, false, TemplateMatchMethod.Orb, "game_anchor"),
        [D3TemplateNames.GameAnchorBottomRight] = new(0.85, true, TemplateMatchMethod.Orb, "game_anchor"),
    };

    /// <summary>True when the name is in the table.</summary>
    public static bool Contains(string templateName) => Table.ContainsKey(templateName);

    /// <summary>All template names in table order.</summary>
    public static IEnumerable<string> Names => Table.Keys;

    /// <summary>Category of a template, null when unknown.</summary>
    public static string? GetCategory(string templateName) => Table.TryGetValue(templateName, out var e) ? e.Category : null;

    /// <summary>Template file path or null when unknown. 1:1 get_template_path.</summary>
    public static string? GetTemplatePath(string templateName) =>
        Table.TryGetValue(templateName, out var e) ? Path.Combine(D3TemplatePaths.GetTemplateDir(), templateName + e.Extension) : null;

    /// <summary>Threshold (default 0.8). 1:1 get_template_threshold.</summary>
    public static double GetThreshold(string templateName) => Table.TryGetValue(templateName, out var e) ? e.Threshold : DefaultThreshold;

    /// <summary>Use alpha (default false). 1:1 get_template_use_alpha.</summary>
    public static bool GetUseAlpha(string templateName) => Table.TryGetValue(templateName, out var e) && e.UseAlpha;

    /// <summary>Match method (default ORB). 1:1 get_template_match_method.</summary>
    public static TemplateMatchMethod GetMatchMethod(string templateName) => Table.TryGetValue(templateName, out var e) ? e.Method : TemplateMatchMethod.Orb;

    /// <summary>Names in a category. 1:1 get_templates_by_category.</summary>
    public static IReadOnlyList<string> GetTemplatesByCategory(string category) =>
        Table.Where(kv => kv.Value.Category == category).Select(kv => kv.Key).ToList();

    /// <summary>Matcher config for a template, null when unknown. 1:1 d3_scaled_template_matcher._d3_get_template_config.</summary>
    public static TemplateMatchConfig? GetConfig(string templateName)
    {
        var path = GetTemplatePath(templateName);
        if (path == null) return null;
        return new TemplateMatchConfig
        {
            Path = path,
            Threshold = GetThreshold(templateName),
            UseAlpha = GetUseAlpha(templateName),
            MatchMethod = GetMatchMethod(templateName),
        };
    }
}
