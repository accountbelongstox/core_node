namespace DotCore.Foundations;

/// <summary>
/// Publish/subscribe by event id. Logic 1:1 with Python event_center: subscribe handlers, trigger from any thread; app marshals to main thread when needed.
/// Handlers are invoked synchronously by default; app can wrap with IMainThreadDispatcher for UI events.
/// </summary>
public interface IEventHub
{
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
}
