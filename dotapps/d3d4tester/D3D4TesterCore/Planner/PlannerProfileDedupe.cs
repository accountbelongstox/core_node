// PY-REF: none (DOT-only)
using System.Globalization;
using System.Text;

namespace DotApps.d3d4tester.Core.Planner;

/// <summary>
/// Duplicate gear sets across builds: two gear sets are the same when every skill with its rune, every passive, every item (slot,
/// item, ancient rank, gems, affixes with values), the Kanai's Cube powers and the follower (type, items, skills) are equal; the name,
/// the build URL and the paragon level do not count. Builds are walked in list order: a later build loses its gear sets already
/// present earlier (or earlier in itself), a build left without gear sets is dropped.
/// </summary>
public static class PlannerProfileDedupe
{
    private const char FieldSeparator = '|';
    private const char ListSeparator = ';';
    private const char SectionSeparator = '\n';
    private const string ValueFormat = "R";

    /// <summary>Content fingerprint of a gear set (equal text = duplicate gear set).</summary>
    public static string Signature(PlannerProfile profile)
    {
        var sb = new StringBuilder();
        Section(sb, profile.Skills.OrderBy(s => s.SlotIndex).Select(s => Join(s.SlotIndex.ToString(CultureInfo.InvariantCulture), s.Id, s.Rune)));
        Section(sb, profile.Passives.Select(p => p.Id).OrderBy(id => id, StringComparer.Ordinal));
        Section(sb, Items(profile.Items));
        Section(sb, Items(profile.Kanai));
        Section(sb, new[] { profile.Follower?.Id ?? "" });
        Section(sb, Items(profile.FollowerItems));
        Section(sb, profile.FollowerSkills.Select(s => s.Id).OrderBy(id => id, StringComparer.Ordinal));
        return sb.ToString();
    }

    /// <summary>
    /// Builds with every duplicate gear set removed (first occurrence kept, list order) and builds left empty dropped; removed counts
    /// duplicate gear sets per build id (for the log / UI).
    /// </summary>
    public static List<PlannerBuild> Apply(IEnumerable<PlannerBuild> builds, out Dictionary<long, int> removed)
    {
        removed = new Dictionary<long, int>();
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var result = new List<PlannerBuild>();
        foreach (var build in builds)
        {
            var kept = new List<PlannerProfile>();
            int keptActive = 0;
            for (int i = 0; i < build.Profiles.Count; i++)
            {
                if (!seen.Add(Signature(build.Profiles[i])))
                {
                    removed[build.Id] = removed.GetValueOrDefault(build.Id) + 1;
                    continue;
                }
                if (i == build.ActiveProfile) keptActive = kept.Count;
                kept.Add(build.Profiles[i]);
            }
            if (kept.Count == 0) continue;
            result.Add(kept.Count == build.Profiles.Count ? build : build with { Profiles = kept, ActiveProfile = keptActive });
        }
        return result;
    }

    private static IEnumerable<string> Items(IEnumerable<PlannerItem> items) =>
        items.Select(i => Join(
                i.Slot,
                i.ItemId,
                i.AncientRank.ToString(CultureInfo.InvariantCulture),
                string.Join(ListSeparator, i.Gems.Select(g => g.Id + "=" + g.NameEn)),
                string.Join(ListSeparator, i.Stats.Select(s => s.Code + "=" + s.Value.ToString(ValueFormat, CultureInfo.InvariantCulture)).OrderBy(x => x, StringComparer.Ordinal))))
            .OrderBy(x => x, StringComparer.Ordinal);

    private static string Join(params string[] fields) => string.Join(FieldSeparator, fields);

    private static void Section(StringBuilder sb, IEnumerable<string> lines) => sb.Append(string.Join(ListSeparator, lines)).Append(SectionSeparator);
}
