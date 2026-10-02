// PY-REF: none (DOT-only)
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Ctl;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Services;

/// <summary>
/// "Refresh game status" debug button: one full refresh (Battle.net, D3 with dynamic capture, D4 running, ROSBOT) through
/// RosbotTaskProcessor.RefreshAllGameStatus, then log the global state center values. Off the UI thread; one run at a time.
/// </summary>
public static class GameStatusDebugService
{
    private const string LogPrefix = "[GameStatus]";
    private static int _running;

    /// <summary>Register the RunLog debug button handler (idempotent).</summary>
    public static void RegisterTestAction() => TestActionRegistry.Register(I18nKeys.RosbotDebugGameStatus, RunInBackground);

    public static void RunInBackground()
    {
        if (Interlocked.Exchange(ref _running, 1) == 1)
        {
            ColorPrinter.Gray($"{LogPrefix} refresh already in progress, skip");
            return;
        }
        Task.Run(() =>
        {
            try
            {
                RosbotTaskProcessor.Instance.RefreshAllGameStatus(d3Dynamic: true);
                LogSnapshot();
            }
            catch (Exception ex)
            {
                ColorPrinter.Red($"{LogPrefix} refresh failed: {ex.Message}");
            }
            finally
            {
                Interlocked.Exchange(ref _running, 0);
            }
        });
    }

    private static void LogSnapshot()
    {
        var game = GameInterfaceData.Instance;
        var s = game.GetStateSnapshot();
        ColorPrinter.Blue($"{LogPrefix} Battle.net window={s.BattlenetWindowFound} login={s.BattlenetOnLoginScreen} disconnected={s.BattlenetDisconnected} normal={s.BattlenetNormalAvailable} waking={s.BattlenetWakingUp} region={s.BattlenetRegion ?? "-"}");
        ColorPrinter.Blue($"{LogPrefix} D3 running={s.D3Running} menu={s.D3OnLoginScreen} disconnected={s.D3Disconnected} in_game={s.D3InGame} hwnd=0x{game.D3WindowHwnd.ToInt64():X} title={game.D3WindowTitle ?? "-"} offset={game.WindowOffset}");
        ColorPrinter.Blue($"{LogPrefix} D4 running={game.D4.GameRunning} window={game.D4.WindowDetected}");
        ColorPrinter.Blue($"{LogPrefix} ROSBOT status={s.RosbotExtendedStatus} flow_master={s.RosbotFlowMasterEnabled} bn_only={s.EnsureBattlenetOnlyEnabled}");
    }
}
