// PY-REF: none (DOT-only)
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using Rcdw32.Ws.Models;
using Rcdw32.Ws.Plugins;

namespace CoreNodeBridge;

/// <summary>
/// ROSBOT plugin that publishes the bot's game state for d3d4tester and runs its commands. Every ScanIntervalMs it scans the
/// world (ground items for the pickup record); every WriteIntervalMs it writes state.json next to this DLL (atomic replace):
/// current map, town / rift flags, player stats, ground items (with pickup-filter matches), NPCs, monster counts, carried
/// items, the live pickup / stash record and the last command result. Commands and the pickup filter: see BridgeCommands; item
/// GameBalanceIds and the affixes of watched build items: see ItemWatch.
/// Everything noteworthy also goes to ROSBOT's log (Context.Log). API reads are guarded: outside the game getters may throw.
/// </summary>
public sealed class CoreNodeBridge : IPlugin
{
    private const string StateFileName = "state.json";
    private const string TempSuffix = ".tmp";
    private const int ScanIntervalMs = 250;
    private const int WriteIntervalMs = 1000;
    private const int FilterReloadMs = 2000;
    private const int MaxAreaHistory = 20;
    private const string LogTag = "[CoreNodeBridge] ";

    private readonly List<KeyValuePair<int, DateTime>> _areaHistory = new();
    private readonly PickupTracker _pickups = new();
    private BridgeCommands _commands;
    private ItemWatch _watch;
    private DateTime _lastScanUtc = DateTime.MinValue;
    private DateTime _lastWriteUtc = DateTime.MinValue;
    private DateTime _lastFilterUtc = DateTime.MinValue;
    private bool _enabled;
    private int _lastArea = -1;
    private DateTime _areaSinceUtc = DateTime.UtcNow;
    private int _greaterRiftLevel;
    private string _lastEvent = "";
    private DateTime _lastEventUtc = DateTime.MinValue;
    private string _dir = ".";
    private List<EntityInfo> _ground = new();

    public string Author => "core_node";
    public Version Version => new(1, 2, 0);
    public string Name => "CoreNode Bridge";
    public string Description => "Publishes map, items, NPCs and pickups to d3d4tester (state.json) and runs its commands.";
    public bool CanSettings => false;

    public bool Equals(IPlugin other) => other != null && other.Name == Name;

    public override bool Equals(object obj) => obj is IPlugin p && Equals(p);

    public override int GetHashCode() => Name.GetHashCode();

    public void DisplayWindow() { }

    public void OnInitialize()
    {
        _dir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location) ?? ".";
        _commands = new BridgeCommands(_dir, Log);
        _commands.ReloadFilter();
        _watch = new ItemWatch(Log);
        _watch.Reload(_dir);
        WorldScanner.Watch = _watch;
        Log("initialized v" + Version + ", folder " + _dir);
    }

    public void OnEnabled()
    {
        _enabled = true;
        PluginsEvents.OnInTown += OnInTown;
        PluginsEvents.OnOpenRift += OnOpenRift;
        PluginsEvents.OnTakeTownPortal += OnTakeTownPortal;
        PluginsEvents.OnOpenGreateRift += OnOpenGreaterRift;
        PluginsEvents.OnGemUpdateFinish += OnRiftEnd;
        PluginsEvents.OnItemStash += OnItemStash;
        WriteState(DateTime.UtcNow);
        Log("enabled");
    }

    public void OnDisabled()
    {
        _enabled = false;
        PluginsEvents.OnInTown -= OnInTown;
        PluginsEvents.OnOpenRift -= OnOpenRift;
        PluginsEvents.OnTakeTownPortal -= OnTakeTownPortal;
        PluginsEvents.OnOpenGreateRift -= OnOpenGreaterRift;
        PluginsEvents.OnGemUpdateFinish -= OnRiftEnd;
        PluginsEvents.OnItemStash -= OnItemStash;
        WriteState(DateTime.UtcNow);
        Log("disabled");
    }

    public void OnPulse()
    {
        if (!_enabled) return;
        var now = DateTime.UtcNow;
        if ((now - _lastFilterUtc).TotalMilliseconds >= FilterReloadMs)
        {
            _lastFilterUtc = now;
            _commands.ReloadFilter();
            _watch.Reload(_dir);
        }
        _commands.Poll();
        if ((now - _lastScanUtc).TotalMilliseconds >= ScanIntervalMs)
        {
            _lastScanUtc = now;
            Scan(now);
        }
        if ((now - _lastWriteUtc).TotalMilliseconds >= WriteIntervalMs) WriteState(now);
    }

    public void OnShutdown()
    {
        _enabled = false;
        WriteState(DateTime.UtcNow);
    }

    private void OnInTown(object sender, EventArgs e) => Event("in_town");

    private void OnOpenRift(object sender, EventArgs e) => Event("open_rift");

    private void OnTakeTownPortal(object sender, EventArgs e) => Event("town_portal");

    private void OnOpenGreaterRift(object sender, int level)
    {
        _greaterRiftLevel = level;
        Event("open_greater_rift");
    }

    private void OnRiftEnd(object sender, EventArgs e)
    {
        Event("rift_end");
        if (!_commands.AutoPickup || _commands.Patterns.Count == 0) return;
        var (picked, matched) = _commands.PickupMatching();
        Log($"auto pickup at rift end: picked {picked} of {matched} matching");
    }

    private void OnItemStash(object sender, ItemStat e)
    {
        var record = _pickups.AddStash(WorldScanner.Safe(() => e.Desc, ""), DateTime.UtcNow);
        Log("stash: " + record.Name);
    }

    private void Event(string name)
    {
        _lastEvent = name;
        _lastEventUtc = DateTime.UtcNow;
        WriteState(_lastEventUtc);
    }

    private void Scan(DateTime now)
    {
        var actors = WorldScanner.Safe(() => Context.Actors, Array.Empty<IActor>()) ?? Array.Empty<IActor>();
        _ground = WorldScanner.GroundItems(actors);
        int world = WorldScanner.Safe(() => LocalPlayer.MeWorldId, 0);
        bool alive = WorldScanner.Safe(() => LocalPlayer.IsValid && !LocalPlayer.IsDead, false);
        foreach (var r in _pickups.Update(_ground, world, alive, now))
            Log($"picked: {r.Name} [{r.InternalName}] gbid={r.Gbid} quality={r.Quality} ancient={r.AncientRank}");
    }

    private void WriteState(DateTime now)
    {
        _lastWriteUtc = now;
        try
        {
            var actors = WorldScanner.Safe(() => Context.Actors, Array.Empty<IActor>()) ?? Array.Empty<IActor>();
            var acds = WorldScanner.Safe(() => Context.Acds, Array.Empty<IAcd>()) ?? Array.Empty<IAcd>();
            int area = WorldScanner.Safe(() => LocalPlayer.SnoLevelArea, 0);
            TrackArea(area, now);
            var (monsters, elites) = WorldScanner.MonsterCounts(actors);
            var json = new JsonWriter().BeginObject()
                .Prop("updated_utc", now)
                .Prop("plugin_version", Version.ToString())
                .Prop("enabled", _enabled)
                .Prop("valid", WorldScanner.Safe(() => LocalPlayer.IsValid, false))
                .Prop("in_game", WorldScanner.Safe(() => LocalPlayer.IsInGame, false))
                .Prop("level_area_sno", area)
                .Prop("level_area_since_utc", _areaSinceUtc)
                .Prop("scene_sno", WorldScanner.Safe(() => LocalPlayer.SnoScene, 0))
                .Prop("global_world_id", WorldScanner.Safe(() => LocalPlayer.GlobalWorldId, 0))
                .Prop("world_id", WorldScanner.Safe(() => LocalPlayer.MeWorldId, 0))
                .Prop("in_town", WorldScanner.Safe(() => LocalPlayer.IsInTown, false))
                .Prop("in_rift", WorldScanner.Safe(() => LocalPlayer.IsInRift, false))
                .Prop("greater_rift", WorldScanner.Safe(() => LocalPlayer.IsGreaterRift, false))
                .Prop("nephalem_rift", WorldScanner.Safe(() => LocalPlayer.IsNephalemRift, false))
                .Prop("greater_rift_level", _greaterRiftLevel)
                .Prop("rift_keys", WorldScanner.Safe(() => LocalPlayer.RiftKey, 0))
                .Prop("blood_shards", WorldScanner.Safe(() => LocalPlayer.Shards, 0))
                .Prop("paragon", WorldScanner.Safe(() => LocalPlayer.ParagonLevel, 0))
                .Prop("actor_class", WorldScanner.Safe(() => LocalPlayer.ActorClass, 0))
                .Prop("health_pct", WorldScanner.Safe(() => LocalPlayer.CurrentHealthPct, 0d))
                .Prop("dead", WorldScanner.Safe(() => LocalPlayer.IsDead, false))
                .Prop("in_combat", WorldScanner.Safe(() => LocalPlayer.IsInCombat, false))
                .Prop("inventory_full", WorldScanner.Safe(() => Context.InventoryFull, false))
                .Prop("repair_needed", WorldScanner.Safe(() => Context.RepairNeeded, false))
                .Prop("sequence", WorldScanner.Safe(() => Context.SequenceName, "") ?? "")
                .Prop("last_event", _lastEvent)
                .Prop("last_event_utc", _lastEventUtc)
                .Prop("monsters_nearby", monsters)
                .Prop("elites_nearby", elites)
                .Prop("picked_count", _pickups.PickedCount)
                .Prop("item_acd_types", WorldScanner.ItemAcdTypesText)
                .Prop("pickup_filter_auto", _commands.AutoPickup)
                .Prop("pickup_filter", string.Join(", ", _commands.Patterns));
            json.BeginArray("level_area_history");
            foreach (var v in _areaHistory) json.BeginObject().Prop("sno", v.Key).Prop("utc", v.Value).EndObject();
            json.EndArray();
            WriteEntities(json, "ground_items", _ground);
            WriteEntities(json, "npcs", WorldScanner.Npcs(actors));
            WriteEntities(json, "carried_items", WorldScanner.CarriedItems(acds, _ground));
            json.BeginArray("pickups");
            foreach (var r in _pickups.Records)
            {
                json.BeginObject().Prop("utc", r.Utc).Prop("kind", r.Kind).Prop("name", r.Name).Prop("internal_name", r.InternalName)
                    .Prop("sno", r.Sno).Prop("gbid", r.Gbid).Prop("quality", r.Quality).Prop("ancient_rank", r.AncientRank);
                WriteAttrs(json, r.Attrs);
                json.EndObject();
            }
            json.EndArray();
            if (_commands.Last is { } c)
                json.BeginObject("last_command").Prop("id", c.Id).Prop("action", c.Action).Prop("ok", c.Ok).Prop("message", c.Message).Prop("utc", c.Utc).EndObject();
            json.EndObject();

            string path = Path.Combine(_dir, StateFileName);
            string tmp = path + TempSuffix;
            File.WriteAllText(tmp, json.ToString(), new UTF8Encoding(false));
            if (File.Exists(path)) File.Replace(tmp, path, null);
            else File.Move(tmp, path);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            // the app may be reading the file; the next write retries
        }
    }

    private void WriteEntities(JsonWriter json, string key, IEnumerable<EntityInfo> items)
    {
        json.BeginArray(key);
        foreach (var e in items)
        {
            json.BeginObject().Prop("id", e.Id).Prop("acd_id", e.AcdId).Prop("name", e.Name).Prop("internal_name", e.InternalName)
                .Prop("sno", e.Sno).Prop("distance", e.Distance).Prop("interact_distance", e.InteractDistance)
                .Prop("quality", e.Quality).Prop("ancient_rank", e.AncientRank).Prop("stack", e.Stack).Prop("equipped", e.Equipped)
                .Prop("durability_cur", e.DurabilityCur).Prop("durability_max", e.DurabilityMax)
                .Prop("elite", e.Elite).Prop("boss", e.Boss).Prop("filter_match", _commands.MatchesFilter(e)).Prop("gbid", e.Gbid);
            WriteAttrs(json, e.Attrs);
            json.EndObject();
        }
        json.EndArray();
    }

    private static void WriteAttrs(JsonWriter json, Dictionary<string, double> attrs)
    {
        if (attrs == null) return;
        json.BeginObject("attrs");
        foreach (var a in attrs) json.Prop(a.Key, a.Value);
        json.EndObject();
    }

    private void TrackArea(int area, DateTime now)
    {
        if (area == _lastArea) return;
        _lastArea = area;
        _areaSinceUtc = now;
        if (area == 0) return;
        _areaHistory.Insert(0, new KeyValuePair<int, DateTime>(area, now));
        if (_areaHistory.Count > MaxAreaHistory) _areaHistory.RemoveAt(_areaHistory.Count - 1);
    }

    private static void Log(string message)
    {
        try
        {
            Context.Log(LogTag + message);
        }
        catch
        {
            // logging must never break the plugin
        }
    }
}
