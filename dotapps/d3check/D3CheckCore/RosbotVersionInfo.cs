using System.IO;
using System.Text.RegularExpressions;

namespace DotApps.d3check.Core;

/// <summary>
/// ROSBOT version parsing and display. Aligned with Python rosbot_update_manager parse_version_from_name, version_to_str,
/// and bottom_bar _ros_version_display_from_update_logic.
/// </summary>
public static class RosbotVersionInfo
{
    private static readonly Regex VersionRe = new(@"(\d{1,4})\.?(\d{2,5})", RegexOptions.Compiled);

    /// <summary>Parse two-segment version from path/filename, e.g. 36.0129 -> (36, 129).</summary>
    public static (int Major, int Minor)? ParseVersionFromName(string? name)
    {
        if (string.IsNullOrEmpty(name)) return null;
        var matches = VersionRe.Matches(name);
        if (matches.Count == 0) return null;
        var m = matches[matches.Count - 1];
        if (int.TryParse(m.Groups[1].Value, out int a) && int.TryParse(m.Groups[2].Value, out int b))
            return (a, b);
        return null;
    }

    /// <summary>Version tuple to string, e.g. (36, 129) -> "36.0129".</summary>
    public static string VersionToString((int Major, int Minor) version)
    {
        return version.Minor < 10000
            ? $"{version.Major}.{version.Minor:D4}"
            : $"{version.Major}.{version.Minor}";
    }

    /// <summary>
    /// Display string for bottom bar: if parent of rosDir is Asia_* or CN_* with version, return parent name;
    /// else parse version and prefix with region (e.g. "CN_36.0129").
    /// </summary>
    public static string GetRosVersionDisplay(string? rosDirectory, string? battlenetRegion)
    {
        if (string.IsNullOrWhiteSpace(rosDirectory)) return "";
        string? parent = Path.GetDirectoryName(rosDirectory);
        string parentBasename = !string.IsNullOrEmpty(parent) ? Path.GetFileName(parent) : "";
        bool isStandardAsia = parentBasename.StartsWith(D3PathConstants.RosbotDirNamespaceAsia + "_", StringComparison.OrdinalIgnoreCase);
        bool isStandardCn = parentBasename.StartsWith(D3PathConstants.RosbotDirNamespaceCn + "_", StringComparison.OrdinalIgnoreCase);
        if ((isStandardAsia || isStandardCn) && ParseVersionFromName(parentBasename) != null)
            return parentBasename;
        var ver = ParseVersionFromName(rosDirectory);
        if (ver == null) return parentBasename ?? "";
        string versionStr = VersionToString(ver.Value);
        if (string.Equals(battlenetRegion, "asia", StringComparison.OrdinalIgnoreCase))
            return $"{D3PathConstants.RosbotDirNamespaceAsia}_{versionStr}";
        if (string.Equals(battlenetRegion, "cn", StringComparison.OrdinalIgnoreCase))
            return $"{D3PathConstants.RosbotDirNamespaceCn}_{versionStr}";
        return versionStr;
    }
}
