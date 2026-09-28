namespace DotCore.Utils;

/// <summary>
/// Config change notification: subscribe by key path or global, notify when config is updated. Logic 1:1 with Python config_change_hub.
/// Subscriber receives key path so it can rebind hotkeys when key_path starts with auxiliary_config, etc.
/// </summary>
public sealed class ConfigChangeNotifier
{
    private readonly object _lock = new();
    private List<Subscription> _subscribers = new();

    /// <summary>
    /// Subscribes to config change. Handler receives optional key path (null = global).
    /// </summary>
    public void Subscribe(Action<string?> handler)
    {
        lock (_lock)
        {
            _subscribers.Add(new Subscription(handler));
        }
    }

    /// <summary>
    /// Unsubscribes the given handler.
    /// </summary>
    public void Unsubscribe(Action<string?> handler)
    {
        lock (_lock)
        {
            _subscribers.RemoveAll(s => s.Handler == handler);
        }
    }

    /// <summary>
    /// Notifies all subscribers that config changed. Pass key path or null for global. Call from config set/save.
    /// </summary>
    public void NotifyConfigChanged(string? keyPath = null)
    {
        List<Subscription> copy;
        lock (_lock)
        {
            copy = new List<Subscription>(_subscribers);
        }
        foreach (Subscription s in copy)
        {
            try { s.Handler(keyPath); } catch { /* ignore */ }
        }
    }

    private sealed class Subscription
    {
        public readonly Action<string?> Handler;
        public Subscription(Action<string?> handler) => Handler = handler;
    }
}
