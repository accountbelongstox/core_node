// PY-REF: none (DOT-only)
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Numerics;
using System.Text;
using System.Threading;
using Rcdw32.Ws.Models;
using Rcdw32.Ws.Plugins;

namespace CoreNodeBridge;

/// <summary>Result of the last command, published in state.json.</summary>
internal sealed class CommandResult
{
    public long Id;
    public string Action = "";
    public bool Ok;
    public string Message = "";
    public DateTime Utc;
}

/// <summary>
/// Commands from the app: command.txt next to the plugin, key=value lines (id, action, target, mode, click, ui_id, value), written
/// atomically by the app (never over a command not taken yet), taken (moved away, then read) on the plugin's own timer once the
/// worker is free and executed on a worker thread, one at a time, so the plugin keeps
/// scanning and writing state.json while a command waits for the game (e.g. movement while ROSBOT is paused). A command still running
/// after CommandTimeoutMs is reported as timed out and abandoned (its late result is dropped); the next command may then run.
/// Actions: move_to / interact / pickup (target = actor id, else a name or internal-name fragment, nearest first),
/// pickup_filter (every ground item matching the pickup filter), click_ui (UI element id, 0x id or UI path, if shown),
/// go_npc (target = exact actor name: walk the path ROSBOT computes for it, waypoint by waypoint, stop when stuck, then interact at
/// the NPC's position and report whether a vendor window opened),
/// salvage_all (value = normal / magic / rare: with the blacksmith window open, open its salvage page, press that salvage-all
/// button and confirm), follow (target = selected player actor id, value = "mode,party slot,banner slot 0-4,pickup 0/1,revive 0/1,assist 0/1" with mode nearest /
/// selected / leader / slot, or "off"; FollowMode; assist = follow only and fight, ROSBOT kept held), ui_sequence (value = UI ids / paths separated by '|': each one is waited for (UiWaitMs) and
/// clicked in order, e.g. the map teleport the app runs right after ROSBOT starts), standby (value = on / off: TownStandby, ends
/// follow mode; follow on ends standby), hold (value = on / off: PulseHold keeps ROSBOT's bot thread so ROSBOT runs no task while the
/// API stays live; off also ends town standby and assist follow), skills_check (value = maxroll skill set: SkillCheck). Commands run on the plugin's tick; walking is bounded by GoNpcTimeoutMs.
/// The pickup filter (pickup_filter.txt: "auto=true|false" then one name fragment per line) is also applied automatically when
/// a rift ends (OnGemUpdateFinish) while auto is on.
/// </summary>
internal sealed class BridgeCommands
{
    public const string CommandFileName = "command.txt";
    public const string FilterFileName = "pickup_filter.txt";
    /// <summary>command.txt is renamed to this before it is read, so a command the app writes meanwhile lands in a new command.txt.</summary>
    private const string TakenSuffix = ".taken";
    public const string ActionMoveTo = "move_to";
    public const string ActionInteract = "interact";
    public const string ActionPickup = "pickup";
    public const string ActionPickupFilter = "pickup_filter";
    public const string ActionClickUi = "click_ui";
    public const string ActionGoNpc = "go_npc";
    public const string ActionSalvageAll = "salvage_all";
    public const string ActionFollow = "follow";
    public const string ActionUiSequence = "ui_sequence";
    public const string ActionStandby = "standby";
    public const string ActionHold = "hold";
    private const string HoldOff = "off";
    private const char UiSequenceSeparator = '|';
    private const string FollowOff = "off";
    private const string StandbyOff = "off";
    private const char FollowValueSeparator = ',';
    private const string FollowPickupOn = "1";
    private const string QualityNormal = "normal";
    private const string QualityMagic = "magic";
    private const string QualityRare = "rare";
    private const int GoNpcTimeoutMs = 25000;
    private const int StepPauseMs = 100;
    private const int UiWaitMs = 3000;
    private const int UiSettleMs = 400;
    private const float NpcReach = 8f;
    private const float WaypointReach = 4f;
    private const int StuckMs = 4000;
    private const float StuckProgress = 1f;
    private const string AutoKey = "auto";
    private const int PickupTimeoutMs = 5000;
    private const int FilterBudgetMs = 20000;
    private const float PickupReach = 2f;
    private const int CommandMaxAgeSec = 60;
    private const int CommandTimeoutMs = 60000;
    private const string BlacksmithNpc = "PT_Blacksmith";
    private const int SalvageSettleMs = 1500;
    private const int QualityMagicMin = 3;
    private const int QualityRareMin = 6;
    private const int QualityLegendaryMin = 9;

    private readonly string _dir;
    private readonly Action<string> _log;
    private DateTime _filterStamp = DateTime.MinValue;
    private List<string> _patterns = new();

    public BridgeCommands(string dir, Action<string> log, FollowMode follow, TownStandby standby, PulseHold hold)
    {
        _dir = dir;
        _log = log;
        _follow = follow;
        _standby = standby;
        _hold = hold;
    }

    private readonly PulseHold _hold;

    private readonly FollowMode _follow;
    private readonly TownStandby _standby;
    private readonly object _workerLock = new();
    private Thread _worker;
    private CommandResult _running;

    /// <summary>Result of the last finished (or timed out / expired) command.</summary>
    public CommandResult Last { get; private set; }

    /// <summary>A command (or an abandoned, timed-out one) still runs on a worker: it may be moving the hero.</summary>
    public bool Busy
    {
        get { lock (_workerLock) return _running != null || _worker is { IsAlive: true }; }
    }

    /// <summary>Command executing right now on the worker (id, action, start time), or null.</summary>
    public CommandResult Running
    {
        get { lock (_workerLock) return _running; }
    }

    public bool AutoPickup { get; private set; }

    public IReadOnlyList<string> Patterns => _patterns;

    /// <summary>Start a pending command on the worker, if any and none is running; time out a stuck one (call on every pulse).</summary>
    public void Poll()
    {
        lock (_workerLock)
        {
            if (_running != null)
            {
                if ((DateTime.UtcNow - _running.Utc).TotalMilliseconds < CommandTimeoutMs) return;
                _running.Message = $"timeout after {CommandTimeoutMs / 1000}s (the game did not respond, e.g. ROSBOT paused), abandoned";
                _running.Utc = DateTime.UtcNow;
                Last = _running;
                _log($"command {_running.Id} {_running.Action}: failed {_running.Message}");
                _running = null;
            }
            if (_worker is { IsAlive: true }) return;
        }
        string path = Path.Combine(_dir, CommandFileName);
        if (!File.Exists(path)) return;
        string taken = path + TakenSuffix;
        Dictionary<string, string> cmd;
        try
        {
            if (File.Exists(taken)) File.Delete(taken);
            File.Move(path, taken);
            cmd = ReadKeyValues(File.ReadAllLines(taken, Encoding.UTF8));
            File.Delete(taken);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            return;
        }
        long ticks = cmd.TryGetValue("id", out var rawId) && long.TryParse(rawId, out long t) ? t : 0;
        double age = ticks > 0 ? (DateTime.UtcNow - new DateTime(ticks, DateTimeKind.Utc)).TotalSeconds : 0;
        string action = cmd.TryGetValue("action", out var a) ? a : "";
        if (age > CommandMaxAgeSec)
        {
            Last = new CommandResult
            {
                Id = ticks, Action = action, Utc = DateTime.UtcNow,
                Message = $"expired ({age:0}s old, written while the plugin was not running), not run",
            };
            _log($"command {Last.Id} {Last.Action}: failed {Last.Message}");
            return;
        }
        var running = new CommandResult { Id = ticks, Action = action, Utc = DateTime.UtcNow };
        var worker = new Thread(() => RunOnWorker(cmd, running)) { IsBackground = true, Name = "CoreNodeBridgeCommand" };
        lock (_workerLock)
        {
            _running = running;
            _worker = worker;
        }
        worker.Start();
    }

    private void RunOnWorker(Dictionary<string, string> cmd, CommandResult running)
    {
        var result = Execute(cmd);
        lock (_workerLock)
        {
            if (!ReferenceEquals(_running, running)) return;
            Last = result;
            _running = null;
            _worker = null;
        }
        _log($"command {result.Id} {result.Action}: {(result.Ok ? "ok" : "failed")} {result.Message}");
    }

    /// <summary>Re-read pickup_filter.txt when it changed.</summary>
    public void ReloadFilter()
    {
        string path = Path.Combine(_dir, FilterFileName);
        try
        {
            var stamp = File.Exists(path) ? File.GetLastWriteTimeUtc(path) : DateTime.MinValue;
            if (stamp == _filterStamp) return;
            _filterStamp = stamp;
            var lines = stamp == DateTime.MinValue ? Array.Empty<string>() : File.ReadAllLines(path, Encoding.UTF8);
            var settings = ReadKeyValues(lines.Where(l => l.Contains('=')));
            AutoPickup = settings.TryGetValue(AutoKey, out var auto) && bool.TryParse(auto, out bool on) && on;
            _patterns = lines.Where(l => !l.Contains('=') && l.Trim().Length > 0).Select(l => l.Trim()).ToList();
            _log($"pickup filter: auto={AutoPickup} patterns={string.Join(", ", _patterns)}");
        }
        catch (IOException) { }
    }

    public bool MatchesFilter(EntityInfo item) => MatchesFilter(item.Name, item.InternalName);

    private bool MatchesFilter(string name, string internalName) =>
        _patterns.Any(p => Contains(name, p) || Contains(internalName, p));

    /// <summary>Nearest valid ground item within range that matches the pickup filter and is not excluded, or null.</summary>
    private IActor NearestMatching(float range, ICollection<uint> exclude) =>
        _patterns.Count == 0 ? null
        : WorldScanner.Safe(() => Context.Actors, Array.Empty<IActor>())
            .Where(a => WorldScanner.Safe(() => a.IsValid && a.IsItem, false) && WorldScanner.Safe(() => a.Distance, float.MaxValue) <= range)
            .Where(a => exclude == null || !exclude.Contains(WorldScanner.Safe(() => a.RActorId, 0u)))
            .Where(a => MatchesFilter(WorldScanner.Safe(() => a.Name, ""), WorldScanner.Safe(() => a.InternalName, "")))
            .OrderBy(a => WorldScanner.Safe(() => a.Distance, float.MaxValue))
            .FirstOrDefault();

    /// <summary>Pick up the nearest ground item within range that matches the pickup filter (one item, Pickup's own time bound).</summary>
    public bool PickupNearestMatching(float range)
    {
        var target = NearestMatching(range, null);
        if (target == null) return false;
        bool ok = Pickup(target);
        _log($"follow pickup: {WorldScanner.Safe(() => target.Name, "")} {(ok ? "picked" : "not picked")}");
        return ok;
    }

    /// <summary>Pick up every ground item that matches the filter (nearest first, each tried once, bounded by FilterBudgetMs).</summary>
    public (int Picked, int Matched) PickupMatching()
    {
        var sw = Stopwatch.StartNew();
        var tried = new HashSet<uint>();
        int picked = 0, matched = 0;
        while (sw.ElapsedMilliseconds < FilterBudgetMs)
        {
            var target = NearestMatching(float.MaxValue, tried);
            if (target == null) break;
            matched++;
            tried.Add(WorldScanner.Safe(() => target.RActorId, 0u));
            if (Pickup(target)) picked++;
        }
        return (picked, matched);
    }

    private CommandResult Execute(Dictionary<string, string> cmd)
    {
        var result = new CommandResult { Utc = DateTime.UtcNow };
        result.Id = cmd.TryGetValue("id", out var id) && long.TryParse(id, out long n) ? n : 0;
        result.Action = cmd.TryGetValue("action", out var action) ? action : "";
        cmd.TryGetValue("target", out var target);
        try
        {
            switch (result.Action)
            {
                case ActionMoveTo:
                case ActionInteract:
                case ActionPickup:
                {
                    var actor = FindActor(target);
                    if (actor == null)
                    {
                        result.Message = "target not found: " + target;
                        return result;
                    }
                    string who = $"{actor.Name} ({actor.RActorId}, {actor.Distance:0.0})";
                    if (result.Action == ActionMoveTo) result.Ok = Walk(actor, NpcReach);
                    else if (result.Action == ActionPickup) result.Ok = Pickup(actor);
                    else
                    {
                        bool mode = !cmd.TryGetValue("mode", out var m) || !bool.TryParse(m, out bool mv) || mv;
                        bool click = !cmd.TryGetValue("click", out var c) || !bool.TryParse(c, out bool cv) || cv;
                        LocalPlayer.Interact(actor, mode, click, actor.Position);
                        result.Ok = true;
                        who += $" mode={mode} click={click}";
                    }
                    result.Message = who;
                    return result;
                }
                case ActionPickupFilter:
                {
                    ReloadFilter();
                    var (picked, matched) = PickupMatching();
                    result.Ok = picked > 0 || matched == 0;
                    result.Message = $"picked {picked} of {matched} matching";
                    return result;
                }
                case ActionFollow:
                {
                    cmd.TryGetValue("value", out var mode);
                    var parts = (mode ?? "").Split(FollowValueSeparator);
                    string Part(int i) => parts.Length > i ? parts[i] : "";
                    if (mode == FollowOff) _follow.Stop();
                    else
                    {
                        _standby.Stop();
                        _follow.Start(Part(0), uint.TryParse(target, out uint selected) ? selected : 0u,
                            int.TryParse(Part(1), out int slot) ? slot : 0, int.TryParse(Part(2), out int banner) ? banner : 0, Part(3) == FollowPickupOn,
                            Part(4) == FollowPickupOn, Part(5) == FollowPickupOn);
                    }
                    result.Ok = true;
                    result.Message = "follow " + (_follow.Enabled ? "on" : "off");
                    return result;
                }
                case ActionHold:
                {
                    bool on = !(cmd.TryGetValue("value", out var hold) && hold == HoldOff);
                    _hold.Set(on);
                    if (!on) _standby.Stop();
                    if (!on && _follow.Assist) _follow.Stop();
                    result.Ok = !on || _hold.Requested;
                    result.Message = "hold " + _hold.State;
                    return result;
                }
                case ActionStandby:
                {
                    if (cmd.TryGetValue("value", out var standby) && standby == StandbyOff) _standby.Stop();
                    else
                    {
                        if (_follow.Enabled) _follow.Stop();
                        _standby.Start();
                    }
                    result.Ok = true;
                    result.Message = "standby " + (_standby.Enabled ? _standby.State : TownStandby.StateOff);
                    return result;
                }
                case ActionGoNpc:
                    return GoNpc(result, target);
                case ActionSalvageAll:
                    return SalvageAll(result, cmd.TryGetValue("value", out var quality) ? quality : "");
                case ActionClickUi:
                {
                    if (!cmd.TryGetValue("ui_id", out var raw) || !UiIds.TryParse(raw, out ulong uiId))
                    {
                        result.Message = "invalid ui_id: " + raw;
                        return result;
                    }
                    if (!Context.HasUIElement(uiId))
                    {
                        result.Message = "UI element not shown: " + raw;
                        return result;
                    }
                    Context.ClickUIElement(uiId);
                    result.Ok = true;
                    result.Message = "clicked " + raw;
                    return result;
                }
                case SkillCheck.Action:
                    return SkillCheck.Run(result, cmd.TryGetValue("value", out var skillSet) ? skillSet : "");
                case ActionUiSequence:
                    return UiSequence(result, cmd.TryGetValue("value", out var sequence) ? sequence : "");
                default:
                    result.Message = "unknown action";
                    return result;
            }
        }
        catch (Exception ex)
        {
            result.Message = ex.GetType().Name + ": " + ex.Message;
            return result;
        }
    }

    /// <summary>Nearest actor with exactly this name; walk to it when a path exists, interact, and wait for a vendor window.</summary>
    private CommandResult GoNpc(CommandResult result, string name)
    {
        var actor = WorldScanner.Safe(() => Context.Actors, Array.Empty<IActor>())
            .Where(a => WorldScanner.Safe(() => a.IsValid, false) && string.Equals(WorldScanner.Safe(() => a.Name, ""), name, StringComparison.OrdinalIgnoreCase))
            .OrderBy(a => WorldScanner.Safe(() => a.Distance, float.MaxValue))
            .FirstOrDefault();
        if (actor == null)
        {
            result.Message = "npc not found nearby: " + name;
            return result;
        }
        float reach = Math.Max(NpcReach, (float)WorldScanner.Safe(() => actor.Interactdistance, 0d));
        var sw = Stopwatch.StartNew();
        Func<bool> cancel = () => sw.ElapsedMilliseconds > GoNpcTimeoutMs || WorldScanner.Safe(() => actor.Distance, 0f) <= reach;
        var waypoints = Waypoints(WorldScanner.Safe(() => Context.FindPaths(LocalPlayer.Position, actor.Position), null), out string pathInfo);
        _log($"go_npc {name}: distance {actor.Distance:0.0}, path {pathInfo}");
        foreach (var point in waypoints)
        {
            if (cancel()) break;
            if (!WorldScanner.Safe(() => { LocalPlayer.CoreMoveTo(point, cancel, WaypointReach); return true; }, false)) break;
        }
        float best = float.MaxValue;
        var lastProgress = Stopwatch.StartNew();
        while (!cancel() && WorldScanner.Safe(() => actor.IsValid, false))
        {
            float d = WorldScanner.Safe(() => actor.Distance, float.MaxValue);
            if (d < best - StuckProgress)
            {
                best = d;
                lastProgress.Restart();
            }
            else if (lastProgress.ElapsedMilliseconds > StuckMs) break;
            if (!WorldScanner.Safe(() => LocalPlayer.MoveTo(actor), false))
                WorldScanner.Safe(() => { LocalPlayer.CoreMoveTo(actor.Position, cancel, reach); return true; }, false);
            Thread.Sleep(StepPauseMs);
        }
        float distance = WorldScanner.Safe(() => actor.Distance, float.MaxValue);
        if (distance > reach)
        {
            result.Message = $"{name} not reached ({distance:0.0}, path {pathInfo}, {sw.ElapsedMilliseconds / 1000}s)";
            return result;
        }
        LocalPlayer.Interact(actor, true, true, actor.Position);
        bool opened = WaitUi(UiIds.VendorDialog, UiWaitMs) || Shown(UiIds.ShopDialog);
        result.Ok = true;
        result.Message = $"{name} reached ({distance:0.0}), {(opened ? "window open" : "no vendor window")}";
        return result;
    }

    /// <summary>ROSBOT path points (x,y,z triples, else x,y pairs at the hero's height); info = point count and layout for the log.</summary>
    private static List<Vector3> Waypoints(float[] path, out string info)
    {
        var points = new List<Vector3>();
        if (path == null || path.Length == 0)
        {
            info = path == null ? "none" : "empty";
            return points;
        }
        float z = WorldScanner.Safe(() => LocalPlayer.Position.Z, 0f);
        int stride = path.Length % 3 == 0 ? 3 : 2;
        for (int i = 0; i + stride <= path.Length; i += stride)
            points.Add(new Vector3(path[i], path[i + 1], stride == 3 ? path[i + 2] : z));
        info = $"{points.Count} points (stride {stride}, first {(points.Count > 0 ? points[0].ToString() : "-")})";
        return points;
    }

    /// <summary>
    /// In town: walk to the blacksmith and open him unless his window is already open, switch to the salvage page (ROSBOT's
    /// BlacksmithTab3 = tab_2), press the salvage-all button of the quality (ROSBOT SalvageNormal / SalvageBlue / SalvageYellow),
    /// confirm, then count the backpack items of that quality before and after.
    /// </summary>
    private CommandResult SalvageAll(CommandResult result, string quality)
    {
        string button = quality switch
        {
            QualityNormal => UiIds.SalvageNormal,
            QualityMagic => UiIds.SalvageMagic,
            QualityRare => UiIds.SalvageRare,
            _ => null,
        };
        if (button == null)
        {
            result.Message = "unknown quality: " + quality;
            return result;
        }
        if (!WorldScanner.Safe(() => LocalPlayer.IsInTown, false))
        {
            result.Message = "not in town";
            return result;
        }
        if (!Shown(UiIds.VendorDialog))
        {
            var walk = GoNpc(new CommandResult { Id = result.Id, Action = ActionGoNpc, Utc = result.Utc }, BlacksmithNpc);
            if (!walk.Ok || !Shown(UiIds.VendorDialog))
            {
                result.Message = "blacksmith window not opened: " + walk.Message;
                return result;
            }
            Thread.Sleep(UiSettleMs);
        }
        int before = CountBackpack(quality);
        foreach (var tab in UiIds.VendorTabs)
        {
            if (Shown(UiIds.SalvageDialog)) break;
            if (!Shown(tab)) continue;
            Click(tab);
            Thread.Sleep(UiSettleMs);
        }
        if (!Shown(UiIds.SalvageDialog))
        {
            result.Message = "salvage page not found (is this the blacksmith?)";
            return result;
        }
        if (!Shown(button))
        {
            result.Message = $"salvage {quality} button not shown";
            return result;
        }
        Click(button);
        bool confirmed = WaitUi(UiIds.ConfirmOk, UiWaitMs);
        if (confirmed) Click(UiIds.ConfirmOk);
        Thread.Sleep(SalvageSettleMs);
        int after = CountBackpack(quality);
        result.Ok = true;
        result.Message = $"salvage {quality} pressed{(confirmed ? ", confirmed" : "")}"
                         + (before >= 0 ? $", backpack {quality} items {before} -> {after}" : "");
        return result;
    }

    /// <summary>Backpack items of a salvage-all quality (normal: inferior..superior, magic, rare); -1 without inventory slots.</summary>
    private static int CountBackpack(string quality)
    {
        if (!WorldScanner.SlotSupported) return -1;
        var (min, max) = quality switch
        {
            QualityNormal => (0, QualityMagicMin - 1),
            QualityMagic => (QualityMagicMin, QualityRareMin - 1),
            _ => (QualityRareMin, QualityLegendaryMin - 1),
        };
        var items = WorldScanner.CarriedItems(WorldScanner.Safe(() => Context.Acds, Array.Empty<IAcd>()), Array.Empty<EntityInfo>());
        return items.Count(i => i.Slot == WorldScanner.SlotBackpack && i.Quality >= min && i.Quality <= max);
    }

    /// <summary>ROSBOT's MoveTo(actor) (fails for far targets), else its cancellable CoreMoveTo to the actor position (bounded).</summary>
    private static bool Walk(IActor actor, float reach)
    {
        if (WorldScanner.Safe(() => LocalPlayer.MoveTo(actor), false)) return true;
        var sw = Stopwatch.StartNew();
        return WorldScanner.Safe(() =>
        {
            LocalPlayer.CoreMoveTo(actor.Position, () => sw.ElapsedMilliseconds > StuckMs, reach);
            return true;
        }, false);
    }

    private static bool Shown(string path) => WorldScanner.Safe(() => Context.HasUIElement(UiIds.Of(path)), false);

    private static void Click(string path) => Context.ClickUIElement(UiIds.Of(path));

    /// <summary>Wait for each UI element of the sequence and click it, in order; stops at the first one that does not show.</summary>
    private static CommandResult UiSequence(CommandResult result, string sequence)
    {
        var steps = sequence.Split(UiSequenceSeparator).Select(s => s.Trim()).Where(s => s.Length > 0).ToList();
        if (steps.Count == 0)
        {
            result.Message = "empty ui_sequence";
            return result;
        }
        for (int i = 0; i < steps.Count; i++)
        {
            if (!UiIds.TryParse(steps[i], out ulong id))
            {
                result.Message = $"invalid ui id at step {i + 1}: {steps[i]}";
                return result;
            }
            var sw = Stopwatch.StartNew();
            while (!WorldScanner.Safe(() => Context.HasUIElement(id), false))
            {
                if (sw.ElapsedMilliseconds >= UiWaitMs)
                {
                    result.Message = $"step {i + 1}/{steps.Count} not shown: {steps[i]}";
                    return result;
                }
                Thread.Sleep(StepPauseMs);
            }
            Context.ClickUIElement(id);
            Thread.Sleep(UiSettleMs);
        }
        result.Ok = true;
        result.Message = $"ui_sequence {steps.Count} step(s) clicked";
        return result;
    }

    private static bool WaitUi(string path, int timeoutMs)
    {
        var sw = Stopwatch.StartNew();
        while (sw.ElapsedMilliseconds < timeoutMs)
        {
            if (Shown(path)) return true;
            Thread.Sleep(StepPauseMs);
        }
        return false;
    }

    /// <summary>Walk to the item and pick it up until it vanishes (bounded); true when it is gone.</summary>
    private bool Pickup(IActor actor)
    {
        var sw = Stopwatch.StartNew();
        while (sw.ElapsedMilliseconds < PickupTimeoutMs)
        {
            if (!WorldScanner.Safe(() => actor.IsValid && actor.IsItem, false)) return true;
            if (WorldScanner.Safe(() => actor.Distance, float.MaxValue) <= PickupReach) WorldScanner.Safe(() => LocalPlayer.PickupItem(actor), false);
            else WorldScanner.Safe(() => LocalPlayer.MoveTo(actor), false);
            Thread.Sleep(StepPauseMs);
        }
        _log($"pickup timed out: {WorldScanner.Safe(() => actor.Name, "")}");
        return false;
    }

    /// <summary>Actor by RActorId, else the nearest whose name or internal name contains the text.</summary>
    private static IActor FindActor(string target)
    {
        if (string.IsNullOrWhiteSpace(target)) return null;
        var actors = WorldScanner.Safe(() => Context.Actors, Array.Empty<IActor>()).Where(a => WorldScanner.Safe(() => a.IsValid, false)).ToList();
        if (uint.TryParse(target, out uint id) && actors.FirstOrDefault(a => WorldScanner.Safe(() => a.RActorId, 0u) == id) is { } byId) return byId;
        return actors.Where(a => Contains(WorldScanner.Safe(() => a.Name, ""), target) || Contains(WorldScanner.Safe(() => a.InternalName, ""), target))
            .OrderBy(a => WorldScanner.Safe(() => a.Distance, float.MaxValue))
            .FirstOrDefault();
    }

    private static bool Contains(string text, string fragment) =>
        !string.IsNullOrEmpty(text) && text.IndexOf(fragment, StringComparison.OrdinalIgnoreCase) >= 0;

    private static Dictionary<string, string> ReadKeyValues(IEnumerable<string> lines)
    {
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var line in lines)
        {
            int eq = line.IndexOf('=');
            if (eq > 0) map[line.Substring(0, eq).Trim()] = line.Substring(eq + 1).Trim();
        }
        return map;
    }
}
