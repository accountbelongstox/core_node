using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using DotApps.d3check.Config;
using DotApps.d3check.Config.Options;
using DotApps.d3check.Constants;
using DotApps.d3check.Core;
using DotCore.Foundations;

namespace DotApps.d3check;

/// <summary>
/// ROSBOT update: find zip in Downloads by region/size, extract to GameTools\{Asia|CN}_{version}\RosBot, update config.
/// Logic 1:1 Python d3utils.rosbot_update_manager (find_rosbot_zips_in_downloads, get_best_newer_zip, apply_update).
/// Downloads dir: 1:1 Python get_downloads_dir — config paths.downloads_dir if set and valid, else user profile Downloads; not editable in UI (auto-resolved).
/// </summary>
public sealed class RosbotUpdateManager
{
    private const string RosbotFinalDirName = D3PathConstants.RosbotFinalDirName;
    private static readonly long MinZipBytes = D3PathConstants.RosbotZipMinSizeMb * 1024L * 1024L;
    private static readonly long MaxZipBytes = D3PathConstants.RosbotZipMaxSizeMb * 1024L * 1024L;
    private static readonly string TempBaseDir = Path.Combine(D3PathConstants.RosbotGameToolsBase, ".tmp");

    public static RosbotUpdateManager Instance { get; } = new RosbotUpdateManager();

    public string? GetBattlenetRegion() => GameInterfaceData.Instance.GetStateSnapshot().BattlenetRegion;

    /// <summary>Downloads directory for ROSBOT zip. Config paths.downloads_dir; if empty or missing, user profile Downloads. 1:1 Python get_downloads_dir.</summary>
    public string GetDownloadsDir()
    {
        var dir = ConfigOptionsProvider.GetOptions<PathsOptions>().DownloadsDir;
        if (!string.IsNullOrWhiteSpace(dir) && Directory.Exists(dir)) return dir;
        return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");
    }

    public bool ZipMatchesRegion(string filename, string region)
    {
        if (region != "asia" && region != "cn") return false;
        string lower = filename.ToLowerInvariant();
        bool matchesAsia = D3PathConstants.RosbotZipKeywordsAsia.Any(k => filename.Contains(k, StringComparison.Ordinal) || lower.Contains(k.ToLowerInvariant()));
        bool matchesCn = D3PathConstants.RosbotZipKeywordsCn.Any(k => filename.Contains(k, StringComparison.Ordinal) || lower.Contains(k.ToLowerInvariant()));
        if (region == "asia") return matchesAsia;
        return matchesCn && !matchesAsia;
    }

    /// <summary>Find matching ROSBOT zips in Downloads; filter by size 20–50MB. Returns (path, size, version) sorted by version desc.</summary>
    public List<(string Path, long Size, (int Major, int Minor)? Version)> FindRosbotZipsInDownloads(string region)
    {
        var list = new List<(string Path, long Size, (int Major, int Minor)? Version)>();
        if (region != "asia" && region != "cn") return list;
        string down = GetDownloadsDir();
        if (!Directory.Exists(down)) return list;
        foreach (var f in Directory.EnumerateFiles(down, "*.zip", SearchOption.TopDirectoryOnly))
        {
            string name = Path.GetFileName(f);
            if (!ZipMatchesRegion(name, region)) continue;
            try
            {
                var fi = new FileInfo(f);
                if (!fi.Exists || fi.Length < MinZipBytes || fi.Length > MaxZipBytes) continue;
                var ver = RosbotVersionInfo.ParseVersionFromName(name);
                list.Add((f, fi.Length, ver));
            }
            catch { /* skip */ }
        }
        list.Sort((a, b) =>
        {
            var va = a.Version ?? (0, 0);
            var vb = b.Version ?? (0, 0);
            int c = vb.Major.CompareTo(va.Major);
            return c != 0 ? c : vb.Minor.CompareTo(va.Minor);
        });
        return list;
    }

    /// <summary>Current installed version for this region (from config path or GameTools\{Asia|CN}_*).</summary>
    public ((int Major, int Minor)? Version, long Ctime) GetCurrentVersionForRegion(string region)
    {
        if (region != "asia" && region != "cn") return (null, 0);
        string? rosDir = ConfigOptionsProvider.GetOptions<RosSettingsOptions>().RosDirectory;
        if (string.IsNullOrWhiteSpace(rosDir)) rosDir = null;
        if (!string.IsNullOrWhiteSpace(rosDir) && Directory.Exists(rosDir!))
        {
            string? parent = Path.GetFileName(Path.GetDirectoryName(rosDir));
            string prefix = region == "asia" ? D3PathConstants.RosbotDirNamespaceAsia + "_" : D3PathConstants.RosbotDirNamespaceCn + "_";
            if (!string.IsNullOrEmpty(parent) && parent.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                long ctime = 0;
                try { ctime = new DirectoryInfo(rosDir!).CreationTimeUtc.Ticks; } catch { }
                return (RosbotVersionInfo.ParseVersionFromName(rosDir), ctime);
            }
        }
        string basePath = D3PathConstants.RosbotGameToolsBase;
        if (!Directory.Exists(basePath)) return (null, 0);
        string prefix2 = region == "asia" ? D3PathConstants.RosbotDirNamespaceAsia + "_" : D3PathConstants.RosbotDirNamespaceCn + "_";
        foreach (var name in Directory.EnumerateDirectories(basePath).Select(Path.GetFileName))
        {
            if (string.IsNullOrEmpty(name) || !name.StartsWith(prefix2, StringComparison.OrdinalIgnoreCase)) continue;
            string finalDir = Path.Combine(basePath, name!, RosbotFinalDirName);
            if (!Directory.Exists(finalDir)) continue;
            string? exe = FindRosbotExeRecursive(finalDir);
            if (exe == null) continue;
            long ctime = 0;
            try { ctime = new DirectoryInfo(finalDir).CreationTimeUtc.Ticks; } catch { }
            return (RosbotVersionInfo.ParseVersionFromName(finalDir), ctime);
        }
        return (null, 0);
    }

    /// <summary>Best zip newer than current for this region. Returns (zipPath, isNewer, versionStr).</summary>
    public (string? ZipPath, bool IsNewer, string? VersionStr) GetBestNewerZip(string region)
    {
        var (curVer, curCtime) = GetCurrentVersionForRegion(region);
        var candidates = FindRosbotZipsInDownloads(region);
        if (candidates.Count == 0) return (null, false, null);
        foreach (var (path, _, zipVer) in candidates)
        {
            if (curVer != null && zipVer != null)
            {
                if (zipVer.Value.Major > curVer.Value.Major || (zipVer.Value.Major == curVer.Value.Major && zipVer.Value.Minor > curVer.Value.Minor))
                    return (path, true, RosbotVersionInfo.VersionToString(zipVer.Value));
                continue;
            }
            if (curVer == null)
            {
                try
                {
                    long zipMtime = new FileInfo(path).LastWriteTimeUtc.Ticks;
                    if (curCtime <= 0 || zipMtime > curCtime)
                        return (path, true, zipVer != null ? RosbotVersionInfo.VersionToString(zipVer.Value) : null);
                }
                catch { }
            }
        }
        return (null, false, null);
    }

    public static string? FindRosbotExeRecursive(string rootDir)
    {
        if (!Directory.Exists(rootDir)) return null;
        foreach (var pattern in D3PathConstants.RosbotExePatterns)
        {
            var files = Directory.GetFiles(rootDir, pattern, SearchOption.AllDirectories);
            if (files.Length > 0) return files[0];
        }
        return null;
    }

    private static void CopyDirectory(string srcDir, string dstDir)
    {
        Directory.CreateDirectory(dstDir);
        foreach (var entry in new DirectoryInfo(srcDir).GetFileSystemInfos())
        {
            string dstPath = Path.Combine(dstDir, entry.Name);
            if (entry is FileInfo fi)
            {
                fi.CopyTo(dstPath, true);
            }
            else if (entry is DirectoryInfo di)
            {
                CopyDirectory(di.FullName, dstPath);
            }
        }
    }

    /// <summary>Copy srcDir into dstDir; if srcDir has exactly one child dir, copy that child's contents into dstDir (flatten). 1:1 _copy_extract_to_dir_no_nesting.</summary>
    private static bool CopyExtractToDirNoNesting(string srcDir, string dstDir)
    {
        try
        {
            var top = Directory.GetFileSystemEntries(srcDir);
            if (top.Length == 1)
            {
                string sub = top[0];
                if (Directory.Exists(sub))
                {
                    CopyDirectory(sub, dstDir);
                    return true;
                }
            }
            CopyDirectory(srcDir, dstDir);
            return true;
        }
        catch { return false; }
    }

    private static void CleanupDirectorySafe(string dirPath)
    {
        if (!Directory.Exists(dirPath)) return;
        try
        {
            string tempPath = dirPath + ".tmp_delete";
            if (Directory.Exists(tempPath)) Directory.Delete(tempPath, true);
            Directory.Move(dirPath, tempPath);
            Directory.Delete(tempPath, true);
        }
        catch
        {
            try { Directory.Delete(dirPath, true); } catch { }
        }
    }

    /// <summary>Apply update: extract zip to temp, find exe, copy to GameTools\{region}_{version}\RosBot, copy RoS-BoT.ini, update config.</summary>
    public bool ApplyUpdate(string zipPath, string region, string? versionStr = null)
    {
        if (!File.Exists(zipPath) || !zipPath.EndsWith(".zip", StringComparison.OrdinalIgnoreCase)) return false;
        if (region != "asia" && region != "cn")
        {
            ColorPrinter.Yellow("[RosbotUpdateManager] Battle.net region not asia/cn, skipping update");
            return false;
        }
        string regionDir = region == "asia" ? D3PathConstants.RosbotDirNamespaceAsia : D3PathConstants.RosbotDirNamespaceCn;
        if (string.IsNullOrEmpty(versionStr))
        {
            var v = RosbotVersionInfo.ParseVersionFromName(Path.GetFileName(zipPath));
            versionStr = v != null ? RosbotVersionInfo.VersionToString(v.Value) : "0.0";
        }
        string parentName = $"{regionDir}_{versionStr}";
        string finalDir = Path.Combine(D3PathConstants.RosbotGameToolsBase, parentName, RosbotFinalDirName);

        if (TargetAlreadyHasVersion(region, versionStr))
        {
            ColorPrinter.Gray($"[RosbotUpdateManager] Already up to date: {finalDir}, skipping");
            return true;
        }

        Directory.CreateDirectory(TempBaseDir);
        string tempRoot = Path.Combine(TempBaseDir, "tmp_" + Guid.NewGuid().ToString("N")[..8]);
        string? rosDirOld = ConfigOptionsProvider.GetOptions<RosSettingsOptions>().RosDirectory;
        if (string.IsNullOrWhiteSpace(rosDirOld)) rosDirOld = null;

        try
        {
            ZipFile.ExtractToDirectory(zipPath, tempRoot);
            ColorPrinter.Green($"[RosbotUpdateManager] Extracted to temp: {tempRoot}");

            string? exePath = FindRosbotExeRecursive(tempRoot);
            if (exePath == null)
            {
                ColorPrinter.Red("[RosbotUpdateManager] RoS-BoT.exe not found after extraction");
                CleanupDirectorySafe(tempRoot);
                return false;
            }
            string exeDir = Path.GetDirectoryName(exePath)!;
            if (Directory.Exists(finalDir)) CleanupDirectorySafe(finalDir);
            if (!CopyExtractToDirNoNesting(exeDir, finalDir))
            {
                ColorPrinter.Red("[RosbotUpdateManager] Failed to copy to final");
                CleanupDirectorySafe(tempRoot);
                return false;
            }
            ColorPrinter.Green($"[RosbotUpdateManager] Copied to final: {finalDir}");

            if (!string.IsNullOrWhiteSpace(rosDirOld) && Directory.Exists(rosDirOld))
            {
                string oldIni = Path.Combine(rosDirOld, "RoS-BoT.ini");
                string newIni = Path.Combine(finalDir, "RoS-BoT.ini");
                if (File.Exists(oldIni))
                {
                    try { File.Copy(oldIni, newIni, true); ColorPrinter.Gray("[RosbotUpdateManager] Copied RoS-BoT.ini"); } catch { }
                }
            }

            string finalDirNorm = Path.GetFullPath(finalDir).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            D3CheckConfigService.Instance.SetValueAsync(ConfigKeys.RosSettingsRosDirectory, finalDirNorm);
            D3CheckConfigService.Instance.QueueSave();
            ColorPrinter.Green($"[RosbotUpdateManager] Config updated: ros_directory = {finalDirNorm}");

            GameInterfaceData.Instance.UpdateFromPaths(
                ConfigOptionsProvider.GetOptions<BattlenetOptions>().BattlenetPath ?? "",
                ConfigOptionsProvider.GetOptions<D3Options>().D3Path ?? "",
                finalDirNorm);
            GameInterfaceData.Instance.NotifyCallbacks();

            CleanupDirectorySafe(tempRoot);
            return true;
        }
        catch (Exception ex)
        {
            ColorPrinter.Red($"[RosbotUpdateManager] Failed: {ex.Message}");
            try { CleanupDirectorySafe(tempRoot); } catch { }
            return false;
        }
    }

    private bool TargetAlreadyHasVersion(string region, string versionStr)
    {
        if (region != "asia" && region != "cn") return false;
        string regionDir = region == "asia" ? D3PathConstants.RosbotDirNamespaceAsia : D3PathConstants.RosbotDirNamespaceCn;
        string parentName = $"{regionDir}_{versionStr}";
        string finalDir = Path.Combine(D3PathConstants.RosbotGameToolsBase, parentName, RosbotFinalDirName);
        if (!Directory.Exists(finalDir)) return false;
        if (FindRosbotExeRecursive(finalDir) == null) return false;
        return string.Equals(Path.GetFileName(Path.GetDirectoryName(finalDir)), parentName, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>Check for update; only when region is asia/cn. Returns (zipPath, isNewer, versionStr, region).</summary>
    public (string? ZipPath, bool IsNewer, string? VersionStr, string? Region) CheckUpdate()
    {
        string? region = GetBattlenetRegion();
        string downloadsDir = GetDownloadsDir();
        ColorPrinter.Gray($"[DEBUG][RosbotUpdateManager] CheckUpdate: GetBattlenetRegion()={region ?? "null"}, GetDownloadsDir()={downloadsDir}, Directory.Exists={Directory.Exists(downloadsDir)}.");
        if (region != "asia" && region != "cn")
        {
            ColorPrinter.Gray($"[RosbotUpdateManager] Region not asia/cn, skipping update check");
            ColorPrinter.Gray($"[DEBUG][RosbotUpdateManager] Only asia/cn regions are supported for ROSBOT update; current region='{(region ?? "null")}'.");
            return (null, false, null, null);
        }
        var (curVer, curCtime) = GetCurrentVersionForRegion(region!);
        var candidates = FindRosbotZipsInDownloads(region!);
        ColorPrinter.Gray($"[DEBUG][RosbotUpdateManager] FindRosbotZipsInDownloads(region={region}) count={candidates.Count}, currentVersion={(curVer.HasValue ? RosbotVersionInfo.VersionToString(curVer.Value) : "none")}, currentCtime={curCtime}.");
        if (candidates.Count > 0)
        {
            for (int i = 0; i < Math.Min(3, candidates.Count); i++)
            {
                var c = candidates[i];
                ColorPrinter.Gray($"[DEBUG][RosbotUpdateManager] Candidate[{i}] Path={c.Path}, Size={c.Size}, Version={(c.Version.HasValue ? RosbotVersionInfo.VersionToString(c.Version.Value) : "?")}.");
            }
            if (candidates.Count > 3)
                ColorPrinter.Gray($"[DEBUG][RosbotUpdateManager] ... and {candidates.Count - 3} more.");
        }
        var (zipPath, isNewer, versionStr) = GetBestNewerZip(region!);
        ColorPrinter.Gray($"[DEBUG][RosbotUpdateManager] GetBestNewerZip result: zipPath={(zipPath != null ? zipPath : "null")}, isNewer={isNewer}, versionStr={versionStr ?? "null"}.");
        return (zipPath, isNewer, versionStr, region);
    }
}
