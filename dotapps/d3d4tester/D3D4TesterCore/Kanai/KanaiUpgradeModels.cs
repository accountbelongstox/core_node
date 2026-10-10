// PY-REF: none (DOT-only)
using System.Text.Json.Serialization;
using DotApps.d3d4tester.Core.Planner;

namespace DotApps.d3d4tester.Core.Kanai;

/// <summary>Materials of Kanai's Cube recipes (Death's Breath, Reusable Parts, Arcane Dust, Veiled Crystal).</summary>
public readonly record struct KanaiMaterials(long DeathsBreath, long ReusableParts, long ArcaneDust, long VeiledCrystal)
{
    /// <summary>Cost of one "upgrade rare" transmute (one rare item of level 70 plus these).</summary>
    public static readonly KanaiMaterials UpgradeRareCost = new(25, 50, 50, 50);

    public KanaiMaterials Times(long count) => new(DeathsBreath * count, ReusableParts * count, ArcaneDust * count, VeiledCrystal * count);

    public static KanaiMaterials operator +(KanaiMaterials a, KanaiMaterials b) =>
        new(a.DeathsBreath + b.DeathsBreath, a.ReusableParts + b.ReusableParts, a.ArcaneDust + b.ArcaneDust, a.VeiledCrystal + b.VeiledCrystal);

    /// <summary>How many transmutes of the given cost this stock pays for.</summary>
    public long Affords(KanaiMaterials cost) => new[]
    {
        cost.DeathsBreath > 0 ? DeathsBreath / cost.DeathsBreath : long.MaxValue,
        cost.ReusableParts > 0 ? ReusableParts / cost.ReusableParts : long.MaxValue,
        cost.ArcaneDust > 0 ? ArcaneDust / cost.ArcaneDust : long.MaxValue,
        cost.VeiledCrystal > 0 ? VeiledCrystal / cost.VeiledCrystal : long.MaxValue,
    }.Min();
}

/// <summary>When to stop upgrading rares.</summary>
public enum KanaiUpgradeStop
{
    /// <summary>As soon as one target is obtained.</summary>
    AnyTarget,
    /// <summary>When every target is obtained.</summary>
    AllTargets,
    /// <summary>Upgrade every rare (no target; the old "upgrade rares" helper).</summary>
    Never,
}

/// <summary>When the products are recognized.</summary>
public enum KanaiUpgradeCheck
{
    /// <summary>After every transmute (icons of the new item only; OCR only when it looks like a target): stops right away.</summary>
    EachTransmute,
    /// <summary>Once after the whole bag of rares (fastest clicking; the first transmute is still checked to catch missing materials).</summary>
    EachPass,
}

/// <summary>Why a run ended.</summary>
public enum KanaiUpgradeOutcome
{
    TargetReached,
    AllRaresUsed,
    LimitReached,
    NoEffect,
    Stopped,
    NotReady,
}

/// <summary>A wanted item: the planned item (build gear or cube power), minimum ancient rank and the affix codes it must have.</summary>
public sealed record KanaiUpgradeTarget(PlannerItem Item, int MinAncientRank, IReadOnlyList<string> RequiredStats)
{
    public string Key => KeyOf(Item);

    /// <summary>Stable key of a planned item within its gear set (slot + item id).</summary>
    public static string KeyOf(PlannerItem item) => item.Slot + "|" + item.ItemId;

    public IEnumerable<PlannerStat> Required => Item.Stats.Where(s => RequiredStats.Contains(s.Code, StringComparer.Ordinal));
}

/// <summary>Run settings; <see cref="Uncheckable"/> = plugin attribute keys ROSBOT cannot read (D3PlannerService.Uncheckable).</summary>
public sealed record KanaiUpgradeSettings(
    IReadOnlyList<KanaiUpgradeTarget> Targets,
    KanaiUpgradeStop Stop,
    KanaiUpgradeCheck Check,
    bool OnlyCompatibleRares,
    bool VerifyByOcr,
    int MaxTransmutes,
    int HelperDelayMs,
    string CacheDir)
{
    public IReadOnlySet<string>? Uncheckable { get; init; }
}

/// <summary>A rare in the bag with its recognized item type group (empty when unsure) and the targets it can turn into.</summary>
public sealed record KanaiRareCell(int Row, int Col, bool Tall, string Group, double Score, bool NonGear, IReadOnlyList<string> TargetKeys);

/// <summary>A legendary / set item in the bag: best icon guess (null when unsure) and whether it looks like a target.</summary>
public sealed record KanaiLegendaryCell(int Row, int Col, bool Tall, D3CatalogItem? Item, double Score, string? TargetKey);

/// <summary>Bag overview for the hints: rares (upgradable, by type) and legendaries (by icon), from one capture without OCR.</summary>
public sealed record KanaiBagScan(DateTime Utc, bool KanaiOpen, IReadOnlyList<KanaiRareCell> Rares, IReadOnlyList<KanaiLegendaryCell> Legendaries, int Skipped)
{
    public static readonly KanaiBagScan Empty = new(DateTime.MinValue, false, Array.Empty<KanaiRareCell>(), Array.Empty<KanaiLegendaryCell>(), 0);
}

/// <summary>
/// One transmute result: where it landed, what it is (names, icon score / plugin), how it was recognized (plugin / icon / ocr), the
/// target it fulfils (null = none), its ancient rank (-1 unknown) and a detail line (affix checks).
/// </summary>
public sealed record KanaiUpgradeProduct(DateTime Utc, int Row, int Col, string NameEn, string NameZh, string Source, double Score,
    string? TargetKey, bool Satisfied, int AncientRank, string Detail);

/// <summary>A finished run: time span, build / gear set, transmutes, products, outcome and the targets obtained.</summary>
public sealed record KanaiUpgradeRun(DateTime StartUtc, DateTime EndUtc, string Build, string Profile, int Transmutes,
    IReadOnlyList<KanaiUpgradeProduct> Products, KanaiUpgradeOutcome Outcome, IReadOnlyList<string> TargetsReached)
{
    [JsonIgnore] public KanaiMaterials Consumed => KanaiMaterials.UpgradeRareCost.Times(Transmutes);

    [JsonIgnore] public TimeSpan Elapsed => EndUtc - StartUtc;
}

/// <summary>Progress line of a run (UI log): time, kind (i18n stage key suffix) and detail.</summary>
public sealed record KanaiUpgradeEvent(DateTime Time, string Kind, string Detail, bool? Ok = null);
