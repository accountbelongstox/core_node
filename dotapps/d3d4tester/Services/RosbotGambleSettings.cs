// PY-REF: none (DOT-only)
using System.Globalization;
using System.IO;
using System.Text.Json;
using DotApps.d3d4tester.Core.Planner;
using DotCore.Foundations;
using DotCore.Utils;

namespace DotApps.d3d4tester.Services;

/// <summary>
/// ROSBOT's Kadala gambling (Documents/RoS-BoT/RosBotGamblingSettings.ini) driven by the d3planner gear set: Apply enables exactly the
/// item types of the unaligned planned items and sets GambleShardsMin to the hero's shard cap, so ROSBOT's town run gambles them when
/// the blood shards are full. The user's own values are saved once (d3planner/rosbot_gamble_backup.json) and Restore writes them back
/// when every item is aligned or the option is off. The INI is only written when the wanted values change.
/// </summary>
public static class RosbotGambleSettings
{
    private const string LogTag = "[RosbotGamble]";
    private const string BackupFileName = "rosbot_gamble_backup.json";
    private const string KeyShardsMin = "GambleShardsMin";
    private const string KeyOneHand = "Gamble1HWeapons";
    private const string KeyTwoHand = "Gamble2HWeapons";
    private const string KeyQuivers = "GambleQuivers";
    private const string KeyMojos = "GambleMojos";
    private const string KeyOrbs = "GambleWizardOrbs";
    private const string KeyShields = "GambleShields";
    private const string KeyPhylactery = "GamblePhylactery";
    private const string SlotMainHand = "mainhand";
    private const string SlotOffHand = "offhand";
    private const string ValueTrue = "True";
    private const string ValueFalse = "False";
    private const string Restored = "restored";

    private static readonly IReadOnlyDictionary<string, string> SlotKeys = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["head"] = "GambleHelmets", ["torso"] = "GambleChestArmors", ["hands"] = "GambleGloves", ["shoulders"] = "GambleShoulders",
        ["legs"] = "GamblePants", ["feet"] = "GambleBoots", ["waist"] = "GambleBelts", ["wrists"] = "GambleBracers",
        ["neck"] = "GambleAmulets", ["leftfinger"] = "GambleRings", ["rightfinger"] = "GambleRings",
    };

    /// <summary>Off-hand item type by maxroll class (name fragment); other classes dual wield one-handed weapons.</summary>
    private static readonly (string Class, string Key)[] OffHandKeys =
    {
        ("necro", KeyPhylactery), ("wizard", KeyOrbs), ("witch", KeyMojos), ("demon", KeyQuivers), ("crusader", KeyShields),
    };

    private static readonly string[] CategoryKeys =
        SlotKeys.Values.Concat(new[] { KeyOneHand, KeyTwoHand, KeyQuivers, KeyMojos, KeyOrbs, KeyShields, KeyPhylactery }).Distinct().ToArray();

    private static readonly object Lock = new();
    private static string? _applied;
    private static bool _missingLogged;

    private static string BackupPath => Path.Combine(D3PlannerService.UserCacheDir, BackupFileName);

    /// <summary>ROSBOT gamble key for a planned item; null for slots Kadala does not sell.</summary>
    public static string? KeyFor(PlannerItem item, PlannerProfile profile, string buildClass)
    {
        if (SlotKeys.TryGetValue(item.Slot, out var key)) return key;
        if (item.Slot == SlotMainHand) return profile.Items.Any(i => i.Slot == SlotOffHand) ? KeyOneHand : KeyTwoHand;
        if (item.Slot != SlotOffHand) return null;
        string cls = (buildClass ?? "").ToLowerInvariant();
        return OffHandKeys.FirstOrDefault(k => cls.Contains(k.Class, StringComparison.Ordinal)).Key ?? KeyOneHand;
    }

    /// <summary>Gamble only these keys, from shardsMin (0 = keep ROSBOT's value).</summary>
    public static void Apply(IReadOnlySet<string> enabled, int shardsMin)
    {
        string wanted = string.Join(",", enabled.OrderBy(k => k, StringComparer.Ordinal)) + "|" + shardsMin.ToString(CultureInfo.InvariantCulture);
        lock (Lock)
        {
            if (wanted == _applied) return;
            string path = RosbotLogPaths.GetGamblingSettingsPath();
            if (!File.Exists(path))
            {
                if (!_missingLogged) ColorPrinter.Yellow($"{LogTag} {path} not found, gambling not driven");
                _missingLogged = true;
                return;
            }
            try
            {
                SaveBackup(path);
                foreach (string key in CategoryKeys) IniFileEditor.SetValue(path, key, enabled.Contains(key) ? ValueTrue : ValueFalse, CategoryKeys);
                if (shardsMin > 0) IniFileEditor.SetValue(path, KeyShardsMin, shardsMin.ToString(CultureInfo.InvariantCulture), CategoryKeys);
                _applied = wanted;
                ColorPrinter.Blue($"{LogTag} gamble {string.Join(", ", enabled)} from {(shardsMin > 0 ? shardsMin.ToString(CultureInfo.InvariantCulture) : "ROSBOT's minimum")} shards");
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException)
            {
                ColorPrinter.Yellow($"{LogTag} {path} not written: {ex.Message}");
            }
        }
    }

    /// <summary>Put the user's own gamble values back (no-op when nothing was changed).</summary>
    public static void Restore()
    {
        lock (Lock)
        {
            if (_applied == Restored) return;
            string backup = BackupPath, path = RosbotLogPaths.GetGamblingSettingsPath();
            try
            {
                if (File.Exists(backup) && File.Exists(path))
                {
                    var values = JsonSerializer.Deserialize<Dictionary<string, string>>(File.ReadAllText(backup)) ?? new();
                    foreach (var (key, value) in values) IniFileEditor.SetValue(path, key, value, CategoryKeys);
                    File.Delete(backup);
                    ColorPrinter.Blue($"{LogTag} own gamble settings restored");
                }
                _applied = Restored;
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException)
            {
                ColorPrinter.Yellow($"{LogTag} gamble settings not restored: {ex.Message}");
            }
        }
    }

    private static void SaveBackup(string path)
    {
        string backup = BackupPath;
        if (File.Exists(backup)) return;
        var values = CategoryKeys.Append(KeyShardsMin)
            .Select(k => (Key: k, Value: IniFileEditor.GetValue(path, k)))
            .Where(v => v.Value != null)
            .ToDictionary(v => v.Key, v => v.Value!);
        Directory.CreateDirectory(Path.GetDirectoryName(backup)!);
        File.WriteAllText(backup, JsonSerializer.Serialize(values));
    }
}
