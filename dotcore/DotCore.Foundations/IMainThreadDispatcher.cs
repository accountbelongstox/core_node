namespace DotCore.Foundations;

/// <summary>
/// Dispatches an action to the main (UI) thread. Logic 1:1 with Python root.after(0, f).
/// App provides implementation (e.g. WPF Dispatcher.Invoke, WinForms Control.Invoke).
/// </summary>
public interface IMainThreadDispatcher
{
    /// <summary>
    /// Invokes the action on the main thread. May block until completed or queue and return.
    /// </summary>
    void Invoke(Action action);
}
