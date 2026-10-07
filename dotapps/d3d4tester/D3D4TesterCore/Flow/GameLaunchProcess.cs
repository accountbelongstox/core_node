// PY-REF: pyapps/d3-check/controller/login_try_screenshot_controller.py
using DotApps.d3d4tester.Core.Battlenet;
using DotApps.d3d4tester.Core.D4;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Core.Flow;

/// <summary>A game launched from Battle.net: window manager, tab + Play click, state write on window found, end ROSBOT before Play (D11a).</summary>
public sealed record GameLaunchTarget(string Label, GameWindowManager Manager, Func<IBattlenetOperation, bool> ClickTabAndPlay, Action OnWindowFound,
    bool EndRosbotBeforePlay)
{
    public static readonly GameLaunchTarget D3 = new("D3", D3Manager.Instance, BattlenetGameLauncher.ClickD3TabAndPlay,
        () => GameInterfaceData.Instance.SetD3Status(true), EndRosbotBeforePlay: true);

    public static readonly GameLaunchTarget D4 = new("D4", D4Manager.Instance, BattlenetGameLauncher.ClickD4TabAndPlay,
        () => GameInterfaceData.Instance.D4.GameRunning = true, EndRosbotBeforePlay: false);
}

/// <summary>
/// [D] Launch a game from a ready Battle.net (the caller ran <see cref="BattlenetReadyProcess"/>), one pass: [D4] activate Battle.net ->
/// [D11a] end ROSBOT (D3) -> [D9/D11] game tab + Play -> [D12] wait -> [D12b] poll the game window -> [D13] found. Never restarts
/// Battle.net; a failed pass returns false and the caller decides when to try again.
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
        if (!bn.ActivateWindow())
        {
            ColorPrinter.Yellow($"{tag} [D6f] Battle.net window not found");
            return false;
        }
        ctx.Wait(AfterActivateSec);
        if (target.EndRosbotBeforePlay)
        {
            ColorPrinter.Gray($"{tag} [D11a] end ROSBOT before starting {target.Label}");
            RosbotManager.Instance.KillIfRunning();
        }
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
        target.OnWindowFound();
        GameInterfaceData.Instance.NotifyCallbacks();
        ColorPrinter.Green($"{tag} [D13] {target.Label} window found");
        return true;
    }
}
