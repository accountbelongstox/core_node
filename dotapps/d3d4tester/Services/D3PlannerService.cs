// PY-REF: none (DOT-only)
using System.Globalization;
using System.IO;
using System.Text.Json;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Bridge;
using DotApps.d3d4tester.Core.Flow;
using DotApps.d3d4tester.Core.Monitor;
using DotApps.d3d4tester.Core.Planner;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.Services.Monitor;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Services;

/// <summary>Result of adding a build: the build as kept (null when every gear set duplicates one already listed) and the duplicate gear sets left out.</summary>
public sealed record PlannerLoadResult(PlannerBuild? Build, int DuplicateProfiles);

/// <summary>A planner item that just dropped or was picked up: localized title / message and the match.</summary>
public sealed record PlannerAlert(string Title, string Message, PlannerMatch Match);

/// <summary>Best in-game copy of a planned item: the match (null = none seen) and whether it is carried (else on the ground).</summary>
public sealed record PlannerSlotStatus(PlannerItem Planned, PlannerMatch? Match, bool Carried);

/// <summary>A backpack item (bridge plugin entity, inventory cell) that improves a planned item over the worn copy.</summary>
public sealed record PlannerUpgrade(PlannerMatch Match, RosbotBridgeEntity Item);

/// <summary>Gear set vs worn items: planned items not worn at their ancient rank, and the backpack upgrades for them.</summary>
public sealed record PlannerAlignment(IReadOnlyList<PlannerItem> Unaligned, IReadOnlyList<PlannerUpgrade> Upgrades)
{
    public static readonly PlannerAlignment Empty = new(Array.Empty<PlannerItem>(), Array.Empty<PlannerUpgrade>());
}

/// <summary>
/// maxroll d3planner builds matched against the game. Every planner download (raw build answers, game data, the parsed build list)
/// lives in <see cref="CacheDir"/>: dotapps/d3d4tester/PlannerData in the source tree, so it is versioned and travels with the code
/// (the user data folder only without a source tree). At startup the list is loaded, every cached raw build is parsed again from disk
/// (no network; a profiles/&lt;id&gt;.json added by hand or by another machine joins the list), and builds from the old user-folder cache are
/// moved in once. The fixed URL list PlannerData/build_urls.json (embedded too) travels with the code: at startup every listed build
/// not cached yet is downloaded, every build that loads (UI or list) is written back to it and a removed build leaves it.
/// LoadAsync(url) adds a build (or refreshes the one with the same id) and writes the bridge plugin's item watch (GBIDs, item ids and checkable affix attributes of every
/// gear set of every build). Every CheckEveryTicks seconds (TickDriver) it reads the plugin state: a ground item of any build not seen
/// before raises a "dropped" alert, a new pickup of one a "picked up" alert (Monitor log, Alert event for the tray, optional push).
/// The selected build / gear set drive the Build tab: Status() pairs its planned items with the best carried (else ground) copy.
/// </summary>
public static class D3PlannerService
{
    private const string LogTag = "[D3Planner]";
    private const string CacheDirName = "d3planner";
    /// <summary>Planner cache folder in the app source tree (versioned with the code).</summary>
    private const string SourceCacheDirName = "PlannerData";
    private const string ProfileSearchPattern = "*" + MaxrollD3PlannerClient.ProfileFileExtension;
    private const string LegacyBuildFileName = "build.json";
    private const string BuildsFileName = "builds.json";
    /// <summary>Build URLs fixed with the code (PlannerData/build_urls.json, also embedded for runs without the source tree).</summary>
    private const string BuildUrlsFileName = "build_urls.json";
    private const string BuildUrlsResourceName = "d3d4tester.build_urls.json";
    private const int CheckEveryTicks = 2;
    private const string WatchGbid = "g|{0}";
    private const string WatchName = "n|{0}";
    private const string WatchAttribute = "a|{0}|{1}|{2}|{3}";
    private const string AttributeTypeInt = "i";
    private const string AttributeTypeFloat = "f";
    private const string PickupKind = "pickup";
    private const string LanguageZhPrefix = "zh";
    private const char UnknownSeparator = ',';
    private const string TitleSeparator = " · ";
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };

    private static readonly object Lock = new();
    private static readonly SemaphoreSlim SaveGate = new(1, 1);
    private static readonly object UrlsLock = new();
    private static readonly HashSet<string> SeenGround = new(StringComparer.Ordinal);
    private static List<PlannerBuild> _builds = new();
    private static RosbotBridgeState? _state;
    private static IReadOnlySet<string> _uncheckable = new HashSet<string>();
    private static DateTime _lastPickupUtc = DateTime.MinValue;
    private static bool _pickupsPrimed;
    private static bool _watchWritten;
    private static int _lastWorld;
    private static int _initialized;
    private static IReadOnlyDictionary<int, (string En, string Zh)>? _itemNames;
    private static int _itemNamesLoading;

    public static event Action? BuildChanged;

    public static event Action<PlannerAlert>? Alert;

    /// <summary>Planner cache: PlannerData in the app source tree, else the user data folder.</summary>
    public static string CacheDir { get; } = SourcePaths.AppSourceDir is { } src ? Path.Combine(src, SourceCacheDirName) : UserCacheDir;

    /// <summary>Per-machine planner folder in the user data dir (old cache location; machine-specific files such as backups).</summary>
    public static string UserCacheDir => Path.Combine(ConfigPaths.CurrentUserDataPath, CacheDirName);

    public static IReadOnlyList<PlannerBuild> Builds => _builds;

    public static int BuildIndex =>
        _builds.Count == 0 ? -1 : Math.Clamp(ConfigBinding.GetValue(ConfigKeys.D3PlannerBuildIndex, 0), 0, _builds.Count - 1);

    public static PlannerBuild? Build => BuildIndex is var i and >= 0 ? _builds[i] : null;

    public static int ProfileIndex =>
        Build is { Profiles.Count: > 0 } b ? Math.Clamp(ConfigBinding.GetValue(ConfigKeys.D3PlannerProfileIndex, b.ActiveProfile), 0, b.Profiles.Count - 1) : -1;

    public static PlannerProfile? Profile => ProfileIndex is var i and >= 0 ? Build!.Profiles[i] : null;

    public static bool UseChineseNames =>
        D3D4TesterI18n.Provider.GetCurrentLanguage().StartsWith(LanguageZhPrefix, StringComparison.OrdinalIgnoreCase);

    public static void Initialize()
    {
        if (Interlocked.Exchange(ref _initialized, 1) == 1) return;
        _builds = ReadBuildList(CacheDir) ?? ReadBuildList(UserCacheDir) ?? new();
        MonitorLog.Info($"{LogTag} planner cache {CacheDir}: {_builds.Count} build(s)");
        TickDriver.Instance.RegisterEveryTick(OnTick);
        _ = Task.Run(RefreshFromCacheAsync);
    }

    /// <summary>builds.json (or the single-build legacy build.json) of a folder; null when it has none.</summary>
    private static List<PlannerBuild>? ReadBuildList(string dir)
    {
        try
        {
            string path = Path.Combine(dir, BuildsFileName), legacy = Path.Combine(dir, LegacyBuildFileName);
            if (File.Exists(path)) return JsonSerializer.Deserialize<List<PlannerBuild>>(File.ReadAllText(path), JsonOptions) ?? new();
            if (File.Exists(legacy) && JsonSerializer.Deserialize<PlannerBuild>(File.ReadAllText(legacy), JsonOptions) is { } old) return new() { old };
        }
        catch (Exception ex) when (ex is IOException or JsonException or NotSupportedException)
        {
            ColorPrinter.Yellow($"{LogTag} cached builds in {dir} not readable: {ex.Message}");
        }
        return null;
    }

    /// <summary>
    /// Startup: move the old user-folder game data in when the cache has none, parse every cached raw build again (fills fields added
    /// since it was saved; new files join the list), save the list into the cache and notify the UI. Builds without a raw answer are kept.
    /// </summary>
    private static async Task RefreshFromCacheAsync()
    {
        try
        {
            Directory.CreateDirectory(CacheDir);
            if (CacheDir != UserCacheDir)
            {
                CopyIfMissing(Path.Combine(UserCacheDir, MaxrollD3PlannerClient.DataCacheName), MaxrollD3PlannerClient.DataPath(CacheDir));
                CopyIfMissing(Path.Combine(UserCacheDir, MaxrollD3PlannerClient.LocaleZhCacheName), MaxrollD3PlannerClient.LocaleZhPath(CacheDir));
            }
            string profilesDir = Path.Combine(CacheDir, MaxrollD3PlannerClient.ProfilesDirName);
            var files = Directory.Exists(profilesDir) ? Directory.GetFiles(profilesDir, ProfileSearchPattern) : Array.Empty<string>();
            var parsed = new List<PlannerBuild>();
            foreach (var file in files)
            {
                try
                {
                    string? url = _builds.FirstOrDefault(b => b.Id.ToString(CultureInfo.InvariantCulture) == Path.GetFileNameWithoutExtension(file))?.Url;
                    parsed.Add(await MaxrollD3PlannerClient.LoadCachedAsync(file, CacheDir, url).ConfigureAwait(false));
                }
                catch (Exception ex) when (ex is IOException or JsonException or ArgumentException or InvalidOperationException or System.Net.Http.HttpRequestException)
                {
                    ColorPrinter.Yellow($"{LogTag} cached build {file} not parsed: {ex.Message}");
                }
            }
            lock (Lock)
            {
                var builds = _builds.ToList();
                foreach (var build in parsed)
                {
                    int index = builds.FindIndex(b => b.Id == build.Id);
                    if (index >= 0) builds[index] = build with { LoadedUtc = builds[index].LoadedUtc };
                    else builds.Add(build);
                }
                _builds = Dedupe(builds);
                _watchWritten = false;
            }
            int downloaded = await LoadListedBuildsAsync().ConfigureAwait(false);
            await SaveAsync().ConfigureAwait(false);
            SyncBuildUrls();
            await EnsureIconsAsync(_builds).ConfigureAwait(false);
            MonitorLog.Info($"{LogTag} planner cache {CacheDir}: {_builds.Count} build(s), {parsed.Count} parsed from cached raw data, {downloaded} downloaded from the URL list");
            BuildChanged?.Invoke();
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException)
        {
            ColorPrinter.Yellow($"{LogTag} planner cache {CacheDir} not refreshed: {ex.Message}");
        }
    }

    /// <summary>
    /// Skill / passive icons of every build class in the cache (cut once from maxroll's sprite sheets) and maxroll's item icons (items,
    /// gems, potions, materials: downloaded once, for the cube upgrade recognition); failures only logged.
    /// </summary>
    private static async Task EnsureIconsAsync(IEnumerable<PlannerBuild> builds)
    {
        try
        {
            await D3MaxrollItemIcons.EnsureAsync(CacheDir).ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or System.Net.Http.HttpRequestException or TaskCanceledException)
        {
            ColorPrinter.Yellow($"{LogTag} item icons not cached: {ex.Message}");
        }
        foreach (string cls in builds.Select(b => b.Class).Where(c => c.Length > 0).Distinct(StringComparer.Ordinal))
        {
            try
            {
                await D3SkillIcons.EnsureAsync(CacheDir, cls).ConfigureAwait(false);
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException or System.Net.Http.HttpRequestException or OpenCvSharp.OpenCVException)
            {
                ColorPrinter.Yellow($"{LogTag} {cls} icons not cached: {ex.Message}");
            }
        }
    }

    /// <summary>
    /// Every URL of the fixed list (source file + embedded copy) whose build is not in the list yet is downloaded and added (selection
    /// unchanged); unreadable ones are logged and stay listed for the next start. Returns the number added.
    /// </summary>
    private static async Task<int> LoadListedBuildsAsync()
    {
        int added = 0;
        foreach (string url in ReadBuildUrls())
        {
            if (MaxrollD3PlannerClient.ParseId(url) is not { } id || _builds.Any(b => b.Id == id)) continue;
            try
            {
                var build = await MaxrollD3PlannerClient.LoadAsync(url, CacheDir).ConfigureAwait(false);
                lock (Lock)
                {
                    if (_builds.Any(b => b.Id == build.Id)) continue;
                    var builds = Dedupe(_builds.Append(build));
                    if (!builds.Any(b => b.Id == build.Id)) continue;
                    _builds = builds;
                    _watchWritten = false;
                }
                added++;
                MonitorLog.Info($"{LogTag} build {build.Id} '{build.Name}' ({build.Class}) added from the URL list");
            }
            catch (Exception ex) when (ex is IOException or JsonException or ArgumentException or InvalidOperationException or System.Net.Http.HttpRequestException or TaskCanceledException)
            {
                ColorPrinter.Yellow($"{LogTag} listed build {url} not loaded: {ex.Message}");
            }
        }
        return added;
    }

    /// <summary>URLs of the fixed list, one per build id: the source / cache file, or the embedded copy while that file does not exist yet.</summary>
    private static List<string> ReadBuildUrls()
    {
        var urls = new List<string>();
        void Add(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return;
            try
            {
                foreach (string url in JsonSerializer.Deserialize<List<string>>(json) ?? new())
                    if (MaxrollD3PlannerClient.ParseId(url) is { } id && !urls.Any(u => MaxrollD3PlannerClient.ParseId(u) == id))
                        urls.Add(MaxrollD3PlannerClient.PlannerUrl(id));
            }
            catch (JsonException ex)
            {
                ColorPrinter.Yellow($"{LogTag} build URL list not readable: {ex.Message}");
            }
        }
        string path = Path.Combine(CacheDir, BuildUrlsFileName);
        lock (UrlsLock)
        {
            if (File.Exists(path))
            {
                Add(File.ReadAllText(path));
                return urls;
            }
        }
        using var stream = typeof(D3PlannerService).Assembly.GetManifestResourceStream(BuildUrlsResourceName);
        if (stream != null) Add(new StreamReader(stream).ReadToEnd());
        return urls;
    }

    /// <summary>Write the fixed URL list: listed URLs plus every build in the list (so each readable build travels with the code), minus removed ids.</summary>
    private static void SyncBuildUrls(long? removedId = null)
    {
        var urls = ReadBuildUrls();
        foreach (var build in _builds)
            if (!urls.Any(u => MaxrollD3PlannerClient.ParseId(u) == build.Id)) urls.Add(MaxrollD3PlannerClient.PlannerUrl(build.Id));
        if (removedId is { } id) urls.RemoveAll(u => MaxrollD3PlannerClient.ParseId(u) == id);
        string path = Path.Combine(CacheDir, BuildUrlsFileName);
        string json = JsonSerializer.Serialize(urls, JsonOptions) + Environment.NewLine;
        try
        {
            lock (UrlsLock)
            {
                if (File.Exists(path) && File.ReadAllText(path) == json) return;
                Directory.CreateDirectory(CacheDir);
                File.WriteAllText(path, json);
            }
            MonitorLog.Info($"{LogTag} build URL list {path}: {urls.Count} URL(s)");
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            ColorPrinter.Yellow($"{LogTag} build URL list {path} not written: {ex.Message}");
        }
    }

    private static void CopyIfMissing(string source, string target)
    {
        if (!File.Exists(source) || File.Exists(target)) return;
        Directory.CreateDirectory(Path.GetDirectoryName(target)!);
        File.Copy(source, target);
    }

    /// <summary>
    /// Add the build behind a maxroll d3planner URL (or id), or refresh it when already listed, select it and watch it. Gear sets that
    /// duplicate one already listed (PlannerProfileDedupe: every skill, rune, passive, item, Kanai power and follower equal) are left
    /// out; a build made only of duplicates is not added (its download is deleted, its URL not listed). Throws when unreadable.
    /// </summary>
    public static async Task<PlannerLoadResult> LoadAsync(string url)
    {
        var build = await MaxrollD3PlannerClient.LoadAsync(url, CacheDir).ConfigureAwait(false);
        int index, duplicates;
        bool wasListed;
        PlannerBuild? kept;
        lock (Lock)
        {
            var builds = _builds.ToList();
            index = builds.FindIndex(b => b.Id == build.Id);
            wasListed = index >= 0;
            if (wasListed) builds[index] = build;
            else builds.Add(build);
            var deduped = PlannerProfileDedupe.Apply(builds, out var removed);
            duplicates = removed.GetValueOrDefault(build.Id);
            kept = deduped.FirstOrDefault(b => b.Id == build.Id);
            if (kept != null)
            {
                _builds = deduped;
                index = deduped.IndexOf(kept);
                SeenGround.Clear();
                _watchWritten = false;
            }
        }
        if (kept == null)
        {
            if (!wasListed) DeleteCachedProfile(build.Id);
            MonitorLog.Info($"{LogTag} build {build.Id} '{build.Name}' not added: all {build.Profiles.Count} gear set(s) duplicate listed ones");
            return new PlannerLoadResult(null, duplicates);
        }
        await SaveAsync().ConfigureAwait(false);
        SyncBuildUrls();
        await EnsureIconsAsync(new[] { kept }).ConfigureAwait(false);
        ConfigBinding.SetValue(ConfigKeys.D3PlannerUrl, url.Trim());
        ConfigBinding.SetValue(ConfigKeys.D3PlannerBuildIndex, index);
        ConfigBinding.SetValue(ConfigKeys.D3PlannerProfileIndex, kept.ActiveProfile);
        MonitorLog.Info($"{LogTag} build {kept.Id} '{kept.Name}' ({kept.Class}) loaded: {kept.Profiles.Count} gear set(s), {duplicates} duplicate(s) left out, {_builds.Count} build(s) watched");
        WriteWatch();
        BuildChanged?.Invoke();
        return new PlannerLoadResult(kept, duplicates);
    }

    /// <summary>Duplicate gear sets removed in list order (PlannerProfileDedupe); removals are logged.</summary>
    private static List<PlannerBuild> Dedupe(IEnumerable<PlannerBuild> builds)
    {
        var result = PlannerProfileDedupe.Apply(builds, out var removed);
        foreach (var (id, count) in removed)
            MonitorLog.Info($"{LogTag} build {id}: {count} duplicate gear set(s) left out" + (result.Any(b => b.Id == id) ? "" : ", build not listed"));
        return result;
    }

    private static void DeleteCachedProfile(long id)
    {
        try
        {
            File.Delete(MaxrollD3PlannerClient.ProfilePath(CacheDir, id));
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            ColorPrinter.Yellow($"{LogTag} cached build {id} not deleted: {ex.Message}");
        }
    }

    public static void SelectBuild(int index)
    {
        if (index < 0 || index >= _builds.Count || index == BuildIndex) return;
        ConfigBinding.SetValue(ConfigKeys.D3PlannerBuildIndex, index);
        ConfigBinding.SetValue(ConfigKeys.D3PlannerProfileIndex, _builds[index].ActiveProfile);
        BuildChanged?.Invoke();
    }

    /// <summary>
    /// Drop a build from the list, the item watch, the fixed URL list and the cache (its raw answer), so it does not come back at the
    /// next start.
    /// </summary>
    public static void RemoveBuild(int index)
    {
        if (index < 0 || index >= _builds.Count) return;
        string name = _builds[index].Name;
        long id = _builds[index].Id;
        lock (Lock)
        {
            var builds = _builds.ToList();
            builds.RemoveAt(index);
            _builds = builds;
            SeenGround.Clear();
        }
        _ = SaveAsync();
        SyncBuildUrls(removedId: id);
        DeleteCachedProfile(id);
        ConfigBinding.SetValue(ConfigKeys.D3PlannerBuildIndex, Math.Max(0, Math.Min(index, _builds.Count - 1)));
        if (Build is { } b) ConfigBinding.SetValue(ConfigKeys.D3PlannerProfileIndex, b.ActiveProfile);
        MonitorLog.Info($"{LogTag} build '{name}' removed, {_builds.Count} left");
        WriteWatch();
        BuildChanged?.Invoke();
    }

    private static async Task SaveAsync()
    {
        await SaveGate.WaitAsync().ConfigureAwait(false);
        try
        {
            Directory.CreateDirectory(CacheDir);
            await File.WriteAllTextAsync(Path.Combine(CacheDir, BuildsFileName), JsonSerializer.Serialize(_builds, JsonOptions)).ConfigureAwait(false);
        }
        finally
        {
            SaveGate.Release();
        }
    }

    public static void SelectProfile(int index)
    {
        if (Build is not { } build || index < 0 || index >= build.Profiles.Count || index == ProfileIndex) return;
        ConfigBinding.SetValue(ConfigKeys.D3PlannerProfileIndex, index);
        BuildChanged?.Invoke();
    }

    /// <summary>Item name for a GameBalanceId from the maxroll game data (loaded once in the background); null while unknown.</summary>
    public static string? ItemNameByGbid(int gbid)
    {
        if (_itemNames == null)
        {
            if (Interlocked.Exchange(ref _itemNamesLoading, 1) == 0)
                _ = Task.Run(async () =>
                {
                    try
                    {
                        _itemNames = await MaxrollD3PlannerClient.LoadItemNamesAsync(CacheDir).ConfigureAwait(false);
                    }
                    catch (Exception ex) when (ex is IOException or JsonException or System.Net.Http.HttpRequestException)
                    {
                        ColorPrinter.Yellow($"{LogTag} item names not loaded: {ex.Message}");
                        Interlocked.Exchange(ref _itemNamesLoading, 0);
                    }
                });
            return null;
        }
        if (gbid == 0 || !_itemNames.TryGetValue(gbid, out var n)) return null;
        return UseChineseNames && n.Zh.Length > 0 ? n.Zh : n.En;
    }

    /// <summary>True when the item is one of any gear set of any loaded build (salvage / drop tests keep these).</summary>
    public static bool IsPlanned(int gbid, string internalName, string name)
    {
        var observed = new ObservedItem(gbid, internalName, name, 0, null);
        return _builds.Any(b => AllItems(b).Any(i => D3PlannerMatcher.IsSameItem(i, observed)));
    }

    /// <summary>Name to show for an item seen in game: maxroll name by GBID, else the plugin's name, else the GBID.</summary>
    public static string DisplayName(int gbid, string pluginName)
    {
        if (pluginName.Length > 0 && D3D4TesterI18n.Provider.GetUiText(I18nKeys.RosbotBridgeItemNamePrefix + pluginName.ToLowerInvariant(), "") is { Length: > 0 } fixedName)
            return fixedName;
        return ItemNameByGbid(gbid) ?? (pluginName.Length > 0 ? pluginName : $"gbid {gbid}");
    }

    public static string ItemName(PlannerItem item) => UseChineseNames && item.NameZh.Length > 0 ? item.NameZh : item.NameEn;

    public static string StatName(PlannerStat stat) => UseChineseNames && stat.NameZh.Length > 0 ? stat.NameZh : stat.NameEn;

    public static string SlotName(PlannerItem item) => UseChineseNames && item.SlotNameZh.Length > 0 ? item.SlotNameZh : item.SlotNameEn;

    private static IReadOnlyList<PlannerItem> AllItems(PlannerProfile profile) => profile.Items.Concat(profile.Kanai).ToList();

    /// <summary>Every item of every gear set of a build (watch and alerts cover all of them).</summary>
    private static IReadOnlyList<PlannerItem> AllItems(PlannerBuild build) => build.Profiles.SelectMany(AllItems).ToList();

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

    /// <summary>Items the hero wears, by planner slot key (bridge plugin InventorySlot -> D3PaperDollLayout).</summary>
    public static IReadOnlyDictionary<string, ObservedItem> EquippedBySlot()
    {
        var equipped = new Dictionary<string, ObservedItem>(StringComparer.Ordinal);
        foreach (var e in _state?.CarriedItems ?? Array.Empty<RosbotBridgeEntity>())
            if (D3PaperDollLayout.FromInventorySlot.TryGetValue(e.Slot, out var slot)) equipped[slot] = Observe(e);
        return equipped;
    }

    public static IReadOnlySet<string> Uncheckable => _uncheckable;

    /// <summary>
    /// Gear set (cube powers excluded) against the worn items: a planned item is aligned when worn (any slot, so rings / weapons may
    /// swap hands) at its ancient rank. For every unaligned one, the best backpack copy that is better than the worn copy: ancient rank
    /// reached, or the same rank with more affixes in range. Empty without a build or plugin state.
    /// </summary>
    public static PlannerAlignment Alignment()
    {
        if (Profile is not { } profile || _state is not { } state) return PlannerAlignment.Empty;
        var worn = state.CarriedItems.Where(e => D3PaperDollLayout.FromInventorySlot.ContainsKey(e.Slot)).Select(Observe).ToList();
        var backpack = state.CarriedItems.Where(e => e.Slot == RosbotPluginConstants.BridgeSlotBackpack && e.InvX >= 0 && e.InvY >= 0).ToList();
        var unaligned = new List<PlannerItem>();
        var upgrades = new List<PlannerUpgrade>();
        var taken = new HashSet<int>();
        foreach (var item in profile.Items)
        {
            var current = Best(item, worn);
            if (current is { AncientOk: true }) continue;
            unaligned.Add(item);
            var upgrade = backpack.Where(e => !taken.Contains(e.AcdId) && D3PlannerMatcher.IsSameItem(item, Observe(e)))
                .Select(e => new PlannerUpgrade(D3PlannerMatcher.Evaluate(item, Observe(e), _uncheckable), e))
                .Where(u => current == null || (u.Match.AncientOk && !current.AncientOk) || (u.Match.AncientOk == current.AncientOk && u.Match.OkStats > current.OkStats))
                .OrderByDescending(u => u.Match.AncientOk).ThenByDescending(u => u.Match.OkStats)
                .FirstOrDefault();
            if (upgrade == null) continue;
            taken.Add(upgrade.Item.AcdId);
            upgrades.Add(upgrade);
        }
        return new PlannerAlignment(unaligned, upgrades);
    }

    /// <summary>Planned item of the current gear set this observed item is (slot + item), null when it is not part of it.</summary>
    public static PlannerItem? PlannedFor(int gbid, string internalName, string name, int ancientRank) =>
        Profile is { } profile ? D3PlannerMatcher.Match(profile.Items, new ObservedItem(gbid, internalName, name, ancientRank, null))?.Planned : null;

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
        var items = _builds.SelectMany(AllItems).ToList();
        if (items.Count > 0)
        {
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
        if (tick.GlobalTick % CheckEveryTicks != 0) return;
        var snapshot = GameInterfaceData.Instance.GetStateSnapshot();
        if (snapshot.RosbotBridge is not { } state || !snapshot.RosbotBridgeFresh) return;
        _state = state;
        var builds = _builds;
        if (builds.Count == 0) return;
        if (!_watchWritten) WriteWatch();
        _uncheckable = state.ItemWatchUnknown.Split(UnknownSeparator, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToHashSet(StringComparer.Ordinal);
        var watched = builds.Select(b => (Build: b, Items: AllItems(b))).ToList();
        var alerts = new List<(PlannerMatch Match, string EventKey, string BuildName)>();
        void Check(ObservedItem observed, string eventKey)
        {
            foreach (var (build, items) in watched)
                if (D3PlannerMatcher.Match(items, observed, _uncheckable) is { } m)
                {
                    alerts.Add((m, eventKey, build.Name));
                    return;
                }
        }
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
                Check(Observe(g), I18nKeys.RosbotBridgeBuildEventDrop);
            }
            var pickups = state.Pickups.Where(p => p.Kind == PickupKind).ToList();
            if (_pickupsPrimed)
            {
                foreach (var p in pickups.Where(p => p.Utc > _lastPickupUtc).OrderBy(p => p.Utc))
                    Check(Observe(p), I18nKeys.RosbotBridgeBuildEventPickup);
            }
            if (pickups.Count > 0) _lastPickupUtc = pickups.Max(p => p.Utc);
            _pickupsPrimed = true;
        }
        foreach (var (match, eventKey, buildName) in alerts) Raise(match, eventKey, buildName);
    }

    private static void Raise(PlannerMatch match, string eventKey, string buildName)
    {
        var p = D3D4TesterI18n.Provider;
        string title = string.Format(CultureInfo.InvariantCulture, p.GetUiText(I18nKeys.RosbotBridgeBuildNotifyTitle), p.GetUiText(eventKey))
            + TitleSeparator + buildName;
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
