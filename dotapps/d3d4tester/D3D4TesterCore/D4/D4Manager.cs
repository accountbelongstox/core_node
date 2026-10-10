// PY-REF: dotapps/d3d4tester/reference/py_d3check/controller/d4func/screenshot_handler.py
// PY-REF: dotapps/d3d4tester/reference/py_d3check/d4utils/d4_battlenet_operation.py
using DotCore.Utils;

namespace DotApps.d3d4tester.Core.D4;

/// <summary>
/// Diablo IV window management on <see cref="GameWindowManager"/>: windows matched by D4 title (EndsWith, same as the D4
/// window-only capture). Single D4 window lookup for capture, launch polling and calibration.
/// </summary>
public sealed class D4Manager : GameWindowManager
{
    public static D4Manager Instance { get; } = new();

    private D4Manager()
    {
    }

    protected override string LogPrefix => "[D4Manager]";

    protected override string GameLabel => "D4";

    protected override IReadOnlyList<string> ProcessNames => D4Constants.ProcessNames;

    public override IReadOnlyList<WindowFinder.WindowInfo> FindWindows() =>
        WindowFinder.FindWindowsByTitles(D4Constants.WindowTitles, WindowFinder.TitleMatchMode.EndsWith);
}
