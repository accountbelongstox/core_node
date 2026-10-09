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
/// Battle.net ready in the configured region (B) -> launch D4 through Battle.net (D). The license comes from the Battle.net login
/// session, so the Battle.net client log is watched meanwhile: a web security check beeps and shows its URL, a failed login ends the
/// run with its error, and the launch must carry -sso.
/// </summary>
public static class D4LicenseFixController
{
    private const string LogPrefix = "[D4LicenseFix]";
    private const string SsoLaunchArg = "-sso";
    private const double LogPollIntervalSec = 2.0;
    private static readonly TimeSpan FixTimeout = TimeSpan.FromMinutes(10);

    public static bool Run()
    {
        ColorPrinter.Blue($"{LogPrefix} close D4 -> close Battle.net + Agent -> clear license caches -> Battle.net login -> launch D4");
        var watch = new LoginWatch(BattlenetClientLog.FromNow());
        D4Manager.Instance.KillIfRunning();
        if (!D4Manager.Instance.KillProcessesByName())
            ColorPrinter.Yellow($"{LogPrefix} D4 process still running (run d3d4tester as administrator?)");
        BattlenetManager.Instance.Close(force: true);
        ProcessUtil.KillProcessByExe(BattlenetConstants.AgentExeName, BattlenetConstants.KillWaitTimeoutSec, LogPrefix);
        BattlenetCacheCleanup.ClearLicenseCache();

        var ctx = FlowContext.WithTimeout(FixTimeout).WithYield(watch.ShouldAbort);
        try
        {
            if (BattlenetReadyProcess.Run(ctx, activate: true) != BattlenetReadyResult.Ready) return false;
            bool launched = GameLaunchProcess.Launch(ctx, GameLaunchTarget.D4);
            watch.Poll(force: true);
            ColorPrinter.Blue($"{LogPrefix} done, D4 launched={launched}, launched by Battle.net with {SsoLaunchArg}={watch.LaunchedWithSso}");
            return launched;
        }
        catch (OperationCanceledException)
        {
            ColorPrinter.Red($"{LogPrefix} stopped: {watch.FailReason ?? $"not finished within {FixTimeout.TotalMinutes} min"}");
            return false;
        }
    }

    /// <summary>Battle.net client log reactions, polled from the flow's wait slices.</summary>
    private sealed class LoginWatch
    {
        private readonly BattlenetClientLog _log;
        private readonly HashSet<string> _announcedChallenges = new(StringComparer.Ordinal);
        private DateTime _lastPollUtc = DateTime.MinValue;

        public LoginWatch(BattlenetClientLog log) => _log = log;

        public string? FailReason { get; private set; }
        public bool LaunchedWithSso { get; private set; }

        public bool ShouldAbort()
        {
            Poll(force: false);
            return FailReason != null;
        }

        public void Poll(bool force)
        {
            var now = DateTime.UtcNow;
            if (!force && (now - _lastPollUtc).TotalSeconds < LogPollIntervalSec) return;
            _lastPollUtc = now;
            foreach (var e in _log.ReadNew())
                Handle(e);
        }

        private void Handle(BattlenetLogEvent e)
        {
            switch (e.Kind)
            {
                case BattlenetLogEventKind.SecurityChallenge when _announcedChallenges.Add(e.Detail):
                    ColorPrinter.Yellow($"{LogPrefix} Battle.net login needs the web security check: complete it in the browser / Battle.net window: {e.Detail}");
                    EventCenter.PlayFeedbackBeep();
                    break;
                case BattlenetLogEventKind.LoggedIn:
                    ColorPrinter.Green($"{LogPrefix} Battle.net logged in (new login session)");
                    break;
                case BattlenetLogEventKind.LoginFailed:
                    FailReason = $"Battle.net login failed: {e.Detail} (security check not completed in time? finish it, then click again)";
                    EventCenter.PlayFeedbackBeep();
                    break;
                case BattlenetLogEventKind.OauthRejected:
                    ColorPrinter.Yellow($"{LogPrefix} Battle.net session token rejected (oauth/sso); a fresh login is required for the license");
                    break;
                case BattlenetLogEventKind.GameLaunched when e.Detail.Contains(D4ExeMarker, StringComparison.OrdinalIgnoreCase):
                    LaunchedWithSso = e.Detail.Contains(SsoLaunchArg, StringComparison.Ordinal);
                    ColorPrinter.Blue($"{LogPrefix} Battle.net launched D4: {e.Detail}");
                    break;
            }
        }

        private static string D4ExeMarker => D4Constants.ProcessNames[0];
    }
}
