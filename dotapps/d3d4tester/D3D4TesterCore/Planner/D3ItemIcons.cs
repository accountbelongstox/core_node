// PY-REF: none (DOT-only)
using System.IO;
using System.Text;

namespace DotApps.d3d4tester.Core.Planner;

/// <summary>
/// Item and gem icons by English name from the icon libraries in the template dir: maxroll planner icons
/// (maxroll_d3planner/&lt;build&gt;/icons/&lt;Name&gt;.png, raw names) first, then the wiki icons (armor_icons/*, weapon_icons/*,
/// gem_icons, URL-encoded names with '_' for spaces, e.g. Andariel%27s_Visage.png; a trailing one-letter variant such as
/// Archon_Crownb is only used when the plain file is missing). Names match ignoring case, spaces and punctuation. The index is built
/// once on first use (cheap: file names only).
/// </summary>
public static class D3ItemIcons
{
    private const string MaxrollDir = "maxroll_d3planner";
    private const string MaxrollIconsDir = "icons";
    private static readonly string[] WikiDirs = { "armor_icons", "weapon_icons", "gem_icons" };
    private static readonly string[] ImageExtensions = { ".png", ".jpg" };
    private static readonly HashSet<char> VariantSuffixes = new() { 'b', 'c', 'm', 'w' };
    private static readonly Lazy<Dictionary<string, string>> Index = new(BuildIndex);

    /// <summary>Icon file for an English item / gem name, or null when the libraries have none.</summary>
    public static string? FindPath(string? nameEn) =>
        string.IsNullOrWhiteSpace(nameEn) ? null : Index.Value.GetValueOrDefault(Key(nameEn));

    /// <summary>Number of names indexed (diagnostics).</summary>
    public static int Count => Index.Value.Count;

    private static Dictionary<string, string> BuildIndex()
    {
        var index = new Dictionary<string, string>(StringComparer.Ordinal);
        string root = D3TemplatePaths.GetTemplateDir();
        string maxroll = Path.Combine(root, MaxrollDir);
        if (Directory.Exists(maxroll))
            foreach (var dir in Directory.EnumerateDirectories(maxroll))
                AddDir(index, Path.Combine(dir, MaxrollIconsDir), variants: false);
        var variantFiles = new List<string>();
        foreach (var wiki in WikiDirs)
        {
            string dir = Path.Combine(root, wiki);
            if (!Directory.Exists(dir)) continue;
            foreach (var sub in Directory.EnumerateDirectories(dir).Prepend(dir))
                variantFiles.AddRange(AddDir(index, sub, variants: true));
        }
        foreach (var file in variantFiles)
        {
            string stem = Path.GetFileNameWithoutExtension(file);
            index.TryAdd(Key(Uri.UnescapeDataString(stem[..^1])), file);
        }
        return index;
    }

    /// <summary>Add each image of the folder under its name key; returns the files whose stem ends in a variant letter.</summary>
    private static List<string> AddDir(Dictionary<string, string> index, string dir, bool variants)
    {
        var variantFiles = new List<string>();
        if (!Directory.Exists(dir)) return variantFiles;
        foreach (var file in Directory.EnumerateFiles(dir))
        {
            if (!ImageExtensions.Contains(Path.GetExtension(file), StringComparer.OrdinalIgnoreCase)) continue;
            string stem = Path.GetFileNameWithoutExtension(file);
            index.TryAdd(Key(Uri.UnescapeDataString(stem)), file);
            if (variants && stem.Length > 2 && VariantSuffixes.Contains(stem[^1]) && char.IsLower(stem[^1])) variantFiles.Add(file);
        }
        return variantFiles;
    }

    /// <summary>Letters and digits only, lower case: "Andariel's Visage" == "Andariel%27s_Visage".</summary>
    private static string Key(string name)
    {
        var sb = new StringBuilder(name.Length);
        foreach (char c in name)
            if (char.IsLetterOrDigit(c)) sb.Append(char.ToLowerInvariant(c));
        return sb.ToString();
    }
}
