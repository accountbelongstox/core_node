using System.Diagnostics;
using DotApps.d3check.Ctl;
using DotCore.Foundations;

namespace DotApps.d3check.Services;

/// <summary>Kill D3 and ROSBOT processes. 1:1 Python get_d3_manager().kill_if_running + get_rosbot_manager().kill_if_running (log analyzer system error).</summary>
public static class D3AndRosbotKillHelper
{
    public static void KillD3IfRunning()
    {
        try
        {
            foreach (var p in Process.GetProcessesByName("Diablo III"))
            {
                try
                {
                    p.Kill();
                }
                catch { /* ignore */ }
                finally { p.Dispose(); }
            }
        }
        catch (Exception ex)
        {
            ColorPrinter.Gray("[LogAnalyzer] Kill D3: " + ex.Message);
        }
    }

    public static void KillD3AndRosbotIfRunning()
    {
        KillD3IfRunning();
        RosbotFlowController.StopRosbot();
    }
}
