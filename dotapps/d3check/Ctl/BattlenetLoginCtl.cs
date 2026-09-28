using System.IO;
using DotApps.d3check.Config;
using DotApps.d3check.Config.Options;
using DotApps.d3check.Constants;
using DotApps.d3check.Core;
using DotApps.d3check.Core.Battlenet;
using DotCore.Foundations;

namespace DotApps.d3check.Ctl;

/// <summary>
/// Battle.net login flow controller (B-block). Ensures BN window, then runs region-specific login flow if on login screen.
/// Aligned with ROSBOT_FLOW_MERMAID: B2→B3→B3w→B7/B8→B9→B10(CN)/B10a(Asia)/B12→B16.
/// </summary>
public static class BattlenetLoginCtl
{

    /// <summary>Run login flow if current UI is login screen: CN = agree+NetEase; Asia = fill account/password + submit. Returns true if already logged in or flow completed/skipped.</summary>
    public static bool RunLoginFlowIfNeeded(string region)
    {
        var op = BattlenetOperationFactory.GetOperation(region);
        if (!op.IsOnLoginScreen())
        {
            if (op.IsLoggedIn())
                ColorPrinter.Gray("[BattlenetLoginCtl] Already logged in (B16).");
            return true;
        }
        if (region == AppConstants.RegionCn)
        {
            ColorPrinter.Blue("[BattlenetLoginCtl] B10/B11: CN login (agree + NetEase).");
            return op.PerformCnLoginFlow((double)BattlenetConstants.CnAfterNetEaseClickSettleSec);
        }
        if (region == AppConstants.RegionAsia)
        {
            var creds = AsiaCredentialsService.GetCredentials(AsiaCredentialsService.RegionAsia);
            string? email = creds?.email;
            string? password = creds?.password;
            ColorPrinter.Blue("[BattlenetLoginCtl] B10a: Asia login (fill + submit).");
            return op.PerformAsiaLoginFillAndSubmit(email, password);
        }
        return false;
    }

    /// <summary>Ensure Battle.net window: if none, start and wait (B3+B3w). Then activate. Returns true if window is present and activated.</summary>
    public static async Task<bool> EnsureBattlenetWindowAsync(string region)
    {
        string? bnPath = ConfigOptionsProvider.GetOptions<BattlenetOptions>().BattlenetPath;
        if (string.IsNullOrWhiteSpace(bnPath)) bnPath = null;
        if (string.IsNullOrWhiteSpace(bnPath) || !File.Exists(bnPath))
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
