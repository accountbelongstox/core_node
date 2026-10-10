// PY-REF: dotapps/d3d4tester/reference/py_d3check/controller/d4func/events/event_manager.py
// PY-REF: dotapps/d3d4tester/reference/py_d3check/controller/d4func/events/exp_farming_events.py
// PY-REF: dotapps/d3d4tester/reference/py_d3check/controller/d4func/events/team_health_events.py
// PY-REF: dotapps/d3d4tester/reference/py_d3check/controller/d4func/events/screen_events.py
// PY-REF: dotapps/d3d4tester/reference/py_d3check/controller/d4func/events/game_state_events.py
using DotCore.Foundations;

namespace DotApps.d3d4tester.Core.D4;

/// <summary>
/// Diffs the previous vs current D4 state each farming tick and fires <see cref="D4EventKeys"/> events (log handlers + <see cref="EventTriggered"/>).
/// 1:1 Python dotapps/d3d4tester/reference/py_d3check/controller/d4func/events/event_manager.py and the log-only handlers in
/// events/exp_farming_events.py, team_health_events.py, screen_events.py, game_state_events.py.
/// GAME_STATE_CHANGED and EXP_FARMING_TICK_COMPLETED are mapped but never fired by the diff (same as Python).
/// Fixes Python bug: team health compared the whole dict including scan_timestamp, so "changed" fired every tick; now only counts and member rows are compared.
/// </summary>
public sealed class D4EventManager
{
    private const string LogPrefix = "[D4EventManager]";

    private static readonly Lazy<D4EventManager> LazyInstance = new(() =>
    {
        var m = new D4EventManager();
        ColorPrinter.Green("[Global] D4 event manager initialized");
        return m;
    });

    private readonly Dictionary<string, Action> _eventFunctions;
    private readonly object _lock = new();

    private bool? _prevExpFarmingRunning;
    private D4TeamHealthResult? _prevTeamHealth;
    private (int Width, int Height)? _prevGameWindowSize;
    private (int X, int Y)? _prevWindowOffset;
    private bool? _prevWindowed;
    private string? _prevMap;
    private string? _prevProgress;

    private D4EventManager()
    {
        _eventFunctions = new Dictionary<string, Action>(StringComparer.Ordinal)
        {
            [D4EventKeys.ExpFarmingStarted] = OnExpFarmingStarted,
            [D4EventKeys.ExpFarmingStopped] = OnExpFarmingStopped,
            [D4EventKeys.ExpFarmingTickCompleted] = OnExpFarmingTickCompleted,
            [D4EventKeys.TeamHealthDetected] = OnTeamHealthDetected,
            [D4EventKeys.TeamMemberJoined] = OnTeamMemberJoined,
            [D4EventKeys.TeamMemberLeft] = OnTeamMemberLeft,
            [D4EventKeys.TeamHealthChanged] = OnTeamHealthChanged,
            [D4EventKeys.ScreenSizeChanged] = OnScreenSizeChanged,
            [D4EventKeys.ScreenCoordinatesChanged] = OnScreenCoordinatesChanged,
            [D4EventKeys.DisplayModeChanged] = OnDisplayModeChanged,
            [D4EventKeys.GameStateChanged] = OnGameStateChanged,
            [D4EventKeys.CurrentMapChanged] = OnCurrentMapChanged,
            [D4EventKeys.DungeonProgressChanged] = OnDungeonProgressChanged,
        };
        ColorPrinter.Blue($"{LogPrefix} Initialized");
    }

    public static D4EventManager Instance => LazyInstance.Value;

    private static D4InterfaceData Data => D4InterfaceData.Instance;

    /// <summary>Raised after the handler of a fired event key ran (tick thread).</summary>
    public event Action<string>? EventTriggered;

    /// <summary>Run the handler of one event key. 1:1 trigger_event.</summary>
    public void TriggerEvent(string eventKey)
    {
        if (_eventFunctions.TryGetValue(eventKey, out var fn))
        {
            fn();
            ColorPrinter.Blue($"{LogPrefix} Event triggered: {eventKey}");
            EventTriggered?.Invoke(eventKey);
        }
        else
        {
            ColorPrinter.Yellow($"{LogPrefix} Unknown event key: {eventKey}");
        }
    }

    /// <summary>Diff all tracked states and fire events. 1:1 check_state_changes.</summary>
    public void CheckStateChanges()
    {
        lock (_lock)
        {
            CheckExpFarmingChanges();
            CheckTeamHealthChanges();
            CheckScreenChanges();
            CheckGameStateChanges();
        }
    }

    private void CheckExpFarmingChanges()
    {
        bool current = Data.IsExpFarmingRunning();
        if (_prevExpFarmingRunning is { } previous)
        {
            if (current && !previous) TriggerEvent(D4EventKeys.ExpFarmingStarted);
            else if (!current && previous) TriggerEvent(D4EventKeys.ExpFarmingStopped);
        }
        _prevExpFarmingRunning = current;
    }

    private void CheckTeamHealthChanges()
    {
        var current = Data.TeamHealth;
        if (current != null)
        {
            int previousTotal = _prevTeamHealth?.TotalMembers ?? 0;
            if (_prevTeamHealth == null) TriggerEvent(D4EventKeys.TeamHealthDetected);
            else if (current.TotalMembers > previousTotal) TriggerEvent(D4EventKeys.TeamMemberJoined);
            else if (current.TotalMembers < previousTotal) TriggerEvent(D4EventKeys.TeamMemberLeft);
            else if (!SameTeamHealth(current, _prevTeamHealth)) TriggerEvent(D4EventKeys.TeamHealthChanged);
        }
        _prevTeamHealth = current;
    }

    private static bool SameTeamHealth(D4TeamHealthResult a, D4TeamHealthResult b)
    {
        if (a.TotalMembers != b.TotalMembers || a.Group1Members != b.Group1Members || a.Group2Members != b.Group2Members
            || a.LocalMapMembers != b.LocalMapMembers || a.NonLocalMapMembers != b.NonLocalMapMembers
            || a.TeamMembers.Count != b.TeamMembers.Count || a.Error != b.Error)
            return false;
        for (int i = 0; i < a.TeamMembers.Count; i++)
        {
            if (a.TeamMembers[i] != b.TeamMembers[i]) return false;
        }
        return true;
    }

    private void CheckScreenChanges()
    {
        var size = Data.GameWindowSize;
        if (_prevGameWindowSize is { } prevSize && size != prevSize) TriggerEvent(D4EventKeys.ScreenSizeChanged);
        _prevGameWindowSize = size;

        var offset = Data.WindowOffset;
        if (_prevWindowOffset is { } prevOffset && offset != prevOffset) TriggerEvent(D4EventKeys.ScreenCoordinatesChanged);
        _prevWindowOffset = offset;

        bool windowed = Data.IsWindowedMode();
        if (_prevWindowed is { } prevWindowed && windowed != prevWindowed) TriggerEvent(D4EventKeys.DisplayModeChanged);
        _prevWindowed = windowed;
    }

    private void CheckGameStateChanges()
    {
        var map = Data.CurrentMap;
        if (_prevMap != null && map != _prevMap) TriggerEvent(D4EventKeys.CurrentMapChanged);
        _prevMap = map;

        var progress = Data.DungeonProgress;
        if (_prevProgress != null && progress != _prevProgress) TriggerEvent(D4EventKeys.DungeonProgressChanged);
        _prevProgress = progress;
    }

    private static void OnExpFarmingStarted()
    {
        ColorPrinter.Green("[EXP Farming Event] EXP farming started");
        ColorPrinter.Blue($"[EXP Farming Event] Current state: {Data.IsExpFarmingRunning()}");
    }

    private static void OnExpFarmingStopped()
    {
        ColorPrinter.Yellow("[EXP Farming Event] EXP farming stopped");
        ColorPrinter.Blue($"[EXP Farming Event] Current state: {Data.IsExpFarmingRunning()}");
    }

    private static void OnExpFarmingTickCompleted()
    {
        ColorPrinter.Blue("[EXP Farming Event] EXP farming tick completed");
        ColorPrinter.Blue($"[EXP Farming Event] Screenshot timestamp: {Data.Timestamp}");
    }

    private static void OnTeamHealthDetected()
    {
        if (Data.TeamHealth is { } t) ColorPrinter.Green($"[Team Health Event] Team health detected: {t.TotalMembers} members");
        else ColorPrinter.Blue("[Team Health Event] Team health detected: No data");
    }

    private static void OnTeamMemberJoined()
    {
        if (Data.TeamHealth is { } t) ColorPrinter.Green($"[Team Health Event] Team member joined: Total {t.TotalMembers} members");
        else ColorPrinter.Blue("[Team Health Event] Team member joined: No data");
    }

    private static void OnTeamMemberLeft()
    {
        if (Data.TeamHealth is { } t) ColorPrinter.Yellow($"[Team Health Event] Team member left: Total {t.TotalMembers} members");
        else ColorPrinter.Blue("[Team Health Event] Team member left: No data");
    }

    private static void OnTeamHealthChanged()
    {
        if (Data.TeamHealth is { } t) ColorPrinter.Blue($"[Team Health Event] Team health changed: Local {t.LocalMapMembers}, Non-Local {t.NonLocalMapMembers}");
        else ColorPrinter.Blue("[Team Health Event] Team health changed: No data");
    }

    private static void OnScreenSizeChanged()
    {
        var (w, h) = Data.GameWindowSize;
        ColorPrinter.Green($"[Screen Event] Screen size changed: {w}x{h}");
    }

    private static void OnScreenCoordinatesChanged()
    {
        var (x, y) = Data.WindowOffset;
        ColorPrinter.Green($"[Screen Event] Screen coordinates changed: ({x}, {y})");
    }

    private static void OnDisplayModeChanged()
    {
        ColorPrinter.Green($"[Screen Event] Display mode changed: {(Data.IsWindowedMode() ? "Windowed" : "Fullscreen")}");
    }

    private static void OnGameStateChanged()
    {
        ColorPrinter.Green($"[Game State Event] Game state changed: {(Data.IsExpFarmingRunning() ? "Running" : "Stopped")}");
    }

    private static void OnCurrentMapChanged()
    {
        if (Data.CurrentMap is { } map) ColorPrinter.Green($"[Game State Event] Current map changed: {map}");
        else ColorPrinter.Blue("[Game State Event] Current map changed: Unknown");
    }

    private static void OnDungeonProgressChanged()
    {
        if (Data.DungeonProgress is { } progress) ColorPrinter.Green($"[Game State Event] Dungeon progress changed: {progress}");
        else ColorPrinter.Blue("[Game State Event] Dungeon progress changed: Unknown");
    }
}
