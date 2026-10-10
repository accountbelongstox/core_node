// PY-REF: none (DOT-only)
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading;
using Rcdw32.Ws.Models;
using Rcdw32.Ws.Plugins;

namespace CoreNodeBridge;

/// <summary>
/// ROSBOT plugin that publishes the bot's game state for d3d4tester and runs its commands. ROSBOT pulses plugins only while it is
/// botting, so from OnEnabled to OnDisabled the plugin runs its own TickMs timer (OnPulse drives the same Tick; one tick at a time).
/// Every ScanIntervalMs it scans the world (ground items for the pickup record); every WriteIntervalMs it writes state.json next to
/// this DLL (atomic replace):
/// current map, town / rift flags, player stats, ground items (with pickup-filter matches), NPCs, monsters (hit points, ROSBOT's
/// attack-target mark), ROSBOT's target settings, the active skills' readiness, monster counts, carried
/// items, the live pickup / stash record, follow / town standby / combat assist state and the last command result. Commands and the pickup filter:
/// see BridgeCommands; item
/// GameBalanceIds and the affixes of watched build items: see ItemWatch.
/// Everything noteworthy also goes to ROSBOT's log (Context.Log). API reads are guarded: outside the game getters may throw.
/// </summary>
public sealed class CoreNodeBridge : IPlugin
{
    private const string StateFileName = "state.json";
    private const string TempSuffix = ".tmp";
    private const int ScanIntervalMs = 250;
    private const int TickMs = 250;
    private const int WriteIntervalMs = 1000;
    private const int FilterReloadMs = 2000;
    private const int MaxAreaHistory = 20;
    private const int SlowWriteMs = 800;
    /// <summary>After OnEnabled no ROSBOT API call for this long: ROSBOT initialises its game reader and starts its first task then.</summary>
    private const int QuietStartMs = 30000;
    private const int SlowLogIntervalSec = 60;
    private const string LogTag = "[CoreNodeBridge] ";
    private const int WatchIntervalMs = 2000;
    /// <summary>ROSBOT pulses plugins only while it bots: a pulse this recent (and no hold) means ROSBOT is botting.</summary>
    private const int BottingPulseMs = 3000;

    private readonly List<KeyValuePair<int, DateTime>> _areaHistory = new();
    private readonly PickupTracker _pickups = new();
    private BridgeCommands _commands;
    private ItemWatch _watch;
    private FollowMode _follow;
    private CombatAssist _assist;
    private readonly CombatProbe _probe = new();
    private TownHold _townHold;
    private TownStandby _standby;
    private PulseHold _hold;
    /// <summary>Stall watchdog for API reads (PulseHold.CheckStall).</summary>
    private Timer _watchTimer;
    private DateTime _writeStartedUtc = DateTime.MinValue;
    private Thread _writeThread;
    private Timer _timer;
    /// <summary>Writes state.json on its own thread so long commands (go_npc, salvage, banner walks) never let it go stale.</summary>
    private Timer _stateTimer;
    private readonly object _writeLock = new();
    private int _ticking;
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
    private List<EntityInfo> _monsters = new();
    private DateTime _lastSlowLogUtc = DateTime.MinValue;
    private DateTime _enabledUtc = DateTime.MaxValue;

    private bool Quiet => DateTime.UtcNow - _enabledUtc < TimeSpan.FromMilliseconds(QuietStartMs);

    public string Author => "core_node";
    public Version Version => typeof(CoreNodeBridge).Assembly.GetName().Version;
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
        _townHold = new TownHold(_dir, Log);
        _assist = new CombatAssist(Log);
        _follow = new FollowMode(Log) { TownHold = _townHold, Assist = _assist };
        _standby = new TownStandby(Log) { TownHold = _townHold };
        _hold = new PulseHold(Log, () => _writeStartedUtc, () => _writeThread);
        _commands = new BridgeCommands(_dir, Log, _follow, _standby, _hold, _assist);
        _follow.PickupHandler = _commands.PickupNearestMatching;
        _follow.CommandBusy = () => _commands.Busy;
        _commands.ReloadFilter();
        _watch = new ItemWatch(Log);
        _watch.Reload(_dir);
        WorldScanner.Watch = _watch;
        Log("initialized v" + Version + ", folder " + _dir);
    }

    public void OnEnabled()
    {
        _enabledUtc = DateTime.UtcNow;
        _enabled = true;
        PluginsEvents.OnInTown += OnInTown;
        PluginsEvents.OnOpenRift += OnOpenRift;
        PluginsEvents.OnTakeTownPortal += OnTakeTownPortal;
        PluginsEvents.OnOpenGreateRift += OnOpenGreaterRift;
        PluginsEvents.OnGemUpdateFinish += OnRiftEnd;
        PluginsEvents.OnItemStash += OnItemStash;
        _timer = new Timer(_ => Tick(), null, TickMs, TickMs);
        _stateTimer = new Timer(_ => WriteState(DateTime.UtcNow), null, WriteIntervalMs, WriteIntervalMs);
        _watchTimer = new Timer(_ => _hold.CheckStall(), null, WatchIntervalMs, WatchIntervalMs);
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
        _timer?.Dispose();
        _timer = null;
        _stateTimer?.Dispose();
        _stateTimer = null;
        _watchTimer?.Dispose();
        _watchTimer = null;
        _hold.Release();
        _townHold.Release("plugin disabled");
        WriteState(DateTime.UtcNow);
        Log("disabled");
    }

    /// <summary>ROSBOT's bot thread: the usual tick, then, while the app holds ROSBOT, stay here (PulseHold).</summary>
    public void OnPulse()
    {
        Tick();
        _hold.OnPulse(() => _enabled);
    }

    /// <summary>Reload files, run a pending command, scan and write when due; skipped while a previous tick (e.g. a command) runs.</summary>
    private void Tick()
    {
        if (!_enabled || Interlocked.Exchange(ref _ticking, 1) == 1) return;
        try
        {
            TickOnce();
        }
        catch (Exception ex)
        {
            Log("tick failed: " + ex.GetType().Name + ": " + ex.Message);
        }
        finally
        {
            Interlocked.Exchange(ref _ticking, 0);
        }
    }

    private void TickOnce()
    {
        var now = DateTime.UtcNow;
        if ((now - _lastFilterUtc).TotalMilliseconds >= FilterReloadMs)
        {
            _lastFilterUtc = now;
            _commands.ReloadFilter();
            _watch.Reload(_dir);
        }
        if (Quiet) return;
        _commands.Poll();
        _townHold.Tick();
        _standby.Tick();
        if (_follow.Enabled && _assist.Enabled && _hold.State == PulseHold.StateOff) _hold.Set(true);
        _follow.Tick();
        TickAssist();
        _probe.Tick();
        if ((now - _lastScanUtc).TotalMilliseconds >= ScanIntervalMs)
        {
            _lastScanUtc = now;
            Scan(now);
        }
    }

    /// <summary>
    /// Combat assist outside follow (follow scans and steps itself): only while the app controls the hero (hold or standby) and it is
    /// alive in game; idle under the hold it steps to the fight, standby and running commands only scan (they own the movement).
    /// </summary>
    private void TickAssist()
    {
        if (!_assist.Enabled || _follow.Enabled) return;
        bool control = _standby.Enabled || _hold.State == PulseHold.StateHolding;
        if (!control || !WorldScanner.Safe(() => LocalPlayer.IsValid && LocalPlayer.IsInGame && !LocalPlayer.IsDead, false))
        {
            _assist.Clear();
            return;
        }
        var monster = _assist.Scan(WorldScanner.Safe(() => Context.Actors, Array.Empty<IActor>()), null);
        if (monster != null && !_standby.Enabled && !_commands.Busy) _assist.Step(monster, null);
    }

    public void OnShutdown()
    {
        _enabled = false;
        _hold?.Release();
        _townHold?.Release("plugin shut down");
        _watchTimer?.Dispose();
        _watchTimer = null;
        _timer?.Dispose();
        _timer = null;
        _stateTimer?.Dispose();
        _stateTimer = null;
        WriteState(DateTime.UtcNow);
    }

    /// <summary>ROSBOT's town run starts: hold it (this thread) while the app equips build items, before ROSBOT salvages.</summary>
    private void OnInTown(object sender, EventArgs e)
    {
        bool hold = _townHold.TryBegin(TownHold.ReasonTownRun);
        Event("in_town");
        if (hold) _townHold.Wait();
    }

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
        if (!WorldScanner.Safe(() => LocalPlayer.IsValid && LocalPlayer.IsInGame, false))
        {
            _ground = new List<EntityInfo>();
            _monsters = new List<EntityInfo>();
            return;
        }
        var actors = WorldScanner.Safe(() => Context.Actors, Array.Empty<IActor>()) ?? Array.Empty<IActor>();
        _ground = WorldScanner.GroundItems(actors);
        if (!_assist.Combat) _assist.RefreshRosTargets();
        _monsters = WorldScanner.Monsters(actors, _assist.RosTargetIds);
        int world = WorldScanner.Safe(() => LocalPlayer.MeWorldId, 0);
        bool alive = WorldScanner.Safe(() => LocalPlayer.IsValid && !LocalPlayer.IsDead, false);
        foreach (var r in _pickups.Update(_ground, world, alive, now))
            Log($"picked: {r.Name} [{r.InternalName}] gbid={r.Gbid} quality={r.Quality} ancient={r.AncientRank}");
    }

    /// <summary>One write at a time; a caller finding a write in progress (e.g. stalled while ROSBOT is paused) skips instead of piling up.</summary>
    private void WriteState(DateTime now)
    {
        if (!Monitor.TryEnter(_writeLock)) return;
        try
        {
            _writeThread = Thread.CurrentThread;
            _writeStartedUtc = DateTime.UtcNow;
            WriteStateLocked(now);
        }
        finally
        {
            _writeStartedUtc = DateTime.MinValue;
            Monitor.Exit(_writeLock);
        }
    }

    private void WriteStateLocked(DateTime now)
    {
        _lastWriteUtc = now;
        if (Quiet)
        {
            WriteFile(new JsonWriter().BeginObject().Prop("plugin_version", Version.ToString()).Prop("enabled", _enabled).Prop("starting", true)
                .Prop("updated_utc", DateTime.UtcNow).EndObject().ToString());
            return;
        }
        var total = Stopwatch.StartNew();
        var sections = new List<string>();
        void Section(string name)
        {
            sections.Add($"{name} {total.ElapsedMilliseconds}ms");
        }
        try
        {
            bool inGame = WorldScanner.Safe(() => LocalPlayer.IsValid && LocalPlayer.IsInGame, false);
            Section("in_game");
            var actors = inGame ? WorldScanner.Safe(() => Context.Actors, Array.Empty<IActor>()) ?? Array.Empty<IActor>() : Array.Empty<IActor>();
            var acds = inGame ? WorldScanner.Safe(() => Context.Acds, Array.Empty<IAcd>()) ?? Array.Empty<IAcd>() : Array.Empty<IAcd>();
            Section("actors");
            int area = WorldScanner.Safe(() => LocalPlayer.SnoLevelArea, 0);
            TrackArea(area, now);
            var (monsters, elites) = WorldScanner.MonsterCounts(actors);
            var json = new JsonWriter().BeginObject()
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
                .Prop("max_blood_shards", WorldScanner.Safe(() => LocalPlayer.MaxShard, 0))
                .Prop("town_hold", _townHold.Holding)
                .Prop("town_hold_reason", _townHold.Holding ? _townHold.Reason : "")
                .Prop("town_hold_since_utc", _townHold.SinceUtc)
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
                .Prop("pickup_filter", string.Join(", ", _commands.Patterns))
                .Prop("item_watch_unknown", string.Join(",", _watch.UnknownKeys))
                .Prop("inventory_slot_supported", WorldScanner.SlotSupported)
                .Prop("inventory_cell_supported", WorldScanner.CellSupported)
                .Prop("follow_enabled", _follow.Enabled)
                .Prop("follow_state", _follow.State)
                .Prop("follow_pickup", _follow.Pickup)
                .Prop("follow_mode", _follow.Mode)
                .Prop("follow_revive", _follow.Revive)
                .Prop("follow_leader", _follow.Leader)
                .Prop("follow_distance", _follow.Distance)
                .Prop("assist_enabled", _assist.Enabled)
                .Prop("combat", _assist.Combat)
                .Prop("combat_target", _assist.Target)
                .Prop("combat_source", _assist.Source)
                .Prop("ros_attack_targets", _assist.RosTargetIds.Count)
                .Prop("standby_enabled", _standby.Enabled)
                .Prop("standby_state", _standby.State)
                .Prop("standby_since_utc", _standby.SinceUtc)
                .Prop("hold_state", _hold.State)
                .Prop("hold_since_utc", _hold.SinceUtc)
                .Prop("last_pulse_utc", _hold.LastPulseUtc)
                .Prop("botting", _hold.State != PulseHold.StateHolding && (DateTime.UtcNow - _hold.LastPulseUtc).TotalMilliseconds < BottingPulseMs)
                .Prop("ui_vendor_open", inGame && WorldScanner.Safe(() => Context.HasUIElement(UiIds.Of(UiIds.VendorDialog)), false))
                .Prop("ui_salvage_open", inGame && WorldScanner.Safe(() => Context.HasUIElement(UiIds.Of(UiIds.SalvageDialog)), false))
                .Prop("ui_inventory_open", inGame && WorldScanner.Safe(() => Context.HasUIElement(UiIds.Of(UiIds.InventoryDialog)), false));
            Section("player+ui");
            json.BeginArray("level_area_history");
            foreach (var v in _areaHistory) json.BeginObject().Prop("sno", v.Key).Prop("utc", v.Value).EndObject();
            json.EndArray();
            WriteEntities(json, "ground_items", _ground);
            WriteEntities(json, "npcs", WorldScanner.Npcs(actors));
            WriteEntities(json, "monsters", _monsters);
            json.BeginArray("skills");
            foreach (var k in _probe.Skills)
                json.BeginObject().Prop("power", k.Power).Prop("name", k.Name).Prop("ready", k.Ready).Prop("on_cooldown", k.OnCooldown)
                    .Prop("cooldown_ms", k.CooldownMs).Prop("resource_ok", k.ResourceOk).Prop("charges", k.Charges).Prop("channel", k.Channel).EndObject();
            json.EndArray();
            json.BeginObject("ros_settings")
                .Prop("scan_range", CombatAssist.RosSetting(() => RosSettings.ScanRange))
                .Prop("density_limit", CombatAssist.RosSetting(() => RosSettings.DensityLimit))
                .Prop("elite_weight", CombatAssist.RosSetting(() => RosSettings.EliteWeight))
                .Prop("goblin_weight", CombatAssist.RosSetting(() => RosSettings.GoblinWeight))
                .Prop("normal_weight", CombatAssist.RosSetting(() => RosSettings.NormalMonsterWeight))
                .Prop("minion_weight", CombatAssist.RosSetting(() => RosSettings.MinionWeight))
                .Prop("warden_weight", CombatAssist.RosSetting(() => RosSettings.WardenWeight))
                .EndObject();
            _follow.LearnBanners(actors);
            WriteEntities(json, "players", WorldScanner.Players(actors).Select(a => new EntityInfo
            {
                Id = WorldScanner.Safe(() => a.RActorId, 0u), AcdId = WorldScanner.Safe(() => a.AcdId, 0), Name = WorldScanner.Safe(() => a.Name, "") ?? "",
                Sno = WorldScanner.Safe(() => a.ActorSnoId, 0), Distance = WorldScanner.Safe(() => a.Distance, 0f),
                PartySlot = _follow.SlotOf(WorldScanner.Safe(() => a.AcdId, 0)), IsLeader = FollowMode.IsLeader(a),
            }));
            Section("ground+npcs+players");
            WriteEntities(json, "carried_items", WorldScanner.CarriedItems(acds, _ground));
            Section("carried");
            json.BeginArray("pickups");
            foreach (var r in _pickups.Records)
            {
                json.BeginObject().Prop("utc", r.Utc).Prop("kind", r.Kind).Prop("name", r.Name).Prop("internal_name", r.InternalName)
                    .Prop("sno", r.Sno).Prop("gbid", r.Gbid).Prop("quality", r.Quality).Prop("ancient_rank", r.AncientRank);
                WriteAttrs(json, r.Attrs);
                json.EndObject();
            }
            json.EndArray();
            if (_commands.Running is { } runningCommand)
                json.BeginObject("running_command").Prop("id", runningCommand.Id).Prop("action", runningCommand.Action).Prop("utc", runningCommand.Utc).EndObject();
            if (_commands.Last is { } c)
                json.BeginObject("last_command").Prop("id", c.Id).Prop("action", c.Action).Prop("ok", c.Ok).Prop("message", c.Message).Prop("utc", c.Utc).EndObject();
            json.Prop("write_ms", total.ElapsedMilliseconds).Prop("updated_utc", DateTime.UtcNow);
            json.EndObject();
            if (total.ElapsedMilliseconds >= SlowWriteMs && (DateTime.UtcNow - _lastSlowLogUtc).TotalSeconds >= SlowLogIntervalSec)
            {
                _lastSlowLogUtc = DateTime.UtcNow;
                Log($"slow state: {total.ElapsedMilliseconds}ms ({string.Join(", ", sections)})");
            }

            WriteFile(json.ToString());
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            // the app may be reading the file; the next write retries
        }
    }

    /// <summary>Atomic state.json write (caller holds _writeLock); the app may read the file at any time.</summary>
    private void WriteFile(string text)
    {
        try
        {
            string path = Path.Combine(_dir, StateFileName);
            string tmp = path + TempSuffix;
            File.WriteAllText(tmp, text, new UTF8Encoding(false));
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
                .Prop("elite", e.Elite).Prop("boss", e.Boss).Prop("filter_match", _commands.MatchesFilter(e)).Prop("gbid", e.Gbid)
                .Prop("slot", e.Slot).Prop("inv_x", e.InvX).Prop("inv_y", e.InvY).Prop("party_slot", e.PartySlot).Prop("is_leader", e.IsLeader)
                .Prop("hp_pct", e.HpPct).Prop("ros_target", e.RosTarget);
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
