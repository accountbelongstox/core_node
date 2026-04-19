namespace DotApps.d3check.Core;

/// <summary>
/// D3 standard resolution and window border constants. Aligned with Python share.game_interface_data
/// and providor.constants.d3 (COORDINATE_SCALE_SPEC). Used for UpdateGlobalScale and scaled click.
/// </summary>
public static class D3ScaleConstants
{
    /// <summary>Content size (game client area).</summary>
    public const int D3StandardResolutionWidth = 1300;
    public const int D3StandardResolutionHeight = 800;

    /// <summary>Title bar and borders (measured).</summary>
    public const int TitleBarHeight = 31;
    public const int WindowBorderLeft = 8;
    public const int WindowBorderRight = 8;
    public const int WindowBorderBottom = 8;

    /// <summary>Outer window size when content is 1300x800 (what GetWindowRect returns).</summary>
    public const int D3StandardOuterWidth = D3StandardResolutionWidth + WindowBorderLeft + WindowBorderRight;   // 1316
    public const int D3StandardOuterHeight = D3StandardResolutionHeight + TitleBarHeight + WindowBorderBottom; // 839

    /// <summary>Threshold for windowed mode: fullscreen - window size must be at least this in both dimensions.</summary>
    public const int WindowHeightThreshold = TitleBarHeight;
}
