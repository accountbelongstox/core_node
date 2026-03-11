namespace DotCore.UITheme;

/// <summary>
/// Semantic color key constants for theme. Used by apps to resolve actual color values (e.g. hex) via <see cref="UITheme"/>.
/// Aligned with pyapps/d3-check/ui/theme/theme.py and docs/DOT_D3CHECK_UI_LIBRARY.md.
/// </summary>
public static class ThemeColorKeys
{
    // Backgrounds
    public const string BgPrimary = "bg_primary";
    public const string BgSecondary = "bg_secondary";
    public const string BgTertiary = "bg_tertiary";
    public const string BgDark = "bg_dark";
    public const string BgLight = "bg_light";
    public const string BgHover = "bg_hover";

    // Text
    public const string TextPrimary = "text_primary";
    public const string TextSecondary = "text_secondary";
    public const string TextTertiary = "text_tertiary";
    public const string TextDark = "text_dark";
    public const string TextAccent = "text_accent";
    public const string TextSuccess = "text_success";
    public const string TextWarning = "text_warning";
    public const string TextError = "text_error";

    // Interactive states
    public const string StateNormal = "state_normal";
    public const string StateHover = "state_hover";
    public const string StateActive = "state_active";
    public const string StateFocus = "state_focus";
    public const string StateDisabled = "state_disabled";

    // Buttons
    public const string BtnPrimary = "btn_primary";
    public const string BtnPrimaryHover = "btn_primary_hover";
    public const string BtnSecondary = "btn_secondary";
    public const string BtnSecondaryHover = "btn_secondary_hover";
    public const string BtnSuccess = "btn_success";
    public const string BtnDanger = "btn_danger";
    public const string BtnAccent = "btn_accent";
    public const string BtnAccentHover = "btn_accent_hover";
    public const string BtnInfo = "btn_info";
    public const string BtnInfoHover = "btn_info_hover";

    // Inputs
    public const string InputBg = "input_bg";
    public const string InputText = "input_text";
    public const string InputBorder = "input_border";
    public const string InputFocus = "input_focus";

    // Borders and decoration
    public const string BorderPrimary = "border_primary";
    public const string BorderSecondary = "border_secondary";
    public const string BorderSubtle = "border_subtle";
    public const string Separator = "separator";
    public const string PanelBorder = "panel_border";

    // Tabs
    public const string TabUnselectedBg = "tab_unselected_bg";
    public const string TabUnselectedFg = "tab_unselected_fg";
    public const string TabSelectedBg = "tab_selected_bg";
    public const string TabSelectedFg = "tab_selected_fg";

    // Accents
    public const string Accent = "accent";
    public const string AccentBlue = "accent_blue";
    public const string AccentCyan = "accent_cyan";
    public const string AccentRed = "accent_red";
    public const string AccentOrange = "accent_orange";
    public const string AccentGreen = "accent_green";
}
