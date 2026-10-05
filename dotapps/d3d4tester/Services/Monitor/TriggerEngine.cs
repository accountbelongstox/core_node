// PY-REF: none (DOT-only)
using System.Collections.Concurrent;
using System.Globalization;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core.Monitor;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Services.Monitor;

/// <summary>
/// Trigger list (monitor.triggers) and dispatch (RBAssist CHECKFORTRIGGERS / DOACTION): events select enabled triggers, matched actions
/// run one at a time on a background worker so a slow action (close bot waits 5 s) never blocks the 1 s tick.
/// </summary>
public sealed class TriggerEngine
{
    private const string WorkerName = "MonitorTriggerWorker";
    private readonly object _lock = new();
    private readonly BlockingCollection<TriggerDefinition> _queue = new();
    private List<TriggerDefinition> _triggers = new();
    private Thread? _worker;
    private int _periodicPending;

    public static TriggerEngine Instance { get; } = new();

    private TriggerEngine()
    {
    }

    /// <summary>Copy of the current list (index = trigger index used for per-trigger state).</summary>
    public IReadOnlyList<TriggerDefinition> Triggers
    {
        get { lock (_lock) return _triggers.Select(t => t.Clone()).ToList(); }
    }

    public void Load()
    {
        var list = TriggerDefinition.ListFromJson(D3D4TesterConfigService.Instance.GetRawText(ConfigKeys.MonitorTriggers));
        lock (_lock) _triggers = list;
    }

    /// <summary>Replace and persist the list.</summary>
    public void Save(IReadOnlyList<TriggerDefinition> triggers)
    {
        var copy = triggers.Select(t => t.Clone()).ToList();
        lock (_lock) _triggers = copy;
        ConfigBinding.SetValue(ConfigKeys.MonitorTriggers, copy);
    }

    public bool HasEnabled(string eventId)
    {
        lock (_lock) return _triggers.Any(t => t.Enabled && t.Event == eventId);
    }

    /// <summary>Run every enabled trigger of eventId whose arguments match (scheduled time, log / history text); others always match.</summary>
    public void Fire(string eventId, string? text = null) => Evaluate(eventId, (_, t) => Matches(t, text));

    /// <summary>Run every enabled trigger of eventId for which predicate(index, trigger) is true.</summary>
    public void Evaluate(string eventId, Func<int, TriggerDefinition, bool> predicate)
    {
        List<(int Index, TriggerDefinition Trigger)> candidates;
        lock (_lock)
            candidates = _triggers.Select((t, i) => (i, t)).Where(x => x.t.Enabled && x.t.Event == eventId).Select(x => (x.i, x.t.Clone())).ToList();
        foreach (var (index, trigger) in candidates)
        {
            bool match;
            try { match = predicate(index, trigger); }
            catch (Exception ex)
            {
                ColorPrinter.Gray($"{MonitorLog.Tag} trigger {index} predicate: {ex.Message}");
                continue;
            }
            if (match) Enqueue(trigger);
        }
    }

    /// <summary>Run the actions of eventId on the calling thread (app exit, when the worker may not get to run).</summary>
    public void RunSynchronously(string eventId)
    {
        List<TriggerDefinition> list;
        lock (_lock) list = _triggers.Where(t => t.Enabled && t.Event == eventId).Select(t => t.Clone()).ToList();
        foreach (var t in list)
        {
            try { TriggerActionRunner.Run(t); }
            catch (Exception ex) { MonitorLog.Warn($"Action {t.Action} failed: {ex.Message}"); }
        }
    }

    /// <summary>Queue the action of a trigger (also used by the page's "run now").</summary>
    public void Enqueue(TriggerDefinition trigger)
    {
        EnsureWorker();
        bool periodic = trigger.Event == MonitorEvents.CombatSwitch;
        if (periodic && Interlocked.Exchange(ref _periodicPending, 1) == 1) return;
        if (trigger.Log && !periodic)
            MonitorLog.Info($"Triggered {trigger.Event} -> {trigger.Action}");
        _queue.Add(trigger.Clone());
    }

    private static bool Matches(TriggerDefinition t, string? text)
    {
        switch (t.Event)
        {
            case MonitorEvents.ScheduledTime:
                var now = DateTime.Now;
                string day = t.EventArg2.Trim();
                bool dayOk = day.Length == 0 || day == TriggerCatalog.WeekdayAll.ToString(CultureInfo.InvariantCulture)
                    || day == ((int)now.DayOfWeek + 1).ToString(CultureInfo.InvariantCulture);
                return dayOk && t.EventArg.Trim() == now.ToString("HHmm", CultureInfo.InvariantCulture);
            case MonitorEvents.LogMatch:
            case MonitorEvents.HistoryMatch:
                return t.EventArg.Length > 0 && text != null && text.Contains(t.EventArg, StringComparison.OrdinalIgnoreCase);
            default:
                return true;
        }
    }

    private void EnsureWorker()
    {
        lock (_lock)
        {
            if (_worker != null) return;
            _worker = new Thread(RunWorker) { IsBackground = true, Name = WorkerName };
            _worker.Start();
        }
    }

    private void RunWorker()
    {
        foreach (var trigger in _queue.GetConsumingEnumerable())
        {
            try { TriggerActionRunner.Run(trigger); }
            catch (Exception ex) { MonitorLog.Warn($"Action {trigger.Action} failed: {ex.Message}"); }
            finally
            {
                if (trigger.Event == MonitorEvents.CombatSwitch) Volatile.Write(ref _periodicPending, 0);
            }
        }
    }
}
