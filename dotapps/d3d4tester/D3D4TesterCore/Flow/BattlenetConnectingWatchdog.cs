// PY-REF: none (DOT-only)
using DotApps.d3d4tester.Core.Battlenet;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Core.Flow;

/// <summary>
/// Restarts Battle.net when the probed client state stays "Connecting" longer than <see cref="ConnectingTimeoutSec"/>
/// (reads GameInterfaceData, written by the BN-only refresh every flow step and the 10 s probe). Runs on the flow step.
/// </summary>
public static class BattlenetConnectingWatchdog
{
    public const double ConnectingTimeoutSec = 120.0;
    private const string LogTag = "[BNWatchdog]";

    private static DateTime? _connectingSinceUtc;

    public static void Tick()
    {
        var state = GameInterfaceData.Instance.GetStateSnapshot().BattlenetClientState;
        if (state != BattlenetClientState.Connecting)
        {
            _connectingSinceUtc = null;
            return;
        }
        var now = DateTime.UtcNow;
        _connectingSinceUtc ??= now;
        double elapsed = (now - _connectingSinceUtc.Value).TotalSeconds;
        if (elapsed < ConnectingTimeoutSec) return;
        ColorPrinter.Yellow($"{LogTag} Battle.net connecting for {(int)elapsed}s (> {(int)ConnectingTimeoutSec}s) -> restart");
        _connectingSinceUtc = null;
        BattlenetManager.Instance.Restart();
        BnBlockState.Reset(forBnOnly: true);
        BnBlockState.Reset(forBnOnly: false);
        BnOnlyFlow.ResetState();
    }
}
