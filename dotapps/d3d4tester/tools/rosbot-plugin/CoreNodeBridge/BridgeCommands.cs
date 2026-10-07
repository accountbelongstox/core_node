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
/// Commands from the app: command.txt next to the plugin, key=value lines (id, action, target, mode, click, ui_id), written
/// atomically by the app, consumed (deleted) on the next pulse and executed on ROSBOT's pulse thread.
/// Actions: move_to / interact / pickup (target = actor id, else a name or internal-name fragment, nearest first),
/// pickup_filter (every ground item matching the pickup filter), click_ui (UI element id, 0x id or UI path, if shown),
/// go_npc (target = exact actor name: walk the path ROSBOT computes for it, waypoint by waypoint, stop when stuck, then interact at
/// the NPC's position and report whether a vendor window opened),
/// salvage_all (value = normal / magic / rare: with the blacksmith window open, open its salvage page, press that salvage-all
/// button and confirm), follow (target = leader actor id or empty for the nearest player, value = "banner slot 0-4,pickup 0/1" or "off"; FollowMode). Commands run on the plugin's tick; walking is bounded by GoNpcTimeoutMs.
/// The pickup filter (pickup_filter.txt: "auto=true|false" then one name fragment per line) is also applied automatically when
/// a rift ends (OnGemUpdateFinish) while auto is on.
/// </summary>
internal sealed class BridgeCommands
{
    public const string CommandFileName = "command.txt";
    public const string FilterFileName = "pickup_filter.txt";
    public const string ActionMoveTo = "move_to";
    public const string ActionInteract = "interact";
    public const string ActionPickup = "pickup";
    public const string ActionPickupFilter = "pickup_filter";
    public const string ActionClickUi = "click_ui";
    public const string ActionGoNpc = "go_npc";
    public const string ActionSalvageAll = "salvage_all";
    public const string ActionFollow = "follow";
    private const string FollowOff = "off";
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

    private readonly string _dir;
    private readonly Action<string> _log;
    private DateTime _filterStamp = DateTime.MinValue;
    private List<string> _patterns = new();

    public BridgeCommands(string dir, Action<string> log, FollowMode follow)
    {
        _dir = dir;
        _log = log;
        _follow = follow;
    }

    private readonly FollowMode _follow;

    public CommandResult Last { get; private set; }

    public bool AutoPickup { get; private set; }

    public IReadOnlyList<string> Patterns => _patterns;

    /// <summary>Run a pending command, if any (call on every pulse).</summary>
    public void Poll()
    {
        string path = Path.Combine(_dir, CommandFileName);
        if (!File.Exists(path)) return;
        Dictionary<string, string> cmd;
        try
        {
            cmd = ReadKeyValues(File.ReadAllLines(path, Encoding.UTF8));
            File.Delete(path);
        }
        catch (IOException)
        {
            return;
        }
        Last = Execute(cmd);
        _log($"command {Last.Id} {Last.Action}: {(Last.Ok ? "ok" : "failed")} {Last.Message}");
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

    public bool MatchesFilter(EntityInfo item) =>
        _patterns.Any(p => Contains(item.Name, p) || Contains(item.InternalName, p));

    /// <summary>Pick up every ground item that matches the filter (nearest first, bounded in time).</summary>
    /// <summary>Pick up the nearest ground item within range that matches the pickup filter (one item, Pickup's own time bound).</summary>
    public bool PickupNearestMatching(float range)
    {
        if (_patterns.Count == 0) return false;
        var target = WorldScanner.Safe(() => Context.Actors, Array.Empty<IActor>())
            .Where(a => WorldScanner.Safe(() => a.IsValid && a.IsItem, false) && WorldScanner.Safe(() => a.Distance, float.MaxValue) <= range)
            .Where(a => _patterns.Any(p => Contains(WorldScanner.Safe(() => a.Name, ""), p) || Contains(WorldScanner.Safe(() => a.InternalName, ""), p)))
            .OrderBy(a => WorldScanner.Safe(() => a.Distance, float.MaxValue))
            .FirstOrDefault();
        if (target == null) return false;
        bool ok = Pickup(target);
        _log($"follow pickup: {WorldScanner.Safe(() => target.Name, "")} {(ok ? "picked" : "not picked")}");
        return ok;
    }

    public (int Picked, int Matched) PickupMatching()
    {
        var sw = Stopwatch.StartNew();
        var tried = new HashSet<uint>();
        int picked = 0, matched = 0;
        while (sw.ElapsedMilliseconds < FilterBudgetMs)
        {
            var target = WorldScanner.Safe(() => Context.Actors, Array.Empty<IActor>())
                .Where(a => WorldScanner.Safe(() => a.IsValid && a.IsItem, false) && !tried.Contains(WorldScanner.Safe(() => a.RActorId, 0u)))
                .Where(a => _patterns.Any(p => Contains(WorldScanner.Safe(() => a.Name, ""), p) || Contains(WorldScanner.Safe(() => a.InternalName, ""), p)))
                .OrderBy(a => WorldScanner.Safe(() => a.Distance, float.MaxValue))
                .FirstOrDefault();
            if (target == null) break;
            matched++;
            tried.Add(target.RActorId);
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
                    if (mode == FollowOff) _follow.Stop();
                    else _follow.Start(uint.TryParse(target, out uint leader) ? leader : 0u, int.TryParse(parts[0], out int slot) ? slot : 0,
                        parts.Length > 1 && parts[1] == FollowPickupOn);
                    result.Ok = true;
                    result.Message = "follow " + (_follow.Enabled ? "on" : "off");
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

    /// <summary>Blacksmith window open: switch to the salvage page, press the salvage-all button of the quality, confirm.</summary>
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
        if (!Shown(UiIds.VendorDialog))
        {
            result.Message = "blacksmith window not open";
            return result;
        }
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
        result.Ok = true;
        result.Message = $"salvage {quality} pressed{(confirmed ? ", confirmed" : "")}";
        return result;
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
            if (WorldScanner.Safe(() => actor.Distance, float.MaxValue) <= PickupReach) LocalPlayer.PickupItem(actor);
            else LocalPlayer.MoveTo(actor);
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
