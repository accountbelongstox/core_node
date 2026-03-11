namespace DotCore.Foundations;

/// <summary>
/// Default in-memory event hub. Invokes handlers synchronously on Publish. App can wrap with dispatcher for UI events.
/// Logic 1:1 with Python event center: subscribe, publish by event id.
/// </summary>
public sealed class DefaultEventHub : IEventHub
{
    private readonly object _lock = new();
    private readonly Dictionary<string, List<Action>> _handlers = new(StringComparer.Ordinal);

    public void Subscribe(string eventId, Action handler)
    {
        Guard.NotNullOrWhiteSpace(eventId);
        Guard.NotNull(handler);
        lock (_lock)
        {
            if (!_handlers.TryGetValue(eventId, out List<Action>? list))
            {
                list = new List<Action>();
                _handlers[eventId] = list;
            }
            list.Add(handler);
        }
    }

    public void Unsubscribe(string eventId, Action handler)
    {
        Guard.NotNullOrWhiteSpace(eventId);
        Guard.NotNull(handler);
        lock (_lock)
        {
            if (_handlers.TryGetValue(eventId, out List<Action>? list))
            {
                list.Remove(handler);
                if (list.Count == 0)
                    _handlers.Remove(eventId);
            }
        }
    }

    public void Publish(string eventId)
    {
        Guard.NotNullOrWhiteSpace(eventId);
        List<Action>? copy;
        lock (_lock)
        {
            if (!_handlers.TryGetValue(eventId, out List<Action>? list) || list.Count == 0)
                return;
            copy = new List<Action>(list);
        }
        foreach (Action h in copy)
        {
            try { h(); } catch { /* ignore */ }
        }
    }
}
