// PY-REF: pyapps/d3-check/share/game_interface_data.py
namespace DotApps.d3d4tester.Core.D4;

/// <summary>Location from the minimap template (Python location_type "Town" / "Dungeon").</summary>
public enum D4LocationType
{
    Unknown,
    Town,
    Dungeon
}

/// <summary>Map switch state machine state (Normal -> Switching -> PostSwitch -> Normal).</summary>
public enum D4MapSwitchState
{
    Normal,
    Switching,
    PostSwitch
}

/// <summary>Edge detected by one map switch tick.</summary>
public enum D4MapSwitchTransition
{
    None,
    SwitchStarted,
    SwitchCompleted
}

/// <summary>Team health bar group (1 = same map, 2 = different map).</summary>
public enum D4TeamHealthGroup
{
    SameMap = 1,
    DifferentMap = 2
}

/// <summary>Row scan direction of a health bar match.</summary>
public enum D4ScanDirection
{
    LeftToRight,
    RightToLeft
}

/// <summary>Step 1 capture result (screenshot_handler.capture_and_collect_info).</summary>
public sealed record D4CaptureResult(
    bool Success,
    (int Width, int Height) GameWindowSize,
    (int Width, int Height) FullscreenSize,
    (int X, int Y) WindowOffset,
    bool IsWindowed,
    string? Error = null);

/// <summary>Scaled region (Python D4RegionInfo).</summary>
public sealed record D4RegionInfo(
    string Name,
    (int X, int Y) StandardStart,
    (int X, int Y) StandardEnd,
    (int X, int Y) ScaledStart,
    (int X, int Y) ScaledEnd,
    int Width,
    int Height,
    (int X, int Y) Center);

/// <summary>Scaled point (Python D4PointInfo).</summary>
public sealed record D4PointInfo(string Name, (int X, int Y) StandardCoord, (int X, int Y) ScaledCoord);

/// <summary>Window region detection (d4_window_region_detector.detect_regions).</summary>
public sealed record D4WindowRegionResult(
    (int Width, int Height) GameWindowSize,
    bool IsWindowed,
    IReadOnlyDictionary<string, D4RegionInfo> Regions,
    IReadOnlyDictionary<string, D4PointInfo> Points,
    string? AnnotatedPath);

/// <summary>Health bar screen offset (hp_screen_offset).</summary>
public sealed record D4HpScreenOffset(int X, int Y, int AbsoluteX, int AbsoluteY);

/// <summary>Detected team member (team_members[] entry).</summary>
public sealed record D4TeamMember(
    int MemberIndex,
    int RowIndex,
    int MatchingPixels,
    int TotalPixels,
    double MatchPercentage,
    (byte B, byte G, byte R)? FirstPixel,
    D4TeamHealthGroup Group,
    bool IsLocalMap,
    D4ScanDirection ScanDirection,
    D4HpScreenOffset HpScreenOffset);

/// <summary>Team health detection (d4_team_health_detector result dict).</summary>
public sealed record D4TeamHealthResult(
    int TotalMembers,
    int Group1Members,
    int Group2Members,
    int LocalMapMembers,
    int NonLocalMapMembers,
    IReadOnlyList<D4TeamMember> TeamMembers,
    DateTime ScanTimestamp,
    (int Width, int Height) RegionSize,
    string? Error = null,
    string? DebugImagePath = null)
{
    public bool Success => Error == null;

    public static D4TeamHealthResult Fail(string error) =>
        new(0, 0, 0, 0, 0, Array.Empty<D4TeamMember>(), DateTime.Now, (0, 0), error);
}

/// <summary>Minimap town/dungeon detection (small_map_detection).</summary>
public sealed record D4SmallMapResult(
    bool IsInTown,
    D4LocationType LocationType,
    double Confidence,
    double Threshold,
    DateTime DetectionTimestamp,
    string? RegionSource,
    string? Error = null,
    string? DebugImagePath = null)
{
    public bool Success => Error == null;
}

/// <summary>Step 2 result (region_detector.detect_regions_from_shared_data).</summary>
public sealed record D4RegionDetectionResult(
    bool Success,
    D4TeamHealthResult? TeamHealth,
    D4SmallMapResult? SmallMap,
    D4WindowRegionResult? WindowRegions,
    int RegionImageCount,
    string? Error = null);

/// <summary>Map name OCR attempt (map_name_recognizer.recognize_map_name).</summary>
public sealed record D4MapNameResult(
    bool Attempted,
    bool Recognized,
    string? MapName,
    int Attempt,
    int MaxAttempts,
    bool GaveUp,
    string? Error = null);

/// <summary>Map switch tick (map_switch_detector.detect_map_switch).</summary>
public sealed record D4MapSwitchResult(
    bool Evaluated,
    bool IsBlack,
    D4MapSwitchTransition Transition,
    D4MapSwitchState State,
    int SwitchCount,
    D4MapNameResult? TriggeredRecognition,
    string? Error = null);

/// <summary>Step 4 result (save screenshot + full annotation when none exists).</summary>
public sealed record D4SaveResult(string? ScreenshotPath, string? AnnotatedPath);

/// <summary>One full pipeline tick (exp_farming.start_exp_farming_process or the debug-window branch).</summary>
public sealed record D4TickResult(
    bool Success,
    D4CaptureResult Capture,
    D4RegionDetectionResult? Regions,
    D4MapSwitchResult? MapSwitch,
    D4MapNameResult? MapName,
    D4SaveResult? Save);

/// <summary>Team formation check (d4_team_formation_checker.run) outcome.</summary>
public sealed record D4TeamCheckResult(
    bool Completed,
    bool? HasTeam,
    string? OcrText,
    bool FormationTriggered,
    bool FormationSucceeded,
    string? Error = null);
