namespace DotApps.d3check.Core;

/// <summary>
/// State center for D3 game interface. UI registers callbacks and receives snapshots on main-thread poll.
/// Logic 1:1 with Python share.game_interface_data get_game_interface_data().
/// </summary>
public interface IGameInterfaceData
{
    /// <summary>Register callback; invoked on main thread with GetStateSnapshot().</summary>
    void RegisterCallback(Action<GameInterfaceStateSnapshot> callback);

    /// <summary>Unregister a previously registered callback.</summary>
    void UnregisterCallback(Action<GameInterfaceStateSnapshot> callback);

    /// <summary>Thread-safe copy of current state for UI.</summary>
    GameInterfaceStateSnapshot GetStateSnapshot();

    /// <summary>Update path-derived state from config (BN/D3/ROS paths). Call from app before NotifyCallbacks when no window detection yet.</summary>
    void UpdateFromPaths(string? battlenetPath, string? d3Path, string? rosDirectory);

    /// <summary>Invoke all registered callbacks with current snapshot. Must be called on main thread only.</summary>
    void NotifyCallbacks();
}
