namespace DotApps.d3check.Core;

/// <summary>
/// Singleton implementation of assistant execution state. Logic 1:1 with Python
/// providor ASSISTANT_EXECUTION_STATE (is_running, should_stop, enabled) and get/set/can_start/reset.
/// </summary>
public sealed class AssistantExecutionState : IAssistantExecutionState
{
    private readonly object _lock = new();
    private bool _isRunning;
    private bool _shouldStop;
    private bool _enabled = true;

    public static AssistantExecutionState Instance { get; } = new();

    private AssistantExecutionState() { }

    public bool IsRunning { get { lock (_lock) return _isRunning; } }
    public bool ShouldStop { get { lock (_lock) return _shouldStop; } }
    public bool Enabled { get { lock (_lock) return _enabled; } }

    public void SetShouldStop(bool value)
    {
        lock (_lock) _shouldStop = value;
    }

    public void SetRunning(bool value)
    {
        lock (_lock) _isRunning = value;
    }

    public void SetEnabled(bool value)
    {
        lock (_lock) _enabled = value;
    }

    public bool CanStart()
    {
        lock (_lock) return !_isRunning && _enabled;
    }

    public bool ShouldStopAssistant()
    {
        lock (_lock) return _shouldStop;
    }

    public void ResetState()
    {
        lock (_lock)
        {
            _isRunning = false;
            _shouldStop = false;
            _enabled = true;
        }
    }
}
