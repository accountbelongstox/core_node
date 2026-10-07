// PY-REF: pyapps/d3-check/d3utils/rosbot_flow_battlenet.py
// PY-REF: pyapps/d3-check/d3utils/rosbot_flow/flow_bn_only.py
// PY-REF: pyapps/d3-check/d3utils/battlenet_operation.py
// PY-REF: pyapps/d3-check/share/asia_credentials.py
// PY-REF: pyapps/d3-check/share/oauth_callback.py
// PY-REF: pyapps/d3-check/d3utils/battlenet_status_provider.py
namespace DotApps.d3d4tester.Core.Battlenet;

/// <summary>
/// App-provided callbacks for the Battle.net flow (Core cannot reference the app: config, credentials dialog, OAuth bridge, event hub).
/// 1:1 Python imports of rosbot_flow_battlenet / flow_bn_only / battlenet_operation (share.asia_credentials, share.oauth_callback,
/// battlenet_status_provider, ros_settings.battlenet_region_cache).
/// </summary>
public static class BattlenetFlowHooks
{
    /// <summary>Config ros_settings.battlenet_region_cache.</summary>
    public static Func<string?>? RegionCacheProvider { get; set; }

    /// <summary>Stored Asia credentials (email, password) or null. 1:1 get_asia_credentials.</summary>
    public static Func<(string Email, string Password)?>? GetAsiaCredentials { get; set; }

    /// <summary>True while the credentials dialog is scheduled or open. 1:1 is_asia_credentials_dialog_pending.</summary>
    public static Func<bool>? CredentialsDialogPending { get; set; }

    /// <summary>Schedule the credentials dialog once (non-blocking). 1:1 schedule_asia_credentials_dialog.</summary>
    public static Action? ScheduleCredentialsDialog { get; set; }

    /// <summary>Saved (encrypted at rest) login credentials for a region ("cn" / "asia"), or null. Used by web login automation.</summary>
    public static Func<string, (string Account, string Password)?>? GetLoginCredentials { get; set; }

    /// <summary>Schedule the credentials dialog for a region (non-blocking).</summary>
    public static Action<string>? ScheduleLoginCredentialsDialog { get; set; }

    /// <summary>1:1 share.oauth_callback.reset_oauth_done.</summary>
    public static Action? ResetOauthDone { get; set; }

    /// <summary>1:1 share.oauth_callback.notify_oauth_done.</summary>
    public static Action? NotifyOauthDone { get; set; }

    /// <summary>Refresh Battle.net window + dynamic state into GameInterfaceData; returns state_changed. 1:1 _refresh_battlenet_status_internal.</summary>
    public static Func<bool>? RefreshBattlenetStatus { get; set; }

    /// <summary>1:1 game_interface_data.notify_state_sync.</summary>
    public static Action? NotifyStateSync { get; set; }

    public static bool IsCredentialsDialogPending() => CredentialsDialogPending?.Invoke() ?? false;
}
