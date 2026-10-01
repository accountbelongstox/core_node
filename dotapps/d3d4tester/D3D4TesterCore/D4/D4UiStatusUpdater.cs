using DotCore.Foundations;

namespace DotApps.d3d4tester.Core.D4;

/// <summary>Game state shown in the status grid (Python game_state "Running" / "Active" / "Stopped").</summary>
public enum D4GameState
{
    Stopped,
    Active,
    Running
}

/// <summary>
/// Typed UI status (Python status_data dict). Null values mean "Unknown"; the view model localizes everything.
/// Reserved_1..10 ("-") are not carried; HasTeam, LocationType and TickCount replace reserved tiles in the page.
/// </summary>
public sealed record D4StatusSnapshot(
    bool ExpFarmingRunning,
    D4GameState GameState,
    (int X, int Y)? ScreenCoordinates,
    (int Width, int Height)? ScreenSize,
    bool IsWindowed,
    string? CurrentMap,
    int TeamTotal,
    int TeamLocal,
    int TeamNonLocal,
    string? DungeonProgress,
    int MapSwitchCount,
    D4MapSwitchState MapSwitchState,
    D4LocationType LocationType,
    bool? HasTeam,
    int TickCount,
    DateTime Timestamp);

/// <summary>
/// Collects the D4 status from D4InterfaceData at the end of each farming tick and raises <see cref="StatusUpdated"/>
/// (Python ui_update_callback). 1:1 Python pyapps/d3-check/controller/d4func/ui_status_updater.py.
/// Fixes Python bug: the debug summary read team_info['members'], the detector writes team_members.
/// </summary>
public sealed class D4UiStatusUpdater
{
    private const string LogPrefix = "[UIStatusUpdater]";
    private const string Separator60 = "============================================================";

    private static readonly Lazy<D4UiStatusUpdater> LazyInstance = new(() =>
    {
        var u = new D4UiStatusUpdater();
        ColorPrinter.Green("[Global] UI status updater initialized");
        return u;
    });

    private D4UiStatusUpdater()
    {
        ColorPrinter.Blue($"{LogPrefix} Initialized");
    }

    public static D4UiStatusUpdater Instance => LazyInstance.Value;

    /// <summary>Raised on the tick thread with the latest snapshot; subscribers marshal to their UI thread.</summary>
    public event Action<D4StatusSnapshot>? StatusUpdated;

    /// <summary>Collect, publish and (DEBUG) print the status. 1:1 update_ui_status.</summary>
    public void UpdateUiStatus(int tickCount = 0)
    {
        var handler = StatusUpdated;
        if (handler == null) return;
        var snapshot = Collect(tickCount);
        handler(snapshot);
        if (D4Pipeline.Instance.DebugImages)
            PrintStatusSummary(snapshot);
    }

    /// <summary>Current status from shared data. 1:1 _collect_status_data.</summary>
    public D4StatusSnapshot Collect(int tickCount = 0)
    {
        var d = D4InterfaceData.Instance;
        var team = d.TeamHealth;
        var offset = d.WindowOffset;
        var size = d.GameWindowSize;
        var gameState = d.ExpFarmingRunning ? D4GameState.Running : d.GameRunning ? D4GameState.Active : D4GameState.Stopped;
        return new D4StatusSnapshot(
            d.IsExpFarmingRunning(),
            gameState,
            offset != (0, 0) ? offset : null,
            size != (0, 0) ? size : null,
            d.IsWindowedMode(),
            d.IsMapNameAvailable ? d.CurrentMap : null,
            team?.TotalMembers ?? 0,
            team?.LocalMapMembers ?? 0,
            team?.NonLocalMapMembers ?? 0,
            string.IsNullOrEmpty(d.DungeonProgress) ? null : d.DungeonProgress,
            d.MapSwitchCount,
            d.MapSwitchState,
            d.LocationType,
            d.HasTeam,
            tickCount,
            DateTime.Now);
    }

    /// <summary>DEBUG status summary. 1:1 _print_status_summary.</summary>
    private static void PrintStatusSummary(D4StatusSnapshot s)
    {
        var d = D4InterfaceData.Instance;
        ColorPrinter.Blue("\n" + Separator60);
        ColorPrinter.Blue($"{LogPrefix} Status Summary (DEBUG)");
        ColorPrinter.Blue(Separator60);
        ColorPrinter.Green($"D4 Running Status: {(s.ExpFarmingRunning ? "Running" : "Stopped")}");
        ColorPrinter.Green($"Screen Coordinates: {(s.ScreenCoordinates is { } c ? $"({c.X}, {c.Y})" : "Unknown")}");
        ColorPrinter.Green($"Screen Size: {(s.ScreenSize is { } z ? $"{z.Width}x{z.Height} ({(s.IsWindowed ? "Windowed" : "Fullscreen")})" : "Unknown")}");
        ColorPrinter.Green($"Current Map: {s.CurrentMap ?? "Unknown"}");
        ColorPrinter.Green($"Game State: {s.GameState}");
        ColorPrinter.Green($"Team Count: {s.TeamTotal} ({s.TeamLocal}/{s.TeamNonLocal})");
        ColorPrinter.Green($"Dungeon Progress: {s.DungeonProgress ?? "Unknown"}");
        if (d.TeamHealth is { } team)
        {
            ColorPrinter.Yellow("Team Health Details:");
            ColorPrinter.Yellow($"  Total Members: {team.TotalMembers}");
            ColorPrinter.Yellow($"  Local Map: {team.LocalMapMembers}");
            ColorPrinter.Yellow($"  Non-Local Map: {team.NonLocalMapMembers}");
            if (team.TeamMembers.Count > 0)
            {
                ColorPrinter.Yellow("  Member Details:");
                for (int i = 0; i < team.TeamMembers.Count; i++)
                {
                    var m = team.TeamMembers[i];
                    var local = m.IsLocalMap ? "Local" : "Non-Local";
                    ColorPrinter.Yellow($"    Member {i + 1}: {local} ({m.Group}) - HP:({m.HpScreenOffset.AbsoluteX},{m.HpScreenOffset.AbsoluteY}) - Scan:{m.ScanDirection}");
                }
            }
        }
        if (d.RegionDetectionTimestamp is { } rt)
            ColorPrinter.Blue($"Region Detection: {rt}");
        if (d.TeamHealthDetectionTimestamp is { } tt)
            ColorPrinter.Blue($"Team Health Detection: {tt}");
        if (!string.IsNullOrEmpty(d.LastAnnotatedScreenshotPath))
            ColorPrinter.Blue($"Last Annotated Screenshot: {d.LastAnnotatedScreenshotPath}");
        ColorPrinter.Blue(Separator60);
    }
}
