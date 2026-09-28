namespace DotApps.d3check.Core;

/// <summary>
/// Registry for the main function thread (extension thread that processes start_macro/stop_macro commands).
/// 1:1 with Python get_main_function_thread() / set_main_function_thread; when registered, HasThread is true.
/// </summary>
public sealed class MainFunctionThreadRegistry
{
    private readonly object _lock = new();
    private object? _thread;

    public static MainFunctionThreadRegistry Instance { get; } = new();

    private MainFunctionThreadRegistry() { }

    /// <summary>Register the main function thread. Call when extension threads are created. 1:1 Python set_main_function_thread.</summary>
    public void Register(object? thread)
    {
        lock (_lock) _thread = thread;
    }

    /// <summary>Unregister. Call on shutdown.</summary>
    public void Unregister()
    {
        lock (_lock) _thread = null;
    }

    /// <summary>True when a main function thread is registered. 1:1 Python get_main_function_thread() is not None.</summary>
    public bool HasThread()
    {
        lock (_lock) return _thread != null;
    }
}
