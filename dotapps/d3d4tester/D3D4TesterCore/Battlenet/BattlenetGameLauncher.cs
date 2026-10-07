// PY-REF: none (DOT-only)
using DotCore.Foundations;

namespace DotApps.d3d4tester.Core.Battlenet;

/// <summary>
/// Switch to the D3 or D4 tab on the Battle.net main UI and click its Play button, driven by <see cref="BattlenetOperationBase.DetectGameUi"/>:
/// already Starting -> done; Update / Install / Try For Free -> fail without clicking; Play (or unrecognized) -> click.
/// Single tab + Play path for the D block (D3 and D4).
/// </summary>
public static class BattlenetGameLauncher
{
    private const string LogTag = "[BattlenetGameLauncher]";
    private const int TabToPlayDelayMs = 1000;

    public static bool ClickD3TabAndPlay(IBattlenetOperation op) => ClickTabAndPlay(op, "D3", ui => (ui.D3Tab, ui.D3Action), op.ClickD3Tab);

    public static bool ClickD4TabAndPlay(IBattlenetOperation op) => ClickTabAndPlay(op, "D4", ui => (ui.D4Tab, ui.D4Action), op.ClickD4Tab);

    private static bool ClickTabAndPlay(IBattlenetOperation op, string game, Func<BattlenetGameUi, (bool Tab, BattlenetGameAction Action)> select, Func<bool> clickTab)
    {
        var (tab, action) = select(DetectGameUi());
        if (!tab)
            ColorPrinter.Gray($"{LogTag} {game} tab not recognized by id, trying the region tab finder");
        if (action == BattlenetGameAction.Starting)
        {
            ColorPrinter.Blue($"{LogTag} {game} already starting");
            return true;
        }
        if (!clickTab())
        {
            ColorPrinter.Yellow($"{LogTag} {game} tab not clicked");
            return false;
        }
        Thread.Sleep(TabToPlayDelayMs);
        (_, action) = select(DetectGameUi());
        switch (action)
        {
            case BattlenetGameAction.Starting:
                ColorPrinter.Blue($"{LogTag} {game} already starting");
                return true;
            case BattlenetGameAction.Update:
            case BattlenetGameAction.Install:
            case BattlenetGameAction.TryFree:
            case BattlenetGameAction.Downloading:
            case BattlenetGameAction.DownloadPaused:
                ColorPrinter.Yellow($"{LogTag} {game} page shows {action} instead of Play, not starting");
                return false;
        }
        bool ok = op.ClickStartGame();
        if (ok) ColorPrinter.Green($"{LogTag} {game} Play clicked");
        else ColorPrinter.Yellow($"{LogTag} {game} Play button not found");
        return ok;
    }

    private static BattlenetGameUi DetectGameUi() => BattlenetClientStateDetector.Detect().GameUi;
}
