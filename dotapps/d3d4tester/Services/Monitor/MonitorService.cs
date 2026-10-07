// PY-REF: none (DOT-only)
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Battlenet;
using DotApps.d3d4tester.Core.Flow;
using DotApps.d3d4tester.Core.Monitor;
using DotApps.d3d4tester.Ctl;
using DotCore.Foundations;
using DotCore.Utils;

namespace DotApps.d3d4tester.Services.Monitor;

/// <summary>Monitor state for the page (read on the UI thread).</summary>
public sealed record MonitorStatus(
    bool Active, bool D3Running, bool RosbotOnline, double LogIdleSec, double HistoryIdleSec, int Restarts,
    int Deaths, int Fails, int Runs, string? SpeedFactor, bool InCombat, string LastLogLine, bool LogsDisabled);

/// <summary>
/// RBAssist main loop merged into the app. "Monitoring" is the ROSBOT flow (flow master): log-driven events and watchdogs run only while
/// it is on, as RBAssist only watched while monitoring. Runs on the 1 s TickDriver; logs.txt lines come from the existing tail
/// (RosbotLogTickProcessor), history.txt has its own tail. Restarts go through <see cref="RosbotRestartRequest"/> (flow F4 -> B2);
/// every restart, including the existing F3 timeout and log disconnect, gets the error screenshot, error trigger and notification here.
/// Differences from RBAssist: log / history timer triggers fire once per idle period instead of every 200 ms; the special portal timer
/// repeats every N s instead of every N ms.
/// </summary>
public sealed class MonitorService
{
    public const string ReasonErrorPopup = "error_popup";
    public const string ReasonMemory = "memory";
    public const string ReasonTrigger = "trigger";
    private const string StatePrefixUrshi = "urshi";
    private const string StatePrefixTownPortal = "tp";
    private const string StatePrefixTownPortal2 = "tp2";
    private const double IllusionSettleSec = 5;
    private const int PopupScanEveryTicks = 2;
    private const int RolloverEveryTicks = 2;
    private const int TuningEveryTicks = 5;
    private const int MemoryEveryTicks = 10;
    private const int VkShift = 0x10;
    private const int CombatColorR = 255;
    private const int CombatColorG = 69;
    private const int CombatColorB = 0;
    private const int PnFirstSuffix = 101;
    private const string RolloverSuffix = ".1";
    private const string PureNumbersDir = "Pure Numbers";
    private const string PnLogsPrefix = "PN-logs.txt.";
    private const string PnHistoryPrefix = "PN-history.txt.";
    private const string PnLogsSubDir = "Logs";
    private const string PnHistorySubDir = "History";
    private const double BytesPerMb = 1024.0 * 1024.0;

    private readonly object _lock = new();
    private readonly ConcurrentQueue<string> _historyQueue = new();
    private readonly Dictionary<string, bool> _edgeStates = new(StringComparer.Ordinal);
    private readonly HashSet<int> _logTimerFired = new();
    private readonly HashSet<int> _historyTimerFired = new();
    private readonly Dictionary<int, DateTime> _portalLastFire = new();
    private readonly HashSet<int> _tunedD3 = new();
    private readonly HashSet<int> _tunedRosbot = new();
    private RosbotLogFileWatcher? _historyWatcher;
    private bool _installed;
    private int _tick;
    private int _lastMinute = -1;
    private bool? _flowEnabled;
    private bool? _d3Running;
    private bool? _rosbotOnline;
    private DateTime _monitorStartUtc = DateTime.UtcNow;
    private DateTime? _lastLogUtc;
    private DateTime? _lastHistoryUtc;
    private string _lastLogLine = "";
    private string _lastHistoryLine = "";
    private string _lastDeathStamp = "";
    private string _lastFailStamp = "";
    private string _lastRunStamp = "";
    private int _deaths;
    private int _fails;
    private int _runs;
    private bool _logsDisabled;
    private bool _inCombat;
    private bool _portalActive;
    private bool _portalPaused;
    private DateTime _portalStartUtc;
    private DateTime? _shrineInfiniteUtc;
    private DateTime? _shrineSpeedUtc;
    private bool _buffActive;
    private bool _blockCombatSwitch;
    private bool _illusionFound;
    private DateTime _illusionFoundUtc;
    private DateTime _lastPeriodicShotUtc = DateTime.UtcNow;
    private (DateTime DueUtc, ErrorPopupHit Hit)? _deferredRestart;
    private DateTime? _logRolloverStamp;
    private DateTime? _historyRolloverStamp;
    private int _townPortalPending;

    public static MonitorService Instance { get; } = new();

    private MonitorService()
    {
    }

    public string LastLogLine
    {
        get { lock (_lock) return _lastLogLine; }
    }

    public string LastHistoryLine
    {
        get { lock (_lock) return _lastHistoryLine; }
    }

    /// <summary>Wire once after RosbotTaskProcessor.Install: history tail, F3 history source, forced sequence, restart hook, tick, exit hook.</summary>
    public void Install()
    {
        if (_installed) return;
        _installed = true;
        TriggerEngine.Instance.Load();
        D3D4TesterConfigChangeHub.Notifier.Subscribe(key =>
        {
            if (key == null || key == ConfigKeys.MonitorTriggers) TriggerEngine.Instance.Load();
        });
        _historyWatcher = new RosbotLogFileWatcher(line => _historyQueue.Enqueue(line));
        _historyWatcher.Start(RosbotLogPaths.GetHistoryFilePath());
        F3LogTimeout.HistoryLastModifiedProvider = () => _historyWatcher?.LastModifiedUtc;
        RosbotUiAutomation.ForcedSequenceProvider = () =>
            MonitorSettings.GetBool(ConfigKeys.MonitorForceSequence) ? MonitorSettings.GetString(ConfigKeys.MonitorForceSequenceName) : null;
        RosbotRestartRequest.Executed += OnRestartExecuted;
        EventCenter.Hub.Subscribe(AppEventIds.ExtensionRosbotStarted, OnRosbotStarted);
        _logRolloverStamp = RolloverStamp(RosbotLogPaths.GetLogsFilePath());
        _historyRolloverStamp = RolloverStamp(RosbotLogPaths.GetHistoryFilePath());
        CheckRosbotLogLevel();
        lock (_lock) _flowEnabled = RosbotFlowState.Instance.FlowMasterEnabled;
        TickDriver.Instance.RegisterEveryTick(OnTick);
        ShutdownManager.RegisterShutdownHook(OnShutdown);
        TriggerEngine.Instance.Fire(MonitorEvents.AppLaunch);
        if (MonitorSettings.GetBool(ConfigKeys.MonitorAutoStartOnLaunch))
        {
            if (WindowInputHelper.IsKeyDown(VkShift))
                MonitorLog.Info("Auto start skipped (Shift held)");
            else
            {
                MonitorLog.Info("Auto start monitoring on launch");
                RosbotTaskProcessor.Instance.RequestStartFlow();
            }
        }
    }

    public MonitorStatus GetStatus()
    {
        DateTime now = DateTime.UtcNow;
        lock (_lock)
        {
            return new MonitorStatus(
                _flowEnabled == true, _d3Running == true, _rosbotOnline == true,
                IdleSeconds(now, _lastLogUtc), IdleSeconds(now, _lastHistoryUtc), RosbotExitState.GetTotalRestartCount(),
                _deaths, _fails, _runs, ExternalGameTools.CurrentSpeedFactor, _inCombat, _lastLogLine, _logsDisabled);
        }
    }

    /// <summary>Restart D3 + ROSBOT through the flow (ignored while monitoring is off, as RBAssist).</summary>
    public void RequestRestart(string reasonId, string detail, bool restartBattlenet)
    {
        if (!RosbotFlowState.Instance.FlowMasterEnabled)
        {
            MonitorLog.Warn($"Restart ({reasonId}) ignored: monitoring is off");
            return;
        }
        if (RosbotFlowState.Instance.Paused)
        {
            MonitorLog.Warn($"Restart ({reasonId}) ignored: monitoring is paused");
            return;
        }
        MonitorLog.Warn($"Restart requested: {reasonId} {detail}");
        RosbotRestartRequest.Request(reasonId, detail, restartBattlenet);
    }

    /// <summary>Game speed action: combat when the ROSBOT overlay shows enough combat-cursor pixels, then the matching factor.</summary>
    public void ApplyGameSpeed(string normalFactor, string combatFactor)
    {
        int count = 0;
        using (var bmp = GameWindowActions.CaptureClient(GameWindowActions.FindRosbotOverlayHwnd()))
            if (bmp != null) count = D3PixelProbes.CountCenterColor(bmp, CombatColorR, CombatColorG, CombatColorB);
        bool combat = count >= MonitorSettings.GetInt(ConfigKeys.MonitorProbeFight, MonitorSettings.FightThresholdDefault);
        lock (_lock) _inCombat = combat;
        ExternalGameTools.SetSpeed(combat ? combatFactor : normalFactor);
    }

    /// <summary>Town portal after delayMs (one pending at a time, RBAssist SENDTPTOD3).</summary>
    public void ScheduleTownPortal(int delayMs)
    {
        if (Interlocked.Exchange(ref _townPortalPending, 1) == 1) return;
        _ = Task.Run(async () =>
        {
            try
            {
                if (delayMs > 0) await Task.Delay(delayMs).ConfigureAwait(false);
                GameWindowActions.PostTownPortal();
            }
            finally
            {
                Volatile.Write(ref _townPortalPending, 0);
            }
        });
    }

    /// <summary>Apply process tuning to the current D3 / ROSBOT processes now (page button).</summary>
    public void ApplyTuningNow()
    {
        lock (_lock)
        {
            _tunedD3.Clear();
            _tunedRosbot.Clear();
        }
        ApplyTuning();
    }

    /// <summary>Called for each logs.txt line on the tick thread (RosbotLogTickProcessor).</summary>
    public void OnLogLine(string line)
    {
        bool active;
        lock (_lock)
        {
            _lastLogLine = line;
            _lastLogUtc = DateTime.UtcNow;
            _logTimerFired.Clear();
            active = _flowEnabled == true;
        }
        if (!active) return;
        var engine = TriggerEngine.Instance;
        engine.Fire(MonitorEvents.LogMatch, line);
        string stamp = line.Length >= RosbotLogMarkers.TimestampPrefixLength ? line[..RosbotLogMarkers.TimestampPrefixLength] : line;
        if (ContainsAny(line, RosbotLogMarkers.Death) && stamp != _lastDeathStamp)
        {
            _lastDeathStamp = stamp;
            lock (_lock) _deaths++;
            engine.Fire(MonitorEvents.DeathDetected);
            MonitorScreenshotService.CaptureKind(MonitorScreenshotKinds.Death);
        }
        if (ContainsAny(line, RosbotLogMarkers.Fail) && stamp != _lastFailStamp)
        {
            _lastFailStamp = stamp;
            lock (_lock) _fails++;
            engine.Fire(MonitorEvents.FailDetected);
            MonitorScreenshotService.CaptureKind(MonitorScreenshotKinds.Fail);
        }
        if (line.Contains(RosbotLogMarkers.NewRun, StringComparison.Ordinal) && stamp != _lastRunStamp)
        {
            _lastRunStamp = stamp;
            lock (_lock) _runs++;
            _illusionFound = false;
            engine.Fire(MonitorEvents.NewRun);
        }
        TrackPortal(line);
        TrackShrines(line);
    }

    private void OnTick(IFlowTick _)
    {
        _tick++;
        var s = GameInterfaceData.Instance.GetStateSnapshot();
        var engine = TriggerEngine.Instance;
        int minute = DateTime.Now.Minute;
        if (minute != _lastMinute)
        {
            _lastMinute = minute;
            engine.Fire(MonitorEvents.ScheduledTime);
        }
        bool active = s.RosbotFlowMasterEnabled;
        HandleFlowEdge(active);
        DrainHistory(active);
        if (!active) return;
        HandleProcessEdges(s);
        DateTime now = DateTime.UtcNow;
        EvaluateIdleTimers(now);
        EvaluatePortalTimer(now);
        EvaluateShrineTimers(now);
        EvaluatePixelProbes(s);
        if (!_blockCombatSwitch) engine.Fire(MonitorEvents.CombatSwitch);
        if (_tick % PopupScanEveryTicks == 0) ScanPopups(now);
        if (_deferredRestart is { } d && now >= d.DueUtc)
        {
            _deferredRestart = null;
            RequestRestart(ReasonErrorPopup, d.Hit.Kind.ToString(), false);
        }
        if (_tick % RolloverEveryTicks == 0) CheckRollovers();
        if (_tick % TuningEveryTicks == 0) ApplyTuning();
        if (_tick % MemoryEveryTicks == 0) CheckD3Memory();
        int minutes = Math.Max(1, MonitorSettings.GetInt(ConfigKeys.MonitorScreenshotPeriodicMinutes, MonitorSettings.PeriodicMinutesDefault));
        if (MonitorSettings.ScreenshotEnabled(MonitorScreenshotKinds.Periodic) && (now - _lastPeriodicShotUtc).TotalMinutes >= minutes)
        {
            _lastPeriodicShotUtc = now;
            MonitorScreenshotService.CaptureKind(MonitorScreenshotKinds.Periodic);
        }
    }

    private void HandleFlowEdge(bool active)
    {
        bool? previous;
        lock (_lock)
        {
            previous = _flowEnabled;
            _flowEnabled = active;
        }
        if (previous == null || previous == active) return;
        if (active)
        {
            lock (_lock)
            {
                _monitorStartUtc = DateTime.UtcNow;
                _d3Running = null;
                _rosbotOnline = null;
            }
            _lastPeriodicShotUtc = DateTime.UtcNow;
            CheckRosbotLogLevel();
            MonitorLog.Info("Monitoring started");
            TriggerEngine.Instance.Fire(MonitorEvents.MonitoringStart);
        }
        else
        {
            _deferredRestart = null;
            MonitorLog.Info("Monitoring stopped");
            TriggerEngine.Instance.Fire(MonitorEvents.MonitoringStop);
        }
    }

    private void HandleProcessEdges(GameInterfaceStateSnapshot s)
    {
        bool online = RosbotDetection.IsOnline(s.RosbotExtendedStatus);
        bool? d3Before, rosbotBefore;
        lock (_lock)
        {
            d3Before = _d3Running;
            rosbotBefore = _rosbotOnline;
            _d3Running = s.D3Running;
            _rosbotOnline = online;
        }
        var engine = TriggerEngine.Instance;
        if (d3Before != s.D3Running)
            engine.Fire(s.D3Running ? MonitorEvents.D3Launch : MonitorEvents.D3Exit);
        if (rosbotBefore == false && online) engine.Fire(MonitorEvents.RosbotLaunch);
        if (rosbotBefore == true && !online) engine.Fire(MonitorEvents.RosbotExit);
    }

    private void DrainHistory(bool active)
    {
        while (_historyQueue.TryDequeue(out var line))
        {
            lock (_lock)
            {
                _lastHistoryLine = line;
                _lastHistoryUtc = DateTime.UtcNow;
                _historyTimerFired.Clear();
            }
            if (active) TriggerEngine.Instance.Fire(MonitorEvents.HistoryMatch, line);
        }
    }

    private void EvaluateIdleTimers(DateTime now)
    {
        double logIdle, historyIdle;
        lock (_lock)
        {
            logIdle = (now - Max(_lastLogUtc, _monitorStartUtc)).TotalSeconds;
            historyIdle = (now - Max(_lastHistoryUtc, _monitorStartUtc)).TotalSeconds;
        }
        var engine = TriggerEngine.Instance;
        engine.Evaluate(MonitorEvents.LogTimer, (i, t) => FireOnce(_logTimerFired, i, logIdle >= ParseArg(t.EventArg)));
        engine.Evaluate(MonitorEvents.HistoryTimer, (i, t) => FireOnce(_historyTimerFired, i, historyIdle >= ParseArg(t.EventArg) * 60));
    }

    private bool FireOnce(HashSet<int> fired, int index, bool condition)
    {
        lock (_lock)
        {
            if (!condition || fired.Contains(index)) return false;
            fired.Add(index);
            return true;
        }
    }

    private void TrackPortal(string line)
    {
        string extra = MonitorSettings.GetString(ConfigKeys.MonitorProbePortalKeys);
        var keys = RosbotLogMarkers.PortalKeys.Concat(extra.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
        if (!_portalActive && keys.Any(k => line.Contains(k, StringComparison.Ordinal)))
        {
            _portalActive = true;
            _portalPaused = false;
            _portalStartUtc = DateTime.UtcNow;
            _portalLastFire.Clear();
        }
        if (!_portalActive) return;
        if (line.Contains(RosbotLogMarkers.PortalPause, StringComparison.Ordinal))
            _portalPaused = true;
        if (_portalPaused && line.Contains(RosbotLogMarkers.PortalResume, StringComparison.Ordinal))
        {
            _portalPaused = false;
            _portalStartUtc = DateTime.UtcNow;
        }
        if (ContainsAny(line, RosbotLogMarkers.PortalEnd))
        {
            _portalActive = false;
            _portalPaused = false;
        }
    }

    private void EvaluatePortalTimer(DateTime now)
    {
        if (!_portalActive || _portalPaused) return;
        double elapsed = (now - _portalStartUtc).TotalSeconds;
        TriggerEngine.Instance.Evaluate(MonitorEvents.SpecialPortalTimer, (i, t) =>
        {
            int sec = ParseArg(t.EventArg);
            if (elapsed < sec) return false;
            if (_portalLastFire.TryGetValue(i, out var last) && (now - last).TotalSeconds < Math.Max(1, sec)) return false;
            _portalLastFire[i] = now;
            return true;
        });
    }

    private void TrackShrines(string line)
    {
        var engine = TriggerEngine.Instance;
        if (_shrineInfiniteUtc == null && line.Contains(RosbotLogMarkers.ShrineInfinite, StringComparison.Ordinal))
            StartShrine(ref _shrineInfiniteUtc, MonitorEvents.ShrineInfinite);
        if (_shrineSpeedUtc == null && line.Contains(RosbotLogMarkers.ShrineSpeed, StringComparison.Ordinal))
            StartShrine(ref _shrineSpeedUtc, MonitorEvents.ShrineSpeed);
        if (_buffActive && ContainsAny(line, RosbotLogMarkers.BuffReset))
        {
            _shrineInfiniteUtc = null;
            _shrineSpeedUtc = null;
            EndBuffIfDone();
        }

        void StartShrine(ref DateTime? started, string eventId)
        {
            started = DateTime.UtcNow;
            _buffActive = true;
            if (!engine.HasEnabled(eventId)) return;
            _blockCombatSwitch = true;
            MonitorLog.Info("Combat switch paused (shrine buff)");
            engine.Fire(eventId);
        }
    }

    private void EvaluateShrineTimers(DateTime now)
    {
        bool expired = Expire(ref _shrineInfiniteUtc, MonitorEvents.ShrineInfinite) | Expire(ref _shrineSpeedUtc, MonitorEvents.ShrineSpeed);
        if (expired) EndBuffIfDone();

        bool Expire(ref DateTime? started, string eventId)
        {
            if (started == null) return false;
            var trigger = TriggerEngine.Instance.Triggers.FirstOrDefault(t => t.Enabled && t.Event == eventId);
            if (trigger == null || ParseArg(trigger.EventArg) <= 0 || (now - started.Value).TotalSeconds < ParseArg(trigger.EventArg)) return false;
            started = null;
            return true;
        }
    }

    private void EndBuffIfDone()
    {
        if (_shrineInfiniteUtc != null || _shrineSpeedUtc != null) return;
        _buffActive = false;
        if (_blockCombatSwitch)
        {
            _blockCombatSwitch = false;
            MonitorLog.Info("Combat switch resumed");
        }
        TriggerEngine.Instance.Fire(MonitorEvents.BuffEnd);
    }

    private void EvaluatePixelProbes(GameInterfaceStateSnapshot s)
    {
        var engine = TriggerEngine.Instance;
        bool urshi = engine.HasEnabled(MonitorEvents.UrshiOpen);
        bool tp = engine.HasEnabled(MonitorEvents.TownPortal);
        bool tp2 = engine.HasEnabled(MonitorEvents.TownPortalAfterIllusion);
        if (!(urshi || tp || tp2) || !s.D3Running) return;
        using var bmp = GameWindowActions.CaptureClient(GameWindowActions.FindD3Hwnd());
        if (bmp == null) return;
        if (urshi)
        {
            bool open = D3PixelProbes.IsUrshiOpen(bmp, D3PixelProbes.ParseThresholds(MonitorSettings.GetString(ConfigKeys.MonitorProbeUrshi, MonitorSettings.UrshiDefault), 100, 6, 140));
            engine.Evaluate(MonitorEvents.UrshiOpen, (i, _) => Rising(StatePrefixUrshi, i, open));
        }
        if (!tp && !tp2) return;
        int tpPixels = D3PixelProbes.CountTownPortalPixels(bmp);
        int threshold = MonitorSettings.GetInt(ConfigKeys.MonitorProbeTownPortal, MonitorSettings.TownPortalThresholdDefault);
        if (tp)
            engine.Evaluate(MonitorEvents.TownPortal, (i, _) => Rising(StatePrefixTownPortal, i, tpPixels > threshold));
        if (!tp2) return;
        if (!_illusionFound && D3PixelProbes.IsIllusionFound(bmp, D3PixelProbes.ParseThresholds(MonitorSettings.GetString(ConfigKeys.MonitorProbeFindIllusion, MonitorSettings.FindIllusionDefault), 60, 1, 2)))
        {
            _illusionFound = true;
            _illusionFoundUtc = DateTime.UtcNow;
        }
        var finishThresholds = D3PixelProbes.ParseThresholds(MonitorSettings.GetString(ConfigKeys.MonitorProbeFinishIllusion, MonitorSettings.FinishIllusionDefault), 100, 25);
        engine.Evaluate(MonitorEvents.TownPortalAfterIllusion, (i, _) =>
        {
            if (!Rising(StatePrefixTownPortal2, i, tpPixels > threshold)) return false;
            if (_illusionFound && (DateTime.UtcNow - _illusionFoundUtc).TotalSeconds > IllusionSettleSec && !D3PixelProbes.IsIllusionFinished(bmp, finishThresholds))
                return false;
            _illusionFound = false;
            return true;
        });
    }

    private bool Rising(string prefix, int index, bool condition)
    {
        string key = prefix + index.ToString(CultureInfo.InvariantCulture);
        lock (_lock)
        {
            bool before = _edgeStates.TryGetValue(key, out var b) && b;
            _edgeStates[key] = condition;
            return condition && !before;
        }
    }

    private void ScanPopups(DateTime now)
    {
        bool handleErrors = MonitorSettings.GetBool(ConfigKeys.MonitorRestartOnErrorPopup);
        bool teamViewer = MonitorSettings.GetBool(ConfigKeys.MonitorCloseTeamViewerPopups);
        var hit = ErrorPopupWatcher.Scan(handleErrors && _deferredRestart == null && !RosbotRestartRequest.IsPending, teamViewer);
        if (hit == null) return;
        MonitorLog.Warn($"Error popup: {hit.Kind} {hit.Detail}");
        TriggerEngine.Instance.Fire(MonitorEvents.ErrorDetected);
        if (hit.RestartDelaySec > 0)
        {
            _deferredRestart = (now.AddSeconds(hit.RestartDelaySec), hit);
            MonitorLog.Warn($"Restart in {hit.RestartDelaySec}s ({hit.Kind})");
        }
        else
        {
            RequestRestart(ReasonErrorPopup, hit.Kind.ToString(), false);
        }
    }

    private void CheckD3Memory()
    {
        if (!MonitorSettings.GetBool(ConfigKeys.MonitorD3MemoryRestart) || RosbotRestartRequest.IsPending) return;
        int limit = MonitorSettings.GetInt(ConfigKeys.MonitorD3MemoryLimitMb, MonitorSettings.D3MemoryLimitMbDefault);
        foreach (int pid in D3Manager.Instance.GetProcessIds())
        {
            double mb;
            try
            {
                using var p = Process.GetProcessById(pid);
                mb = p.WorkingSet64 / BytesPerMb;
            }
            catch
            {
                continue;
            }
            if (mb <= limit) continue;
            RequestRestart(ReasonMemory, ((int)mb).ToString(CultureInfo.InvariantCulture), false);
            return;
        }
    }

    private void ApplyTuning()
    {
        if (!MonitorSettings.GetBool(ConfigKeys.MonitorTuningEnabled)) return;
        Apply(D3Manager.Instance.GetProcessIds(), _tunedD3, ConfigKeys.MonitorTuningD3Priority, ConfigKeys.MonitorTuningD3Cpus);
        Apply(RosbotManager.Instance.GetDetection().Pids, _tunedRosbot, ConfigKeys.MonitorTuningRosbotPriority, ConfigKeys.MonitorTuningRosbotCpus);

        void Apply(IEnumerable<int> pids, HashSet<int> tuned, string priorityKey, string cpusKey)
        {
            var current = pids.ToHashSet();
            List<int> fresh;
            lock (_lock)
            {
                tuned.IntersectWith(current);
                fresh = current.Where(p => !tuned.Contains(p)).ToList();
                foreach (int p in fresh) tuned.Add(p);
            }
            string priority = MonitorSettings.GetString(priorityKey, ProcessTuning.PriorityNormal);
            long mask = ProcessTuning.ParseCpuList(MonitorSettings.GetString(cpusKey));
            foreach (int pid in fresh)
            {
                bool ok = ProcessTuning.Apply(pid, priority, mask);
                MonitorLog.Info($"Process tuning pid={pid} priority={priority} cpus=0x{mask:X}: {(ok ? "ok" : "failed")}");
            }
        }
    }

    private void CheckRollovers()
    {
        CheckRollover(RosbotLogPaths.GetLogsFilePath(), ref _logRolloverStamp, MonitorEvents.LogRollover, PnLogsPrefix, PnLogsSubDir);
        CheckRollover(RosbotLogPaths.GetHistoryFilePath(), ref _historyRolloverStamp, MonitorEvents.HistoryRollover, PnHistoryPrefix, PnHistorySubDir);
    }

    /// <summary>A new "&lt;file&gt;.1" means ROSBOT rolled the file: fire the event and, when enabled, move it into Logs/Pure Numbers/&lt;dir&gt;/PN-*.txt.&lt;n&gt;.</summary>
    private static void CheckRollover(string path, ref DateTime? stamp, string eventId, string pnPrefix, string pnSubDir)
    {
        DateTime? current = RolloverStamp(path);
        if (current == null || current == stamp)
        {
            stamp = current;
            return;
        }
        stamp = current;
        MonitorLog.Info($"{Path.GetFileName(path)} rolled over");
        TriggerEngine.Instance.Fire(eventId);
        if (!MonitorSettings.GetBool(ConfigKeys.MonitorArchiveLogRollover)) return;
        try
        {
            string dir = Path.Combine(RosbotLogPaths.GetLogsDirectory(), PureNumbersDir, pnSubDir);
            Directory.CreateDirectory(dir);
            int next = Directory.GetFiles(dir, pnPrefix + "*")
                .Select(f => int.TryParse(Path.GetFileName(f)[pnPrefix.Length..], NumberStyles.Integer, CultureInfo.InvariantCulture, out int n) ? n : 0)
                .DefaultIfEmpty(PnFirstSuffix - 1).Max() + 1;
            string target = Path.Combine(dir, pnPrefix + next.ToString(CultureInfo.InvariantCulture));
            File.Move(path + RolloverSuffix, target);
            stamp = null;
            MonitorLog.Info($"Archived to {target}");
        }
        catch (Exception ex)
        {
            MonitorLog.Warn($"Archive failed: {ex.Message}");
        }
    }

    private static DateTime? RolloverStamp(string path)
    {
        string rolled = path + RolloverSuffix;
        try { return File.Exists(rolled) ? File.GetLastWriteTimeUtc(rolled) : null; }
        catch { return null; }
    }

    private void CheckRosbotLogLevel()
    {
        bool disabled = false;
        try
        {
            string path = RosbotLogPaths.GetGlobalSettingsPath();
            if (File.Exists(path))
            {
                string? line = File.ReadLines(path).FirstOrDefault(l => l.Contains(RosbotLogMarkers.DebugLevelKey, StringComparison.OrdinalIgnoreCase));
                int eq = line?.IndexOf('=') ?? -1;
                disabled = eq >= 0 && string.Equals(line![(eq + 1)..].Trim(), RosbotLogMarkers.DebugLevelNoLogs, StringComparison.OrdinalIgnoreCase);
            }
        }
        catch (Exception ex)
        {
            ColorPrinter.Gray($"{MonitorLog.Tag} read ROSBOT settings: {ex.Message}");
        }
        lock (_lock) _logsDisabled = disabled;
        if (disabled) MonitorLog.Warn("ROSBOT logs are disabled (DebugLevel = NoLogs): log timeout and log triggers will not work");
    }

    /// <summary>Single place for every restart: error trigger (timeouts), error screenshot, Battle.net close (requested or configured), notification.</summary>
    private void OnRestartExecuted(string reasonId, string detail, bool restartBattlenet)
    {
        MonitorLog.Warn($"Restarting D3 + ROSBOT: {reasonId} {detail}");
        if (reasonId == RosbotRestartRequest.ReasonLogTimeout)
            TriggerEngine.Instance.Fire(MonitorEvents.ErrorDetected);
        if (reasonId != ReasonMemory)
            MonitorScreenshotService.CaptureKind(MonitorScreenshotKinds.Error);
        if (restartBattlenet || MonitorSettings.GetBool(ConfigKeys.MonitorRestartBattlenetOnRestart))
            BattlenetManager.Instance.Close();
        NotificationService.NotifyRestart(reasonId, detail, RosbotExitState.GetTotalRestartCount());
    }

    private void OnRosbotStarted(object? payload)
    {
        if (payload is not RosbotStartedPayload { Success: true }) return;
        if (MonitorSettings.GetBool(ConfigKeys.MonitorD3ShrinkOnStart))
            _ = Task.Run(GameWindowActions.ShrinkD3);
    }

    private void OnShutdown()
    {
        TriggerEngine.Instance.RunSynchronously(MonitorEvents.AppExit);
        ExternalGameTools.Shutdown();
        _historyWatcher?.Dispose();
        _historyWatcher = null;
    }

    private static int ParseArg(string text) => MonitorSettings.ParseArg(text);

    private static bool ContainsAny(string line, IEnumerable<string> markers) => markers.Any(m => line.Contains(m, StringComparison.Ordinal));

    private static DateTime Max(DateTime? a, DateTime b) => a is { } v && v > b ? v : b;

    private static double IdleSeconds(DateTime now, DateTime? last) => last is { } l ? (now - l).TotalSeconds : -1;
}
