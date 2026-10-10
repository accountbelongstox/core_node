// PY-REF: none (DOT-only)
namespace DotApps.d3d4tester.Core.D4.Agent;

/// <summary>YOLO class names of the D4 combat model (targets of the recognition table: monsters, drops, interactables, danger areas, UI).</summary>
public static class D4AgentClasses
{
    public const string Monster = "monster";
    public const string Elite = "elite";
    public const string Boss = "boss";
    public const string ItemDrop = "item_drop";
    public const string ItemLegendary = "item_legendary";
    public const string Door = "door";
    public const string Interactable = "interactable";
    public const string DangerZone = "danger_zone";
    public const string ReviveButton = "revive_button";
    public const string MenuPanel = "menu_panel";

    public static readonly string[] Enemies = { Monster, Elite, Boss };
    public static readonly string[] Loot = { ItemLegendary, ItemDrop };
    public static readonly string[] Interactables = { Door, Interactable };

    /// <summary>Classes the model must have to drive combat (the others are optional and only used when present).</summary>
    public static readonly string[] Required = { Monster };

    public static readonly string[] All = { Monster, Elite, Boss, ItemDrop, ItemLegendary, Door, Interactable, DangerZone, ReviveButton, MenuPanel };
}

/// <summary>Fixed values of the D4 vision agent (layout at the D4 standard resolution 1763x1126, perception and decision tuning).</summary>
public static class D4AgentConstants
{
    public const string LogTag = "[D4Agent]";
    public const string ModelConsumer = "d4_agent";
    public const string OutputDirName = "d4_agent";
    public const string SessionDirFormat = "yyyyMMdd_HHmmss";
    public const string DecisionsFileName = "decisions.jsonl";
    public const string SummaryFileName = "summary.json";
    public const string FramePrefix = "frame_";
    public const string MinimapMaskPrefix = "minimap_";

    public const string SourceLive = "live";
    public const string SourceVideo = "video";
    public const string ModeObserve = "observe";
    public const string ModeAct = "act";
    public static readonly string[] Sources = { SourceLive, SourceVideo };
    public static readonly string[] Modes = { ModeObserve, ModeAct };

    public const string KeyLeftClick = "left_click";
    public const string KeyRightClick = "right_click";

    /// <summary>Health globe (left of the skill bar) at standard resolution; the liquid level is read bottom-up.</summary>
    public static readonly D4StdRegion HealthGlobe = new("Health Globe", 491, 985, 571, 1075);

    /// <summary>Skill bar at standard resolution, split into <see cref="SkillSlotCount"/> equal slots.</summary>
    public static readonly D4StdRegion SkillBar = new("Skill Bar", 700, 1010, 1063, 1068);
    public const int SkillSlotCount = 6;

    /// <summary>Hero position on screen as a fraction of the client size (the camera follows the hero).</summary>
    public const double PlayerAnchorX = 0.5;
    public const double PlayerAnchorY = 0.47;

    /// <summary>Red liquid of the health globe in HSV (OpenCV hue 0..180).</summary>
    public const int HealthHueLow = 10;
    public const int HealthHueHigh = 170;
    public const int HealthMinSaturation = 90;
    public const int HealthMinValue = 50;
    public const double HealthRowFillRatio = 0.2;
    public const double HealthSmoothing = 0.5;

    /// <summary>A skill slot is ready when its brightness is at least this share of the brightest value seen for it.</summary>
    public const double SkillReadyBrightnessRatio = 0.72;
    public const double SkillBaselineDecay = 0.995;

    /// <summary>Death screen: the world turns grey (low mean saturation) while the globe is empty.</summary>
    public const double DeathMaxMeanSaturation = 28;
    public const double DeathMaxHealth = 0.03;
    public const int DeathConfirmFrames = 3;

    /// <summary>Minimap is normalized to its standard size before tracking; cells are CellPixels x CellPixels minimap pixels.</summary>
    public const int MinimapStdWidth = 292;
    public const int MinimapStdHeight = 212;
    public const int MapCellPixels = 2;
    public const int MapGridSize = 1024;
    public const double MinimapUsableRadiusRatio = 0.46;
    public const double OdometryMinResponse = 0.08;
    public const double OdometryMaxShift = 40;
    public const int MapMinSeenForState = 2;
    public const double MapFreeVoteRatio = 0.5;
    public const int FrontierMinSize = 4;
    public const int PathLookaheadCells = 6;
    public const int FrontierCandidates = 6;

    /// <summary>Screen distance of a move click from the hero as a fraction of the client height.</summary>
    public const double MoveClickRadiusRatio = 0.22;

    /// <summary>Danger boxes are grown by this fraction before the hero anchor is tested against them.</summary>
    public const double DangerMarginRatio = 0.1;
    public const double EvadeDistanceRatio = 0.25;

    /// <summary>An enemy farther than this (fraction of the client height) is approached before skills are used.</summary>
    public const double AttackRangeRatio = 0.35;

    /// <summary>Loot: give up a drop after this many pickup clicks without it disappearing (blacklisted for BlacklistSeconds).</summary>
    public const int LootMaxAttempts = 3;
    public const int InteractMaxAttempts = 2;
    public const double BlacklistSeconds = 20;

    /// <summary>Stuck: moves whose map displacement stays below StuckMinPixels for StuckMoves consecutive moves.</summary>
    public const double StuckMinPixels = 1.5;
    public const int StuckMoves = 4;
    public const int EscapeMoves = 2;

    public const int TrackerMinHits = 2;
    public const int TrackerMaxMisses = 5;

    /// <summary>Annotated preview frames are raised at most this often (ms).</summary>
    public const int PreviewIntervalMs = 200;
    public const int PreviewMaxWidth = 960;
    public const int LiveNoWindowWaitMs = 1000;
    public const int MaxLoggedReasons = 1;
}
