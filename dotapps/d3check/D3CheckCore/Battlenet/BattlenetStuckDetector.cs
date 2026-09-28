using System.Diagnostics;
using DotCore.UIInspect;

namespace DotApps.d3check.Core.Battlenet;

/// <summary>
/// Detects Battle.net stuck states: sleep (Agent went to sleep) or fetching/loading account info.
/// Used to trigger cache cleanup after StuckCleanupDelaySec (5 min) in login context.
/// </summary>
public static class BattlenetStuckDetector
{
    /// <summary>True when process tree has sleep-mode AutomationId (announcer) or fetching/loading account keywords.</summary>
    public static bool IsStuck(Process? process)
    {
        if (process == null || process.HasExited) return false;
        if (UIOperations.ContainsAnyAutomationIdInTree(process, BattlenetConstants.SleepModeAutomationIdMarkers))
            return true;
        if (UIOperations.ContainsAnyKeywordInTree(process, BattlenetConstants.FetchingAccountInfoKeywords))
            return true;
        return false;
    }

    /// <summary>True when sleep-mode UI is present. 1:1 existing sleep detection.</summary>
    public static bool IsSleepMode(Process? process)
    {
        if (process == null || process.HasExited) return false;
        return UIOperations.ContainsAnyAutomationIdInTree(process, BattlenetConstants.SleepModeAutomationIdMarkers);
    }

    /// <summary>True when "Fetching/Loading account info" (or 读取中/获取信息) is present in tree.</summary>
    public static bool IsFetchingAccountInfo(Process? process)
    {
        if (process == null || process.HasExited) return false;
        return UIOperations.ContainsAnyKeywordInTree(process, BattlenetConstants.FetchingAccountInfoKeywords);
    }
}
