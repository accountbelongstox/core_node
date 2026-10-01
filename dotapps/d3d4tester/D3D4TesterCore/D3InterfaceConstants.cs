namespace DotApps.d3d4tester.Core;

/// <summary>
/// Template names, region ratio, C-branch (C3/C5/C7/C10) templates, clicks and timings for D3. 1:1 with Python
/// providor.constants.d3, providor.constants.common (click/activate) and share.scaled_template_matcher_base.LEFT_REGION_RATIO.
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

    /// <summary>Standard-coordinate clicks (unified scaled): minimize map, teleport 1 (large/small map), teleport 2 (secret camp minimap).</summary>
    public static readonly (int X, int Y) D3MapMinimizeClick = (610, 126);
    public static readonly (int X, int Y) D3TeleportClick = (751, 413);
    public static readonly (int X, int Y) D3TeleportClick2 = (713, 611);

    public const double C7bTeleportClickIntervalSec = 0.5;
    public const double C7bWaitAfterClickSec = 2.0;
    public const double C7bAfterBountyStableSec = 0.5;
    public const double D3GameToolAfterMDelaySec = 2.0;
    public const double D3StartGameWaitIntervalSec = 2.0;
    public const int D3StartGameMaxAttempts = 10;
    public const int D3GameToolMaxAttempts = 10;
    public const int D3Fragment1WaitGameToolAttempts = 5;
    public const int D3Fragment2DisappearAttempts = 5;

    /// <summary>C3/C3w overall timeout (3 minutes) for the blocking C3 loop.</summary>
    public const double C3C3wTimeoutSec = 180.0;

    /// <summary>Extension flow deadline in flow ticks (2 s per flow tick): 90 * 2 s = 180 s.</summary>
    public const int C3DeadlineTicks = 90;

    /// <summary>Flow ticks to wait for d3_game_tool after Start Game (C5w).</summary>
    public const int C5wDeadlineTicks = 5;

    public const double C3wWaitSec = 2.0;

    /// <summary>Within this many seconds after a teleport skip C10 (M-key disconnect check) and do not re-enter the C branch.</summary>
    public const int C10SkipAfterTeleportSec = 90;

    /// <summary>C10b: before/after-M similarity at or above this means M had no response, i.e. disconnected.</summary>
    public const double D3OnlineSimilarityThreshold = 0.995;

    public const int D3OnlineSimilarityResize = 64;

    /// <summary>1:1 Python CLICK_MOVE_DURATION_SEC / CLICK_PAUSE_AFTER_MOVE_SEC.</summary>
    public const double ClickMoveDurationSec = 0.0;
    public const double ClickPauseAfterMoveSec = 0.02;

    /// <summary>1:1 Python ACTIVATE_BEFORE_CAPTURE_DELAY_SEC.</summary>
    public const int ActivateBeforeCaptureDelayMs = 300;

    /// <summary>Key-down to key-up gap for M sent via PostMessage.</summary>
    public const int SendKeyHoldMs = 50;

    public const ushort VkM = 0x4D;

    /// <summary>Debug image subdirectories under <see cref="TmpRootDir"/>. 1:1 Python MATCH_DEBUG_DIR / LOGIN_TRY_SCREENSHOT_DIR.</summary>
    public const string MatchDebugSubdir = "match_debug";
    public const string LoginTrySubdir = "login_try_screenshots";
    public const string LoginTryScreenshotPrefix = "login_try";

    /// <summary>1:1 Python TMP_DIR (system cache pytools/tmp).</summary>
    public static readonly string TmpRootDir = Path.Combine(Path.GetTempPath(), "pytools", "tmp");
}
