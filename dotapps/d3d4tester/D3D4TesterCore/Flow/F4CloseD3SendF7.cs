// PY-REF: pyapps/d3-check/d3utils/rosbot_flow_f4_close_d3_send_f7.py
using DotCore.Foundations;

namespace DotApps.d3d4tester.Core.Flow;

/// <summary>
/// [F4] F4a close D3, F4b send F7 to the system to close ROSBOT, then kill ROSBOT by PID and invalidate the lookup cache.
/// Caller refreshes D3/ROSBOT and enters B2. 1:1 Python d3utils/rosbot_flow_f4_close_d3_send_f7.py.
/// </summary>
public static class F4CloseD3SendF7
{
    public static void Run()
    {
        D3Manager.Instance.KillIfRunning();
        ColorPrinter.Blue("[F4] D3 process ended");
        if (RosbotManager.SendF7ToSystem())
        {
            RosbotExitState.SetF7SentForRosbot();
            ColorPrinter.Blue("[F4] F7 sent to system (close ROSBOT)");
        }
        else
        {
            ColorPrinter.Yellow("[F4] F7 send failed");
        }
        var mgr = RosbotManager.Instance;
        mgr.KillIfRunning();
        mgr.InvalidateLookupCache();
    }
}
