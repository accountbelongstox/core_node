// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/event_center.py
namespace DotCore.Foundations;

/// <summary>
/// Default in-memory event hub. Invokes handlers synchronously on Publish in priority order (lower first, stable).
/// 1:1 Python pycore/pyfoundations/thread_bus/event_handler_registry.py (register/unregister/trigger) and
/// d3utils/event_center.py (_schedule_on_main_thread, _pending_events, _dispatch_pending_events).
/// </summary>
public sealed class DefaultEventHub : IEventHub
{
    private readonly object _lock = new();
    private readonly Dictionary<string, List<HandlerEntry>> _handlers = new(StringComparer.Ordinal);
    private readonly Queue<(string EventId, object? Payload)> _pendingEvents = new();
    private IMainThreadDispatcher? _dispatcher;

    private sealed record HandlerEntry(int Priority, Delegate Original, Action<object?> Invoke);

    public void Subscribe(string eventId, Action handler)
    {
        Guard.NotNull(handler);
        AddHandler(eventId, new HandlerEntry(IEventHub.DefaultPriority, handler, _ => handler()));
    }

    public void Unsubscribe(string eventId, Action handler)
    {
        Guard.NotNull(handler);
        RemoveHandler(eventId, handler);
    }

    public void Publish(string eventId) => Publish(eventId, null);

    public void Subscribe(string eventId, Action<object?> handler, int priority = IEventHub.DefaultPriority)
    {
        Guard.NotNull(handler);
        AddHandler(eventId, new HandlerEntry(priority, handler, handler));
    }

    public bool Unsubscribe(string eventId, Action<object?> handler)
    {
        Guard.NotNull(handler);
        return RemoveHandler(eventId, handler);
    }

    public void Publish(string eventId, object? payload)
    {
        Guard.NotNullOrWhiteSpace(eventId);
        HandlerEntry[] copy;
        lock (_lock)
        {
            if (!_handlers.TryGetValue(eventId, out List<HandlerEntry>? list) || list.Count == 0)
                return;
            copy = list.ToArray();
        }
        foreach (HandlerEntry h in copy)
        {
            try { h.Invoke(payload); } catch { /* ignore */ }
        }
    }

    public void SetMainThreadDispatcher(IMainThreadDispatcher? dispatcher)
    {
        (string EventId, object? Payload)[] pending;
        lock (_lock)
        {
            _dispatcher = dispatcher;
            if (dispatcher == null || _pendingEvents.Count == 0)
                return;
            pending = _pendingEvents.ToArray();
            _pendingEvents.Clear();
        }
        foreach (var (eventId, payload) in pending)
        {
            try { dispatcher.Invoke(() => Publish(eventId, payload)); } catch { /* UI may have been destroyed */ }
        }
        ColorPrinter.Yellow($"[EventCenter] Dispatched {pending.Length} pending events");
    }

    public void PublishOnMainThread(string eventId, object? payload = null)
    {
        Guard.NotNullOrWhiteSpace(eventId);
        IMainThreadDispatcher? dispatcher;
        lock (_lock)
        {
            dispatcher = _dispatcher;
            if (dispatcher == null)
            {
                _pendingEvents.Enqueue((eventId, payload));
                return;
            }
        }
        dispatcher.Invoke(() => Publish(eventId, payload));
    }

    private void AddHandler(string eventId, HandlerEntry entry)
    {
        Guard.NotNullOrWhiteSpace(eventId);
        lock (_lock)
        {
            if (!_handlers.TryGetValue(eventId, out List<HandlerEntry>? list))
            {
                list = new List<HandlerEntry>();
                _handlers[eventId] = list;
            }
            if (list.Any(e => e.Original.Equals(entry.Original)))
                return;
            int index = list.FindLastIndex(e => e.Priority <= entry.Priority) + 1;
            list.Insert(index, entry);
        }
    }

    private bool RemoveHandler(string eventId, Delegate original)
    {
        Guard.NotNullOrWhiteSpace(eventId);
        lock (_lock)
        {
            if (!_handlers.TryGetValue(eventId, out List<HandlerEntry>? list))
                return false;
            int removed = list.RemoveAll(e => e.Original.Equals(original));
            if (list.Count == 0)
                _handlers.Remove(eventId);
            return removed > 0;
        }
    }
}
