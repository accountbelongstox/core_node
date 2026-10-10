// PY-REF: none (DOT-only)
namespace DotApps.d3d4tester.Core.Planner;

/// <summary>
/// One planned affix: maxroll stat code, display names, planned value (maxroll units) and, when the game exposes it, the D3 attribute
/// (ROSBOT AttributeId name + parameter) with the planned value converted to attribute units. Attribute null = not checkable in game.
/// </summary>
public sealed record PlannerStat(
    string Code,
    string NameEn,
    string NameZh,
    double Value,
    string? Attribute,
    uint? Parameter,
    bool IsInt,
    bool Percent,
    double AttributeValue)
{
    /// <summary>Key under which the plugin publishes this attribute ("Resistance#1", "Crit_Damage_Percent").</summary>
    public string? WatchKey => Attribute == null ? null : Parameter is { } p ? $"{Attribute}#{p}" : Attribute;
}

/// <summary>A named planner entry (passive, follower skill, gem): maxroll key and English / Chinese names.</summary>
public sealed record PlannerNamed(string Id, string NameEn, string NameZh);

/// <summary>An active skill on a skill bar slot (0 = left mouse ... 5 = action key 4) with its rune.</summary>
public sealed record PlannerSkill(int SlotIndex, string Id, string NameEn, string NameZh, string Rune, string RuneNameEn, string RuneNameZh);

/// <summary>A planned item in one slot: item ids (main + alternates), GBIDs, names, required ancient rank (0 / 1 ancient / 2 primal), affixes.</summary>
public sealed record PlannerItem(
    string Slot,
    string SlotNameEn,
    string SlotNameZh,
    string ItemId,
    IReadOnlyList<string> ItemIds,
    IReadOnlyList<int> Gbids,
    string NameEn,
    string NameZh,
    int AncientRank,
    IReadOnlyList<PlannerStat> Stats)
{
    /// <summary>Socketed gems (normal gem with its quality, or legendary gem with its rank).</summary>
    public IReadOnlyList<PlannerNamed> Gems { get; init; } = Array.Empty<PlannerNamed>();
}

/// <summary>
/// One gear profile of the build (maxroll lets a build hold several): hero gear and Kanai's Cube, skill bar, passives, paragon level,
/// and the follower (type, gear, skills).
/// </summary>
public sealed record PlannerProfile(string Name, IReadOnlyList<PlannerItem> Items, IReadOnlyList<PlannerItem> Kanai)
{
    public IReadOnlyList<PlannerSkill> Skills { get; init; } = Array.Empty<PlannerSkill>();
    public IReadOnlyList<PlannerNamed> Passives { get; init; } = Array.Empty<PlannerNamed>();
    public int ParagonLevel { get; init; }
    public PlannerNamed? Follower { get; init; }
    public IReadOnlyList<PlannerItem> FollowerItems { get; init; } = Array.Empty<PlannerItem>();
    public IReadOnlyList<PlannerNamed> FollowerSkills { get; init; } = Array.Empty<PlannerNamed>();
}

/// <summary>A maxroll d3planner build: id, source URL, name, class and its profiles.</summary>
public sealed record PlannerBuild(long Id, string Url, string Name, string Class, IReadOnlyList<PlannerProfile> Profiles, int ActiveProfile, DateTime LoadedUtc)
{
    /// <summary>Chinese class name from the planner locale (empty when unknown).</summary>
    public string ClassZh { get; init; } = "";
}

/// <summary>One item seen in game (bridge plugin): identity fields and the watched affix values.</summary>
public sealed record ObservedItem(int Gbid, string InternalName, string Name, int AncientRank, IReadOnlyDictionary<string, double>? Attrs);

/// <summary>How well an observed item fits a planned one; stat results are null for affixes the game data cannot show.</summary>
public sealed record PlannerStatResult(PlannerStat Stat, double? Actual, bool? Ok);

public sealed record PlannerMatch(PlannerItem Planned, ObservedItem Observed, bool AncientOk, IReadOnlyList<PlannerStatResult> Stats)
{
    public int CheckedStats => Stats.Count(s => s.Ok != null);

    public int OkStats => Stats.Count(s => s.Ok == true);

    /// <summary>Right item, right ancient rank and every checkable affix present with at least the planned value.</summary>
    public bool Perfect => AncientOk && Stats.All(s => s.Ok != false);
}
