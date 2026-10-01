using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Battlenet;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Ctl;

/// <summary>
/// One-shot Battle.net login helpers for manual actions: ensure the window (B3 + wait) and run the region login step if the
/// login UI is shown (CN: agree + NetEase; Asia: fill + submit). The ticked B block lives in Core.Flow.BattlenetReadyFlow.
/// </summary>
public static class BattlenetLoginCtl
{
    /// <summary>Run login if the login UI is shown. True when already logged in or the step ran.</summary>
    public static bool RunLoginFlowIfNeeded(string region)
    {
        var op = BattlenetOperationFactory.GetOperation(region);
        if (!op.IsOnLoginScreen() && !op.IsOnAsiaLoginScreen())
        {
            if (op.IsLoggedIn())
                ColorPrinter.Gray("[BattlenetLoginCtl] Already logged in (B16).");
            return true;
        }
        if (region == AppConstants.RegionCn)
        {
            ColorPrinter.Blue("[BattlenetLoginCtl] B10/B11: CN login (agree + NetEase).");
            return op.PerformCnLoginFlow(BattlenetConstants.CnAfterNetEaseClickSettleSec);
        }
        if (region == AppConstants.RegionAsia)
        {
            var creds = AsiaCredentialsService.GetCredentials(AsiaCredentialsService.RegionAsia);
            if (creds == null)
            {
                AsiaCredentialsService.ScheduleCredentialsDialog(AsiaCredentialsService.RegionAsia);
                return false;
            }
            ColorPrinter.Blue("[BattlenetLoginCtl] BN_LoginAsia: Asia login (fill + submit).");
            return op.PerformAsiaLoginFillAndSubmit(creds.Value.email, creds.Value.password);
        }
        return false;
    }

    /// <summary>Ensure Battle.net window: if none, start and wait (B3+B3w). Then activate. True if the window is present.</summary>
    public static async Task<bool> EnsureBattlenetWindowAsync(string region)
    {
        if (BattlenetManager.Instance.GetPath() == null)
        {
            ColorPrinter.Yellow("[BattlenetLoginCtl] Battle.net path not set or file not found.");
            return false;
        }
        var op = BattlenetOperationFactory.GetOperation(region);
        if (!BattlenetManager.Instance.HasWindow())
        {
            ColorPrinter.Blue("[BattlenetLoginCtl] B3: starting Battle.net (" + region + ")...");
            if (!op.Start())
            {
                ColorPrinter.Red("[BattlenetLoginCtl] B3: failed to start Battle.net.");
                return false;
            }
            for (int i = 0; i < AppConstants.WaitForBnWindowMaxAttempts; i++)
            {
                await Task.Delay(AppConstants.WaitForBnWindowMs);
                if (BattlenetManager.Instance.HasWindow())
                    break;
            }
        }
        if (!BattlenetManager.Instance.HasWindow())
        {
            ColorPrinter.Yellow("[BattlenetLoginCtl] Battle.net window not found after start (timeout).");
            return false;
        }
        op.ActivateWindow();
        GameInterfaceData.Instance.SetBattlenetWindowFound(true);
        return true;
    }
}
