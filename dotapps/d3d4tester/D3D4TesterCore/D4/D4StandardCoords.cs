// PY-REF: pyapps/d3-check/share/game_interface_data.py
// PY-REF: pyapps/d3-check/d4utils/d4_window_region_detector.py
// PY-REF: pyapps/d3-check/controller/d4func/region_detector.py
// PY-REF: pyapps/d3-check/controller/d4func/image_annotator.py
using DotCore.Common.Geometry;

namespace DotApps.d3d4tester.Core.D4;

/// <summary>Standard-resolution rectangle (start -> end) at 1763x1126.</summary>
public readonly record struct D4StdRegion(string Name, int X1, int Y1, int X2, int Y2)
{
    public (int X, int Y) Start => (X1, Y1);
    public (int X, int Y) End => (X2, Y2);
}

/// <summary>Standard-resolution point at 1763x1126.</summary>
public readonly record struct D4StdPoint(string Name, int X, int Y)
{
    public (int X, int Y) Coord => (X, Y);
}

/// <summary>Region / point labels (Python label strings; keys of region images and detected regions).</summary>
public static class D4RegionNames
{
    public const string Bag = "Bag";
    public const string BlacksmithMenu = "Blacksmith Menu";
    public const string WhisperObols = "Whisper Obols";
    public const string EquipmentLeft = "Equipment Left";
    public const string EquipmentRight = "Equipment Right";
    public const string BlacksmithFunction = "Blacksmith Function";
    public const string ExpBar = "EXP Bar";
    public const string Minimap = "Minimap";
    public const string MapName = "Map Name";
    public const string QuestText = "Quest Text";
    public const string TeamCount = "Team Count";
    public const string TeamVote = "Team Vote";
    public const string DungeonProgress = "Dungeon Progress";
    public const string FindTeam = "Find Team";
    public const string FormTeam = "Form Team";
    public const string ActivitySelection = "Activity Selection";
    public const string MinTierInput = "Min Tier Input";
    public const string MaxTierInput = "Max Tier Input";
    public const string ConfirmTeam = "Confirm Team";
    public const string PanelClose = "Panel Close";
    public const string ActivitySelectionArea = "Activity Selection Area";

    public const string EditTeam = "Edit Team";
    public const string ConfirmEdit = "Confirm Edit";
    public const string IdleMinTier = "Idle Min Tier";
    public const string IdleMaxTier = "Idle Max Tier";
    public const string IdleActivity = "Idle Activity";
    public const string AddIdleTeam = "Add Idle Team";
    public const string HealthOrb = "Health Orb";
    public const string AcceptVote = "Accept Vote";
    public const string StartGame = "Start Game";
    public const string MinTierClick = "Min Tier Click";
}

/// <summary>
/// D4 standard coordinates at 1763x1126 and the scaling to the actual window.
/// 1:1 Python pyapps/d3-check/share/game_interface_data.py D4StandardCoordinates + the region/point lists of
/// d4_window_region_detector.py, controller/d4func/region_detector.py and image_annotator.py.
/// </summary>
public static class D4StandardCoords
{
    public static readonly D4StdRegion Bag = new(D4RegionNames.Bag, 1093, 756, 1710, 1004);
    public static readonly D4StdRegion BlacksmithMenu = new(D4RegionNames.BlacksmithMenu, 392, 172, 682, 212);
    public static readonly D4StdRegion WhisperObols = new(D4RegionNames.WhisperObols, 1291, 1025, 1353, 1048);
    public static readonly D4StdRegion EquipmentLeft = new(D4RegionNames.EquipmentLeft, 1294, 108, 1359, 695);
    public static readonly D4StdRegion EquipmentRight = new(D4RegionNames.EquipmentRight, 1660, 206, 1724, 695);
    public static readonly D4StdRegion BlacksmithFunction = new(D4RegionNames.BlacksmithFunction, 198, 467, 536, 776);
    public static readonly D4StdRegion ExpBar = new(D4RegionNames.ExpBar, 733, 993, 1041, 1000);
    public static readonly D4StdRegion Minimap = new(D4RegionNames.Minimap, 1439, 78, 1731, 290);
    public static readonly D4StdRegion MapName = new(D4RegionNames.MapName, 1440, 40, 1626, 68);
    public static readonly D4StdRegion QuestText = new(D4RegionNames.QuestText, 1439, 315, 1720, 1006);
    public static readonly D4StdRegion TeamCount = new(D4RegionNames.TeamCount, 146, 310, 228, 624);
    public static readonly D4StdRegion TeamVote = new(D4RegionNames.TeamVote, 127, 219, 523, 500);
    public static readonly D4StdRegion DungeonProgress = new(D4RegionNames.DungeonProgress, 1460, 355, 1700, 370);
    public static readonly D4StdRegion FindTeam = new(D4RegionNames.FindTeam, 155, 94, 275, 129);
    public static readonly D4StdRegion FormTeam = new(D4RegionNames.FormTeam, 292, 73, 406, 126);
    public static readonly D4StdRegion ActivitySelection = new(D4RegionNames.ActivitySelection, 360, 414, 591, 426);
    public static readonly D4StdRegion MinTierInput = new(D4RegionNames.MinTierInput, 375, 494, 757, 503);
    public static readonly D4StdRegion MaxTierInput = new(D4RegionNames.MaxTierInput, 757, 503, 942, 525);
    public static readonly D4StdRegion ConfirmTeam = new(D4RegionNames.ConfirmTeam, 728, 861, 831, 879);
    public static readonly D4StdRegion PanelClose = new(D4RegionNames.PanelClose, 1387, 50, 1806, 76);

    /// <summary>Activity dropdown menu (7 rows) of D4AutoTeamFormation.REGION_COORDS.</summary>
    public static readonly D4StdRegion ActivitySelectionArea = new(D4RegionNames.ActivitySelectionArea, 315, 445, 640, 700);

    public static readonly D4StdPoint EditTeam = new(D4RegionNames.EditTeam, 950, 265);
    public static readonly D4StdPoint ConfirmEdit = new(D4RegionNames.ConfirmEdit, 730, 950);
    public static readonly D4StdPoint IdleMinTier = new(D4RegionNames.IdleMinTier, 410, 550);
    public static readonly D4StdPoint IdleMaxTier = new(D4RegionNames.IdleMaxTier, 805, 550);
    public static readonly D4StdPoint IdleActivity = new(D4RegionNames.IdleActivity, 375, 456);
    public static readonly D4StdPoint AddIdleTeam = new(D4RegionNames.AddIdleTeam, 368, 118);
    public static readonly D4StdPoint HealthOrb = new(D4RegionNames.HealthOrb, 531, 1030);
    public static readonly D4StdPoint AcceptVote = new(D4RegionNames.AcceptVote, 225, 418);
    public static readonly D4StdPoint StartGame = new(D4RegionNames.StartGame, 1505, 972);
    public static readonly D4StdPoint MinTierClick = new(D4RegionNames.MinTierClick, 568, 525);

    public const int TeamHealthBarStartOffsetX = 114;
    public const int TeamHealthBarEndOffsetX = 178;
    public const int TeamMenuRelativeHeightY = 230;
    public const int MouseHoverDisplayHeightOffset1Y = 104;
    public const int MouseHoverDisplayWidthOffset1X = 133;
    public const int TeamRightMenuLeftOffsetX = 324;
    public const int TeamRightMenuRightOffsetX = 633;
    public const int TeamRightMenuDownOffsetY = 760;

    public const int RedPortalScanLeftMarginX = 150;
    public const int RedPortalScanRightMarginX = 328;
    public const int RedPortalScanBottomMarginY = 200;
    public const int RedPortalMaxWidthX = 310;
    public const int RedPortalMaxHeightY = 600;
    public const int RedPortalMinArea = 10;

    /// <summary>Regions scaled into detected regions (d4_window_region_detector, 13).</summary>
    public static readonly IReadOnlyList<D4StdRegion> DetectionRegions = new[]
    {
        Bag, BlacksmithMenu, WhisperObols, EquipmentLeft, EquipmentRight, BlacksmithFunction, ExpBar,
        Minimap, MapName, QuestText, TeamCount, TeamVote, DungeonProgress,
    };

    /// <summary>Points scaled into detected points (d4_window_region_detector, 9).</summary>
    public static readonly IReadOnlyList<D4StdPoint> DetectionPoints = new[]
    {
        EditTeam, ConfirmEdit, IdleMinTier, IdleMaxTier, IdleActivity, AddIdleTeam, HealthOrb, AcceptVote, StartGame,
    };

    /// <summary>Regions cropped into region images every tick (region_detector, 20).</summary>
    public static readonly IReadOnlyList<D4StdRegion> CropRegions = new[]
    {
        Bag, BlacksmithMenu, WhisperObols, EquipmentLeft, EquipmentRight, BlacksmithFunction, ExpBar,
        Minimap, MapName, QuestText, TeamCount, TeamVote, DungeonProgress,
        FindTeam, FormTeam, ActivitySelection, MinTierInput, MaxTierInput, ConfirmTeam, PanelClose,
    };

    /// <summary>Points cropped as 10x10 squares (region_detector).</summary>
    public static readonly IReadOnlyList<D4StdPoint> CropPoints = new[] { MinTierClick };

    /// <summary>Region -> annotation color name (image_annotator regions_to_draw).</summary>
    public static readonly IReadOnlyList<(D4StdRegion Region, string Color)> AnnotationRegions = new[]
    {
        (Bag, "red"), (BlacksmithMenu, "orange"), (WhisperObols, "purple"), (EquipmentLeft, "spring_green"),
        (EquipmentRight, "sky_blue"), (BlacksmithFunction, "violet"), (ExpBar, "green"), (Minimap, "blue"),
        (MapName, "gold"), (QuestText, "yellow"), (TeamCount, "magenta"), (TeamVote, "coral"), (DungeonProgress, "cyan"),
        (FindTeam, "lime"), (FormTeam, "pink"), (ActivitySelection, "teal"), (MinTierInput, "indigo"),
        (MaxTierInput, "maroon"), (ConfirmTeam, "brown"), (PanelClose, "crimson"),
    };

    /// <summary>Point -> annotation color name (image_annotator points_to_draw).</summary>
    public static readonly IReadOnlyList<(D4StdPoint Point, string Color)> AnnotationPoints = new[]
    {
        (EditTeam, "turquoise"), (ConfirmEdit, "salmon"), (IdleMinTier, "khaki"), (IdleMaxTier, "mint"),
        (IdleActivity, "peach"), (AddIdleTeam, "aqua"), (HealthOrb, "red"), (AcceptVote, "rose"),
        (StartGame, "navy"), (MinTierClick, "orange"),
    };

    /// <summary>Lines drawn by the annotator (dungeon progress bar).</summary>
    public static readonly IReadOnlyList<(D4StdRegion Line, string Color)> AnnotationLines = new[] { (DungeonProgress, "olive") };

    /// <summary>Standard -> actual window pixel. 1:1 calculate_unified_scaled_coordinate with D4 standard resolution.</summary>
    public static (int X, int Y) Scale(int x, int y, (int Width, int Height) gameWindowSize, bool isWindowed) =>
        CoordinateScaler.Scale(x, y, gameWindowSize.Width, gameWindowSize.Height,
            D4Constants.StandardWidth, D4Constants.StandardHeight, isWindowed, D4Constants.Borders);

    public static (int X, int Y) Scale((int X, int Y) coord, (int Width, int Height) gameWindowSize, bool isWindowed) =>
        Scale(coord.X, coord.Y, gameWindowSize, isWindowed);

    /// <summary>D4 scale factors for the actual window (template scaling).</summary>
    public static (double ScaleX, double ScaleY) GetScale((int Width, int Height) gameWindowSize, bool isWindowed) =>
        CoordinateScaler.GetScale(gameWindowSize.Width, gameWindowSize.Height,
            D4Constants.StandardWidth, D4Constants.StandardHeight, isWindowed, D4Constants.Borders);
}
