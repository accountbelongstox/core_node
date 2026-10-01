using DotCore.Foundations;

namespace DotApps.d3d4tester.Core.Flow;

/// <summary>
/// F1d (disconnect: set D3 disconnected, reset BN block) and F1c (end D3; next tick F_Entry).
/// 1:1 Python d3utils/rosbot_flow/flow_f1c_f1d.py.
/// </summary>
public static class F1cF1d
{
    /// <summary>[F1d] Set d3 disconnected and reset the BN flow state; caller then runs F1c.</summary>
    public static void RunF1dOnDisconnect()
    {
        GameInterfaceData.Instance.SetD3DynamicStatus(onLoginScreen: false, disconnected: true, inGame: false);
        BnBlockState.Reset(false);
        ColorPrinter.Yellow("[F1d] Disconnect detected, flow reset");
    }

    /// <summary>[F1c] End the D3 process. Next tick enters F_Entry.</summary>
    public static void RunF1cEndD3()
    {
        D3Manager.Instance.KillIfRunning();
        ColorPrinter.Blue("[F1c] D3 process ended, next tick F_Entry");
    }
}
