// PY-REF: none (DOT-only)
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Bridge;
using DotApps.d3d4tester.Core.Flow;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Services;

/// <summary>
/// What the flow does through the CoreNodeBridge plugin once ROSBOT runs (instead of screenshot recognition): wait until the plugin
/// reports the hero in game, pause ROSBOT (its pause key) so it does not act meanwhile, then
/// - follow configured (last follow command, saved when the panel sent it): replay it and hand control to the plugin by pausing
///   monitoring with ROSBOT kept paused, so ROSBOT, the log timeout and the follow walk never race (Resume monitoring gives it back);
///   follow only and fight: ROSBOT is not paused with its key but held by the plugin (it keeps pulsing, the plugin API stays live),
///   falling back to the key when the hold is not confirmed within HoldWaitSec;
/// - else, on a fresh ROSBOT start with a teleport sequence configured: the plugin clicks it (map teleport), then ROSBOT is resumed.
/// Nothing configured, or no live plugin in game: ROSBOT just keeps botting.
/// </summary>
public static class RosbotBridgeStartActions
{
    private const string LogTag = "[BridgeStart]";
    private const double InGameWaitSec = 90.0;
    private const double InGamePollSec = 2.0;
    private const double PauseSettleSec = 1.5;
    private const double HoldWaitSec = 10.0;
    /// <summary>Longer than the plugin's own 60 s command timeout, so its result (ok or timeout) always arrives before the app gives up.</summary>
    private static readonly TimeSpan CommandTimeout = TimeSpan.FromSeconds(65);

    /// <summary>Run after ROSBOT is online (started this cycle when freshStart). Throws OperationCanceledException when the flow stops.</summary>
    public static void Run(FlowContext ctx, bool freshStart)
    {
        bool follow = RosbotBridgePluginService.FollowConfigured(out string followValue, out string followTarget);
        string teleport = (ConfigBinding.GetValue(ConfigKeys.BridgeTeleportUiSequence, "") ?? "").Trim();
        bool doTeleport = freshStart && teleport.Length > 0;
        if (!follow && !doTeleport) return;
        if (!RosbotBridgePluginService.IsInstalled || !WaitPluginInGame(ctx))
        {
            ColorPrinter.Yellow($"{LogTag} plugin not live in game within {InGameWaitSec}s -> {(follow ? "follow" : "teleport")} skipped, ROSBOT keeps botting");
            return;
        }
        if (follow && RosbotBridgePluginService.FollowAssist(followValue))
        {
            RunAssistFollow(ctx, followValue, followTarget);
            return;
        }
        ColorPrinter.Blue($"{LogTag} pause ROSBOT -> plugin {(follow ? "follow (teleport skipped)" : "map teleport")}");
        RosbotManager.SendPauseToggleToSystem();
        ctx.Wait(PauseSettleSec);
        if (follow)
        {
            var result = RosbotBridgePluginService.SendCommandAndWait(ctx, CommandTimeout, RosbotPluginConstants.BridgeActionFollow, followTarget, followValue);
            ColorPrinter.Blue($"{LogTag} follow: {Describe(result)}; monitoring paused, ROSBOT stays paused (Resume monitoring hands control back)");
            RosbotFlowRunner.HoldForPlugin();
            return;
        }
        var teleported = RosbotBridgePluginService.SendCommandAndWait(ctx, CommandTimeout, RosbotPluginConstants.BridgeActionUiSequence, value: teleport);
        ColorPrinter.Blue($"{LogTag} map teleport: {Describe(teleported)} -> resume ROSBOT");
        RosbotManager.SendPauseToggleToSystem();
    }

    /// <summary>Follow only and fight: the follow command makes the plugin hold ROSBOT; monitoring pauses on that hold (else on the pause key).</summary>
    private static void RunAssistFollow(FlowContext ctx, string followValue, string followTarget)
    {
        var result = RosbotBridgePluginService.SendCommandAndWait(ctx, CommandTimeout, RosbotPluginConstants.BridgeActionFollow, followTarget, followValue);
        ColorPrinter.Blue($"{LogTag} follow only and fight: {Describe(result)}");
        var deadline = DateTime.UtcNow.AddSeconds(HoldWaitSec);
        while (DateTime.UtcNow < deadline)
        {
            var s = GameInterfaceData.Instance.GetStateSnapshot();
            if (s.RosbotBridgeFresh && s.RosbotBridge?.HoldState == RosbotBridgeState.HoldStateHolding)
            {
                ColorPrinter.Blue($"{LogTag} ROSBOT held by the plugin; monitoring paused (Resume monitoring hands control back)");
                RosbotFlowRunner.PauseHeldByPlugin();
                return;
            }
            ctx.Wait(InGamePollSec);
        }
        ColorPrinter.Yellow($"{LogTag} plugin hold not confirmed within {HoldWaitSec}s -> pause ROSBOT with its key");
        RosbotManager.SendPauseToggleToSystem();
        ctx.Wait(PauseSettleSec);
        RosbotFlowRunner.HoldForPlugin();
    }

    private static bool WaitPluginInGame(FlowContext ctx)
    {
        var deadline = DateTime.UtcNow.AddSeconds(InGameWaitSec);
        while (DateTime.UtcNow < deadline)
        {
            var s = GameInterfaceData.Instance.GetStateSnapshot();
            if (s.RosbotBridgeFresh && s.RosbotBridge is { InGame: true }) return true;
            ctx.Wait(InGamePollSec);
        }
        return false;
    }

    private static string Describe(Core.Bridge.RosbotBridgeCommandResult? r) =>
        r == null ? "no result (timeout)" : $"{(r.Ok ? "ok" : "failed")} {r.Message}";
}
