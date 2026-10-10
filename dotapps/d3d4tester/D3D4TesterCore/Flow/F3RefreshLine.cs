// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/f3_refresh_line.py
namespace DotApps.d3d4tester.Core.Flow;

/// <summary>
/// F3-only refresh: while silent, D3/ROSBOT refresh and the manager do not print; flow master builds one line and
/// gray-refreshes it so all F3-only messages share the same console line. 1:1 Python d3utils/f3_refresh_line.py.
/// </summary>
public static class F3RefreshLine
{
    private const string D3Ok = "ok";
    private const string D3No = "no";

    private static volatile bool _silent;

    public static bool IsSilent => _silent;

    public static void SetSilent(bool value) => _silent = value;

    /// <summary>"{prefix}D3 ok | ROSBOT running | F3: ..." (running = no main UI; paused = main UI visible).</summary>
    public static string BuildF3OnlyRefreshLine(string statusPrefix, bool d3Ok, string rosbotStatus, string f3Short) =>
        $"{statusPrefix}D3 {(d3Ok ? D3Ok : D3No)} | ROSBOT {rosbotStatus} | {f3Short}";
}
