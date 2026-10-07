// PY-REF: pyapps/d3-check/d3utils/rosbot_flow/flow_c_d3_direct.py
// PY-REF: pyapps/d3-check/d3utils/rosbot_flow/extension_flow_tick_step.py
using DotCore.Foundations;
using DotCore.Utils.Window;
using K = DotApps.d3d4tester.Core.D3InterfaceConstants;
using S = DotApps.d3d4tester.Core.D3StartGameAndTeleport;

namespace DotApps.d3d4tester.Core.Flow;

/// <summary>Outcome of <see cref="D3DirectProcess.Run"/>.</summary>
public enum D3DirectResult
{
    /// <summary>In game, map teleport done (A8): continue with F2 / E.</summary>
    Ready,

    /// <summary>D3 was ended (disconnect, C5w / C3 timeout) or is gone: route again from F1.</summary>
    D3Ended,
}

/// <summary>
/// [C] D3 is running (reused, or just launched by D): one sequential pass over the D3 screen. C2 resize -> C3 recognize until game_tool
/// (d3_start_game_button: C5a end ROSBOT, C5 click, C5w wait game_tool; d3_disconnected twice: F1d + F1c; timeout: C12) -> C6/C10 M
/// online check (skipped when just entered or right after a teleport) -> C7a open the map (bounty progress, at most two M rounds)
/// -> C7b minimize + teleport. Any D3 end returns <see cref="D3DirectResult.D3Ended"/>. While the CoreNodeBridge plugin state is live and
/// in game, C3 ends at once and C10 is skipped (the plugin reads the running game, so it is online).
/// </summary>
public static class D3DirectProcess
{
    private const string LogTag = "[C]";

    private static readonly object Lock = new();
    private static DateTime? _lastTeleportUtc;

    /// <summary>True while within C10SkipAfterTeleportSec of the last teleport.</summary>
    public static bool IsInTeleportCooldown()
    {
        lock (Lock) return _lastTeleportUtc is { } t && (DateTime.UtcNow - t).TotalSeconds < K.C10SkipAfterTeleportSec;
    }

    public static D3DirectResult Run(FlowContext ctx, bool d3JustEntered)
    {
        ColorPrinter.Blue($"{LogTag} [C1] D3 running (just_entered={d3JustEntered}) -> [C2] resize -> [C3] recognize");
        WindowResizer.ResizeWindowByTitlesToClientSize(D3WindowConstants.DiabloIIIWindowTitles,
            D3ScaleConstants.D3StandardResolutionWidth, D3ScaleConstants.D3StandardResolutionHeight);
        D3Manager.Instance.InvalidateWindowCache();

        if (!WaitInGame(ctx, ref d3JustEntered))
            return D3DirectResult.D3Ended;

        if (!d3JustEntered && !IsInTeleportCooldown() && !BridgeInGame())
        {
            ColorPrinter.Gray($"{LogTag} [C10] M-key online check");
            if (!S.StepC10SendM())
                return EndD3("C10 could not capture / send M");
            ctx.Wait(K.MapToggleWaitSec);
            if (S.StepC10Compare() != true)
                return EndD3("C10 M had no effect (disconnected)");
        }
        else
            ColorPrinter.Gray($"{LogTag} [C6] just entered, teleported recently or plugin in game -> skip C10");

        OpenMap(ctx);
        ColorPrinter.Gray($"{LogTag} [C7b] minimize map -> wait -> teleport");
        if (!S.HasGameWindowCapture() || !S.StepC7bMinimizeOnly())
            return EndD3("C7b no D3 capture");
        ctx.Wait(K.MapToggleWaitSec);
        if (!S.HasGameWindowCapture() || !S.StepC7bTeleportOnly())
            return EndD3("C7b no D3 capture");
        lock (Lock) _lastTeleportUtc = DateTime.UtcNow;
        GameInterfaceData.Instance.SetD3Status(true);
        ColorPrinter.Green($"{LogTag} [C8] teleport done -> [A8]");
        return D3DirectResult.Ready;
    }

    /// <summary>[C3] until game_tool. Start Game resets the timeout and marks the session as just entered. False when D3 was ended.</summary>
    private static bool WaitInGame(FlowContext ctx, ref bool d3JustEntered)
    {
        var deadline = DateTime.UtcNow.AddSeconds(K.C3TimeoutSec);
        while (DateTime.UtcNow < deadline)
        {
            ctx.ThrowIfStopped();
            if (!D3Manager.Instance.IsRunning())
            {
                ColorPrinter.Yellow($"{LogTag} [C3] D3 is gone");
                return false;
            }
            if (BridgeInGame())
            {
                ColorPrinter.Gray($"{LogTag} [C3] in game (CoreNodeBridge plugin)");
                return true;
            }
            switch (S.DetectD3AlreadyRunningState())
            {
                case S.StateGameTool:
                    ColorPrinter.Gray($"{LogTag} [C3] in game (d3_game_tool)");
                    return true;
                case S.StateDisconnect:
                    ctx.Wait(K.C3wWaitSec);
                    if (S.DetectD3AlreadyRunningState() == S.StateDisconnect)
                    {
                        ColorPrinter.Yellow($"{LogTag} [C4] disconnected (confirmed twice) -> [F1d] + [F1c] end D3");
                        GameInterfaceData.Instance.SetD3DynamicStatus(onLoginScreen: false, disconnected: true, inGame: false);
                        D3Manager.Instance.KillIfRunning();
                        return false;
                    }
                    continue;
                case S.StateStart:
                    ColorPrinter.Gray($"{LogTag} [C5a] end ROSBOT -> [C5] click Start Game");
                    RosbotManager.Instance.KillIfRunning();
                    if (S.ClickStartGameButtonIfFound())
                    {
                        deadline = DateTime.UtcNow.AddSeconds(K.C3TimeoutSec);
                        d3JustEntered = WaitGameToolAfterStart(ctx);
                        if (d3JustEntered) return true;
                        if (!D3Manager.Instance.IsRunning()) return false;
                    }
                    break;
            }
            ctx.Wait(K.C3wWaitSec);
        }
        EndD3($"C3 no game screen within {K.C3TimeoutSec}s");
        return false;
    }

    /// <summary>[C5w] Poll for d3_game_tool after Start Game; a disconnect or the timeout ends D3 (C12).</summary>
    private static bool WaitGameToolAfterStart(FlowContext ctx)
    {
        var until = DateTime.UtcNow.AddSeconds(K.C5wTimeoutSec);
        while (DateTime.UtcNow < until)
        {
            ctx.Wait(K.C3wWaitSec);
            string? state = S.DetectD3AlreadyRunningState();
            if (state == S.StateGameTool)
            {
                ColorPrinter.Green($"{LogTag} [C5w] d3_game_tool after Start Game");
                return true;
            }
            if (state == S.StateDisconnect)
                break;
        }
        EndD3("C5w no d3_game_tool after Start Game");
        return false;
    }

    /// <summary>[C7a] Make sure the map is open: bounty progress visible, else M + wait, at most two rounds; teleport runs either way.</summary>
    private static void OpenMap(FlowContext ctx)
    {
        for (int round = 0; round <= 2; round++)
        {
            if (S.StepC7aVerifyBountyProgress())
            {
                ColorPrinter.Gray($"{LogTag} [C7a] map open (bounty progress)");
                return;
            }
            if (round == 2) break;
            ColorPrinter.Gray($"{LogTag} [C7a] map not open -> M (round {round + 1})");
            S.StepC7aSendM();
            ctx.Wait(K.MapToggleWaitSec);
        }
        ColorPrinter.Yellow($"{LogTag} [C7a] no bounty progress after two M rounds, teleport anyway");
    }

    /// <summary>Live plugin state says the hero is in game.</summary>
    private static bool BridgeInGame()
    {
        var s = GameInterfaceData.Instance.GetStateSnapshot();
        return s.RosbotBridgeFresh && s.RosbotBridge is { InGame: true };
    }

    private static D3DirectResult EndD3(string reason)
    {
        ColorPrinter.Yellow($"{LogTag} [C12] {reason} -> end D3");
        D3Manager.Instance.KillIfRunning();
        return D3DirectResult.D3Ended;
    }
}
