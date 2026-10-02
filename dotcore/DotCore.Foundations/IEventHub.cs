// PY-REF: pyapps/d3-check/d3utils/event_center.py
namespace DotCore.Foundations;

/// <summary>
/// Publish/subscribe by event id. Logic 1:1 with Python event_center / pycore thread_bus EventHandlerRegistry:
/// handlers run in priority order (lower = earlier), optional payload, trigger from any thread.
/// PublishOnMainThread marshals through the registered IMainThreadDispatcher and queues events until one is set.
/// </summary>
public interface IEventHub
{
    /// <summary>Default handler priority (Python register_event_handler priority=100).</summary>
    const int DefaultPriority = 100;

    /// <summary>
    /// Subscribes a handler for the event id. Same id can have multiple handlers.
    /// </summary>
    void Subscribe(string eventId, Action handler);

    /// <summary>
    /// Unsubscribes the handler for the event id.
    /// </summary>
    void Unsubscribe(string eventId, Action handler);

    /// <summary>
    /// Publishes the event: invokes all handlers registered for the event id. Call from any thread; implementor may marshal to main thread.
    /// </summary>
    void Publish(string eventId);

    /// <summary>Subscribes a payload handler with priority (lower runs first). Same handler is registered once per event id.</summary>
    void Subscribe(string eventId, Action<object?> handler, int priority = DefaultPriority);

    /// <summary>Unsubscribes a payload handler. Returns true if removed.</summary>
    bool Unsubscribe(string eventId, Action<object?> handler);

    /// <summary>Publishes the event with payload to all handlers (payload-less handlers ignore it). 1:1 Python THREAD_BUS.trigger_event(name, data).</summary>
    void Publish(string eventId, object? payload);

    /// <summary>Sets the main-thread dispatcher; pending events queued before it was set are dispatched. Null clears it.</summary>
    void SetMainThreadDispatcher(IMainThreadDispatcher? dispatcher);

    /// <summary>Publishes on the main thread via the dispatcher; queues the event while no dispatcher is set. 1:1 Python _schedule_on_main_thread.</summary>
    void PublishOnMainThread(string eventId, object? payload = null);
}
