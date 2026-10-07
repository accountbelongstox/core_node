// PY-REF: none (DOT-only)
using System.Text.RegularExpressions;

namespace DotApps.d3d4tester.Core.Planner;

/// <summary>
/// Pairs items seen in game with a planner profile. Identity: GameBalanceId (D3Gbid of the maxroll ids), else the actor internal
/// name without its "-1234" instance suffix, else the localized display name (Chinese / English planner names). Then the ancient
/// rank (primal / ancient) and every checkable affix: present and at least StatTolerance of the planned value.
/// </summary>
public static class D3PlannerMatcher
{
    /// <summary>Rolled affixes below the planned (usually perfect) roll still count from this share of it.</summary>
    public const double StatTolerance = 0.9;
    private static readonly Regex InstanceSuffix = new(@"-\d+$", RegexOptions.CultureInvariant);

    /// <summary>uncheckable: watch keys the plugin could not resolve in ROSBOT's AttributeId enum (reported as not checkable).</summary>
    public static PlannerMatch? Match(IEnumerable<PlannerItem> planned, ObservedItem observed, IReadOnlySet<string>? uncheckable = null)
    {
        var item = planned.FirstOrDefault(p => IsSameItem(p, observed));
        return item == null ? null : Evaluate(item, observed, uncheckable);
    }

    public static bool IsSameItem(PlannerItem planned, ObservedItem observed)
    {
        if (observed.Gbid != 0 && planned.Gbids.Contains(observed.Gbid)) return true;
        string internalName = NormalizeName(observed.InternalName);
        if (internalName.Length > 0 && planned.ItemIds.Contains(internalName, StringComparer.OrdinalIgnoreCase)) return true;
        string name = observed.Name.Trim();
        return name.Length > 0 && (string.Equals(name, planned.NameZh, StringComparison.Ordinal) || string.Equals(name, planned.NameEn, StringComparison.OrdinalIgnoreCase));
    }

    public static PlannerMatch Evaluate(PlannerItem planned, ObservedItem observed, IReadOnlySet<string>? uncheckable = null)
    {
        var stats = planned.Stats.Select(s =>
        {
            if (s.WatchKey is not { } key || observed.Attrs == null || uncheckable?.Contains(key) == true) return new PlannerStatResult(s, null, null);
            double? actual = observed.Attrs.TryGetValue(key, out double v) ? v : null;
            return new PlannerStatResult(s, actual, actual is { } a && a >= s.AttributeValue * StatTolerance);
        }).ToList();
        return new PlannerMatch(planned, observed, observed.AncientRank >= planned.AncientRank, stats);
    }

    public static string NormalizeName(string internalName) => InstanceSuffix.Replace((internalName ?? "").Trim(), "");
}
