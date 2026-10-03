// PY-REF: pyapps/d3-check/d3utils/rosbot_update_manager.py
// PY-REF: pyapps/d3-check/timers/one_shot_tasks.py
// PY-REF: pyapps/d3-check/d3utils/rosbot_update_check.py
using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Config.Options;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Ctl;
using DotApps.d3d4tester.I18n;
using DotCore.Foundations;
using DotApps.d3d4tester.Core.Battlenet;

namespace DotApps.d3d4tester;

/// <summary>One zip candidate shown in the no-update detection view.</summary>
public sealed record RosbotUpdateCandidate(string Path, string VersionStr, double SizeMb);

/// <summary>Per-region detection result (no newer zip). Candidates empty = no matching zip at all.</summary>
public sealed record RosbotUpdateRegionDetection(string Region, string RegionDisplay, IReadOnlyList<RosbotUpdateCandidate> Candidates);

/// <summary>Why no update was applied: current dir/version, scanned Downloads dir and per-region candidates.</summary>
public sealed record RosbotNoUpdateDetection(string CurrentRosDir, string CurrentVersion, string DownloadsDir, IReadOnlyList<RosbotUpdateRegionDetection> Regions);

/// <summary>Newer zip found for a region; shown in the confirm dialog.</summary>
public sealed record RosbotUpdateOffer(string Region, string RegionDisplay, string? VersionStr, string ZipPath);

/// <summary>
/// ROSBOT update: find zip in Downloads by region/size, extract to temp (recursively extracting nested ros-bot zips),
/// copy the exe dir to GameTools\{Asia|CN}_{version}\RosBot without nesting, fix RosBot\RosBot, copy RoS-BoT.ini,
/// update config (verified) and invalidate the ROSBOT detection cache. RunUpdateFlowAsync is the "Update ROSBOT" flow
/// (E1 kill, E2 wait, region order, detection data, confirm / no-update dialogs via callbacks).
/// Logic 1:1 Python d3utils/rosbot_update_manager.py + timers/one_shot_tasks.py do_rosbot_update.
/// Downloads dir: config paths.downloads_dir if set and valid, else user profile Downloads.
/// </summary>
public sealed class RosbotUpdateManager
{
    private const string RosbotFinalDirName = D3PathConstants.RosbotFinalDirName;
    private const string ZipExtension = ".zip";
    private const string ZipPattern = "*.zip";
    private const string ExeExtension = ".exe";
    private const string TempDirPrefix = "tmp_";
    private const string DefaultVersionStr = "0.0";
    private const string LogTag = "[RosbotUpdateManager]";
    private const string PanelLogTag = "[RosbotPanel]";
    private static readonly long MinZipBytes = D3PathConstants.RosbotZipMinSizeMb * 1024L * 1024L;
    private static readonly long MaxZipBytes = D3PathConstants.RosbotZipMaxSizeMb * 1024L * 1024L;
    private static readonly string TempBaseDir = Path.Combine(D3PathConstants.RosbotGameToolsBase, ".tmp");

    public static RosbotUpdateManager Instance { get; } = new RosbotUpdateManager();

    public string? GetBattlenetRegion() => GameInterfaceData.Instance.GetStateSnapshot().BattlenetRegion;

    /// <summary>Downloads directory for ROSBOT zip. 1:1 Python get_downloads_dir.</summary>
    public string GetDownloadsDir()
    {
        var dir = ConfigOptionsProvider.GetOptions<PathsOptions>().DownloadsDir;
        if (!string.IsNullOrWhiteSpace(dir) && Directory.Exists(dir)) return dir;
        return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");
    }

    /// <summary>Region display text (i18n server_asia / server_cn).</summary>
    public static string GetRegionDisplay(string? region)
    {
        var p = D3D4TesterI18n.Provider;
        return region == BattlenetConstants.RegionAsia ? p.GetUiText(I18nKeys.StatusServerAsia)
            : region == BattlenetConstants.RegionCn ? p.GetUiText(I18nKeys.StatusServerCn)
            : p.GetUiText(I18nKeys.StatusServerUnknown);
    }

    public bool ZipMatchesRegion(string filename, string region)
    {
        if (region != BattlenetConstants.RegionAsia && region != BattlenetConstants.RegionCn) return false;
        string lower = filename.ToLowerInvariant();
        bool matchesAsia = D3PathConstants.RosbotZipKeywordsAsia.Any(k => filename.Contains(k, StringComparison.Ordinal) || lower.Contains(k.ToLowerInvariant()));
        bool matchesCn = D3PathConstants.RosbotZipKeywordsCn.Any(k => filename.Contains(k, StringComparison.Ordinal) || lower.Contains(k.ToLowerInvariant()));
        if (region == BattlenetConstants.RegionAsia) return matchesAsia;
        return matchesCn && !matchesAsia;
    }

    /// <summary>Find matching ROSBOT zips in Downloads; filter by size 20–50MB. Returns (path, size, version) sorted by version desc.</summary>
    public List<(string Path, long Size, (int Major, int Minor)? Version)> FindRosbotZipsInDownloads(string region)
    {
        var list = new List<(string Path, long Size, (int Major, int Minor)? Version)>();
        if (region != BattlenetConstants.RegionAsia && region != BattlenetConstants.RegionCn) return list;
        string down = GetDownloadsDir();
        if (!Directory.Exists(down)) return list;
        foreach (var f in Directory.EnumerateFiles(down, ZipPattern, SearchOption.TopDirectoryOnly))
        {
            string name = Path.GetFileName(f);
            if (!ZipMatchesRegion(name, region)) continue;
            try
            {
                var fi = new FileInfo(f);
                if (!fi.Exists || fi.Length < MinZipBytes || fi.Length > MaxZipBytes) continue;
                list.Add((f, fi.Length, RosbotVersionInfo.ParseVersionFromName(name)));
            }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
        }
        list.Sort((a, b) => VersionKey(b.Version).CompareTo(VersionKey(a.Version)));
        return list;
    }

    /// <summary>Current ROS dir (config), its creation time and version parsed from the path. 1:1 Python get_current_ros_dir_info.</summary>
    public (string? RosDir, long Ctime, (int Major, int Minor)? Version) GetCurrentRosDirInfo()
    {
        string? rosDir = ConfigOptionsProvider.GetOptions<RosSettingsOptions>().RosDirectory;
        if (string.IsNullOrWhiteSpace(rosDir)) return (null, 0, null);
        if (FindRosbotExeInDir(rosDir) == null) return (null, 0, null);
        if (!Directory.Exists(rosDir)) return (rosDir, 0, null);
        long ctime = 0;
        try { ctime = new DirectoryInfo(rosDir).CreationTimeUtc.Ticks; } catch (IOException) { }
        return (rosDir, ctime, RosbotVersionInfo.ParseVersionFromName(rosDir));
    }

    /// <summary>Current installed version for this region (configured path when it is this region, else GameTools\{Asia|CN}_*).</summary>
    public ((int Major, int Minor)? Version, long Ctime) GetCurrentVersionForRegion(string region)
    {
        if (region != BattlenetConstants.RegionAsia && region != BattlenetConstants.RegionCn) return (null, 0);
        string prefix = RegionDirName(region) + "_";
        var (rosDir, curCtime, curVer) = GetCurrentRosDirInfo();
        if (!string.IsNullOrEmpty(rosDir))
        {
            string? parent = Path.GetFileName(Path.GetDirectoryName(rosDir));
            if (!string.IsNullOrEmpty(parent) && parent.StartsWith(prefix, StringComparison.Ordinal))
                return (curVer, curCtime);
        }
        string basePath = D3PathConstants.RosbotGameToolsBase;
        if (!Directory.Exists(basePath)) return (null, 0);
        try
        {
            foreach (var name in Directory.EnumerateDirectories(basePath).Select(Path.GetFileName))
            {
                if (string.IsNullOrEmpty(name) || !name.StartsWith(prefix, StringComparison.Ordinal)) continue;
                string finalDir = Path.Combine(basePath, name, RosbotFinalDirName);
                if (!Directory.Exists(finalDir) || FindRosbotExeRecursive(finalDir) == null) continue;
                long ctime = 0;
                try { ctime = new DirectoryInfo(finalDir).CreationTimeUtc.Ticks; } catch (IOException) { }
                return (RosbotVersionInfo.ParseVersionFromName(finalDir), ctime);
            }
        }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
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
                if (VersionKey(zipVer) > VersionKey(curVer))
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
                catch (IOException) { }
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
            if (files.Length > 0) return Path.GetFullPath(files[0]);
        }
        return null;
    }

    /// <summary>Target dir GameTools\{Asia|CN}_{version}\RosBot for (region, version). 1:1 Python get_target_final_dir.</summary>
    public string? GetTargetFinalDir(string region, string? versionStr = null, string? zipPath = null)
    {
        if (region != BattlenetConstants.RegionAsia && region != BattlenetConstants.RegionCn) return null;
        versionStr = ResolveVersionStr(versionStr, zipPath);
        if (string.IsNullOrEmpty(versionStr)) return null;
        return Path.Combine(D3PathConstants.RosbotGameToolsBase, $"{RegionDirName(region)}_{versionStr}", RosbotFinalDirName);
    }

    /// <summary>True when the target dir for (region, version) already holds the main exe. 1:1 Python target_already_has_version.</summary>
    public bool TargetAlreadyHasVersion(string region, string? versionStr = null, string? zipPath = null)
    {
        string? finalDir = GetTargetFinalDir(region, versionStr, zipPath);
        if (finalDir == null || !Directory.Exists(finalDir)) return false;
        if (FindRosbotExeRecursive(finalDir) == null) return false;
        string parentName = $"{RegionDirName(region)}_{ResolveVersionStr(versionStr, zipPath)}";
        return string.Equals(Path.GetFileName(Path.GetDirectoryName(finalDir)), parentName, StringComparison.Ordinal);
    }

    /// <summary>
    /// Apply update: extract to unique temp, recursive nested zip extraction when the exe is missing, copy the exe dir to
    /// final (flatten one level), fix RosBot\RosBot, copy RoS-BoT.ini, update + verify config, invalidate detection cache.
    /// </summary>
    public bool ApplyUpdate(string zipPath, string region, string? versionStr = null)
    {
        if (!File.Exists(zipPath) || !zipPath.EndsWith(ZipExtension, StringComparison.OrdinalIgnoreCase)) return false;
        if (region != BattlenetConstants.RegionAsia && region != BattlenetConstants.RegionCn)
        {
            ColorPrinter.Yellow($"{LogTag} Battle.net region not detected (need asia/cn), skipping update");
            return false;
        }
        if (string.IsNullOrEmpty(versionStr))
        {
            var v = RosbotVersionInfo.ParseVersionFromName(Path.GetFileName(zipPath));
            versionStr = v != null ? RosbotVersionInfo.VersionToString(v.Value) : DefaultVersionStr;
        }
        string parentName = $"{RegionDirName(region)}_{versionStr}";
        string parentDir = Path.Combine(D3PathConstants.RosbotGameToolsBase, parentName);
        string finalDir = Path.Combine(parentDir, RosbotFinalDirName);

        if (TargetAlreadyHasVersion(region, versionStr))
        {
            ColorPrinter.Gray($"{LogTag} Already up to date: {finalDir} has main exe for {region} {versionStr}, skipping extract");
            return true;
        }
        if (Directory.Exists(finalDir) && FindRosbotExeRecursive(finalDir) != null
            && !string.Equals(Path.GetFileName(parentDir), parentName, StringComparison.Ordinal))
            ColorPrinter.Gray($"{LogTag} Target directory exists but parent name mismatch, proceeding with update");

        string tempRoot = GetUniqueTempDir();
        var (rosDirOld, _, _) = GetCurrentRosDirInfo();
        try
        {
            Directory.CreateDirectory(tempRoot);
            ZipFile.ExtractToDirectory(zipPath, tempRoot, true);
            ColorPrinter.Green($"{LogTag} Extracted main zip to temp: {tempRoot}");

            string? exePath = FindRosbotExeRecursive(tempRoot);
            if (exePath == null)
            {
                ColorPrinter.Gray($"{LogTag} RoS-BoT.exe not found, searching for nested zips...");
                if (ExtractNestedZipsRecursive(tempRoot, ShellConstants.RosbotNestedZipMaxDepth, 0))
                    exePath = FindRosbotExeRecursive(tempRoot);
            }
            if (exePath == null)
            {
                ColorPrinter.Red($"{LogTag} RoS-BoT.exe not found after extraction (tried recursive nested zip extraction)");
                CleanupDirectorySafe(tempRoot);
                return false;
            }

            string exeDir = Path.GetDirectoryName(exePath)!;
            if (Directory.Exists(finalDir)) CleanupDirectorySafe(finalDir);
            if (!CopyExtractToDirNoNesting(exeDir, finalDir))
            {
                ColorPrinter.Red($"{LogTag} Failed to copy exe directory to final location");
                CleanupDirectorySafe(tempRoot);
                return false;
            }
            ColorPrinter.Green($"{LogTag} Copied to final: {finalDir}");
            CheckAndFixNestedRosbot(finalDir);

            if (!string.IsNullOrWhiteSpace(rosDirOld) && Directory.Exists(rosDirOld))
            {
                string oldIni = Path.Combine(rosDirOld, ShellConstants.RosbotIniFileName);
                string newIni = Path.Combine(finalDir, ShellConstants.RosbotIniFileName);
                if (File.Exists(oldIni))
                {
                    try
                    {
                        File.Copy(oldIni, newIni, true);
                        ColorPrinter.Gray($"{LogTag} Copied RoS-BoT.ini");
                    }
                    catch (IOException) { }
                }
            }

            SetRosDirectoryVerified(NormalizeDir(finalDir));
            CleanupDirectorySafe(tempRoot);
            ColorPrinter.Gray($"{LogTag} Cleaned up temp directory");
            return true;
        }
        catch (Exception ex)
        {
            ColorPrinter.Red($"{LogTag} Extract/move/update failed: {ex.Message}");
            CleanupDirectorySafe(tempRoot);
            return false;
        }
    }

    /// <summary>Check for update; only when region is asia/cn. Returns (zipPath, isNewer, versionStr, region). 1:1 Python check_update.</summary>
    public (string? ZipPath, bool IsNewer, string? VersionStr, string? Region) CheckUpdate()
    {
        string? region = GetBattlenetRegion();
        if (region != BattlenetConstants.RegionAsia && region != BattlenetConstants.RegionCn)
        {
            ColorPrinter.Gray($"{LogTag} Battle.net region not detected (need asia/cn), skipping update check");
            return (null, false, null, null);
        }
        var (zipPath, isNewer, versionStr) = GetBestNewerZip(region!);
        return (zipPath, isNewer, versionStr, region);
    }

    /// <summary>
    /// "Update ROSBOT" flow (run off the UI thread): E1 kill → E2 wait 1 s → check regions (current first, other when
    /// check_both_regions_for_update; Asia first when both) → no update: showNoUpdate(detection) unless silent → confirm(offer)
    /// unless silent → already on disk: point config there → ApplyUpdate. Does not start ROSBOT. Returns true when applied.
    /// Fixes Python bug: best update across regions was picked by string compare of version strings; uses numeric versions.
    /// 1:1 Python timers/one_shot_tasks.py do_rosbot_update.
    /// </summary>
    public async Task<bool> RunUpdateFlowAsync(bool silent, Func<RosbotUpdateOffer, bool>? confirm, Action<RosbotNoUpdateDetection>? showNoUpdate, CancellationToken cancellationToken = default)
    {
        ColorPrinter.Blue($"{PanelLogTag} Update ROSBOT: E1 kill existing");
        RosbotFlowController.StopRosbot();
        ColorPrinter.Blue($"{PanelLogTag} E2 wait 1s");
        await Task.Delay(ShellConstants.RosbotUpdateKillWaitMs, cancellationToken).ConfigureAwait(false);

        string? currentRegion = GetBattlenetRegion();
        bool checkBoth = D3D4TesterConfigService.Instance.GetValueSafe(ConfigKeys.RosSettingsCheckBothRegionsForUpdate, ShellConstants.RosbotCheckBothRegionsDefault);
        var regions = new List<string>();
        if (currentRegion == BattlenetConstants.RegionAsia || currentRegion == BattlenetConstants.RegionCn)
        {
            regions.Add(currentRegion!);
            ColorPrinter.Blue($"{PanelLogTag} Current region detected: {currentRegion}");
            if (checkBoth)
            {
                string other = currentRegion == BattlenetConstants.RegionAsia ? BattlenetConstants.RegionCn : BattlenetConstants.RegionAsia;
                regions.Add(other);
                ColorPrinter.Blue($"{PanelLogTag} Also checking: {other}");
            }
            if (regions.Count == 2 && regions[0] != BattlenetConstants.RegionAsia)
                regions = new List<string> { BattlenetConstants.RegionAsia, BattlenetConstants.RegionCn };
        }
        else
        {
            ColorPrinter.Gray($"{PanelLogTag} No region detected, checking both Asia and CN (Asia first)");
            regions.Add(BattlenetConstants.RegionAsia);
            regions.Add(BattlenetConstants.RegionCn);
        }

        var (curDir, _, curVer) = GetCurrentRosDirInfo();
        string curVerStr = curVer != null ? RosbotVersionInfo.VersionToString(curVer.Value) : ShellConstants.UnknownVersion;
        string downloadsDir = GetDownloadsDir();

        RosbotUpdateOffer? best = null;
        var detections = new List<RosbotUpdateRegionDetection>();
        foreach (var region in regions)
        {
            string regionDisplay = GetRegionDisplay(region);
            var (zipPath, isNewer, versionStr) = GetBestNewerZip(region);
            if (isNewer && !string.IsNullOrEmpty(zipPath))
            {
                if (best == null || VersionKey(RosbotVersionInfo.ParseVersionFromName(versionStr)) > VersionKey(RosbotVersionInfo.ParseVersionFromName(best.VersionStr)))
                {
                    best = new RosbotUpdateOffer(region, regionDisplay, versionStr, zipPath!);
                    ColorPrinter.Blue($"{PanelLogTag} Found update for {region}: {versionStr} at {zipPath}");
                }
                continue;
            }
            var candidates = FindRosbotZipsInDownloads(region);
            if (candidates.Count == 0)
                ColorPrinter.Gray($"{PanelLogTag} No zip in Downloads for region={region} (need 20-50MB, filename contains region keyword)");
            else
                ColorPrinter.Gray($"{PanelLogTag} region={region}: found {candidates.Count} zip(s), none newer than current {curVerStr} (current path: {curDir ?? "none"})");
            detections.Add(new RosbotUpdateRegionDetection(region, regionDisplay, candidates
                .Select(c => new RosbotUpdateCandidate(c.Path, c.Version != null ? RosbotVersionInfo.VersionToString(c.Version.Value) : "?", Math.Round(c.Size / (1024.0 * 1024.0), 1)))
                .ToList()));
        }

        if (best == null)
        {
            ColorPrinter.Gray($"{PanelLogTag} No update found in Downloads");
            if (!silent)
                showNoUpdate?.Invoke(new RosbotNoUpdateDetection(curDir ?? "", curVerStr, downloadsDir, detections));
            return false;
        }

        if (!silent)
        {
            bool confirmed = false;
            try { confirmed = confirm?.Invoke(best) ?? false; }
            catch (Exception ex) { ColorPrinter.Red($"{PanelLogTag} Update dialog error: {ex.Message}"); }
            if (!confirmed)
            {
                ColorPrinter.Gray($"{PanelLogTag} User cancelled update");
                return false;
            }
        }
        else
        {
            ColorPrinter.Gray($"{PanelLogTag} Scan-triggered update: applying without dialog");
        }

        if (TargetAlreadyHasVersion(best.Region, best.VersionStr, best.ZipPath))
        {
            ColorPrinter.Gray($"{PanelLogTag} Already up to date: target directory has main exe for {best.Region} {best.VersionStr}, skipping extract");
            string? finalDir = GetTargetFinalDir(best.Region, best.VersionStr, best.ZipPath);
            if (finalDir != null)
                SetRosDirectoryVerified(NormalizeDir(finalDir));
            return true;
        }

        ColorPrinter.Blue($"{PanelLogTag} E3c-E3e apply update: extract, copy RoS-BoT.ini, update ros_directory for {best.Region}");
        if (!ApplyUpdate(best.ZipPath, best.Region, best.VersionStr))
        {
            ColorPrinter.Yellow($"{PanelLogTag} apply_update failed");
            return false;
        }
        ColorPrinter.Green($"{PanelLogTag} E3f update applied for {best.Region}, ros_directory refreshed");
        ColorPrinter.Green($"{PanelLogTag} Update ROSBOT completed (ROSBOT not started)");
        return true;
    }

    private static string RegionDirName(string region) =>
        region == BattlenetConstants.RegionAsia ? D3PathConstants.RosbotDirNamespaceAsia : D3PathConstants.RosbotDirNamespaceCn;

    private static int VersionKey((int Major, int Minor)? version) =>
        version == null ? 0 : version.Value.Major * 10000 + version.Value.Minor;

    private static string? ResolveVersionStr(string? versionStr, string? zipPath)
    {
        if (!string.IsNullOrEmpty(versionStr) || string.IsNullOrEmpty(zipPath)) return versionStr;
        var v = RosbotVersionInfo.ParseVersionFromName(Path.GetFileName(zipPath));
        return v != null ? RosbotVersionInfo.VersionToString(v.Value) : null;
    }

    private static string NormalizeDir(string dir) =>
        Path.GetFullPath(dir).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);

    private static string? FindRosbotExeInDir(string rosDir)
    {
        if (File.Exists(rosDir) && rosDir.EndsWith(ExeExtension, StringComparison.OrdinalIgnoreCase)) return rosDir;
        if (!Directory.Exists(rosDir)) return null;
        try
        {
            foreach (var pattern in D3PathConstants.RosbotExePatterns)
            {
                var files = Directory.GetFiles(rosDir, pattern, SearchOption.TopDirectoryOnly);
                if (files.Length > 0) return files[0];
            }
        }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
        return null;
    }

    /// <summary>Write ros_directory, verify it reads back (10 x 100 ms), refresh status paths and invalidate the detection cache.</summary>
    private static void SetRosDirectoryVerified(string finalDirNorm)
    {
        var cfg = D3D4TesterConfigService.Instance;
        cfg.SetValueAsync(ConfigKeys.RosSettingsRosDirectory, finalDirNorm);
        bool verified = false;
        for (int i = 0; i < ShellConstants.RosbotConfigVerifyAttempts && !verified; i++)
        {
            Thread.Sleep(ShellConstants.RosbotConfigVerifyIntervalMs);
            string? updated = cfg.GetValueSafe<string>(ConfigKeys.RosSettingsRosDirectory, "");
            verified = !string.IsNullOrEmpty(updated) && string.Equals(NormalizeDir(updated), finalDirNorm, StringComparison.OrdinalIgnoreCase);
        }
        if (verified)
            ColorPrinter.Green($"{LogTag} Config updated: ros_directory = {finalDirNorm}");
        else
            ColorPrinter.Yellow($"{LogTag} Config path mismatch: expected {finalDirNorm}, got {cfg.GetValueSafe<string>(ConfigKeys.RosSettingsRosDirectory, "")}");

        RosbotDetection.InvalidateCache();
        ColorPrinter.Gray($"{LogTag} Cleared ROSBOT detection cache");
        GameInterfaceData.Instance.UpdateFromPaths(
            ConfigOptionsProvider.GetOptions<BattlenetOptions>().BattlenetPath ?? "",
            ConfigOptionsProvider.GetOptions<D3Options>().D3Path ?? "",
            finalDirNorm);
        GameInterfaceData.Instance.NotifyCallbacks();
    }

    private static string GetUniqueTempDir()
    {
        Directory.CreateDirectory(TempBaseDir);
        return Path.Combine(TempBaseDir, TempDirPrefix + Guid.NewGuid().ToString("N")[..8]);
    }

    private static List<string> FindNestedZips(string rootDir)
    {
        var zips = new List<string>();
        if (!Directory.Exists(rootDir)) return zips;
        foreach (var f in Directory.EnumerateFiles(rootDir, ZipPattern, SearchOption.AllDirectories))
        {
            string lower = Path.GetFileName(f).ToLowerInvariant();
            if (lower.Contains(ShellConstants.RosbotNestedZipKeyword1) || lower.Contains(ShellConstants.RosbotNestedZipKeyword2))
                zips.Add(Path.GetFullPath(f));
        }
        return zips;
    }

    /// <summary>Extract nested ros-bot zips in place until the exe appears or maxDepth is reached. 1:1 Python _extract_nested_zips_recursive.</summary>
    private static bool ExtractNestedZipsRecursive(string rootDir, int maxDepth, int currentDepth)
    {
        if (currentDepth >= maxDepth)
        {
            ColorPrinter.Yellow($"{LogTag} Reached max depth {maxDepth}, stopping recursive extraction");
            return false;
        }
        if (FindRosbotExeRecursive(rootDir) != null) return true;
        var nested = FindNestedZips(rootDir);
        if (nested.Count == 0) return false;
        ColorPrinter.Gray($"{LogTag} Found {nested.Count} nested zip(s), starting recursive extraction (depth {currentDepth + 1})");
        foreach (var zipPath in nested)
        {
            string zipDir = Path.GetDirectoryName(zipPath)!;
            string tempExtract = GetUniqueTempDir();
            try
            {
                Directory.CreateDirectory(tempExtract);
                ZipFile.ExtractToDirectory(zipPath, tempExtract, true);
                CopyExtractToDirNoNesting(tempExtract, zipDir);
                CleanupDirectorySafe(tempExtract);
                ColorPrinter.Gray($"{LogTag} Extracted nested zip: {Path.GetFileName(zipPath)}");
                SafeRemoveFile(zipPath);
                if (FindRosbotExeRecursive(rootDir) != null) return true;
                if (ExtractNestedZipsRecursive(rootDir, maxDepth, currentDepth + 1)) return true;
            }
            catch (Exception ex)
            {
                ColorPrinter.Yellow($"{LogTag} Failed to extract nested zip: {zipPath}, {ex.Message}");
                CleanupDirectorySafe(tempExtract);
            }
        }
        return FindRosbotExeRecursive(rootDir) != null;
    }

    /// <summary>Move inner RosBot\RosBot contents to the outer RosBot and remove the inner dir. 1:1 Python _check_and_fix_nested_rosbot.</summary>
    private static void CheckAndFixNestedRosbot(string finalDir)
    {
        if (!Directory.Exists(finalDir)) return;
        string nested = Path.Combine(finalDir, RosbotFinalDirName);
        if (!Directory.Exists(nested)) return;
        ColorPrinter.Yellow($"{LogTag} Found nested RosBot directory: {nested}, fixing...");
        try
        {
            foreach (var entry in new DirectoryInfo(nested).GetFileSystemInfos())
            {
                string dst = Path.Combine(finalDir, entry.Name);
                if (Directory.Exists(dst)) CleanupDirectorySafe(dst);
                else if (File.Exists(dst)) SafeRemoveFile(dst);
                if (entry is DirectoryInfo di) di.MoveTo(dst);
                else ((FileInfo)entry).MoveTo(dst);
            }
            CleanupDirectorySafe(nested);
            ColorPrinter.Green($"{LogTag} Fixed nested RosBot: moved contents to {finalDir}");
        }
        catch (Exception ex)
        {
            ColorPrinter.Yellow($"{LogTag} Failed to fix nested RosBot: {ex.Message}");
        }
    }

    /// <summary>Copy by streaming each file (works when the source is locked for delete). 1:1 Python _copy_directory_safe.</summary>
    private static bool CopyDirectorySafe(string srcDir, string dstDir)
    {
        try
        {
            if (!Directory.Exists(srcDir)) return false;
            Directory.CreateDirectory(dstDir);
            foreach (var dir in Directory.EnumerateDirectories(srcDir, "*", SearchOption.AllDirectories))
                Directory.CreateDirectory(Path.Combine(dstDir, Path.GetRelativePath(srcDir, dir)));
            foreach (var file in Directory.EnumerateFiles(srcDir, "*", SearchOption.AllDirectories))
            {
                string dst = Path.Combine(dstDir, Path.GetRelativePath(srcDir, file));
                Directory.CreateDirectory(Path.GetDirectoryName(dst)!);
                using var src = new FileStream(file, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
                using var dstStream = new FileStream(dst, FileMode.Create, FileAccess.Write, FileShare.None);
                src.CopyTo(dstStream);
            }
            return true;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>Copy srcDir into dstDir; a single top-level child dir is flattened. 1:1 _copy_extract_to_dir_no_nesting.</summary>
    private static bool CopyExtractToDirNoNesting(string srcDir, string dstDir)
    {
        if (!Directory.Exists(srcDir)) return false;
        try
        {
            var top = Directory.GetFileSystemEntries(srcDir);
            if (top.Length == 1 && Directory.Exists(top[0]))
                return CopyDirectorySafe(top[0], dstDir);
            return CopyDirectorySafe(srcDir, dstDir);
        }
        catch
        {
            return false;
        }
    }

    /// <summary>Rename to *.tmp_delete then delete (avoids lock issues); falls back to direct delete. 1:1 Python _safe_remove_file.</summary>
    private static bool SafeRemoveFile(string filePath)
    {
        if (!File.Exists(filePath)) return true;
        try
        {
            string temp = filePath + ShellConstants.TempDeleteSuffix;
            if (File.Exists(temp)) File.Delete(temp);
            File.Move(filePath, temp);
            File.Delete(temp);
            return true;
        }
        catch
        {
            try { File.Delete(filePath); return true; }
            catch { return false; }
        }
    }

    /// <summary>Rename then remove a directory tree; falls back to direct delete. 1:1 Python _cleanup_directory_safe.</summary>
    private static bool CleanupDirectorySafe(string dirPath)
    {
        if (!Directory.Exists(dirPath)) return true;
        try
        {
            string temp = dirPath + ShellConstants.TempDeleteSuffix;
            if (Directory.Exists(temp)) Directory.Delete(temp, true);
            Directory.Move(dirPath, temp);
            Directory.Delete(temp, true);
            return true;
        }
        catch
        {
            try { Directory.Delete(dirPath, true); return true; }
            catch { return false; }
        }
    }
}
