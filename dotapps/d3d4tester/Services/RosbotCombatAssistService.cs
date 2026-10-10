// PY-REF: none (DOT-only)
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Flow;
using DotApps.d3d4tester.Ui;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Services;

/// <summary>
/// Combat assist, cast side: the plugin holds ROSBOT and only positions the hero, so ROSBOT casts nothing; the combat macro casts instead.
/// On the 1 s TickDriver it starts the combat macro while the plugin reports combat (assist on, any plugin mode: follow, standby,
/// commands, idle under the hold; in game, alive) and stops it when the fight ends, only when this service started it (a macro the user
/// started stays on). A macro the user stopped meanwhile (smart pause keys, hotkey) is not started again until the next fight.
/// </summary>
public static class RosbotCombatAssistService
{
    private const string LogTag = "[CombatAssist]";
    private static int _installed;
    private static bool _startedByAssist;
    private static bool _fighting;

    public static void Install()
    {
        if (Interlocked.Exchange(ref _installed, 1) == 1) return;
        TickDriver.Instance.RegisterEveryTick(_ => OnTick());
    }

    private static void OnTick()
    {
        var snapshot = GameInterfaceData.Instance.GetStateSnapshot();
        bool fight = snapshot.RosbotBridgeFresh && snapshot.RosbotBridge is { AssistEnabled: true, Combat: true, InGame: true, Dead: false };
        bool started = fight && !_fighting;
        _fighting = fight;
        var dispatcher = System.Windows.Application.Current?.Dispatcher;
        if (dispatcher == null || !(started || (!fight && _startedByAssist))) return;
        dispatcher.BeginInvoke(() => Apply(fight, started));
    }

    /// <summary>UI thread: start the macro at the start of a fight, stop the one this service started when the fight ends.</summary>
    private static void Apply(bool fight, bool started)
    {
        var controller = UiRegistry.GetCombatMacroController();
        if (controller == null) return;
        if (fight)
        {
            if (!started || controller.MacroRunning) return;
            ColorPrinter.Blue($"{LogTag} fight -> combat macro on");
            controller.StartMacro();
            _startedByAssist = controller.MacroRunning;
            return;
        }
        if (!_startedByAssist) return;
        _startedByAssist = false;
        if (!controller.MacroRunning) return;
        ColorPrinter.Blue($"{LogTag} fight over -> combat macro off");
        controller.StopMacro();
    }
}
