// PY-REF: none (DOT-only)
namespace DotApps.d3d4tester.Core;

/// <summary>
/// ROSBOT update convention &lt;GameTools&gt;\{Asia|CN}_{version}\RosBot on any drive. The GameTools folder follows the ROSBOT the
/// path scan found (ros_settings.ros_directory); the default D3PathConstants.RosbotGameToolsBase only applies when none is set.
/// </summary>
public static class RosbotGameToolsLayout
{
    private static readonly string[] NamespaceSeparators = { "_", " " };

    /// <summary>
    /// GameTools folder for new versions: the grandparent of a convention path, the parent folder of any other existing ROSBOT
    /// folder (new versions go next to it), else the default base.
    /// </summary>
    public static string GetBase(string? currentRosDirectory)
    {
        if (string.IsNullOrWhiteSpace(currentRosDirectory)) return D3PathConstants.RosbotGameToolsBase;
        if (IsConventionPath(currentRosDirectory)) return Path.GetDirectoryName(Path.GetDirectoryName(Normalize(currentRosDirectory)))!;
        string dir = Normalize(currentRosDirectory);
        if (File.Exists(dir)) dir = Path.GetDirectoryName(dir)!;
        return Directory.Exists(dir) && Path.GetDirectoryName(dir) is { } parent ? parent : D3PathConstants.RosbotGameToolsBase;
    }

    /// <summary>True when the path ends with {Asia|CN}_{version}\RosBot (or "Asia 36.0129\RosBot").</summary>
    public static bool IsConventionPath(string dirPath)
    {
        try
        {
            string norm = Normalize(dirPath);
            if (!string.Equals(Path.GetFileName(norm), D3PathConstants.RosbotFinalDirName, StringComparison.OrdinalIgnoreCase)) return false;
            string? parent = Path.GetFileName(Path.GetDirectoryName(norm));
            if (string.IsNullOrEmpty(parent) || Path.GetDirectoryName(Path.GetDirectoryName(norm)) == null) return false;
            return new[] { D3PathConstants.RosbotDirNamespaceAsia, D3PathConstants.RosbotDirNamespaceCn }
                .SelectMany(ns => NamespaceSeparators.Select(sep => ns + sep))
                .Any(prefix => parent.StartsWith(prefix, StringComparison.OrdinalIgnoreCase));
        }
        catch (Exception ex) when (ex is ArgumentException or NotSupportedException or PathTooLongException)
        {
            return false;
        }
    }

    private static string Normalize(string path) => Path.GetFullPath(path).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
}
