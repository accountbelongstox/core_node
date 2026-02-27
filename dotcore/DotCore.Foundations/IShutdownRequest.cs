namespace DotCore.Foundations;

/// <summary>
/// Shutdown request state. Logic 1:1 with Python shutdown_manager: request_shutdown, is_shutdown_requested.
/// App sets requested and runs execute_shutdown (stop hotkeys, hooks, threads, UI, exit).
/// </summary>
public interface IShutdownRequest
{
    /// <summary>
    /// True after Request() has been called.
    /// </summary>
    bool IsShutdownRequested { get; }

    /// <summary>
    /// Requests application shutdown. ExecuteShutdown() should be called on main thread.
    /// </summary>
    void Request();
}
