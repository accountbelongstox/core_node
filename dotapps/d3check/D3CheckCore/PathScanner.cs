using System.IO;
using System.Text.RegularExpressions;
using DotCore.Foundations;

namespace DotApps.d3check.Core;

internal static class PathScanLogTag
{
    public const string Tag = "[PathScan]";
}

/// <summary>
/// Scans fixed drives for Battle.net.exe, Diablo III.exe, and ROSBOT directories.
/// Logic aligned with Python d3utils.path_scanner. Does not touch config; caller updates config and UI.
/// </summary>
public static class PathScanner
{
    private static readonly HashSet<string> SkipDirNames = new(StringComparer.OrdinalIgnoreCase)
    {
        "node_modules", "__pycache__", ".git", ".svn", ".hg", ".venv", "venv", "env",
        ".npm", ".cache", ".yarn", "tmp", "temp", "build", "dist", ".idea", ".vscode",
        "appdata", "cache", "caches", ".nuget", "packages", ".tox", ".mypy_cache",
    };

    /// <summary>
    /// Scan drives (D first, C last), max depth 6. If getConfiguredBattlenet/getConfiguredD3/getConfiguredRos return non-empty and exist, skip scanning that item unless forceScanRosbot (for ROS only).
    /// Returns (battlenetPath, rosbotDirs, d3Path). progressCallback(currentDir) is invoked from the scan; do not do UI in it.
    /// </summary>
    public static PathScanResult ScanForPaths(
        Action<string>? progressCallback = null,
        bool includeRosbot = true,
        bool forceScanRosbot = false,
        string? configuredBattlenet = null,
        string? configuredD3 = null,
        string? configuredRosDir = null)
    {
        var result = new PathScanResult();
        string? bnPath = null;
        double bnMtime = 0;
        string? d3Path = null;
        double d3Mtime = 0;
        var rosByDir = new Dictionary<string, (string path, double mtime)>(StringComparer.OrdinalIgnoreCase);

        if (!string.IsNullOrWhiteSpace(configuredBattlenet) && File.Exists(configuredBattlenet) &&
            Path.GetFileName(configuredBattlenet) == D3PathConstants.BattleNetExeName)
        {
            bnPath = configuredBattlenet;
            bnMtime = GetMtime(configuredBattlenet);
        }
        if (!string.IsNullOrWhiteSpace(configuredD3) && File.Exists(configuredD3) &&
            Path.GetFileName(configuredD3) == D3PathConstants.DiabloIIIExeName)
        {
            d3Path = configuredD3;
            d3Mtime = GetMtime(configuredD3);
        }
        if (!string.IsNullOrWhiteSpace(configuredRosDir) && Directory.Exists(configuredRosDir))
            rosByDir[NormalizePath(configuredRosDir)] = (configuredRosDir, GetMtime(configuredRosDir));

        string[] drives = DriveOrder.GetFixedDriveRootsForScan();
        ColorPrinter.Blue($"{PathScanLogTag.Tag} === Scan criteria ===");
        ColorPrinter.Blue($"{PathScanLogTag.Tag} Drives: {(drives.Length > 0 ? string.Join(", ", drives) : "(none)")}, Max depth: {D3PathConstants.PathScanMaxDepth}");
        ColorPrinter.Blue($"{PathScanLogTag.Tag} Battle.net: {(bnPath != null ? "configured, skip: " + bnPath : "will scan")}");
        ColorPrinter.Blue($"{PathScanLogTag.Tag} D3: {(d3Path != null ? "configured, skip: " + d3Path : "will scan")}");
        string rosStatus = includeRosbot
            ? (rosByDir.Count > 0 && forceScanRosbot ? "configured, will scan (force)" : (rosByDir.Count > 0 ? "configured, skip: " + rosByDir.Values.First().path : "will scan"))
            : "skip (BN+D3 only)";
        ColorPrinter.Blue($"{PathScanLogTag.Tag} ROSBOT: {rosStatus}");
        ColorPrinter.Blue($"{PathScanLogTag.Tag} === Start scan ===");

        bool needBn = bnPath == null;
        bool needD3 = d3Path == null;
        bool needRos = includeRosbot && (rosByDir.Count == 0 || forceScanRosbot);

        foreach (string driveRoot in drives)
        {
            if (!needBn && !needD3 && !needRos) break;
            progressCallback?.Invoke(driveRoot);
            ColorPrinter.Blue($"{PathScanLogTag.Tag} Scanning {driveRoot} ...");

            ScanDir(driveRoot, 1, progressCallback, ref bnPath, ref bnMtime, ref d3Path, ref d3Mtime, rosByDir, includeRosbot);

            needBn = bnPath == null;
            needD3 = d3Path == null;
            needRos = includeRosbot && rosByDir.Count == 0;
            if (!needBn && !needD3 && !needRos)
            {
                ColorPrinter.Blue($"{PathScanLogTag.Tag} Scan complete (all found).");
                break;
            }
        }

        result.BattlenetPath = bnPath;
        result.D3Path = d3Path;
        // 1:1 Python: prefer update-convention paths (GameTools\{Asia|CN}_{version}\RosBot), then by mtime descending
        result.RosbotDirs = rosByDir.Values
            .OrderBy(x => IsRosbotUpdateConventionPath(x.path) ? 0 : 1)
            .ThenByDescending(x => x.mtime)
            .Select(x => x.path)
            .ToList();

        ColorPrinter.Blue($"{PathScanLogTag.Tag} === Scan done === Battle.net: {(bnPath != null ? 1 : 0)}, D3: {(d3Path != null ? 1 : 0)}, ROSBOT dirs: {result.RosbotDirs.Count}");
        ColorPrinter.Blue($"{PathScanLogTag.Tag} Battle.net: {bnPath ?? "(none)"}");
        ColorPrinter.Blue($"{PathScanLogTag.Tag} D3: {d3Path ?? "(none)"}");
        ColorPrinter.Blue($"{PathScanLogTag.Tag} ROSBOT dirs: {(result.RosbotDirs.Count > 0 ? string.Join(", ", result.RosbotDirs) : "(none)")}");

        return result;
    }

    private static void ScanDir(
        string root,
        int depth,
        Action<string>? progressCallback,
        ref string? battlenetPath,
        ref double battlenetMtime,
        ref string? d3Path,
        ref double d3Mtime,
        Dictionary<string, (string path, double mtime)> rosByDir,
        bool includeRosbot)
    {
        if (depth > D3PathConstants.PathScanMaxDepth) return;
        progressCallback?.Invoke(root);

        if (!Directory.Exists(root)) return;
        string[] entries;
        try
        {
            entries = Directory.GetFileSystemEntries(root);
        }
        catch
        {
            return;
        }

        foreach (string full in entries)
        {
            if (File.Exists(full))
            {
                string name = Path.GetFileName(full);
                double mtime = GetMtime(full);
                if (name == D3PathConstants.BattleNetExeName)
                    KeepNewer(ref battlenetPath, ref battlenetMtime, full, mtime);
                else if (name == D3PathConstants.DiabloIIIExeName)
                    KeepNewer(ref d3Path, ref d3Mtime, full, mtime);
                else if (includeRosbot && MatchesRosbot(name))
                {
                    string dir = Path.GetDirectoryName(full) ?? full;
                    string norm = NormalizePath(dir);
                    if (!rosByDir.TryGetValue(norm, out var existing) || mtime > existing.mtime)
                        rosByDir[norm] = (dir, mtime);
                }
            }
            else if (Directory.Exists(full))
            {
                string name = Path.GetFileName(full);
                if (string.IsNullOrEmpty(name) || name[0] == '.' || SkipDirNames.Contains(name))
                    continue;
                ScanDir(full, depth + 1, progressCallback, ref battlenetPath, ref battlenetMtime, ref d3Path, ref d3Mtime, rosByDir, includeRosbot);
            }
        }
    }

    private static bool MatchesRosbot(string fileName)
    {
        foreach (string pattern in D3PathConstants.RosbotExePatterns)
        {
            if (MatchesGlob(fileName, pattern)) return true;
        }
        return false;
    }

    private static bool MatchesGlob(string name, string pattern)
    {
        string regex = "^" + Regex.Escape(pattern).Replace("\\*", ".*").Replace("\\?", ".") + "$";
        return Regex.IsMatch(name, regex, RegexOptions.IgnoreCase);
    }

    private static void KeepNewer(ref string? current, ref double currentMtime, string newPath, double newMtime)
    {
        if (current == null || newMtime > currentMtime)
        {
            current = newPath;
            currentMtime = newMtime;
        }
    }

    private static double GetMtime(string path)
    {
        try
        {
            return File.GetLastWriteTimeUtc(path).Ticks;
        }
        catch
        {
            return 0;
        }
    }

    private static string NormalizePath(string path) => Path.GetFullPath(path).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);

    /// <summary>True if path is under GameTools and matches {Asia|CN}_{version}\RosBot (update convention). 1:1 Python _is_rosbot_update_convention_path.</summary>
    private static bool IsRosbotUpdateConventionPath(string dirPath)
    {
        try
        {
            string norm = Path.GetFullPath(dirPath).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            string baseNorm = Path.GetFullPath(D3PathConstants.RosbotGameToolsBase).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            if (string.IsNullOrEmpty(baseNorm) || !norm.StartsWith(baseNorm, StringComparison.OrdinalIgnoreCase) || norm.Length <= baseNorm.Length)
                return false;
            string rest = norm.Substring(baseNorm.Length).TrimStart(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            string[] parts = rest.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            if (parts.Length < 2) return false;
            string parentName = parts[^2];
            string lastPart = parts[^1];
            if (!string.Equals(lastPart, D3PathConstants.RosbotFinalDirName, StringComparison.OrdinalIgnoreCase))
                return false;
            return parentName.StartsWith(D3PathConstants.RosbotDirNamespaceAsia + "_", StringComparison.OrdinalIgnoreCase)
                || parentName.StartsWith(D3PathConstants.RosbotDirNamespaceAsia + " ", StringComparison.OrdinalIgnoreCase)
                || parentName.StartsWith(D3PathConstants.RosbotDirNamespaceCn + "_", StringComparison.OrdinalIgnoreCase)
                || parentName.StartsWith(D3PathConstants.RosbotDirNamespaceCn + " ", StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            return false;
        }
    }
}
