// PY-REF: dotapps/d3d4tester/reference/py_d3check/providor/constants/d4.py
// PY-REF: dotapps/d3d4tester/reference/py_d3check/providor/providor_index.py
// PY-REF: dotapps/d3d4tester/reference/py_d3check/share/coordinate_helper.py
// PY-REF: scripts/analysis/d4_minimap_path.py
using DotCore.Common;
using DotCore.Common.Geometry;
using DotCore.MinimapPath;
using DotCore.TemplateMatcher;
using DotCore.Utils.ImageColor;
using OpenCvSharp;

namespace DotApps.d3d4tester.Core.D4;

/// <summary>
/// D4-only constants. 1:1 Python dotapps/d3d4tester/reference/py_d3check/providor/constants/d4.py, providor_index.py (DIABLO_IV_WINDOW_TITLES, D4_TEMPLATE_CONFIGS),
/// share/coordinate_helper.py and the class constants of d4utils (team health, black screen, red portal, team formation).
/// </summary>
public static class D4Constants
{
    public const int StandardWidth = 1763;
    public const int StandardHeight = 1126;

    public const double TickIntervalSec = 3.0;
    public const int TickIntervalMs = 3000;

    public const string TmpDirParent = D3PathConstants.PytoolsDirName;
    public const string TmpDirName = D3PathConstants.TmpDirName;
    public const string ScreenshotDirName = "d4_screenshots";
    public const string AnnotatedDirName = "d4_annotated";
    public const string TimestampFormat = D3PathConstants.FileTimestampMsFormat;
    public const string ImageExtension = ".png";

    public const string ExpFarmingScreenshotPrefix = "d4_exp_farming_";
    public const string AnnotatedImagePrefix = "d4_annotated_";
    public const string TeamHealthDebugPrefix = "team_health_detection_";
    public const string SmallMapDebugPrefix = "small_map_detection_";
    public const string MinimapRegionPrefix = "minimap_region_";

    /// <summary>Root for D4 output dirs (Python TMP_DIR = system cache/pytools/tmp). Settable by the app.</summary>
    public static string TmpDir { get; set; } = Path.Combine(AppPaths.GetUserDataDirectory(), TmpDirParent, TmpDirName);

    public static string ScreenshotDir => Path.Combine(TmpDir, ScreenshotDirName);
    public static string AnnotatedDir => Path.Combine(TmpDir, AnnotatedDirName);

    /// <summary>Window frame used by windowed scaling (same measured constants as D3).</summary>
    public static readonly WindowBorders Borders = new(
        D3ScaleConstants.WindowBorderLeft, D3ScaleConstants.WindowBorderRight,
        D3ScaleConstants.TitleBarHeight, D3ScaleConstants.WindowBorderBottom);

    /// <summary>Windowed when fullscreen minus window is at least this on both axes (InterfaceDataBase.WINDOW_HEIGHT_THRESHOLD).</summary>
    public const int WindowedThreshold = D3ScaleConstants.WindowHeightThreshold;

    public const int TitleBarTopOffset = -1;
    public const int TitleBarInnerMargin = 5;
    public const int ClickMarginDefault = 10;
    public const int ClickMarginRegion = 5;
    public const double RandomDelayMinMs = 100;
    public const double RandomDelayMaxMs = 500;
    public const int WindowActivationDelayMs = 50;

    /// <summary>Diablo IV client process names (no extension): also covers a window whose title is not listed (license / error dialog).</summary>
    public static readonly IReadOnlyList<string> ProcessNames = new[] { "Diablo IV" };

    /// <summary>Diablo IV window titles (DIABLO_IV_WINDOW_TITLES).</summary>
    public static readonly IReadOnlyList<string> WindowTitles = new[]
    {
        "暗黑破坏神IV",
        "暗黑破壞神IV",
        "《暗黑破坏神 IV》",
        "《暗黑破壞神 IV》",
        "《暗黑破坏神IV》",
        "《暗黑破壞神IV》",
        "Diablo IV - Blizzard Entertainment",
        "暗黑破坏神IV - 暴雪娱乐",
        "暗黑破壞神IV - 暴雪娛樂",
        "《暗黑破坏神 IV》- 暴雪娱乐",
        "《暗黑破壞神 IV》- 暴雪娛樂",
        "Diablo IV (32-bit)",
        "Diablo IV (64-bit)",
        "暗黑破坏神IV (32位)",
        "暗黑破坏神IV (64位)",
        "暗黑破壞神IV (32位)",
        "暗黑破壞神IV (64位)",
        "《暗黑破坏神 IV》(32位)",
        "《暗黑破坏神 IV》(64位)",
        "《暗黑破壞神 IV》(32位)",
        "《暗黑破壞神 IV》(64位)",
        "IV》",
        "暗黑破坏神4",
        "暗黑破壞神4",
        "《暗黑破坏神 IV》",
        "《暗黑破壞神 IV》",
    };

    public const string SmallMapTemplateName = "d4_small_map";
    public const string SmallMapTemplateSubDir = "d4";
    public const string SmallMapTemplateFile = "small_map.jpg";
    public const double SmallMapThreshold = 0.6;
    public const TemplateMatchMethod SmallMapMatchMethod = TemplateMatchMethod.Sift;
    public const string SmallMapRegionName = "minimap";
    public const string RegionSourceFullImage = "full_image";

    public const string MinimapRouteDebugPrefix = "minimap_route_";

    /// <summary>
    /// Minimap route (pinned navigation dot line) recognition: white-core dots with a dark outline on the parchment minimap.
    /// 1:1 Python scripts/analysis/d4_minimap_path.py constants (tuned on 1024x576 .. 1454x818 screenshots).
    /// </summary>
    public static readonly MinimapRouteOptions MinimapRoute = new()
    {
        DotHsv = new HsvRange(0, 179, 0, 90, 210, 255),
        BackgroundHsv = new HsvRange(10, 40, 40, 200, 80, 255),
        DotAreaMinRatio = 1e-5,
        DotAreaMaxRatio = 8e-4,
        DotOutlineContrast = 60,
        DotRingKernel = 7,
        TopStripRatio = 0.08,
        BottomStripRatio = 0.15,
        NearestMinRatio = 0.025,
        NearestMaxRatio = 0.10,
        LinkRatio = 0.10,
        MinChainDots = 4,
        SimplifyRatio = 0.02,
        RoiSearchArea = (0.5, 0.0, 1.0, 0.5),
        RoiCloseKernel = 15,
        RoiMinAreaRatio = 0.005,
    };

    /// <summary>Team health row scan (d4_team_health_detector): tolerance = int(255 * 0.1) per channel.</summary>
    public const double TeamHealthColorTolerance = 0.1;
    public static readonly int TeamHealthToleranceAbs = (int)(255 * TeamHealthColorTolerance);
    public const int TeamHealthMinPixelsPerRow = 20;
    public const int TeamHealthRowJump = 40;

    /// <summary>Group 1 (same map) health colors, BGR.</summary>
    public static readonly IReadOnlyList<Scalar> TeamHealthGroup1Colors = new[]
    {
        new Scalar(12, 20, 123),
        new Scalar(2, 5, 116),
        new Scalar(3, 5, 112),
        new Scalar(12, 15, 107),
        new Scalar(8, 11, 115),
    };

    /// <summary>Group 2 (different map) health colors, BGR.</summary>
    public static readonly IReadOnlyList<Scalar> TeamHealthGroup2Colors = new[]
    {
        new Scalar(16, 23, 25),
        new Scalar(15, 20, 22),
        new Scalar(15, 22, 23),
        new Scalar(15, 21, 23),
        new Scalar(16, 22, 24),
        new Scalar(17, 24, 26),
    };

    /// <summary>Red portal colors (d4_red_portal_detector TARGET_COLORS), BGR, ±5 %.</summary>
    public static readonly IReadOnlyList<Scalar> RedPortalColors = new[]
    {
        new Scalar(0x41, 0x99, 0xfe),
        new Scalar(0x3b, 0x77, 0xff),
        new Scalar(0x27, 0x6e, 0xfd),
        new Scalar(0x20, 0x3a, 0xff),
        new Scalar(0xa2, 0xe8, 0xff),
        new Scalar(0x6e, 0xd0, 0xfe),
        new Scalar(0x21, 0x42, 0xeb),
        new Scalar(0x7d, 0xd5, 0xfe),
        new Scalar(0x1e, 0x2a, 0xb2),
        new Scalar(0x21, 0x31, 0xe1),
        new Scalar(0x20, 0x2d, 0x9f),
        new Scalar(0x2b, 0x48, 0xe7),
    };
    public const double RedPortalColorTolerance = 0.05;

    public const int MapNameMaxRecognitionAttempts = 3;
    public const int PointCropSquareSize = 10;

    /// <summary>
    /// OCR prefixes of the "Find Team" button text meaning "no team" (Python hardcoded CN "寻找").
    /// Game-client language keyword list (CN, TW, EN); the app may override it via D4Pipeline.FindTeamPrefixes.
    /// </summary>
    public static readonly IReadOnlyList<string> FindTeamOcrPrefixes = new[] { "寻找", "尋找", "Find" };

    public const string TeamPanelKey = "o";
    public const double TeamPanelOpenDelaySec = 0.2;
    public const double TeamPanelCloseDelaySec = 0.1;
    public const double PressKeyDefaultDelaySec = 0.1;

    public const int TeamFormationMinLevel = 80;
    public const int TeamFormationMaxLevel = 120;
    public const int TeamFormationActivityRow = 5;
    public const int TeamFormationActivityRows = 7;
    public const double TeamFormationClickDurationSec = 0.2;
    public const double TeamFormationAfterClickSec = 0.1;
    public const double TeamFormationDropdownExpandSec = 0.3;
    public const double TeamFormationSubmitWaitSec = 0.5;
    public const int TeamFormationRowRandomOffset = 5;
    public const int TeamFormationSubmitRandomOffset = 3;
    public const int TeamFormationFindTeamMargin = 5;
    public const int TeamFormationFindTeamDelayMinMs = 100;
    public const int TeamFormationFindTeamDelayMaxMs = 300;
    public const int TeamFormationRowDelayMinMs = 100;
    public const int TeamFormationRowDelayMaxMs = 200;
    public const int TypeCharDelayMinMs = 50;
    public const int TypeCharDelayMaxMs = 100;
}

/// <summary>D4 event keys (D4_EVENT_KEYS). Consumed by the D4 event manager.</summary>
public static class D4EventKeys
{
    public const string ExpFarmingStarted = "exp_farming_started";
    public const string ExpFarmingStopped = "exp_farming_stopped";
    public const string ExpFarmingTickCompleted = "exp_farming_tick_completed";
    public const string TeamHealthDetected = "team_health_detected";
    public const string TeamMemberJoined = "team_member_joined";
    public const string TeamMemberLeft = "team_member_left";
    public const string TeamHealthChanged = "team_health_changed";
    public const string ScreenSizeChanged = "screen_size_changed";
    public const string ScreenCoordinatesChanged = "screen_coordinates_changed";
    public const string DisplayModeChanged = "display_mode_changed";
    public const string GameStateChanged = "game_state_changed";
    public const string CurrentMapChanged = "current_map_changed";
    public const string DungeonProgressChanged = "dungeon_progress_changed";

    public static readonly IReadOnlyList<string> All = new[]
    {
        ExpFarmingStarted, ExpFarmingStopped, ExpFarmingTickCompleted, TeamHealthDetected, TeamMemberJoined, TeamMemberLeft,
        TeamHealthChanged, ScreenSizeChanged, ScreenCoordinatesChanged, DisplayModeChanged, GameStateChanged, CurrentMapChanged,
        DungeonProgressChanged,
    };
}
