using DotCore.UITheme.StatusBar;

namespace DotApps.d3check.Core;

/// <summary>
/// D3-specific status bar display DTO: one place for all segment text and brush keys.
/// Built by D3StatusBarDisplayBuilder (in app); consumed by MainWindow and any other UI.
/// </summary>
public sealed class D3StatusBarDisplay : IStatusBarDisplay
{
    public string CurrentConfigLabel { get; init; } = "";
    public string BattlenetText { get; init; } = "";
    public string BattlenetBrushKey { get; init; } = "TextMutedBrush";
    public string RosText { get; init; } = "";
    public string RosBrushKey { get; init; } = "TextMutedBrush";
    public string D3Text { get; init; } = "";
    public string D3BrushKey { get; init; } = "TextMutedBrush";
    public string MapText { get; init; } = "";
    public string MapBrushKey { get; init; } = "TextMutedBrush";
    public string StageText { get; init; } = "";
    public string StageBrushKey { get; init; } = "TextMutedBrush";
    public string OauthText { get; init; } = "";
    public string OauthBrushKey { get; init; } = "TextMutedBrush";
    public string WindowSizeText { get; init; } = "";
    public string WindowSizeBrushKey { get; init; } = "TextMutedBrush";
    public string TestModeText { get; init; } = "";
    public string PathBnText { get; init; } = "";
    public string PathBnBrushKey { get; init; } = "TextMutedBrush";
    public string PathD3Text { get; init; } = "";
    public string PathD3BrushKey { get; init; } = "TextMutedBrush";
    public string PathD4Text { get; init; } = "";
    public string PathD4BrushKey { get; init; } = "TextMutedBrush";
    public string PathRosText { get; init; } = "";
    public string PathRosBrushKey { get; init; } = "TextMutedBrush";
}
