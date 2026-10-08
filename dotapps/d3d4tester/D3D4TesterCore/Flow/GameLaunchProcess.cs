// PY-REF: pyapps/d3-check/controller/login_try_screenshot_controller.py
using DotApps.d3d4tester.Core.Battlenet;
using DotApps.d3d4tester.Core.D4;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Core.Flow;

/// <summary>A game launched from Battle.net: window manager, tab + Play click, state write on window found, end ROSBOT before Play (D11a).</summary>
public sealed record GameLaunchTarget(string Label, GameWindowManager Manager, Func<IBattlenetOperation, bool> ClickTabAndPlay, Action OnWindowFound,
    bool EndRosbotBeforePlay, Func<string?> DirectProductCode)
{
    public static readonly GameLaunchTarget D3 = new("D3", D3Manager.Instance, BattlenetGameLauncher.ClickD3TabAndPlay,
        () => GameInterfaceData.Instance.SetD3Status(true), EndRosbotBeforePlay: true,
        () => BattlenetManager.Instance.GetD3ProductCode(GameInterfaceData.Instance.GetStateSnapshot().BattlenetUiRegion));

    public static readonly GameLaunchTarget D4 = new("D4", D4Manager.Instance, BattlenetGameLauncher.ClickD4TabAndPlay,
        () => GameInterfaceData.Instance.D4.GameRunning = true, EndRosbotBeforePlay: false, () => null);
}

/// <summary>
/// [D] Launch a game from a ready Battle.net (the caller ran <see cref="BattlenetReadyProcess"/>): [D11a] end ROSBOT (D3) -> direct
/// launch Battle.net.exe --exec="launch &lt;product&gt;" (RBAssist method, re-sent every DirectRetrySec until the client process runs, up to
/// DirectTimeoutSec) -> fallback [D4] activate Battle.net -> [D9/D11] game tab + Play -> [D12] wait -> [D12b] poll the game window ->
/// [D13] found. Never restarts Battle.net; a failed pass returns false and the caller decides when to try again.
/// </summary>
public static class GameLaunchProcess
{
    private const string LogTag = "[D]";
    private const double AfterKillSec = 5.0;
    private const double AfterActivateSec = 1.0;
    private const double AfterPlaySec = 5.0;
    private const double WindowPollTimeoutSec = 10.0;
    private const double WindowPollIntervalSec = 0.5;
    private const int WindowPollLogEveryN = 4;
    private const double DirectRetrySec = 10.0;
    private const double DirectTimeoutSec = 60.0;
    private const double DirectPollSec = 1.0;

    /// <summary>True when this call found the game window after Play; false on any failed step.</summary>
    public static bool Launch(FlowContext ctx, GameLaunchTarget target, bool killGameFirst = false)
    {
        string tag = $"{LogTag}[{target.Label}]";
        if (killGameFirst && target.Manager.IsRunning())
        {
            ColorPrinter.Blue($"{tag} end current {target.Label} process");
            target.Manager.KillIfRunning();
            ctx.Wait(AfterKillSec);
        }
        var bn = BattlenetManager.Instance;
        if (target.EndRosbotBeforePlay)
        {
            ColorPrinter.Gray($"{tag} [D11a] end ROSBOT before starting {target.Label}");
            RosbotManager.Instance.KillIfRunning();
        }
        if (target.DirectProductCode() is { } product && LaunchDirect(ctx, target, product))
            return true;
        if (!bn.ActivateWindow())
        {
            ColorPrinter.Yellow($"{tag} [D6f] Battle.net window not found");
            return false;
        }
        ctx.Wait(AfterActivateSec);
        if (!target.ClickTabAndPlay(BattlenetOperationFactory.GetOperation()))
        {
            ColorPrinter.Yellow($"{tag} [D8] {target.Label} tab / Play not available");
            return false;
        }
        ColorPrinter.Gray($"{tag} [D12] wait then poll the {target.Label} window up to {WindowPollTimeoutSec}s");
        ctx.Wait(AfterPlaySec);
        if (!target.Manager.PollUntilWindowAppears(WindowPollTimeoutSec, WindowPollIntervalSec, WindowPollLogEveryN))
        {
            ColorPrinter.Yellow($"{tag} [D13] {target.Label} window not found in time");
            return false;
        }
        return Found(target, tag);
    }

    /// <summary>Direct launch: send --exec, re-send every DirectRetrySec, poll the window every second up to DirectTimeoutSec.</summary>
    private static bool LaunchDirect(FlowContext ctx, GameLaunchTarget target, string product)
    {
        string tag = $"{LogTag}[{target.Label}]";
        var deadline = DateTime.UtcNow.AddSeconds(DirectTimeoutSec);
        var nextSend = DateTime.MinValue;
        while (DateTime.UtcNow < deadline)
        {
            if (DateTime.UtcNow >= nextSend && !target.Manager.IsProcessRunning())
            {
                if (!BattlenetManager.Instance.LaunchProduct(product))
                {
                    ColorPrinter.Yellow($"{tag} direct launch {product} could not be sent, fall back to tab + Play");
                    return false;
                }
                nextSend = DateTime.UtcNow.AddSeconds(DirectRetrySec);
            }
            ctx.Wait(DirectPollSec);
            D3Manager.Instance.DismissNewVersionPopup();
            if (target.Manager.IsWindowReady())
                return Found(target, tag);
        }
        ColorPrinter.Yellow($"{tag} direct launch {product}: no {target.Label} window in {DirectTimeoutSec}s, fall back to tab + Play");
        return false;
    }

    private static bool Found(GameLaunchTarget target, string tag)
    {
        target.OnWindowFound();
        GameInterfaceData.Instance.NotifyCallbacks();
        ColorPrinter.Green($"{tag} [D13] {target.Label} window found");
        return true;
    }
}
