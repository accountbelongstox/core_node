// PY-REF: none (DOT-only)
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using Rcdw32.Ws.Plugins;

namespace CoreNodeBridge;

/// <summary>
/// skills_check command: compares the hero's skills with a maxroll skill set using ROSBOT's own reads (IsActiveSkill / IsActiveRune /
/// IsActivePassiveSkills) and reports the hero level. ROSBOT has no API that changes skills; the app switches them through the game UI
/// and uses this check before (which slots need work, level 70) and after (verification).
/// Value: "class;skill:runeIndex,...;passive,..." with maxroll keys (e.g. "monk;waveoflight:1,...;harmony,..."). maxroll keys map to
/// ROSBOT PowerId names: the class word and the key (letters / digits only, any case) inside the name, passive names for passives;
/// the shortest name without variant words wins (e.g. Monk_WaveOfLight, not an Archon / P74 copy).
/// Message: "level=N;skills=k1:c,k2:c,...;passives=p1:c,..." with c = 1 ok, 0 skill not on the bar, r rune differs, ? unresolved key.
/// </summary>
internal static class SkillCheck
{
    public const string Action = "skills_check";
    private const char PartSeparator = ';';
    private const char ListSeparator = ',';
    private const char PairSeparator = ':';
    private const string AttrLevel = "Level";
    private const string PassiveWord = "passive";
    private const string Ok = "1";
    private const string Missing = "0";
    private const string RuneDiffers = "r";
    private const string Unresolved = "?";
    private const int NoRune = -1;

    /// <summary>maxroll class key -> word in ROSBOT PowerId names.</summary>
    private static readonly Dictionary<string, string> ClassWords = new(StringComparer.OrdinalIgnoreCase)
    {
        ["barbarian"] = "barbarian", ["crusader"] = "crusader", ["demonhunter"] = "demonhunter", ["monk"] = "monk",
        ["necromancer"] = "necro", ["witchdoctor"] = "witchdoctor", ["wizard"] = "wizard",
    };

    /// <summary>Words of PowerId variants (form changes, test / proxy powers) ranked after the plain skill power.</summary>
    private static readonly string[] VariantWords = { "archon", "p74", "proxy", "buff", "debuff", "rune", "dummy", "test", "visual", "damage", "delay", "summon" };

    private static (string Name, int Id)[] _powers;

    public static CommandResult Run(CommandResult result, string value)
    {
        var parts = (value ?? "").Split(PartSeparator);
        string cls = parts.Length > 0 ? parts[0].Trim() : "";
        if (!ClassWords.TryGetValue(cls, out var classWord))
        {
            result.Message = "unknown class: " + cls;
            return result;
        }
        var skills = Items(parts, 1).Select(item =>
        {
            var kv = item.Split(PairSeparator);
            int rune = kv.Length > 1 && int.TryParse(kv[1], NumberStyles.Integer, CultureInfo.InvariantCulture, out int r) ? r : NoRune;
            int? power = Resolve(classWord, kv[0], passive: false);
            string code = power is not { } p ? Unresolved
                : !WorldScanner.Safe(() => LocalPlayer.IsActiveSkill(p), false) ? Missing
                : rune != NoRune && !WorldScanner.Safe(() => LocalPlayer.IsActiveRune(p, rune), false) ? RuneDiffers
                : Ok;
            return kv[0] + PairSeparator + code;
        }).ToList();
        var passives = Items(parts, 2).Select(key =>
        {
            int? power = Resolve(classWord, key, passive: true);
            string code = power is not { } p ? Unresolved : WorldScanner.Safe(() => LocalPlayer.IsActivePassiveSkills(p), false) ? Ok : Missing;
            return key + PairSeparator + code;
        }).ToList();
        int levelId = WorldScanner.AttributeId(AttrLevel);
        int level = levelId == int.MinValue ? 0 : WorldScanner.Safe(() => LocalPlayer.GetAttribute<int>(levelId), 0);
        result.Ok = true;
        result.Message = $"level={level};skills={string.Join(",", skills)};passives={string.Join(",", passives)}";
        return result;
    }

    private static IEnumerable<string> Items(string[] parts, int index) =>
        parts.Length > index ? parts[index].Split(ListSeparator).Select(s => s.Trim()).Where(s => s.Length > 0) : Enumerable.Empty<string>();

    private static int? Resolve(string classWord, string key, bool passive)
    {
        string k = Normalize(key);
        if (k.Length == 0) return null;
        var hit = Powers()
            .Where(p =>
            {
                string n = Normalize(p.Name);
                return n.Contains(classWord) && n.Contains(PassiveWord) == passive && n.Contains(k);
            })
            .OrderBy(p => VariantWords.Count(w => p.Name.IndexOf(w, StringComparison.OrdinalIgnoreCase) >= 0))
            .ThenBy(p => p.Name.Length)
            .FirstOrDefault();
        return hit.Name == null ? null : hit.Id;
    }

    private static (string Name, int Id)[] Powers()
    {
        if (_powers != null) return _powers;
        _powers = WorldScanner.Safe(() => Enum.GetValues(typeof(PowerId)).Cast<object>()
            .Select(v => (Enum.GetName(typeof(PowerId), v), Convert.ToInt32(v, CultureInfo.InvariantCulture))).ToArray(), Array.Empty<(string, int)>());
        return _powers;
    }

    private static string Normalize(string s)
    {
        var sb = new StringBuilder(s.Length);
        foreach (char c in s)
            if (char.IsLetterOrDigit(c)) sb.Append(char.ToLowerInvariant(c));
        return sb.ToString();
    }
}
