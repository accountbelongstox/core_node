namespace DotCore.UITheme.StatusBar;

/// <summary>
/// Centralized status bar display data: one place defines segment text and brush key per segment.
/// Consumed by status bar UI and any other UI that shows the same status. App implements builder.
/// </summary>
public interface IStatusBarDisplay
{
    string CurrentConfigLabel { get; }
    string BattlenetText { get; }
    string BattlenetBrushKey { get; }
    string RosText { get; }
    string RosBrushKey { get; }
    string D3Text { get; }
    string D3BrushKey { get; }
    string MapText { get; }
    string MapBrushKey { get; }
    string StageText { get; }
    string StageBrushKey { get; }
    string OauthText { get; }
    string OauthBrushKey { get; }
    string WindowSizeText { get; }
    string WindowSizeBrushKey { get; }
    string TestModeText { get; }
    string PathBnText { get; }
    string PathBnBrushKey { get; }
    string PathD3Text { get; }
    string PathD3BrushKey { get; }
    string PathD4Text { get; }
    string PathD4BrushKey { get; }
    string PathRosText { get; }
    string PathRosBrushKey { get; }
}
