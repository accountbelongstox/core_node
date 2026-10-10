// PY-REF: pyapps/d3-check/d3utils/rosbot_flow/flow_master_driver.py
// PY-REF: pyapps/d3-check/d3utils/rosbot_flow_f0_entry.py
// PY-REF: pyapps/d3-check/d3utils/rosbot_flow_f1_d3_online.py
// PY-REF: pyapps/d3-check/d3utils/rosbot_flow_f4_close_d3_send_f7.py
using DotApps.d3d4tester.Constants;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Core.Flow;

/// <summary>
/// The ROSBOT flow (docs/ROSBOT_FLOW_MERMAID.md) as one sequential procedure on its own thread, started by "Start monitoring" and
/// cancelled by "Stop monitoring" (every wait ends at once). One cycle:
/// [F1] D3 running? no -> ROSBOT left without D3 is closed (ROSBOT must start after D3) -> [B] Battle.net ready (reused when logged in)
/// -> [D] launch D3; yes -> D3 reused. Both running = both reused, nothing restarted (F3 measures the log timeout from adoption).
/// [F2] ROSBOT online? no -> [E] start ROSBOT (autostart; no screen recognition) -> plugin start actions (ROSBOT paused: follow, else
/// map teleport via UI clicks, then resumed). Then [F3] monitor until a restart (F4: end D3 +
/// ROSBOT), D3 gone (F4), ROSBOT gone (D3 kept) or a ROSBOT-only restart (E again). The cycle repeats until stopped.
/// Pause halts the flow (monitoring stays on, so restart requests and the Battle.net guard stay idle), waits for the running step to
/// end and pauses a botting ROSBOT with its own pause key; Resume presses the key again for a ROSBOT it paused, restarts the F3 timeout
/// window and continues from F1 (everything still running is reused). Pause key and F4 take the GameControl lease.
/// </summary>
public static class RosbotFlowRunner
{
    private const string LogTag = "[Flow]";
    private const int StepFinishWaitMs = 20000;
    private const int LeaseWaitMs = 20000;
    private const int TaskStartWaitMs = 25000;
    private const string LeasePause = "pause key";
    private const string LeaseF4 = "F4 end D3 + ROSBOT";
    private const string LeaseRosbotWithoutD3 = "close ROSBOT without D3";

    private static readonly FlowThread Worker = new("RosbotFlow", RunCycle);
    private static readonly object PauseLock = new();
    private static readonly object StateLock = new();
    private static bool _rosbotPausedByFlow;
    /// <summary>ROSBOT process the pause handled (paused by key, or found not botting); another one is checked again.</summary>
    private static int _pausedRosbotPid;
    private static int _guardInstalled;
    private static int _guardBusy;

    private static GameInterfaceStateSnapshot State => GameInterfaceData.Instance.GetStateSnapshot();

    public static bool IsRunning => Worker.IsRunning;

    public static bool IsPaused => RosbotFlowState.Instance.Paused;

    /// <summary>Raised after Resume gave control back (the app ends what the user drove while paused, e.g. follow mode).</summary>
    public static event Action? Resumed;

    /// <summary>Start monitoring: set the flow flag and start the flow thread (idempotent; a paused flow is resumed).</summary>
    public static void Start()
    {
        if (IsPaused)
        {
            Resume();
            return;
        }
        RosbotFlowState.Instance.SetFlowMasterEnabled(true);
        Worker.Start();
    }

    /// <summary>
    /// Stop monitoring: clear the flow flag and pending restarts and cancel the flow at its current step. ROSBOT is left as it is; a taken
    /// control stays taken (Resume still presses the pause key again for a ROSBOT the pause stopped).
    /// </summary>
    public static void Stop()
    {
        RosbotFlowState.Instance.SetFlowMasterEnabled(false);
        RosbotRestartRequest.Clear();
        Worker.Stop();
    }

    /// <summary>
    /// Pause (take control): with or without monitoring. Halts the flow at its current step when monitoring runs, then presses ROSBOT's
    /// pause key when ROSBOT is botting. Already paused: ROSBOT is checked again and paused when it bots anyway (a ROSBOT process started
    /// meanwhile starts unpaused), so every take-control really stops ROSBOT. The task completes once the key was sent (or not needed);
    /// its result is true when a key was sent.
    /// </summary>
    public static Task<bool> Pause()
    {
        var state = RosbotFlowState.Instance;
        bool already;
        lock (StateLock)
        {
            already = state.Paused;
            if (!already) state.SetPaused(true);
        }
        if (!already)
        {
            Worker.Stop();
            ColorPrinter.Yellow($"{LogTag} paused (control taken)");
        }
        return Task.Run(() =>
        {
            if (!already && !Worker.WaitStopped(StepFinishWaitMs)) ColorPrinter.Yellow($"{LogTag} flow step still running after {StepFinishWaitMs / 1000}s");
            using var lease = GameControl.TryAcquire(LeasePause, LeaseWaitMs);
            return PauseRosbotIfBotting(already ? "re-check" : "pause");
        });
    }

    /// <summary>
    /// While control is taken: press the pause key for a botting ROSBOT that the pause did not stop (the same process keeps its "paused
    /// by flow" mark, so the key is never toggled twice). Caller holds the GameControl lease. True when the key was sent.
    /// </summary>
    private static bool PauseRosbotIfBotting(string why)
    {
        var state = RosbotFlowState.Instance;
        lock (PauseLock)
        {
            if (!state.Paused) return false;
            RosbotManager.Instance.InvalidateLookupCache();
            Refresh();
            int pid = State.RosbotFoundPid;
            if (_rosbotPausedByFlow && pid == _pausedRosbotPid) return false;
            if (!RosbotDetection.IsBotting(State))
            {
                ColorPrinter.Gray($"{LogTag} {why}: ROSBOT not botting ({State.RosbotExtendedStatus}), no pause key");
                _pausedRosbotPid = pid;
                return false;
            }
            RosbotInterruptGuard.WaitSafe(LeasePause, TaskStartWaitMs, () => !state.Paused);
            if (!state.Paused) return false;
            _rosbotPausedByFlow = RosbotManager.SendPauseToggleToSystem();
            _pausedRosbotPid = pid;
            ColorPrinter.Yellow($"{LogTag} {why}: ROSBOT #{pid} pause key {(_rosbotPausedByFlow ? "sent" : "send failed")}");
            return _rosbotPausedByFlow;
        }
    }

    /// <summary>
    /// Pause guard on the 1 s TickDriver: while control is taken, a ROSBOT process other than the one the pause handled (ROSBOT exited
    /// and was started again) is paused once when it bots, so a taken control never lets a new ROSBOT run tasks.
    /// </summary>
    public static void InstallPauseGuard()
    {
        if (Interlocked.Exchange(ref _guardInstalled, 1) == 1) return;
        TickDriver.Instance.RegisterEveryTick(_ =>
        {
            var s = State;
            if (!s.RosbotFlowPaused || s.RosbotFoundPid <= 0 || s.RosbotFoundPid == _pausedRosbotPid || !RosbotDetection.IsBotting(s)) return;
            if (Interlocked.Exchange(ref _guardBusy, 1) == 1) return;
            ColorPrinter.Yellow($"{LogTag} control taken but a new ROSBOT #{s.RosbotFoundPid} is botting -> pause it");
            Task.Run(() =>
            {
                try
                {
                    using var lease = GameControl.TryAcquire(LeasePause, LeaseWaitMs);
                    lock (PauseLock) if (_pausedRosbotPid != s.RosbotFoundPid) _rosbotPausedByFlow = false;
                    PauseRosbotIfBotting("guard");
                }
                finally
                {
                    Volatile.Write(ref _guardBusy, 0);
                }
            });
        });
    }

    /// <summary>
    /// Hand control to the plugin from the flow thread (follow mode right after ROSBOT started): ROSBOT was already paused with its key,
    /// so monitoring is paused with that ROSBOT marked as paused by the flow (Resume presses the key again) and the flow halts.
    /// </summary>
    public static void HoldForPlugin()
    {
        var state = RosbotFlowState.Instance;
        lock (StateLock)
        {
            if (state.Paused) return;
            state.SetPaused(true);
        }
        lock (PauseLock)
        {
            _rosbotPausedByFlow = true;
            _pausedRosbotPid = State.RosbotFoundPid;
        }
        ColorPrinter.Yellow($"{LogTag} paused: control handed to the plugin (ROSBOT paused)");
        Worker.Stop();
    }

    /// <summary>
    /// The user typed ROSBOT's pause key (F6), so ROSBOT paused itself: halt the flow without sending a key. Resume presses the key
    /// again only when ROSBOT was botting before the key.
    /// </summary>
    public static void PauseByUserKey(bool rosbotWasBotting)
    {
        var state = RosbotFlowState.Instance;
        lock (StateLock)
        {
            if (state.Paused) return;
            state.SetPaused(true);
        }
        lock (PauseLock)
        {
            _rosbotPausedByFlow = rosbotWasBotting;
            _pausedRosbotPid = State.RosbotFoundPid;
        }
        ColorPrinter.Yellow($"{LogTag} paused by the user's ROSBOT pause key (F6)");
        Worker.Stop();
    }

    /// <summary>The user typed ROSBOT's pause key (F6) to resume ROSBOT: continue the flow without sending a key.</summary>
    public static void ResumeByUserKey()
    {
        lock (PauseLock) _rosbotPausedByFlow = false;
        ColorPrinter.Blue($"{LogTag} resumed by the user's ROSBOT pause key (F6)");
        Resume();
    }

    /// <summary>Resume: press ROSBOT's pause key again for a ROSBOT the pause stopped, restart the F3 window; monitoring continues from F1.</summary>
    public static void Resume()
    {
        var state = RosbotFlowState.Instance;
        if (!state.Paused) return;
        Task.Run(() =>
        {
            using var lease = GameControl.TryAcquire(LeasePause, LeaseWaitMs);
            lock (PauseLock)
            {
                if (!state.Paused) return;
                Refresh();
                if (!state.Paused)
                {
                    ColorPrinter.Gray($"{LogTag} resume skipped: no longer paused");
                    return;
                }
                if (_rosbotPausedByFlow && State.RosbotFoundPid != _pausedRosbotPid)
                    ColorPrinter.Gray($"{LogTag} ROSBOT #{_pausedRosbotPid} the pause stopped is gone, no resume key");
                else if (_rosbotPausedByFlow)
                {
                    bool sent = RosbotManager.SendPauseToggleToSystem();
                    ColorPrinter.Blue($"{LogTag} ROSBOT resume key {(sent ? "sent" : "send failed")}");
                }
                _rosbotPausedByFlow = false;
                _pausedRosbotPid = 0;
                RosbotRestartRequest.Clear();
                F3LogTimeout.SetRosbotStartedAt();
                state.SetPaused(false);
                ColorPrinter.Green($"{LogTag} resumed");
                if (state.FlowMasterEnabled && !state.Paused) Worker.Start();
            }
            Resumed?.Invoke();
        });
    }

    private static void RunCycle(FlowContext ctx)
    {
        Refresh();
        if (!State.D3Running && D3Manager.Instance.IsProcessRunning())
            WaitForD3Window(ctx);
        if (!State.D3Running)
        {
            CloseRosbotWithoutD3();
            ColorPrinter.Blue($"{LogTag} [F1] D3 not running -> [B] Battle.net -> [D] launch D3");
            if (BattlenetReadyProcess.Run(ctx, activate: true) == BattlenetReadyResult.NoPath)
            {
                ctx.Wait(FlowTimings.NoBattlenetPathRetrySec);
                return;
            }
            if (!D3Manager.Instance.IsRunning())
            {
                if (!GameLaunchProcess.Launch(ctx, GameLaunchTarget.D3))
                {
                    ctx.Wait(FlowTimings.D3LaunchRetrySec);
                    return;
                }
            }
            Refresh();
        }
        else
            ColorPrinter.Blue($"{LogTag} [F1] D3 running -> reuse it");

        if (!RosbotDetection.IsOnline(State.RosbotExtendedStatus))
        {
            if (!RosbotFlowHost.GetConfig(ConfigKeys.RosSettingsAutoStartRosbot, true))
            {
                ColorPrinter.Gray($"{LogTag} [F2] ROSBOT offline and auto_start_rosbot is off -> wait (no teleport, no start)");
                ctx.Wait(FlowTimings.RosbotStartRetrySec);
                return;
            }
        }
        else
            ColorPrinter.Blue($"{LogTag} [F2] ROSBOT online -> reuse it");
        if (!StartRosbot(ctx))
            return;

        while (true)
        {
            var outcome = F3MonitorProcess.Run(ctx);
            switch (outcome.Exit)
            {
                case F3Exit.Restart:
                    ColorPrinter.Yellow($"{LogTag} restart ({outcome.ReasonId} {outcome.Detail}) -> [F4] end D3 + ROSBOT");
                    if (outcome.CountRestart) RosbotExitState.IncrementTotalRestartCount();
                    RosbotRestartRequest.NotifyExecuted(outcome.ReasonId, outcome.Detail, outcome.RestartBattlenet);
                    EndD3AndRosbot();
                    return;
                case F3Exit.D3Gone:
                    ColorPrinter.Yellow($"{LogTag} D3 is gone -> [F4] end ROSBOT");
                    EndD3AndRosbot();
                    return;
                case F3Exit.RosbotGone:
                    ColorPrinter.Yellow($"{LogTag} ROSBOT offline -> route again (D3 reused)");
                    return;
                case F3Exit.RosbotRestart:
                    ColorPrinter.Yellow($"{LogTag} ROSBOT restart requested -> [E] (ROSBOT closed and started again)");
                    if (!StartRosbot(ctx, restart: true)) return;
                    continue;
            }
        }
    }

    /// <summary>[F1] ROSBOT runs but D3 does not: close ROSBOT, so it is started again after the new D3 ([E]).</summary>
    /// <summary>[F1] D3 process up but no visible window yet (loading, minimized): wait for the window instead of launching D3 again.</summary>
    private static void WaitForD3Window(FlowContext ctx)
    {
        ColorPrinter.Blue($"{LogTag} [F1] D3 process running without window -> wait for it (no D3 launch)");
        var deadline = DateTime.UtcNow.AddSeconds(FlowTimings.D3WindowWaitSec);
        while (!State.D3Running && DateTime.UtcNow < deadline && D3Manager.Instance.IsProcessRunning())
        {
            ctx.Wait(FlowTimings.D3WindowPollSec);
            Refresh();
        }
    }

    private static void CloseRosbotWithoutD3()
    {
        var rosbot = RosbotManager.Instance;
        if (rosbot.FindRosbotProcesses().Count == 0) return;
        ColorPrinter.Yellow($"{LogTag} [F1] ROSBOT running without D3 -> close ROSBOT (it starts after D3)");
        using var lease = GameControl.TryAcquire(LeaseRosbotWithoutD3, LeaseWaitMs);
        rosbot.CloseGracefully();
        Refresh();
    }

    /// <summary>[F2] + [E] on the host (restart: [E] even when ROSBOT is online); false (after the retry wait) when ROSBOT could not be started.</summary>
    private static bool StartRosbot(FlowContext ctx, bool restart = false)
    {
        if (RosbotFlowHost.Current?.RunRosbotStart(ctx, restart) == true)
            return true;
        ColorPrinter.Yellow($"{LogTag} [E] ROSBOT not started, retry in {FlowTimings.RosbotStartRetrySec}s");
        ctx.Wait(FlowTimings.RosbotStartRetrySec);
        return false;
    }

    /// <summary>
    /// [F4] RBAssist order, without its fixed waits: F7 stops botting while D3 is still up, end D3, second F7 closes ROSBOT (polled until it
    /// exits, leftovers killed by PID), refresh. Also the restart path outside the flow (log system error).
    /// </summary>
    public static void EndD3AndRosbot()
    {
        using var lease = GameControl.TryAcquire(LeaseF4, LeaseWaitMs);
        var rosbot = RosbotManager.Instance;
        bool rosbotRunning = rosbot.FindRosbotProcesses().Count > 0;
        if (rosbotRunning)
        {
            RosbotManager.SendF7ToSystem();
            Thread.Sleep(RosbotConstants.F7StopSettleMs);
        }
        D3Manager.Instance.KillIfRunning();
        if (rosbotRunning) rosbot.CloseGracefully();
        Refresh();
    }

    private static void Refresh()
    {
        var host = RosbotFlowHost.Current;
        if (host == null) return;
        bool changed = host.RefreshD3Status(skipDynamic: true);
        changed |= host.RefreshRosbotStatus();
        if (changed) host.NotifyStateSync();
    }
}
