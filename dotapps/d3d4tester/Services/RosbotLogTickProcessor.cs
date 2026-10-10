// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/rosbot_task_processor.py
using DotApps.d3d4tester.Core;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Services;

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
                Monitor.MonitorService.Instance.OnLogLine(line);
            }
        }
        if (any)
            GameInterfaceData.Instance.NotifyCallbacks();
    }
}
