// PY-REF: none (DOT-only)
using System.Collections.Concurrent;
using System.Text.Json.Nodes;

namespace DotApps.d3d4tester.Core.Planner;

/// <summary>
/// A legendary or set item of the maxroll game data: ids (main + alternates), English / Chinese names, item type (belt, ring, axe2h,
/// ...) and its paper doll slot, and the wiki icon (inventory layout) used to recognize it on screen.
/// </summary>
public sealed record D3CatalogItem(string Id, IReadOnlyList<string> Ids, string NameEn, string NameZh, string Type, string Slot, bool IsSet, string? WikiIcon)
{
    /// <summary>Icon group (item type folder of the wiki library); empty without an icon.</summary>
    public string Group => WikiIcon is { } path ? D3ItemIcons.GroupOf(path) : "";
}

/// <summary>A non-gear item of the game data (gem, legendary gem, potion, material, key): names only; never transmuted.</summary>
public sealed record D3CatalogOther(string Id, string NameEn, string NameZh, string Kind);

/// <summary>
/// Static item resources from the cached maxroll game data (PlannerData/game, versioned with the code): every legendary and set item
/// with its type and icon, the item type names, and the gems, legendary gems, potions and materials (kept apart so that recipes skip
/// them). Kanai's Cube "upgrade rare" turns a rare into a legendary / set item of the same type, so <see cref="OfType"/> lists the
/// possible results of a rare of that type. One catalog per cache dir, built on first use.
/// </summary>
public sealed class D3ItemCatalog
{
    public const string QualityLegendary = "legendary";
    public const string QualitySet = "set";
    public const string KindGem = "gem";
    public const string KindLegendaryGem = "legendary_gem";
    public const string KindPotion = "potion";
    public const string KindMaterial = "material";
    private static readonly ConcurrentDictionary<string, Lazy<D3ItemCatalog>> Catalogs = new(StringComparer.OrdinalIgnoreCase);

    private readonly Dictionary<string, D3CatalogItem> _byId = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, D3CatalogItem> _byName = new(StringComparer.Ordinal);
    private readonly Dictionary<string, List<D3CatalogItem>> _byType = new(StringComparer.Ordinal);
    private readonly Dictionary<string, string> _groupOfType = new(StringComparer.Ordinal);

    private D3ItemCatalog(JsonNode? data, JsonNode? zh)
    {
        var zhItems = zh?["itemById"];
        var types = data?["itemTypes"]?.AsObject() ?? new JsonObject();
        foreach (var (type, def) in types)
            TypeNames[type] = (Text(def?["name"]), Text(zh?["itemTypes"]?[type]?["name"]));
        var equipment = new List<D3CatalogItem>();
        foreach (var node in data?["items"]?.AsArray() ?? new JsonArray())
        {
            string quality = Text(node?["quality"]);
            if (quality is not (QualityLegendary or QualitySet) || Text(node?["id"]) is not { Length: > 0 } id) continue;
            var ids = new List<string> { id };
            foreach (var alt in node!["ids"]?.AsArray() ?? new JsonArray())
                if (Text(alt) is { Length: > 0 } a) ids.Add(a);
            string type = Text(node["type"]);
            string nameEn = Text(node["name"]);
            var item = new D3CatalogItem(id, ids, nameEn, Text(zhItems?[id]?["name"]), type, Text(types[type]?["slot"]), quality == QualitySet,
                D3ItemIcons.FindWikiPath(nameEn));
            equipment.Add(item);
            foreach (var i in ids) _byId.TryAdd(i, item);
            _byName.TryAdd(D3ItemIcons.Key(nameEn), item);
            if (item.NameZh.Length > 0) _byName.TryAdd(item.NameZh, item);
            if (!_byType.TryGetValue(type, out var list)) _byType[type] = list = new List<D3CatalogItem>();
            list.Add(item);
        }
        Equipment = equipment;
        foreach (var (type, items) in _byType)
            if (items.Where(i => i.Group.Length > 0).GroupBy(i => i.Group).OrderByDescending(g => g.Count()).FirstOrDefault() is { } best)
                _groupOfType[type] = best.Key;
        var others = new List<D3CatalogOther>();
        foreach (var (key, gem) in data?["legendaryGems"]?.AsObject() ?? new JsonObject())
            others.Add(new D3CatalogOther(Text(gem?["id"]), Text(gem?["name"]), Text(zh?["legendaryGems"]?[key]?["name"]), KindLegendaryGem));
        foreach (var (_, gem) in data?["gemColors"]?.AsObject() ?? new JsonObject())
            others.Add(new D3CatalogOther(Text(gem?["id"]), Text(gem?["name"]), "", KindGem));
        foreach (var node in data?["potions"]?.AsArray() ?? new JsonArray())
            others.Add(new D3CatalogOther(Text(node?["id"]), Text(node?["name"]), Text(zhItems?[Text(node?["id"])]?["name"]), KindPotion));
        foreach (var node in data?["extraItems"]?.AsArray() ?? new JsonArray())
            others.Add(new D3CatalogOther(Text(node?["id"]), Text(node?["name"]), Text(zhItems?[Text(node?["id"])]?["name"]), KindMaterial));
        Others = others;
    }

    /// <summary>Catalog of a planner cache dir (empty until the game data is cached there).</summary>
    public static D3ItemCatalog For(string cacheDir) => Catalogs.GetOrAdd(cacheDir, dir => new Lazy<D3ItemCatalog>(() =>
    {
        var (data, zh) = MaxrollD3PlannerClient.GameData(dir);
        return new D3ItemCatalog(data, zh);
    })).Value;

    /// <summary>Every legendary and set item.</summary>
    public IReadOnlyList<D3CatalogItem> Equipment { get; }

    /// <summary>Gems, legendary gems, potions and materials.</summary>
    public IReadOnlyList<D3CatalogOther> Others { get; }

    /// <summary>Item type -> (English, Chinese) name.</summary>
    public Dictionary<string, (string En, string Zh)> TypeNames { get; } = new(StringComparer.Ordinal);

    public D3CatalogItem? ById(string id) => _byId.GetValueOrDefault(id);

    /// <summary>Item by English (any case / punctuation) or exact Chinese name.</summary>
    public D3CatalogItem? ByName(string name) => _byName.GetValueOrDefault(name) ?? _byName.GetValueOrDefault(D3ItemIcons.Key(name));

    /// <summary>The catalog entry of a planned item (its ids, else its names).</summary>
    public D3CatalogItem? Of(PlannerItem item) =>
        item.ItemIds.Prepend(item.ItemId).Select(ById).FirstOrDefault(i => i != null) ?? ByName(item.NameEn) ?? ByName(item.NameZh);

    /// <summary>Legendary and set items of one type: the possible results of upgrading a rare of that type.</summary>
    public IReadOnlyList<D3CatalogItem> OfType(string type) => _byType.TryGetValue(type, out var list) ? list : Array.Empty<D3CatalogItem>();

    /// <summary>Icon group (wiki folder) most items of the type use; null when none has an icon.</summary>
    public string? GroupOfType(string type) => _groupOfType.GetValueOrDefault(type);

    /// <summary>Item types whose icons live in the group (a recognized rare's possible types).</summary>
    public IReadOnlyList<string> TypesOfGroup(string group) => _groupOfType.Where(kv => kv.Value == group).Select(kv => kv.Key).ToList();

    public (string En, string Zh) TypeName(string type) => TypeNames.TryGetValue(type, out var n) ? n : (type, "");

    private static string Text(JsonNode? node) => node is JsonValue v && v.TryGetValue(out string? s) ? s : "";
}
