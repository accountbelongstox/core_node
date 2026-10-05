// PY-REF: none (DOT-only)
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
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
/// pickup_filter (every ground item matching the pickup filter), click_ui (ROSBOT UI element id, if present).
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
    private const string AutoKey = "auto";
    private const int PickupTimeoutMs = 5000;
    private const int FilterBudgetMs = 20000;
    private const float PickupReach = 2f;

    private readonly string _dir;
    private readonly Action<string> _log;
    private DateTime _filterStamp = DateTime.MinValue;
    private List<string> _patterns = new();

    public BridgeCommands(string dir, Action<string> log)
    {
        _dir = dir;
        _log = log;
    }

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
                    if (result.Action == ActionMoveTo) result.Ok = LocalPlayer.MoveTo(actor);
                    else if (result.Action == ActionPickup) result.Ok = Pickup(actor);
                    else
                    {
                        bool mode = !cmd.TryGetValue("mode", out var m) || !bool.TryParse(m, out bool mv) || mv;
                        bool click = !cmd.TryGetValue("click", out var c) || !bool.TryParse(c, out bool cv) || cv;
                        LocalPlayer.Interact(actor, mode, click);
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
                case ActionClickUi:
                {
                    if (!cmd.TryGetValue("ui_id", out var raw) || !TryParseUiId(raw, out ulong uiId))
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

    private static bool TryParseUiId(string raw, out ulong id)
    {
        raw = (raw ?? "").Trim();
        return raw.StartsWith("0x", StringComparison.OrdinalIgnoreCase)
            ? ulong.TryParse(raw.Substring(2), NumberStyles.HexNumber, CultureInfo.InvariantCulture, out id)
            : ulong.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out id);
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
