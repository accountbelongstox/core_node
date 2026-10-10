// PY-REF: none (DOT-only)
using System.Globalization;
using System.IO;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using DotCore.Utils;

namespace DotApps.d3d4tester.Core.Planner;

/// <summary>
/// Reads a maxroll.gg D3 planner build. The planner page is a JS app without the build in its HTML: the build comes from the planner
/// API (planners.maxroll.gg/profiles/d3/{id}; its "data" field is a JSON string with the gear profiles), item / stat / slot definitions
/// from the planner's game data (d3planner-assets.maxroll.gg/d3planner/data.json) and Chinese names from its zhCN locale patch. Game
/// data is cached for GameDataMaxAge. Cache layout under the cache dir: profiles/&lt;id&gt;.json (the raw planner API answer, every field
/// kept), game/ (game data + zhCN locale); a cached profile parses again without network. Stats map to D3 attributes by the "id"
/// maxroll stores ("Crit_Damage_Percent", "Resistance#Fire"); element / resource parameters become D3 enum indexes; percent stats are
/// divided by 100 (attribute units). Besides gear: skill bar with runes, passives, paragon level, gems, follower gear and skills.
/// </summary>
public static class MaxrollD3PlannerClient
{
    private const string ProfileUrlFormat = "https://planners.maxroll.gg/profiles/d3/{0}";
    private const string AssetsBase = "https://d3planner-assets.maxroll.gg/d3planner/";
    private const string DataFileName = "data.json";
    private const string LocaleZhFileName = "locale/zhCN.json";
    public const string DataCacheName = "maxroll_d3_data.json";
    public const string LocaleZhCacheName = "maxroll_d3_zhCN.json";
    public const string ProfilesDirName = "profiles";
    public const string GameDirName = "game";
    public const string ProfileFileExtension = ".json";
    private const string PlannerUrlFormat = "https://maxroll.gg/d3/d3planner/{0}";
    /// <summary>Game data changes with patches only; a long age keeps the cached copy (it travels with the code) stable.</summary>
    private static readonly TimeSpan GameDataMaxAge = TimeSpan.FromDays(30);
    private static readonly Regex PlannerUrlId = new(@"d3planner(?:-ptr)?/(\d+)", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    private static readonly Regex PlainId = new(@"^\s*(\d+)\s*$", RegexOptions.CultureInvariant);
    private const char ParameterSeparator = '#';
    private const string PairSuffix = " (pair)";
    private const string AncientPrimal = "primal";
    private const string AncientAncient = "ancient";
    private const string StatSockets = "sockets";
    private const string AttributeSockets = "Sockets";
    private const string KanaiSlotPrefix = "kanai.";
    private const string StatCustom = "custom";
    private const string SkillStatPrefix = "skill_";
    private const char CodeSeparator = '_';
    private const double PercentDivisor = 100.0;
    private const string GemTierFormat = "00";
    private const string GemRankFormat = "{0} ({1})";
    private const string GemQualityFormat = "{0} {1}";
    private static readonly string[] ItemListNames = { "items", "potions", "extraItems" };

    /// <summary>maxroll attribute ids that ROSBOT's AttributeId enum names differently.</summary>
    private static readonly Dictionary<string, string> AttributeAliases = new(StringComparer.Ordinal)
    {
        ["Critical_Chance"] = "Crit_Percent_Bonus_Capped",
        ["Movement_Speed"] = "Movement_Scalar",
        ["Damage_Type_Percent_Reduction"] = "Damage_Percent_Reduction_From_Type",
    };

    /// <summary>D3 DamageType order (attribute parameter of Resistance#, Damage_Dealt_Percent_Bonus#, ...).</summary>
    private static readonly string[] DamageTypes = { "Physical", "Fire", "Lightning", "Cold", "Poison", "Arcane", "Holy" };

    /// <summary>D3 resource type order (parameter of Resource_Max_Bonus#, Resource_Regen_Per_Second#, ...).</summary>
    private static readonly string[] ResourceTypes = { "Mana", "Arcanum", "Fury", "Spirit", "Faith", "Hatred", "Discipline", "Essence" };

    /// <summary>Planner id from a maxroll URL (…/d3planner/522341742) or a bare number; null when none.</summary>
    public static long? ParseId(string urlOrId)
    {
        var m = PlannerUrlId.Match(urlOrId ?? "");
        if (!m.Success) m = PlainId.Match(urlOrId ?? "");
        return m.Success && long.TryParse(m.Groups[1].Value, NumberStyles.Integer, CultureInfo.InvariantCulture, out long id) ? id : null;
    }

    /// <summary>Canonical planner page URL of a build id (https://maxroll.gg/d3/d3planner/&lt;id&gt;).</summary>
    public static string PlannerUrl(long id) => string.Format(CultureInfo.InvariantCulture, PlannerUrlFormat, id);

    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, (JsonNode? Data, JsonNode? Zh)> CachedGameData = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>Every rune of a class skill (letter, English, Chinese) from the cached game data; empty when unknown.</summary>
    public static IReadOnlyList<(string Letter, string En, string Zh)> RuneNames(string cacheDir, string cls, string skill)
    {
        var (data, zh) = CachedGameData.GetOrAdd(cacheDir, dir =>
        {
            JsonNode? Read(string path) => File.Exists(path) ? JsonNode.Parse(File.ReadAllText(path)) : null;
            return (Read(DataPath(dir)), Read(LocaleZhPath(dir))?["patch"]);
        });
        var zhRunes = zh?["skills"]?[cls]?[skill]?["runes"];
        return (data?["skills"]?[cls]?[skill]?["runes"]?.AsObject() ?? new JsonObject())
            .Select(kv => (kv.Key, Text(kv.Value), Text(zhRunes?[kv.Key]))).ToList();
    }

    /// <summary>Raw planner API answer of a build in the cache dir.</summary>
    public static string ProfilePath(string cacheDir, long id) =>
        Path.Combine(cacheDir, ProfilesDirName, id.ToString(CultureInfo.InvariantCulture) + ProfileFileExtension);

    public static string DataPath(string cacheDir) => Path.Combine(cacheDir, GameDirName, DataCacheName);

    public static string LocaleZhPath(string cacheDir) => Path.Combine(cacheDir, GameDirName, LocaleZhCacheName);

    /// <summary>Download the build (raw answer saved to profiles/), make sure the game data is cached, parse.</summary>
    public static async Task<PlannerBuild> LoadAsync(string urlOrId, string cacheDir, CancellationToken ct = default)
    {
        long id = ParseId(urlOrId) ?? throw new ArgumentException(urlOrId, nameof(urlOrId));
        var profileTask = HttpFileCache.GetStringAsync(string.Format(CultureInfo.InvariantCulture, ProfileUrlFormat, id), ct);
        var gameTask = LoadGameDataAsync(cacheDir, ct);
        await Task.WhenAll(profileTask, gameTask).ConfigureAwait(false);
        var profile = JsonNode.Parse(profileTask.Result)!;
        string path = ProfilePath(cacheDir, id);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        await File.WriteAllTextAsync(path, profileTask.Result, ct).ConfigureAwait(false);
        var (data, zh) = gameTask.Result;
        return Parse(id, urlOrId.Trim(), profile, data, zh);
    }

    /// <summary>Parse a cached raw profile (profiles/&lt;id&gt;.json) with the cached game data; network only when the game data is missing.</summary>
    public static async Task<PlannerBuild> LoadCachedAsync(string profilePath, string cacheDir, string? url = null, CancellationToken ct = default)
    {
        string name = Path.GetFileNameWithoutExtension(profilePath);
        long id = long.TryParse(name, NumberStyles.Integer, CultureInfo.InvariantCulture, out long n) ? n : throw new ArgumentException(profilePath, nameof(profilePath));
        var profile = JsonNode.Parse(await File.ReadAllTextAsync(profilePath, ct).ConfigureAwait(false))!;
        var (data, zh) = await LoadGameDataAsync(cacheDir, ct).ConfigureAwait(false);
        return Parse(id, url ?? PlannerUrl(id), profile, data, zh);
    }

    private static async Task<(JsonNode Data, JsonNode? Zh)> LoadGameDataAsync(string cacheDir, CancellationToken ct)
    {
        Directory.CreateDirectory(Path.Combine(cacheDir, GameDirName));
        var dataTask = HttpFileCache.GetCachedAsync(AssetsBase + DataFileName, DataPath(cacheDir), GameDataMaxAge, ct);
        var zhTask = HttpFileCache.GetCachedAsync(AssetsBase + LocaleZhFileName, LocaleZhPath(cacheDir), GameDataMaxAge, ct);
        await Task.WhenAll(dataTask, zhTask).ConfigureAwait(false);
        var data = JsonNode.Parse(await File.ReadAllTextAsync(dataTask.Result ?? throw new IOException(DataFileName), ct).ConfigureAwait(false))!;
        var zh = zhTask.Result is { } zhPath ? JsonNode.Parse(await File.ReadAllTextAsync(zhPath, ct).ConfigureAwait(false))?["patch"] : null;
        return (data, zh);
    }

    /// <summary>
    /// English / Chinese names by GameBalanceId from the cached game data: equipment (alternate ids included), potions, materials and
    /// keys (extraItems), legendary gems, and normal gems per tier (gem id = color id + two-digit tier, tier names from gemQualities).
    /// </summary>
    public static async Task<IReadOnlyDictionary<int, (string En, string Zh)>> LoadItemNamesAsync(string cacheDir, CancellationToken ct = default)
    {
        var names = new Dictionary<int, (string En, string Zh)>();
        Directory.CreateDirectory(Path.Combine(cacheDir, GameDirName));
        string? dataPath = await HttpFileCache.GetCachedAsync(AssetsBase + DataFileName, DataPath(cacheDir), GameDataMaxAge, ct).ConfigureAwait(false);
        string? zhPath = await HttpFileCache.GetCachedAsync(AssetsBase + LocaleZhFileName, LocaleZhPath(cacheDir), GameDataMaxAge, ct).ConfigureAwait(false);
        if (dataPath == null) return names;
        var data = JsonNode.Parse(await File.ReadAllTextAsync(dataPath, ct).ConfigureAwait(false));
        var zhPatch = zhPath != null ? JsonNode.Parse(await File.ReadAllTextAsync(zhPath, ct).ConfigureAwait(false))?["patch"] : null;
        var zh = zhPatch?["itemById"];
        foreach (var listName in ItemListNames)
        {
            foreach (var item in data?[listName]?.AsArray() ?? new JsonArray())
            {
                if (item?["id"]?.GetValue<string>() is not { Length: > 0 } id) continue;
                var entry = (Text(item["name"]), Text(zh?[id]?["name"]));
                var ids = new List<string> { id };
                foreach (var alt in item["ids"]?.AsArray() ?? new JsonArray())
                    if (alt is JsonValue av && av.TryGetValue(out string? s) && s.Length > 0) ids.Add(s);
                if (item["realid"] is JsonValue rv && rv.TryGetValue(out string? real) && real.Length > 0) ids.Add(real);
                foreach (var i in ids) names.TryAdd(D3Gbid.Of(i), entry);
            }
        }
        foreach (var (key, gem) in data?["legendaryGems"]?.AsObject() ?? new JsonObject())
            if (Text(gem?["id"]) is { Length: > 0 } gemId)
                names.TryAdd(D3Gbid.Of(gemId), (Text(gem!["name"]), Text(zhPatch?["legendaryGems"]?[key]?["name"])));
        var tiers = data?["gemQualities"]?.AsArray() ?? new JsonArray();
        var oldTiers = data?["oldGemQualities"]?.AsArray() ?? new JsonArray();
        foreach (var (color, def) in data?["gemColors"]?.AsObject() ?? new JsonObject())
        {
            var zhNames = zhPatch?["gemColors"]?[color]?["names"]?.AsArray();
            (string, string) Entry(int t) => ($"{Text(tiers[t])} {Text(def?["name"])}", zhNames != null && t < zhNames.Count ? Text(zhNames[t]) : "");
            for (int t = 0; t < tiers.Count; t++)
                if (Text(def?["id"]) is { Length: > 0 } id) names.TryAdd(D3Gbid.Of(id + (t + 1).ToString(GemTierFormat, CultureInfo.InvariantCulture)), Entry(t));
            for (int o = 0; o < oldTiers.Count; o++)
                if (Text(def?["oldid"]) is { Length: > 0 } oldId && oldTiers[o] is JsonValue ov && ov.TryGetValue(out int t) && t >= 0 && t < tiers.Count)
                    names.TryAdd(D3Gbid.Of(oldId + (o + 1).ToString(GemTierFormat, CultureInfo.InvariantCulture)), Entry(t));
        }
        return names;
    }

    private static PlannerBuild Parse(long id, string url, JsonNode profile, JsonNode data, JsonNode? zh)
    {
        var body = profile["data"] is JsonValue v && v.TryGetValue(out string? text) ? JsonNode.Parse(text)! : profile["data"]!;
        var items = new Dictionary<string, JsonNode>(StringComparer.OrdinalIgnoreCase);
        foreach (var item in data["items"]!.AsArray())
            if (item?["id"]?.GetValue<string>() is { } itemId) items[itemId] = item;
        string cls = Text(profile["class"]) is { Length: > 0 } c ? c : Text(body["class"]);
        var profiles = new List<PlannerProfile>();
        foreach (var p in body["profiles"]?.AsArray() ?? new JsonArray())
        {
            if (p == null) continue;
            string profileClass = Text(p["class"]) is { Length: > 0 } pc ? pc : cls;
            var kanai = new List<PlannerItem>();
            foreach (var (slot, node) in p["kanai"]?.AsObject() ?? new JsonObject())
                if (node is JsonValue kv && kv.TryGetValue(out string? itemId) && itemId.Length > 0)
                    kanai.Add(BuildItem(KanaiSlotPrefix + slot, itemId, 0, null, items, data, zh));
            string follower = Text(p["follower"]);
            profiles.Add(new PlannerProfile(Text(p["name"]), GearItems(p["items"], items, data, zh), kanai)
            {
                Skills = Skills(p["skills"], profileClass, data, zh),
                Passives = Named(p["passives"], key => (data["passives"]?[profileClass]?[key], zh?["passives"]?[profileClass]?[key])),
                ParagonLevel = p["paragon"]?["level"] is JsonValue lv && lv.TryGetValue(out int level) ? level : 0,
                Follower = follower.Length > 0 ? new PlannerNamed(follower, ClassName(data, follower), ClassNameZh(zh, follower)) : null,
                FollowerItems = GearItems(p["followerItems"], items, data, zh),
                FollowerSkills = Named(p["followerSkills"], key => (data["followerSkills"]?[key], zh?["followerSkills"]?[key])),
            });
        }
        int active = body["activeProfile"] is JsonValue a && a.TryGetValue(out int ap) ? ap : 0;
        string name = Text(profile["name"]) is { Length: > 0 } n ? n : Text(body["name"]);
        return new PlannerBuild(id, url, name, cls, profiles, Math.Clamp(active, 0, Math.Max(0, profiles.Count - 1)), DateTime.UtcNow)
        {
            ClassZh = ClassNameZh(zh, cls),
        };
    }

    /// <summary>Gear of one equipment object (hero "items" or "followerItems"): slot -> item with ancient rank, affixes and gems.</summary>
    private static List<PlannerItem> GearItems(JsonNode? gear, Dictionary<string, JsonNode> items, JsonNode data, JsonNode? zh)
    {
        var planned = new List<PlannerItem>();
        foreach (var (slot, node) in gear?.AsObject() ?? new JsonObject())
        {
            if (node?["id"]?.GetValue<string>() is not { Length: > 0 } itemId) continue;
            planned.Add(BuildItem(slot, itemId, AncientRank(node["ancient"]), node["stats"]?.AsObject(), items, data, zh) with
            {
                Gems = Gems(node["gems"], data, zh),
            });
        }
        return planned;
    }

    /// <summary>Skill bar: [skill key, rune letter] per slot in bar order, names from the class skill table.</summary>
    private static List<PlannerSkill> Skills(JsonNode? bar, string cls, JsonNode data, JsonNode? zh)
    {
        var skills = new List<PlannerSkill>();
        int slot = 0;
        foreach (var entry in bar?.AsArray() ?? new JsonArray())
        {
            int index = slot++;
            if (entry is not JsonArray pair || pair.Count == 0 || Text(pair[0]) is not { Length: > 0 } key) continue;
            string rune = pair.Count > 1 ? Text(pair[1]) : "";
            var def = data["skills"]?[cls]?[key];
            var zhDef = zh?["skills"]?[cls]?[key];
            skills.Add(new PlannerSkill(index, key, Text(def?["name"]) is { Length: > 0 } en ? en : key, Text(zhDef?["name"]),
                rune, Text(def?["runes"]?[rune]), Text(zhDef?["runes"]?[rune])));
        }
        return skills;
    }

    /// <summary>Keys of a string array with English / Chinese names from (definition, zh patch) nodes; the key when unknown.</summary>
    private static List<PlannerNamed> Named(JsonNode? keys, Func<string, (JsonNode? Def, JsonNode? Zh)> lookup)
    {
        var named = new List<PlannerNamed>();
        foreach (var k in keys?.AsArray() ?? new JsonArray())
        {
            if (Text(k) is not { Length: > 0 } key) continue;
            var (def, zhDef) = lookup(key);
            named.Add(new PlannerNamed(key, Text(def?["name"]) is { Length: > 0 } en ? en : key, Text(zhDef?["name"])));
        }
        return named;
    }

    /// <summary>
    /// Gems of an item: [quality index, color] for normal gems (quality name + color name, Chinese from the color's names list), or
    /// [legendary gem key, rank].
    /// </summary>
    private static List<PlannerNamed> Gems(JsonNode? gems, JsonNode data, JsonNode? zh)
    {
        var result = new List<PlannerNamed>();
        var qualities = data["gemQualities"]?.AsArray() ?? new JsonArray();
        foreach (var g in gems?.AsArray() ?? new JsonArray())
        {
            if (g is not JsonArray pair || pair.Count < 2) continue;
            if (pair[0] is JsonValue qv && qv.TryGetValue(out int quality))
            {
                string color = Text(pair[1]);
                int q = Math.Clamp(quality, 0, Math.Max(0, qualities.Count - 1));
                var zhNames = zh?["gemColors"]?[color]?["names"]?.AsArray();
                string en = string.Format(CultureInfo.InvariantCulture, GemQualityFormat, Text(qualities.Count > 0 ? qualities[q] : null), Text(data["gemColors"]?[color]?["name"])).Trim();
                result.Add(new PlannerNamed(color, en.Length > 0 ? en : color, zhNames != null && q < zhNames.Count ? Text(zhNames[q]) : ""));
                continue;
            }
            string key = Text(pair[0]);
            if (key.Length == 0) continue;
            string rank = pair[1] is JsonValue rv && rv.TryGetValue(out int r) ? r.ToString(CultureInfo.InvariantCulture) : "";
            string gemEn = Text(data["legendaryGems"]?[key]?["name"]) is { Length: > 0 } ln ? ln : key;
            string gemZh = Text(zh?["legendaryGems"]?[key]?["name"]);
            result.Add(new PlannerNamed(key, string.Format(CultureInfo.InvariantCulture, GemRankFormat, gemEn, rank),
                gemZh.Length > 0 ? string.Format(CultureInfo.InvariantCulture, GemRankFormat, gemZh, rank) : ""));
        }
        return result;
    }

    private static string ClassName(JsonNode data, string key) => Text(data["classes"]?[key]?["name"]) is { Length: > 0 } n ? n : key;

    private static string ClassNameZh(JsonNode? zh, string key) => Text(zh?["classes"]?[key]?["name"]);

    private static PlannerItem BuildItem(string slot, string itemId, int ancientRank, JsonObject? stats,
        Dictionary<string, JsonNode> items, JsonNode data, JsonNode? zh)
    {
        items.TryGetValue(itemId, out var def);
        var ids = new List<string> { itemId };
        foreach (var alt in def?["ids"]?.AsArray() ?? new JsonArray())
            if (alt is JsonValue av && av.TryGetValue(out string? s) && s.Length > 0) ids.Add(s);
        if (def?["realid"] is JsonValue rv && rv.TryGetValue(out string? real) && real.Length > 0) ids.Add(real);
        ids = ids.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        var planned = new List<PlannerStat>();
        foreach (var (code, values) in stats ?? new JsonObject())
        {
            if (FirstNumber(values) is not { } value) continue;
            planned.Add(BuildStat(code, value, itemId, def, data, zh));
        }
        return new PlannerItem(slot,
            Text(data["itemSlots"]?[slot]?["name"]), Text(zh?["itemSlots"]?[slot]?["name"]),
            itemId, ids, ids.Select(D3Gbid.Of).Distinct().ToList(),
            Text(def?["name"]) is { Length: > 0 } en ? en : itemId, Text(zh?["itemById"]?[itemId]?["name"]),
            ancientRank, planned);
    }

    private static PlannerStat BuildStat(string code, double value, string itemId, JsonNode? item, JsonNode data, JsonNode? zh)
    {
        var def = data["stats"]?[code];
        var (en, zhName) = StatNames(code, def, itemId, item, data, zh);
        if (code == StatSockets) return new PlannerStat(code, en, zhName, value, AttributeSockets, null, true, false, value);
        string attrId = Text(def?["id"]);
        if (attrId.Length == 0 || attrId.EndsWith(PairSuffix, StringComparison.Ordinal))
            return new PlannerStat(code, en, zhName, value, null, null, false, false, value);
        string attribute = attrId;
        uint? parameter = null;
        if (AttributeAliases.TryGetValue(attrId, out var alias)) attribute = attrId = alias;
        int hash = attrId.IndexOf(ParameterSeparator);
        if (hash >= 0)
        {
            attribute = attrId[..hash];
            string param = attrId[(hash + 1)..];
            int index = Array.IndexOf(DamageTypes, param);
            if (index < 0) index = Array.IndexOf(ResourceTypes, param);
            if (index < 0) return new PlannerStat(code, en, zhName, value, null, null, false, false, value);
            parameter = (uint)index;
        }
        bool percent = def?["percent"] is JsonValue pv && pv.TryGetValue(out bool isPercent) && isPercent;
        return new PlannerStat(code, en, zhName, value, attribute, parameter, false, percent, percent ? value / PercentDivisor : value);
    }

    /// <summary>
    /// Display names: the stat definition, else for "custom" the item's legendary power, for "skill_class_skill" the skill name
    /// (skill damage affix); the code itself when nothing else is known.
    /// </summary>
    private static (string En, string Zh) StatNames(string code, JsonNode? def, string itemId, JsonNode? item, JsonNode data, JsonNode? zh)
    {
        string en = Text(def?["name"]), zhName = Text(zh?["stats"]?[code]?["name"]);
        if (code == StatCustom)
        {
            en = Text(item?["required"]?["custom"]?["name"]) is { Length: > 0 } power ? power : en;
            zhName = Text(zh?["itemById"]?[itemId]?["required"]?["custom"]?["name"]) is { Length: > 0 } zhPower ? zhPower : zhName;
        }
        else if (code.StartsWith(SkillStatPrefix, StringComparison.Ordinal) && code[SkillStatPrefix.Length..].Split(CodeSeparator, 2) is [var cls, var skill])
        {
            en = Text(data["skills"]?[cls]?[skill]?["name"]) is { Length: > 0 } s ? s : en;
            zhName = Text(zh?["skills"]?[cls]?[skill]?["name"]) is { Length: > 0 } zs ? zs : zhName;
        }
        return (en.Length > 0 ? en : code, zhName.Length > 0 ? zhName : en.Length > 0 ? en : code);
    }

    /// <summary>maxroll "ancient": "primal" -> 2, "ancient" / true -> 1, else 0 (D3 Ancient_Rank).</summary>
    private static int AncientRank(JsonNode? node) => node switch
    {
        JsonValue v when v.TryGetValue(out string? s) => s == AncientPrimal ? 2 : s == AncientAncient ? 1 : 0,
        JsonValue v when v.TryGetValue(out bool b) => b ? 1 : 0,
        _ => 0,
    };

    private static double? FirstNumber(JsonNode? node)
    {
        var first = node is JsonArray arr ? arr.FirstOrDefault() : node;
        return first is JsonValue v && v.TryGetValue(out double d) ? d : null;
    }

    private static string Text(JsonNode? node) => node is JsonValue v && v.TryGetValue(out string? s) ? s : "";
}
