// PY-REF: none (DOT-only)
using System.Diagnostics;
using DotCore.UIInspect;

namespace DotApps.d3d4tester.Core.Battlenet;

/// <summary>
/// Detects Battle.net stuck states: sleep (Agent went to sleep) or fetching/loading account info.
/// Used to trigger cache cleanup after StuckCleanupDelaySec (5 min) in login context.
/// </summary>
public static class BattlenetStuckDetector
{
    /// <summary>True when the process tree shows the update-agent sleep message or fetching/loading account keywords.</summary>
    public static bool IsStuck(Process? process)
    {
        if (process == null || process.HasExited) return false;
        if (IsSleepMode(process))
            return true;
        if (UIOperations.ContainsAnyKeywordInTree(process, BattlenetConstants.FetchingAccountInfoKeywords))
            return true;
        return false;
    }

    /// <summary>True when the update-agent sleep message is shown (the announcer group alone is always present, so match its text).</summary>
    public static bool IsSleepMode(Process? process)
    {
        if (process == null || process.HasExited) return false;
        return UIOperations.ContainsAnyKeywordInTree(process, BattlenetConstants.SleepModeTextKeywords);
    }

    /// <summary>True when "Fetching/Loading account info" (or 读取中/获取信息) is present in tree.</summary>
    public static bool IsFetchingAccountInfo(Process? process)
    {
        if (process == null || process.HasExited) return false;
        return UIOperations.ContainsAnyKeywordInTree(process, BattlenetConstants.FetchingAccountInfoKeywords);
    }
}
