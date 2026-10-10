// PY-REF: none (DOT-only)
using System.Collections.Concurrent;
using System.Globalization;
using System.IO;
using System.Text.Json.Nodes;
using DotCore.Foundations;
using DotCore.Utils;

namespace DotApps.d3d4tester.Core.Planner;

/// <summary>
/// maxroll's item icons as static resources in the planner cache (icons/items/&lt;icon id&gt;.png, versioned with the code): the game data
/// maps item ids to icon ids (itemIcons.&lt;id&gt; = [variant, icon id]; extraItems carry their own icon), and maxroll serves each icon in
/// the inventory layout (64x128 for a two-cell item), so they serve on-screen recognition too. <see cref="EnsureAsync"/> downloads the
/// missing icons of every legendary / set item, gem, legendary gem, potion and material once.
/// </summary>
public static class D3MaxrollItemIcons
{
    private const string UrlFormat = "https://d3planner-assets.maxroll.gg/icons/{0}.png";
    private const string IconsDirName = "icons";
    private const string ItemsDirName = "items";
    private const string IconExtension = ".png";
    private const int ParallelDownloads = 6;
    private const string LogTag = "[MaxrollItemIcons]";
    /// <summary>An icon never changes once published.</summary>
    private static readonly TimeSpan MaxAge = TimeSpan.FromDays(3650);
    private static readonly ConcurrentDictionary<string, byte> Running = new(StringComparer.OrdinalIgnoreCase);

    public static string PathOf(string cacheDir, long iconId) =>
        Path.Combine(cacheDir, IconsDirName, ItemsDirName, iconId.ToString(CultureInfo.InvariantCulture) + IconExtension);

    /// <summary>Icon id of an item id from the game data (itemIcons), null when it has none.</summary>
    public static long? IconId(JsonNode? data, string id) =>
        data?["itemIcons"]?[id] is JsonArray { Count: >= 2 } entry && entry[1] is JsonValue v && v.TryGetValue(out long icon) ? icon : null;

    /// <summary>Download the missing icons (items, gems, potions, materials); number written. Concurrent calls for one dir run once.</summary>
    public static async Task<int> EnsureAsync(string cacheDir, CancellationToken ct = default)
    {
        if (!Running.TryAdd(cacheDir, 0)) return 0;
        try
        {
            var (data, _) = MaxrollD3PlannerClient.GameData(cacheDir);
            if (data == null) return 0;
            var missing = IconIds(data).Distinct().Where(id => !File.Exists(PathOf(cacheDir, id))).ToList();
            if (missing.Count == 0) return 0;
            int written = 0;
            using var gate = new SemaphoreSlim(ParallelDownloads);
            await Task.WhenAll(missing.Select(async id =>
            {
                await gate.WaitAsync(ct).ConfigureAwait(false);
                try
                {
                    if (await HttpFileCache.GetCachedAsync(string.Format(CultureInfo.InvariantCulture, UrlFormat, id), PathOf(cacheDir, id), MaxAge, ct).ConfigureAwait(false) != null)
                        Interlocked.Increment(ref written);
                }
                finally
                {
                    gate.Release();
                }
            })).ConfigureAwait(false);
            ColorPrinter.Gray($"{LogTag} {written} of {missing.Count} missing icon(s) written to {Path.Combine(cacheDir, IconsDirName, ItemsDirName)}");
            return written;
        }
        finally
        {
            Running.TryRemove(cacheDir, out _);
        }
    }

    /// <summary>Icon ids of every legendary / set item, gem (all tiers), legendary gem, potion and material of the game data.</summary>
    private static IEnumerable<long> IconIds(JsonNode data)
    {
        foreach (var item in data["items"]?.AsArray() ?? new JsonArray())
            if (Text(item?["quality"]) is D3ItemCatalog.QualityLegendary or D3ItemCatalog.QualitySet && FirstIcon(data, item) is { } icon)
                yield return icon;
        foreach (var item in data["potions"]?.AsArray() ?? new JsonArray())
            if (FirstIcon(data, item) is { } icon) yield return icon;
        foreach (var item in data["extraItems"]?.AsArray() ?? new JsonArray())
            if (item?["icon"] is JsonValue v && v.TryGetValue(out long icon)) yield return icon;
            else if (FirstIcon(data, item) is { } other) yield return other;
        foreach (var (_, gem) in data["legendaryGems"]?.AsObject() ?? new JsonObject())
            if (IconId(data, Text(gem?["id"])) is { } icon) yield return icon;
        var prefixes = (data["gemColors"]?.AsObject() ?? new JsonObject())
            .SelectMany(kv => new[] { Text(kv.Value?["id"]), Text(kv.Value?["oldid"]) }).Where(p => p.Length > 0).ToList();
        foreach (var (key, _) in data["itemIcons"]?.AsObject() ?? new JsonObject())
            if (prefixes.Any(p => key.StartsWith(p, StringComparison.Ordinal)) && IconId(data, key) is { } icon) yield return icon;
    }

    /// <summary>Icon of an item record: its id, else its alternate ids.</summary>
    internal static long? FirstIcon(JsonNode data, JsonNode? item)
    {
        if (item == null) return null;
        if (IconId(data, Text(item["id"])) is { } icon) return icon;
        foreach (var alt in item["ids"]?.AsArray() ?? new JsonArray())
            if (IconId(data, Text(alt)) is { } a) return a;
        return null;
    }

    private static string Text(JsonNode? node) => node is JsonValue v && v.TryGetValue(out string? s) ? s : "";
}
