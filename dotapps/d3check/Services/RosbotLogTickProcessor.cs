using DotApps.d3check.Core;
using DotCore.Foundations;

namespace DotApps.d3check.Services;

/// <summary>
/// Drains <see cref="RosbotLogLineBridge"/> on the global poll tick, prints and analyzes lines. 1:1 Python rosbot_task_processor process_task drain + analyze_log_line.
/// </summary>
public static class RosbotLogTickProcessor
{
    public static void ProcessPendingLines()
    {
        bool any = false;
        lock (RosbotLogAnalyzer.SyncRoot)
        {
            foreach (var line in RosbotLogLineBridge.Drain())
            {
                ColorPrinter.Info("[ROSBOT] " + line);
                if (RosbotLogAnalyzer.AnalyzeLine(line))
                    any = true;
            }
        }
        if (any)
            GameInterfaceData.Instance.NotifyCallbacks();
    }
}
