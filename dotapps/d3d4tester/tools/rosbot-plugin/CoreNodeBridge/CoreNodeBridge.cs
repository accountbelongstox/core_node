// PY-REF: none (DOT-only)
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Reflection;
using System.Text;
using Rcdw32.Ws.Plugins;

namespace CoreNodeBridge;

/// <summary>
/// ROSBOT plugin that publishes the bot's game state for d3d4tester: current map (level area / scene / world SNO), town and
/// rift flags, greater rift level, paragon, health, current sequence and the recent level areas. Written once per second
/// (atomic replace) to state.json next to this DLL; the app reads it from &lt;ROSBOT&gt;\plugins\CoreNodeBridge\state.json.
/// Every API read is guarded: outside the game ROSBOT's getters may throw.
/// </summary>
public sealed class CoreNodeBridge : IPlugin
{
    private const string StateFileName = "state.json";
    private const string TempSuffix = ".tmp";
    private const int WriteIntervalMs = 1000;
    private const int MaxHistory = 20;
    private const string LogTag = "[CoreNodeBridge] ";
    private const string TimeFormat = "o";

    private readonly List<KeyValuePair<int, DateTime>> _areaHistory = new();
    private DateTime _lastWriteUtc = DateTime.MinValue;
    private bool _enabled;
    private int _lastArea = -1;
    private DateTime _areaSinceUtc = DateTime.UtcNow;
    private int _greaterRiftLevel;
    private string _lastEvent = "";
    private DateTime _lastEventUtc = DateTime.MinValue;
    private string _statePath = "";

    public string Author => "core_node";
    public Version Version => new(1, 0, 0);
    public string Name => "CoreNode Bridge";
    public string Description => "Publishes the current map and player state to d3d4tester (state.json).";
    public bool CanSettings => false;

    public bool Equals(IPlugin other) => other != null && other.Name == Name;

    public override bool Equals(object obj) => obj is IPlugin p && Equals(p);

    public override int GetHashCode() => Name.GetHashCode();

    public void DisplayWindow() { }

    public void OnInitialize()
    {
        _statePath = Path.Combine(Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location) ?? ".", StateFileName);
        Log("initialized, state file " + _statePath);
    }

    public void OnEnabled()
    {
        _enabled = true;
        PluginsEvents.OnInTown += OnInTown;
        PluginsEvents.OnOpenRift += OnOpenRift;
        PluginsEvents.OnTakeTownPortal += OnTakeTownPortal;
        PluginsEvents.OnOpenGreateRift += OnOpenGreaterRift;
        Write(true);
        Log("enabled");
    }

    public void OnDisabled()
    {
        _enabled = false;
        PluginsEvents.OnInTown -= OnInTown;
        PluginsEvents.OnOpenRift -= OnOpenRift;
        PluginsEvents.OnTakeTownPortal -= OnTakeTownPortal;
        PluginsEvents.OnOpenGreateRift -= OnOpenGreaterRift;
        Write(true);
        Log("disabled");
    }

    public void OnPulse()
    {
        if (_enabled) Write(false);
    }

    public void OnShutdown()
    {
        _enabled = false;
        Write(true);
    }

    private void OnInTown(object sender, EventArgs e) => Event("in_town");

    private void OnOpenRift(object sender, EventArgs e) => Event("open_rift");

    private void OnTakeTownPortal(object sender, EventArgs e) => Event("town_portal");

    private void OnOpenGreaterRift(object sender, int level)
    {
        _greaterRiftLevel = level;
        Event("open_greater_rift");
    }

    private void Event(string name)
    {
        _lastEvent = name;
        _lastEventUtc = DateTime.UtcNow;
        Write(true);
    }

    private void Write(bool force)
    {
        var now = DateTime.UtcNow;
        if (!force && (now - _lastWriteUtc).TotalMilliseconds < WriteIntervalMs) return;
        _lastWriteUtc = now;
        if (string.IsNullOrEmpty(_statePath)) return;
        try
        {
            int area = Read(() => LocalPlayer.SnoLevelArea, 0);
            if (area != _lastArea)
            {
                _lastArea = area;
                _areaSinceUtc = now;
                if (area != 0)
                {
                    _areaHistory.Insert(0, new KeyValuePair<int, DateTime>(area, now));
                    if (_areaHistory.Count > MaxHistory) _areaHistory.RemoveAt(_areaHistory.Count - 1);
                }
            }
            var json = new JsonWriter();
            json.Add("updated_utc", now.ToString(TimeFormat, CultureInfo.InvariantCulture));
            json.Add("plugin_version", Version.ToString());
            json.Add("enabled", _enabled);
            json.Add("valid", Read(() => LocalPlayer.IsValid, false));
            json.Add("in_game", Read(() => LocalPlayer.IsInGame, false));
            json.Add("level_area_sno", area);
            json.Add("level_area_since_utc", _areaSinceUtc.ToString(TimeFormat, CultureInfo.InvariantCulture));
            json.Add("scene_sno", Read(() => LocalPlayer.SnoScene, 0));
            json.Add("global_world_id", Read(() => LocalPlayer.GlobalWorldId, 0));
            json.Add("world_id", Read(() => LocalPlayer.MeWorldId, 0));
            json.Add("in_town", Read(() => LocalPlayer.IsInTown, false));
            json.Add("in_rift", Read(() => LocalPlayer.IsInRift, false));
            json.Add("greater_rift", Read(() => LocalPlayer.IsGreaterRift, false));
            json.Add("nephalem_rift", Read(() => LocalPlayer.IsNephalemRift, false));
            json.Add("greater_rift_level", _greaterRiftLevel);
            json.Add("rift_keys", Read(() => LocalPlayer.RiftKey, 0));
            json.Add("blood_shards", Read(() => LocalPlayer.Shards, 0));
            json.Add("paragon", Read(() => LocalPlayer.ParagonLevel, 0));
            json.Add("actor_class", Read(() => LocalPlayer.ActorClass, 0));
            json.Add("health_pct", Read(() => LocalPlayer.CurrentHealthPct, 0d));
            json.Add("dead", Read(() => LocalPlayer.IsDead, false));
            json.Add("in_combat", Read(() => LocalPlayer.IsInCombat, false));
            json.Add("inventory_full", Read(() => Context.InventoryFull, false));
            json.Add("sequence", Read(() => Context.SequenceName, ""));
            json.Add("last_event", _lastEvent);
            json.Add("last_event_utc", _lastEventUtc == DateTime.MinValue ? "" : _lastEventUtc.ToString(TimeFormat, CultureInfo.InvariantCulture));
            json.AddAreaHistory("level_area_history", _areaHistory);
            string tmp = _statePath + TempSuffix;
            File.WriteAllText(tmp, json.ToString(), new UTF8Encoding(false));
            if (File.Exists(_statePath)) File.Replace(tmp, _statePath, null);
            else File.Move(tmp, _statePath);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            // the app may be reading the file; the next pulse writes again
        }
    }

    private static T Read<T>(Func<T> getter, T fallback)
    {
        try
        {
            return getter();
        }
        catch
        {
            return fallback;
        }
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

    /// <summary>Flat JSON object writer (net48 has no System.Text.Json).</summary>
    private sealed class JsonWriter
    {
        private readonly StringBuilder _sb = new("{");

        public void Add(string key, string value) => Key(key).Append('"').Append(Escape(value)).Append('"');

        public void Add(string key, bool value) => Key(key).Append(value ? "true" : "false");

        public void Add(string key, int value) => Key(key).Append(value.ToString(CultureInfo.InvariantCulture));

        public void Add(string key, double value) => Key(key).Append(value.ToString("0.###", CultureInfo.InvariantCulture));

        public void AddAreaHistory(string key, List<KeyValuePair<int, DateTime>> items)
        {
            Key(key).Append('[');
            for (int i = 0; i < items.Count; i++)
            {
                if (i > 0) _sb.Append(',');
                _sb.Append("{\"sno\":").Append(items[i].Key.ToString(CultureInfo.InvariantCulture))
                    .Append(",\"utc\":\"").Append(items[i].Value.ToString(TimeFormat, CultureInfo.InvariantCulture)).Append("\"}");
            }
            _sb.Append(']');
        }

        public override string ToString() => _sb.ToString() + "}";

        private StringBuilder Key(string key)
        {
            if (_sb.Length > 1) _sb.Append(',');
            return _sb.Append('"').Append(key).Append("\":");
        }

        private static string Escape(string s)
        {
            var sb = new StringBuilder(s.Length);
            foreach (char c in s)
            {
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    default:
                        if (c < ' ') sb.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                        else sb.Append(c);
                        break;
                }
            }
            return sb.ToString();
        }
    }
}
