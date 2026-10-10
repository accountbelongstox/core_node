// PY-REF: pyapps/d3-check/d3utils/rosbot_flow_battlenet.py
// PY-REF: pyapps/d3-check/d3utils/rosbot_flow/flow_bn_only.py
// PY-REF: pyapps/d3-check/d3utils/battlenet_operation.py
// PY-REF: pyapps/d3-check/share/asia_credentials.py
// PY-REF: pyapps/d3-check/d3utils/battlenet_status_provider.py
namespace DotApps.d3d4tester.Core.Battlenet;

/// <summary>
/// App-provided callbacks for the Battle.net flow (Core cannot reference the app: config, credentials, the accounts prompt).
/// 1:1 Python imports of rosbot_flow_battlenet / flow_bn_only / battlenet_operation (share.asia_credentials,
/// ros_settings.battlenet_region_cache).
/// </summary>
public static class BattlenetFlowHooks
{
    /// <summary>Config ros_settings.battlenet_region_cache.</summary>
    public static Func<string?>? RegionCacheProvider { get; set; }

    /// <summary>True while the Battle.net accounts were shown and the credentials are still missing. 1:1 is_asia_credentials_dialog_pending.</summary>
    public static Func<bool>? CredentialsPromptPending { get; set; }

    /// <summary>Saved (encrypted at rest) login credentials for a region ("cn" / "asia"), or null; Asia client login and web login share it. 1:1 get_asia_credentials.</summary>
    public static Func<string, (string Account, string Password)?>? GetLoginCredentials { get; set; }

    /// <summary>Show the Battle.net accounts once (non-blocking) for a region without saved credentials. 1:1 schedule_asia_credentials_dialog.</summary>
    public static Action<string>? ScheduleLoginCredentialsPrompt { get; set; }

    public static bool IsCredentialsPromptPending() => CredentialsPromptPending?.Invoke() ?? false;
}
