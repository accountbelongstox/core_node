// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/d3_status_provider.py
// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/rosbot_status_provider.py
// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/d3_manager.py
// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/log_monitor_api.py
// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/rosbot_task_registry.py
namespace DotApps.d3d4tester.Core;

/// <summary>
/// App services the Core flow library needs (config, status providers, task start/stop, the E block). The app sets
/// <see cref="RosbotFlowHost.Current"/> at startup. Replaces Python module-level imports of providor / status providers /
/// event_center / rosbot_task_registry, which Core cannot reference directly.
/// </summary>
public interface IRosbotFlowHost
{
    T? GetConfig<T>(string keyPath, T? defaultValue);

    /// <summary>String array at keyPath (e.g. ros_settings.other_exe_search_patterns); null when missing or not an array.</summary>
    IReadOnlyList<string>? GetConfigStringList(string keyPath);

    void SetConfig(string keyPath, object? value);

    /// <summary>Last logs.txt write time (UTC); null when unknown. 1:1 Python log_monitor_api.get_last_log_modified_time.</summary>
    DateTime? GetLastLogModifiedUtc();

    /// <summary>1:1 Python rosbot_task_processor.start_rosbot_task.</summary>
    void StartRosbotTask();

    /// <summary>1:1 Python rosbot_task_processor.stop_rosbot_task.</summary>
    void StopRosbotTask();

    /// <summary>Returns state_changed. 1:1 Python _refresh_d3_status_internal(skip_dynamic).</summary>
    bool RefreshD3Status(bool skipDynamic);

    /// <summary>Returns state_changed. 1:1 Python _refresh_rosbot_status_internal.</summary>
    bool RefreshRosbotStatus();

    /// <summary>1:1 Python game_interface_data.notify_state_sync.</summary>
    void NotifyStateSync();

    /// <summary>
    /// [F2] ROSBOT online -> true; else [E1-E6] (end, optional update, start, task init, UI start clicks), aborted when ctx stops.
    /// Runs on the flow thread; true when ROSBOT is online or was started.
    /// </summary>
    /// <summary>[F2] + [E]; restart = [E] (ROSBOT closed and started again) even when ROSBOT is online.</summary>
    bool RunRosbotStart(Flow.FlowContext ctx, bool restart);
}

/// <summary>Holder for the app-provided <see cref="IRosbotFlowHost"/>.</summary>
public static class RosbotFlowHost
{
    public static IRosbotFlowHost? Current { get; set; }

    public static T? GetConfig<T>(string keyPath, T? defaultValue) =>
        Current != null ? Current.GetConfig(keyPath, defaultValue) : defaultValue;
}
