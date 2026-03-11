namespace DotCore.Foundations;

/// <summary>
/// Default shutdown request: holds a flag set by Request(). Logic 1:1 with Python shutdown_manager state.
/// </summary>
public sealed class DefaultShutdownRequest : IShutdownRequest
{
    private volatile bool _requested;

    public bool IsShutdownRequested => _requested;

    public void Request()
    {
        _requested = true;
    }
}
