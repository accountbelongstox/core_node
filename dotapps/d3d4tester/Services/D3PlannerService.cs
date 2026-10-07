// PY-REF: none (DOT-only)
using System.Globalization;
using System.IO;
using System.Text.Json;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core.Flow;
using DotApps.d3d4tester.Core.Monitor;
using DotApps.d3d4tester.Core.Planner;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.Services.Monitor;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Services;

/// <summary>A planner item that just dropped or was picked up: localized title / message and the match.</summary>
public sealed record PlannerAlert(string Title, string Message, PlannerMatch Match);

/// <summary>Best in-game copy of a planned item: the match (null = none seen) and whether it is carried (else on the ground).</summary>
public sealed record PlannerSlotStatus(PlannerItem Planned, PlannerMatch? Match, bool Carried);

/// <summary>
/// maxroll d3planner build matched against the game. Load(url) reads the build (MaxrollD3PlannerClient), caches it in the user data
/// folder and writes the bridge plugin's item watch (the build's GBIDs, item ids and checkable affix attributes). Every CheckEveryTicks
/// seconds (TickDriver) it reads the plugin state: a ground item of the build not seen before raises a "dropped" alert, a new pickup of
/// one a "picked up" alert (Monitor log, Alert event for the tray, optional push). Status() pairs every planned item with the best
/// carried (else ground) copy for the Build tab.
/// </summary>
public static class D3PlannerService
{
    private const string LogTag = "[D3Planner]";
    private const string CacheDirName = "d3planner";
    private const string BuildFileName = "build.json";
    private const int CheckEveryTicks = 2;
    private const string WatchGbid = "g|{0}";
    private const string WatchName = "n|{0}";
    private const string WatchAttribute = "a|{0}|{1}|{2}|{3}";
    private const string AttributeTypeInt = "i";
    private const string AttributeTypeFloat = "f";
    private const string PickupKind = "pickup";
    private const string LanguageZhPrefix = "zh";
    private const char UnknownSeparator = ',';
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };

    private static readonly object Lock = new();
    private static readonly HashSet<string> SeenGround = new(StringComparer.Ordinal);
    private static PlannerBuild? _build;
    private static RosbotBridgeState? _state;
    private static IReadOnlySet<string> _uncheckable = new HashSet<string>();
    private static DateTime _lastPickupUtc = DateTime.MinValue;
    private static bool _pickupsPrimed;
    private static bool _watchWritten;
    private static int _lastWorld;
    private static int _initialized;

    public static event Action? BuildChanged;

    public static event Action<PlannerAlert>? Alert;

    public static string CacheDir => Path.Combine(ConfigPaths.CurrentUserDataPath, CacheDirName);

    public static PlannerBuild? Build => _build;

    public static int ProfileIndex =>
        _build is { Profiles.Count: > 0 } b ? Math.Clamp(ConfigBinding.GetValue(ConfigKeys.D3PlannerProfileIndex, b.ActiveProfile), 0, b.Profiles.Count - 1) : -1;

    public static PlannerProfile? Profile => ProfileIndex is var i and >= 0 ? _build!.Profiles[i] : null;

    public static bool UseChineseNames =>
        D3D4TesterI18n.Provider.GetCurrentLanguage().StartsWith(LanguageZhPrefix, StringComparison.OrdinalIgnoreCase);

    public static void Initialize()
    {
        if (Interlocked.Exchange(ref _initialized, 1) == 1) return;
        try
        {
            string path = Path.Combine(CacheDir, BuildFileName);
            if (File.Exists(path)) _build = JsonSerializer.Deserialize<PlannerBuild>(File.ReadAllText(path), JsonOptions);
        }
        catch (Exception ex) when (ex is IOException or JsonException or NotSupportedException)
        {
            ColorPrinter.Yellow($"{LogTag} cached build not readable: {ex.Message}");
        }
        TickDriver.Instance.RegisterEveryTick(OnTick);
    }

    /// <summary>Read the build behind a maxroll d3planner URL (or id), keep it and watch its items. Throws when the build cannot be read.</summary>
    public static async Task<PlannerBuild> LoadAsync(string url)
    {
        var build = await MaxrollD3PlannerClient.LoadAsync(url, CacheDir).ConfigureAwait(false);
        Directory.CreateDirectory(CacheDir);
        await File.WriteAllTextAsync(Path.Combine(CacheDir, BuildFileName), JsonSerializer.Serialize(build, JsonOptions)).ConfigureAwait(false);
        lock (Lock)
        {
            _build = build;
            SeenGround.Clear();
            _watchWritten = false;
        }
        ConfigBinding.SetValue(ConfigKeys.D3PlannerUrl, url.Trim());
        ConfigBinding.SetValue(ConfigKeys.D3PlannerProfileIndex, build.ActiveProfile);
        MonitorLog.Info($"{LogTag} build {build.Id} '{build.Name}' ({build.Class}) loaded: {build.Profiles.Count} gear set(s)");
        WriteWatch();
        BuildChanged?.Invoke();
        return build;
    }

    public static void SelectProfile(int index)
    {
        if (_build == null || index < 0 || index >= _build.Profiles.Count || index == ProfileIndex) return;
        ConfigBinding.SetValue(ConfigKeys.D3PlannerProfileIndex, index);
        lock (Lock) SeenGround.Clear();
        WriteWatch();
        BuildChanged?.Invoke();
    }

    public static string ItemName(PlannerItem item) => UseChineseNames && item.NameZh.Length > 0 ? item.NameZh : item.NameEn;

    public static string StatName(PlannerStat stat) => UseChineseNames && stat.NameZh.Length > 0 ? stat.NameZh : stat.NameEn;

    public static string SlotName(PlannerItem item) => UseChineseNames && item.SlotNameZh.Length > 0 ? item.SlotNameZh : item.SlotNameEn;

    private static IReadOnlyList<PlannerItem> AllItems(PlannerProfile profile) => profile.Items.Concat(profile.Kanai).ToList();

    /// <summary>Every planned item with its best copy in game (carried first, then ground; most affixes ok).</summary>
    public static IReadOnlyList<PlannerSlotStatus> Status()
    {
        if (Profile is not { } profile) return Array.Empty<PlannerSlotStatus>();
        var state = _state;
        var carried = state?.CarriedItems.Select(Observe).ToList() ?? new List<ObservedItem>();
        var ground = state?.GroundItems.Select(Observe).ToList() ?? new List<ObservedItem>();
        return AllItems(profile).Select(item =>
        {
            var best = Best(item, carried);
            return best != null ? new PlannerSlotStatus(item, best, true) : new PlannerSlotStatus(item, Best(item, ground), false);
        }).ToList();
    }

    private static PlannerMatch? Best(PlannerItem item, IEnumerable<ObservedItem> observed) =>
        observed.Where(o => D3PlannerMatcher.IsSameItem(item, o))
            .Select(o => D3PlannerMatcher.Evaluate(item, o, _uncheckable))
            .OrderByDescending(m => m.AncientOk).ThenByDescending(m => m.OkStats)
            .FirstOrDefault();

    private static ObservedItem Observe(RosbotBridgeEntity e) => new(e.Gbid, e.InternalName, e.Name, e.AncientRank, e.Attrs);

    private static ObservedItem Observe(RosbotBridgePickup p) => new(p.Gbid, p.InternalName, p.Name, p.AncientRank, p.Attrs);

    /// <summary>Plugin item watch for the current gear set (empty when no build): GBIDs, item ids and checkable affix attributes.</summary>
    private static void WriteWatch()
    {
        var lines = new List<string>();
        if (Profile is { } profile)
        {
            var items = AllItems(profile);
            foreach (int gbid in items.SelectMany(i => i.Gbids).Distinct()) lines.Add(string.Format(CultureInfo.InvariantCulture, WatchGbid, gbid));
            foreach (string id in items.SelectMany(i => i.ItemIds).Distinct(StringComparer.OrdinalIgnoreCase)) lines.Add(string.Format(CultureInfo.InvariantCulture, WatchName, id));
            foreach (var stat in items.SelectMany(i => i.Stats).Where(s => s.WatchKey != null).GroupBy(s => s.WatchKey).Select(g => g.First()))
                lines.Add(string.Format(CultureInfo.InvariantCulture, WatchAttribute, stat.WatchKey, stat.Attribute,
                    stat.Parameter?.ToString(CultureInfo.InvariantCulture) ?? "", stat.IsInt ? AttributeTypeInt : AttributeTypeFloat));
        }
        _watchWritten = RosbotBridgePluginService.SaveItemWatch(lines);
    }

    private static void OnTick(IFlowTick tick)
    {
        if (tick.GlobalTick % CheckEveryTicks != 0 || _build == null) return;
        if (!_watchWritten) WriteWatch();
        var state = RosbotBridgePluginService.ReadState();
        if (state == null || state.IsStale(DateTime.UtcNow)) return;
        _state = state;
        _uncheckable = state.ItemWatchUnknown.Split(UnknownSeparator, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToHashSet(StringComparer.Ordinal);
        if (Profile is not { } profile) return;
        var items = AllItems(profile);
        var alerts = new List<(PlannerMatch Match, string EventKey)>();
        lock (Lock)
        {
            if (state.WorldId != _lastWorld)
            {
                _lastWorld = state.WorldId;
                SeenGround.Clear();
            }
            foreach (var g in state.GroundItems)
            {
                if (!SeenGround.Add($"{state.WorldId}:{g.AcdId}:{g.Gbid}")) continue;
                if (D3PlannerMatcher.Match(items, Observe(g), _uncheckable) is { } m) alerts.Add((m, I18nKeys.RosbotBridgeBuildEventDrop));
            }
            var pickups = state.Pickups.Where(p => p.Kind == PickupKind).ToList();
            if (_pickupsPrimed)
            {
                foreach (var p in pickups.Where(p => p.Utc > _lastPickupUtc).OrderBy(p => p.Utc))
                    if (D3PlannerMatcher.Match(items, Observe(p), _uncheckable) is { } m) alerts.Add((m, I18nKeys.RosbotBridgeBuildEventPickup));
            }
            if (pickups.Count > 0) _lastPickupUtc = pickups.Max(p => p.Utc);
            _pickupsPrimed = true;
        }
        foreach (var (match, eventKey) in alerts) Raise(match, eventKey);
    }

    private static void Raise(PlannerMatch match, string eventKey)
    {
        var p = D3D4TesterI18n.Provider;
        string title = string.Format(CultureInfo.InvariantCulture, p.GetUiText(I18nKeys.RosbotBridgeBuildNotifyTitle), p.GetUiText(eventKey));
        string rank = match.AncientOk || match.Planned.AncientRank == 0 ? "" : " (" + string.Format(CultureInfo.InvariantCulture,
            p.GetUiText(I18nKeys.RosbotBridgeBuildRankMissing), RankName(match.Planned.AncientRank)) + ")";
        string message = string.Format(CultureInfo.InvariantCulture, p.GetUiText(I18nKeys.RosbotBridgeBuildNotifyMessage),
            SlotName(match.Planned), ItemName(match.Planned), match.OkStats, match.CheckedStats, rank);
        MonitorLog.Info($"{LogTag} {title}: {message}");
        if (!ConfigBinding.GetValue(ConfigKeys.D3PlannerNotify, true)) return;
        Alert?.Invoke(new PlannerAlert(title, message, match));
        if (ConfigBinding.GetValue(ConfigKeys.D3PlannerNotifyPush, false))
            NotificationService.Send(MonitorSettings.GetString(ConfigKeys.MonitorNotifyRestartChannel, MonitorNotifyChannels.All), title, message);
    }

    public static string RankName(int rank) =>
        D3D4TesterI18n.Provider.GetUiText(rank >= 2 ? I18nKeys.RosbotBridgeBuildPrimal : I18nKeys.RosbotBridgeBuildAncient);
}
