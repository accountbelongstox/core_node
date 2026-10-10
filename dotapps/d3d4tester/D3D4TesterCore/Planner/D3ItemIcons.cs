// PY-REF: none (DOT-only)
using System.IO;
using System.Text;

namespace DotApps.d3d4tester.Core.Planner;

/// <summary>A wiki library icon: file, group (its folder, one item type such as Diablo_III_belt_icons) and name key.</summary>
public sealed record D3IconEntry(string Path, string Group, string Key);

/// <summary>
/// Item and gem icons by English name from the icon libraries in the template dir: maxroll planner icons
/// (maxroll_d3planner/&lt;build&gt;/icons/&lt;Name&gt;.png, raw names) first, then the wiki icons (armor_icons/*, weapon_icons/*,
/// gem_icons, URL-encoded names with '_' for spaces, e.g. Andariel%27s_Visage.png; a trailing one-letter variant such as
/// Archon_Crownb is only used when the plain file is missing). Names match ignoring case, spaces and punctuation. The wiki icons keep
/// the inventory layout (64x128 canvas for a two-cell item) and are grouped by item type (folder), so they also serve on-screen
/// recognition (<see cref="FindWikiPath"/>, <see cref="WikiIcons"/>). The index is built once on first use (cheap: file names only).
/// </summary>
public static class D3ItemIcons
{
    private const string MaxrollDir = "maxroll_d3planner";
    private const string MaxrollIconsDir = "icons";
    public const string GemGroup = "gem_icons";
    private static readonly string[] WikiDirs = { "armor_icons", "weapon_icons", GemGroup };
    private static readonly string[] ImageExtensions = { ".png", ".jpg" };
    private static readonly HashSet<char> VariantSuffixes = new() { 'b', 'c', 'm', 'w' };
    private const char SuffixStart = '(';
    private static readonly Lazy<(Dictionary<string, string> All, Dictionary<string, string> Wiki, List<D3IconEntry> Entries)> Index = new(BuildIndex);

    /// <summary>Icon file for an English item / gem name ("Bane of the Trapped (150)": the rank / quality suffix is ignored), or null when the libraries have none.</summary>
    public static string? FindPath(string? nameEn) => Find(Index.Value.All, nameEn);

    /// <summary>Wiki icon (inventory layout, grouped by item type) for an English name, or null.</summary>
    public static string? FindWikiPath(string? nameEn) => Find(Index.Value.Wiki, nameEn);

    /// <summary>Every wiki icon (variants included), with its item type group.</summary>
    public static IReadOnlyList<D3IconEntry> WikiIcons => Index.Value.Entries;

    /// <summary>Item type group (folder name) of a wiki icon file.</summary>
    public static string GroupOf(string iconPath) => Path.GetFileName(Path.GetDirectoryName(iconPath) ?? "");

    /// <summary>Number of names indexed (diagnostics).</summary>
    public static int Count => Index.Value.All.Count;

    /// <summary>Letters and digits only, lower case: "Andariel's Visage" == "Andariel%27s_Visage".</summary>
    public static string Key(string name)
    {
        var sb = new StringBuilder(name.Length);
        foreach (char c in name)
            if (char.IsLetterOrDigit(c)) sb.Append(char.ToLowerInvariant(c));
        return sb.ToString();
    }

    private static string? Find(Dictionary<string, string> index, string? nameEn)
    {
        if (string.IsNullOrWhiteSpace(nameEn)) return null;
        string name = nameEn.Trim();
        int suffix = name.IndexOf(SuffixStart);
        if (suffix > 0) name = name[..suffix];
        return index.GetValueOrDefault(Key(name));
    }

    private static (Dictionary<string, string>, Dictionary<string, string>, List<D3IconEntry>) BuildIndex()
    {
        var all = new Dictionary<string, string>(StringComparer.Ordinal);
        var wiki = new Dictionary<string, string>(StringComparer.Ordinal);
        var entries = new List<D3IconEntry>();
        string root = D3TemplatePaths.GetTemplateDir();
        string maxroll = Path.Combine(root, MaxrollDir);
        if (Directory.Exists(maxroll))
            foreach (var dir in Directory.EnumerateDirectories(maxroll))
                AddDir(all, Path.Combine(dir, MaxrollIconsDir), variants: false, entries: null);
        var variantFiles = new List<string>();
        foreach (var name in WikiDirs)
        {
            string dir = Path.Combine(root, name);
            if (!Directory.Exists(dir)) continue;
            foreach (var sub in Directory.EnumerateDirectories(dir).Prepend(dir))
                variantFiles.AddRange(AddDir(wiki, sub, variants: true, entries));
        }
        foreach (var file in variantFiles)
        {
            string stem = Path.GetFileNameWithoutExtension(file);
            wiki.TryAdd(Key(Uri.UnescapeDataString(stem[..^1])), file);
        }
        foreach (var (key, file) in wiki) all.TryAdd(key, file);
        return (all, wiki, entries);
    }

    /// <summary>Add each image of the folder under its name key; returns the files whose stem ends in a variant letter.</summary>
    private static List<string> AddDir(Dictionary<string, string> index, string dir, bool variants, List<D3IconEntry>? entries)
    {
        var variantFiles = new List<string>();
        if (!Directory.Exists(dir)) return variantFiles;
        foreach (var file in Directory.EnumerateFiles(dir))
        {
            if (!ImageExtensions.Contains(Path.GetExtension(file), StringComparer.OrdinalIgnoreCase)) continue;
            string stem = Path.GetFileNameWithoutExtension(file);
            string key = Key(Uri.UnescapeDataString(stem));
            index.TryAdd(key, file);
            entries?.Add(new D3IconEntry(file, GroupOf(file), key));
            if (variants && stem.Length > 2 && VariantSuffixes.Contains(stem[^1]) && char.IsLower(stem[^1])) variantFiles.Add(file);
        }
        return variantFiles;
    }
}
