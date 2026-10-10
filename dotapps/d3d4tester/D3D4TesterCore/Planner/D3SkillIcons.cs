// PY-REF: none (DOT-only)
using System.Globalization;
using System.IO;
using System.Text.Json.Nodes;
using DotCore.Foundations;
using DotCore.Utils;
using OpenCvSharp;

namespace DotApps.d3d4tester.Core.Planner;

/// <summary>
/// Skill and passive icons of a class in the planner cache (icons/skills/&lt;class&gt;/&lt;key&gt;.png, icons/passives/&lt;class&gt;/&lt;key&gt;.png),
/// cut from maxroll's per-class sprite sheets (kept in icons/sheets): active sheet = 5 columns of IconPx squares, a skill at
/// (col, row) at x = col * IconPx, y = row * ActiveRowStepPx (each row also holds the inactive variant below); passive sheet = one row,
/// a passive at x = index * IconPx. Positions come from the game data (skills.&lt;class&gt;.&lt;key&gt;.row / col, passives.&lt;class&gt;.&lt;key&gt;.index).
/// Used by the UI and by the image method of the skill switch (template match on screen).
/// </summary>
public static class D3SkillIcons
{
    private const string SheetUrlFormat = "https://planner-assets.com/d3planner/static/media/{0}";
    private const string ActiveSheetFormat = "class-{0}.png";
    private const string PassiveSheetFormat = "class-{0}-passive.png";
    private const string IconsDirName = "icons";
    private const string SheetsDirName = "sheets";
    private const string SkillsDirName = "skills";
    private const string PassivesDirName = "passives";
    private const string IconExtension = ".png";
    private const int IconPx = 42;
    private const int ActiveRowStepPx = 84;
    private const string LogTag = "[SkillIcons]";
    /// <summary>Sheets change only with new game content; the cached copy travels with the code.</summary>
    private static readonly TimeSpan SheetMaxAge = TimeSpan.FromDays(365);

    /// <summary>Suffix of an icon learned from the game screen (some game art differs from maxroll's sheet): key.game.png next to key.png.</summary>
    public const string GameVariantSuffix = ".game";

    /// <summary>Learned game-art variant of an icon file (key.png -> key.game.png).</summary>
    public static string GameVariantPath(string iconPath) =>
        Path.Combine(Path.GetDirectoryName(iconPath) ?? "", Path.GetFileNameWithoutExtension(iconPath) + GameVariantSuffix + IconExtension);

    public static string SkillIconPath(string cacheDir, string cls, string key) =>
        Path.Combine(cacheDir, IconsDirName, SkillsDirName, cls, key + IconExtension);

    public static string PassiveIconPath(string cacheDir, string cls, string key) =>
        Path.Combine(cacheDir, IconsDirName, PassivesDirName, cls, key + IconExtension);

    /// <summary>Every skill and passive icon of the class exists (sheets downloaded once, missing icons cut); number of icons written.</summary>
    public static async Task<int> EnsureAsync(string cacheDir, string cls, CancellationToken ct = default)
    {
        string dataPath = MaxrollD3PlannerClient.DataPath(cacheDir);
        if (string.IsNullOrEmpty(cls) || !File.Exists(dataPath)) return 0;
        var data = JsonNode.Parse(await File.ReadAllTextAsync(dataPath, ct).ConfigureAwait(false));
        var skills = data?["skills"]?[cls]?.AsObject();
        var passives = data?["passives"]?[cls]?.AsObject();
        int written = 0;
        if (skills != null && skills.Any(kv => !File.Exists(SkillIconPath(cacheDir, cls, kv.Key))))
            written += await CutAsync(cacheDir, string.Format(CultureInfo.InvariantCulture, ActiveSheetFormat, cls), skills,
                def => (Int(def?["col"]) * IconPx, Int(def?["row"]) * ActiveRowStepPx), key => SkillIconPath(cacheDir, cls, key), ct).ConfigureAwait(false);
        if (passives != null && passives.Any(kv => !File.Exists(PassiveIconPath(cacheDir, cls, kv.Key))))
            written += await CutAsync(cacheDir, string.Format(CultureInfo.InvariantCulture, PassiveSheetFormat, cls), passives,
                def => (Int(def?["index"]) * IconPx, 0), key => PassiveIconPath(cacheDir, cls, key), ct).ConfigureAwait(false);
        if (written > 0) ColorPrinter.Gray($"{LogTag} {cls}: {written} icon(s) cut into {Path.Combine(cacheDir, IconsDirName)}");
        return written;
    }

    private static async Task<int> CutAsync(string cacheDir, string sheetName, JsonObject defs, Func<JsonNode?, (int X, int Y)> origin,
        Func<string, string> target, CancellationToken ct)
    {
        string sheetPath = Path.Combine(cacheDir, IconsDirName, SheetsDirName, sheetName);
        Directory.CreateDirectory(Path.GetDirectoryName(sheetPath)!);
        if (await HttpFileCache.GetCachedAsync(string.Format(CultureInfo.InvariantCulture, SheetUrlFormat, sheetName), sheetPath, SheetMaxAge, ct).ConfigureAwait(false) is not { } path)
        {
            ColorPrinter.Yellow($"{LogTag} sheet {sheetName} not available");
            return 0;
        }
        using var sheet = Cv2.ImRead(path, ImreadModes.Unchanged);
        if (sheet.Empty()) return 0;
        int written = 0;
        foreach (var (key, def) in defs)
        {
            string file = target(key);
            if (File.Exists(file)) continue;
            var (x, y) = origin(def);
            if (x < 0 || y < 0 || x + IconPx > sheet.Cols || y + IconPx > sheet.Rows) continue;
            Directory.CreateDirectory(Path.GetDirectoryName(file)!);
            using var icon = new Mat(sheet, new Rect(x, y, IconPx, IconPx));
            if (Cv2.ImWrite(file, icon)) written++;
        }
        return written;
    }

    private static int Int(JsonNode? node) => node is JsonValue v && v.TryGetValue(out int i) ? i : -1;
}
