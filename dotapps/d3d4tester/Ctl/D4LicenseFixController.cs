// PY-REF: none (DOT-only)
using DotApps.d3d4tester.Core.Battlenet;
using DotApps.d3d4tester.Core.D4;
using DotApps.d3d4tester.Core.Flow;
using DotApps.d3d4tester.Services;
using DotCore.Foundations;
using DotCore.Utils;

namespace DotApps.d3d4tester.Ctl;

/// <summary>
/// D4 "unable to find a valid license" (error 315306) client-side fix, idempotent (each step skips what is already done):
/// close D4 (window and process: the license dialog has no listed title) -> close Battle.net + Agent -> clear the license caches ->
/// Battle.net ready in the configured region (B; security checks wait for the user) -> launch D4 through Battle.net (D) -> read the
/// server license answer from the D4 client log. A launch with -sso that still gets no license is an account matter, reported as such.
/// </summary>
public static class D4LicenseFixController
{
    private const string LogPrefix = "[D4LicenseFix]";
    private const double LicenseCheckTimeoutSec = 120;
    private static readonly TimeSpan FixTimeout = TimeSpan.FromMinutes(10);

    public static bool Run()
    {
        ColorPrinter.Blue($"{LogPrefix} close D4 -> close Battle.net + Agent -> clear license caches -> Battle.net login -> launch D4 -> license check");
        D4Manager.Instance.KillIfRunning();
        if (!D4Manager.Instance.KillProcessesByName())
            ColorPrinter.Yellow($"{LogPrefix} D4 process still running (run d3d4tester as administrator?)");
        BattlenetManager.Instance.Close(force: true);
        ProcessUtil.KillProcessByExe(BattlenetConstants.AgentExeName, BattlenetConstants.KillWaitTimeoutSec, LogPrefix);
        BattlenetCacheCleanup.ClearLicenseCache();

        var ctx = FlowContext.WithTimeout(FixTimeout);
        try
        {
            if (BattlenetReadyProcess.Run(ctx, activate: true) != BattlenetReadyResult.Ready) return false;
            var launchUtc = DateTime.UtcNow;
            if (!GameLaunchProcess.Launch(ctx, GameLaunchTarget.D4))
            {
                ColorPrinter.Red($"{LogPrefix} D4 did not start from Battle.net");
                return false;
            }
            return ReportLicense(launchUtc, ctx);
        }
        catch (OperationCanceledException)
        {
            ColorPrinter.Red($"{LogPrefix} not finished within {FixTimeout.TotalMinutes} min (Battle.net login / security check pending?)");
            return false;
        }
    }

    private static bool ReportLicense(DateTime launchUtc, FlowContext ctx)
    {
        if (D4BuildInfo.Read(BattlenetNetHoldService.InstallPath) is not { } build)
        {
            ColorPrinter.Yellow($"{LogPrefix} D4 launched; install folder unknown, license answer not checked");
            return true;
        }
        var check = D4ClientLog.WaitForLicenseCheck(build.InstallDir, launchUtc, ctx, LicenseCheckTimeoutSec);
        if (check == null)
        {
            ColorPrinter.Yellow($"{LogPrefix} D4 launched; no license answer in FenrisDebug.txt within {LicenseCheckTimeoutSec}s");
            return true;
        }
        if (!check.LaunchedWithSso)
            ColorPrinter.Yellow($"{LogPrefix} D4 was not launched by Battle.net with -sso: it cannot get a license that way");
        if (check.Licensed)
        {
            ColorPrinter.Green($"{LogPrefix} license OK (num_licenses={check.LicenseCount})");
            return true;
        }
        ColorPrinter.Red($"{LogPrefix} server answer: this Battle.net account has no D4 license (num_licenses={check.LicenseCount?.ToString() ?? "?"}, "
            + $"315306), client side is fine (Battle.net login + -sso={check.LaunchedWithSso}, region {build.Branch}). Buy / redeem D4 on this account, "
            + "or log in with the account (and region) that owns it.");
        EventCenter.PlayFeedbackBeep();
        return false;
    }
}
