// PY-REF: none (DOT-only)
using System.IO;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Core.Battlenet;

/// <summary>
/// Battle.net cache cleanup for stuck states (Agent went to sleep / Fetching-Loading account info).
/// Reddit/Blizzard: corrupted cache is the main cause; delete ProgramData and AppData Battle.net folders after fully closing BN/Agent.
/// BattlenetReadyProcess calls it only after sleep / account loading lasted StuckCleanupDelaySec (5 min).
/// </summary>
public static class BattlenetCacheCleanup
{
    /// <summary>%ProgramData%\Battle.net</summary>
    public static string ProgramDataBattleNet => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "Battle.net");

    /// <summary>%ProgramData%\Blizzard Entertainment</summary>
    public static string ProgramDataBlizzard => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "Blizzard Entertainment");

    /// <summary>%AppData%\Battle.net (Roaming)</summary>
    public static string AppDataBattleNet => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Battle.net");

    /// <summary>%LocalAppData%\Battle.net</summary>
    public static string LocalAppDataBattleNet => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Battle.net");

    /// <summary>
    /// Close Battle.net (and Agent) then delete the four cache folders. Call only when stuck in sleep/fetching for 5 min.
    /// Returns true if at least one folder was deleted or BN was closed; false if nothing done or error.
    /// </summary>
    public static bool ClearCache()
    {
        bool closed = false;
        try
        {
            if (BattlenetManager.Instance.HasWindow())
            {
                BattlenetManager.Instance.Close();
                closed = true;
                ColorPrinter.Blue("[BattlenetCacheCleanup] Closed Battle.net before cache cleanup.");
            }
        }
        catch (Exception ex)
        {
            ColorPrinter.Yellow("[BattlenetCacheCleanup] Close BN: " + ex.Message);
        }

        bool deleted = DeleteFolderIfExists(ProgramDataBattleNet, "ProgramData\\Battle.net")
            | DeleteFolderIfExists(ProgramDataBlizzard, "ProgramData\\Blizzard Entertainment")
            | DeleteFolderIfExists(AppDataBattleNet, "AppData\\Battle.net")
            | DeleteFolderIfExists(LocalAppDataBattleNet, "LocalAppData\\Battle.net");

        if (deleted)
            ColorPrinter.Green("[BattlenetCacheCleanup] Cache folders cleared. Restart Battle.net to continue.");
        return closed || deleted;
    }

    /// <summary>
    /// License / session caches only (Agent data cache, client cache and browser caches); keeps Agent product.db and Battle.net.config,
    /// so installs and the login region survive. Missing folders are skipped. Caller closes Battle.net and Agent first.
    /// </summary>
    public static bool ClearLicenseCache()
    {
        string programData = Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData);
        string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        bool deleted = DeleteFolderIfExists(Path.Combine(programData, "Battle.net", "Agent", "data", "cache"), "ProgramData\\Battle.net\\Agent\\data\\cache")
            | DeleteFolderIfExists(Path.Combine(ProgramDataBlizzard, "Battle.net", "Cache"), "ProgramData\\Blizzard Entertainment\\Battle.net\\Cache")
            | DeleteFolderIfExists(Path.Combine(localAppData, "Battle.net", "Cache"), "LocalAppData\\Battle.net\\Cache")
            | DeleteFolderIfExists(Path.Combine(localAppData, "Battle.net", "BrowserCaches"), "LocalAppData\\Battle.net\\BrowserCaches");
        if (!deleted)
            ColorPrinter.Gray("[BattlenetCacheCleanup] License caches already clean.");
        return deleted;
    }

    private static bool DeleteFolderIfExists(string fullPath, string label)
    {
        if (string.IsNullOrEmpty(fullPath) || !Directory.Exists(fullPath))
            return false;
        try
        {
            Directory.Delete(fullPath, recursive: true);
            ColorPrinter.Blue("[BattlenetCacheCleanup] Deleted: " + label);
            return true;
        }
        catch (Exception ex)
        {
            ColorPrinter.Yellow("[BattlenetCacheCleanup] Failed to delete " + label + ": " + ex.Message);
            return false;
        }
    }
}
