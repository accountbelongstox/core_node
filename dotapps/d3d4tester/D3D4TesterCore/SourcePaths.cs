// PY-REF: pyapps/d3-check/providor/constants/common.py
using System.Reflection;

namespace DotApps.d3d4tester.Core;

/// <summary>
/// Single resolver for source-tree paths. The build output lives outside the repo (start scripts use
/// &lt;CN_CACHE_ROOT&gt;/dotnet-artifacts), so walking up from AppContext.BaseDirectory cannot find the repo; the source
/// directory is stamped into this assembly at build time (AssemblyMetadata "SourceDir") and used first, then the walk-up.
/// </summary>
public static class SourcePaths
{
    public const string PyAppsDirName = "pyapps";
    public const string PythonAppDirName = "d3-check";
    public const string PythonImagesDirName = "images";
    private const string SourceDirMetadataKey = "SourceDir";

    private static readonly Lazy<string?> RepoRootLazy = new(ResolveRepoRoot);

    /// <summary>Repository root (contains pyapps/), or null when the app runs without its source tree.</summary>
    public static string? RepoRoot => RepoRootLazy.Value;

    /// <summary>dotapps/d3d4tester source directory, or null without the source tree.</summary>
    public static string? AppSourceDir => RepoRoot is { } root ? Path.Combine(root, "dotapps", "d3d4tester") : null;

    /// <summary>pyapps/d3-check/images (Python TEMPLATE_DIR), or null when missing.</summary>
    public static string? PythonImagesDir =>
        RepoRoot is { } root && Path.Combine(root, PyAppsDirName, PythonAppDirName, PythonImagesDirName) is var dir && Directory.Exists(dir) ? dir : null;

    private static string? ResolveRepoRoot()
    {
        var stamped = typeof(SourcePaths).Assembly.GetCustomAttributes<AssemblyMetadataAttribute>()
            .FirstOrDefault(a => a.Key == SourceDirMetadataKey)?.Value;
        if (!string.IsNullOrEmpty(stamped) && FindAncestorWith(stamped, PyAppsDirName) is { } fromSource)
            return fromSource;
        return FindAncestorWith(AppContext.BaseDirectory, PyAppsDirName);
    }

    private static string? FindAncestorWith(string start, string childDirName)
    {
        for (var dir = new DirectoryInfo(start); dir != null; dir = dir.Parent)
        {
            if (Directory.Exists(Path.Combine(dir.FullName, childDirName)))
                return dir.FullName;
        }
        return null;
    }
}
