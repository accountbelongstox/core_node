// PY-REF: none (DOT-only)
using System.Diagnostics;
using DotCore.UIInspect;

namespace DotApps.d3d4tester.Core.Battlenet;

/// <summary>
/// Detects Battle.net stuck states by process tree text: sleep (Agent went to sleep) or fetching/loading account info (BnProbe).
/// </summary>
public static class BattlenetStuckDetector
{
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
