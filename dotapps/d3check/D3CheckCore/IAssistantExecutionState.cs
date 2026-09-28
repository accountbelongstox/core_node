namespace DotApps.d3check.Core;

/// <summary>
/// Assistant macro execution state. Logic 1:1 with Python ASSISTANT_EXECUTION_STATE and
/// get_assistant_state / set_assistant_should_stop / can_start_assistant / reset_assistant_state (DOT_REF SS8.6).
/// Used by hotkey callback to decide start vs stop and by RunAssistantAutoUse to guard and reset.
/// </summary>
public interface IAssistantExecutionState
{
    /// <summary>Whether the assistant flow is currently running.</summary>
    bool IsRunning { get; }
    /// <summary>Whether a stop has been requested (e.g. hotkey pressed again).</summary>
    bool ShouldStop { get; }
    /// <summary>Whether starting the assistant is allowed.</summary>
    bool Enabled { get; }

    /// <summary>Set should_stop. Called when user presses assistant hotkey while running.</summary>
    void SetShouldStop(bool value);
    /// <summary>Set is_running. Called at start of auto_use_interface_function.</summary>
    void SetRunning(bool value);
    /// <summary>Set enabled. Default true.</summary>
    void SetEnabled(bool value);

    /// <summary>True when not running and enabled. 1:1 with Python can_start_assistant().</summary>
    bool CanStart();
    /// <summary>True when should_stop. 1:1 with Python should_stop_assistant().</summary>
    bool ShouldStopAssistant();
    /// <summary>Reset to idle: is_running=false, should_stop=false, enabled=true. 1:1 with Python reset_assistant_state().</summary>
    void ResetState();
}
