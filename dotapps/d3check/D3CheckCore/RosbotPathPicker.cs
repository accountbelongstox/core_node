using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace DotApps.d3check.Core;

/// <summary>
/// Pick best ROSBOT directory by Battle.net region. 1:1 Python path_scanner.pick_best_rosbot_dir_by_region
/// and _path_matches_region used in _apply_scan_results overwrite_ok logic.
/// </summary>
public static class RosbotPathPicker
{
    /// <summary>Pick ROSBOT dir that matches region (asia/cn). If none matches or region unknown, return newest by parsed version.</summary>
    public static string? PickBestRosbotDirByRegion(IReadOnlyList<string> dirs, string? region)
    {
        if (dirs == null || dirs.Count == 0) return null;
        if (string.Equals(region, "asia", StringComparison.OrdinalIgnoreCase) || string.Equals(region, "cn", StringComparison.OrdinalIgnoreCase))
        {
            foreach (var d in dirs)
            {
                string norm = Path.GetFullPath(d).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
                if (string.Equals(region, "asia", StringComparison.OrdinalIgnoreCase))
                {
                    if (norm.Contains(D3PathConstants.RosbotDirNamespaceAsia, StringComparison.OrdinalIgnoreCase)
                        || norm.Contains("亚服", StringComparison.OrdinalIgnoreCase)
                        || norm.Contains("Asia", StringComparison.OrdinalIgnoreCase))
                        return d;
                }
                else
                {
                    if ((norm.Contains(D3PathConstants.RosbotDirNamespaceCn, StringComparison.OrdinalIgnoreCase) || norm.Contains("国服", StringComparison.OrdinalIgnoreCase))
                        && !norm.Contains(D3PathConstants.RosbotDirNamespaceAsia, StringComparison.OrdinalIgnoreCase))
                        return d;
                }
            }
        }
        var withVer = dirs.Select(d => (path: d, ver: RosbotVersionInfo.ParseVersionFromName(d))).Where(x => x.ver != null).ToList();
        if (withVer.Count == 0) return dirs[0];
        withVer.Sort((a, b) =>
        {
            var va = a.ver!.Value;
            var vb = b.ver!.Value;
            int c = vb.Major.CompareTo(va.Major);
            return c != 0 ? c : vb.Minor.CompareTo(va.Minor);
        });
        return withVer[0].path;
    }

    /// <summary>True if path matches region (asia: Asia/亚服 in path; cn: CN/国服 in path and no Asia). 1:1 Python _path_matches_region.</summary>
    public static bool PathMatchesRegion(string? path, string? region)
    {
        if (string.IsNullOrEmpty(path) || string.IsNullOrEmpty(region) || (region != "asia" && region != "cn"))
            return false;
        string n = Path.GetFullPath(path).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        if (string.Equals(region, "asia", StringComparison.OrdinalIgnoreCase))
            return n.Contains(D3PathConstants.RosbotDirNamespaceAsia, StringComparison.OrdinalIgnoreCase);
        return n.Contains(D3PathConstants.RosbotDirNamespaceCn, StringComparison.OrdinalIgnoreCase)
            && !n.Contains(D3PathConstants.RosbotDirNamespaceAsia, StringComparison.OrdinalIgnoreCase);
    }
}
