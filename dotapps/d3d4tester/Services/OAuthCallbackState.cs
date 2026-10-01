using DotApps.d3d4tester.Constants;

namespace DotApps.d3d4tester.Services;

/// <summary>
/// OAuth callback state for CN Battle.net login: the Tampermonkey script on the NetEase OAuth page talks to the HTTP bridge
/// (oauth-done, oauth-ping, oauth-step1-received). Flow waits on OAuth done; the status bar shows script connected from the ping.
/// Core flow code reaches it through BattlenetFlowHooks (wired by SystemInitializer). 1:1 Python share/oauth_callback.py.
/// </summary>
public static class OAuthCallbackState
{
    private static readonly ManualResetEventSlim OauthDone = new(false);
    private static readonly object Lock = new();
    private static DateTime _lastPingUtc = DateTime.MinValue;
    private static DateTime _lastOauthDoneUtc = DateTime.MinValue;

    /// <summary>Clear the done flag before starting a wait (right after clicking NetEase login).</summary>
    public static void ResetOauthDone() => OauthDone.Reset();

    /// <summary>Block until oauth-done arrives or timeout. True when the user completed the web login.</summary>
    public static bool WaitOauthDone(TimeSpan timeout) => OauthDone.Wait(timeout);

    /// <summary>Called by the HTTP bridge on oauth-done (GET/POST).</summary>
    public static void NotifyOauthDone()
    {
        lock (Lock) _lastOauthDoneUtc = DateTime.UtcNow;
        OauthDone.Set();
    }

    /// <summary>Non-blocking: true once oauth-done was notified (tick-driven flow).</summary>
    public static bool IsOauthDone() => OauthDone.IsSet;

    /// <summary>Called by the HTTP bridge on oauth-ping (script health check).</summary>
    public static void NotifyPing()
    {
        lock (Lock) _lastPingUtc = DateTime.UtcNow;
    }

    /// <summary>True when the script pinged within the timeout (status bar health indicator).</summary>
    public static bool IsScriptConnected(double timeoutSec = AppConstants.OauthScriptPingTimeoutSec)
    {
        lock (Lock)
            return (DateTime.UtcNow - _lastPingUtc).TotalSeconds <= timeoutSec;
    }

    /// <summary>
    /// Queried by the flow/end page (cross-origin, no shared storage): true when oauth-done was submitted within validSec.
    /// Consumes the mark once. Returns the submit time as Unix seconds (Python time.time()).
    /// </summary>
    public static (bool Received, double? At) GetAndConsumeStep1Received(double validSec = ShellConstants.OauthStep1ValidSec)
    {
        lock (Lock)
        {
            if (_lastOauthDoneUtc == DateTime.MinValue || (DateTime.UtcNow - _lastOauthDoneUtc).TotalSeconds > validSec)
                return (false, null);
            double at = new DateTimeOffset(_lastOauthDoneUtc).ToUnixTimeMilliseconds() / 1000.0;
            _lastOauthDoneUtc = DateTime.MinValue;
            return (true, at);
        }
    }
}
