// PY-REF: pyapps/d3-check/providor/providor_index.py
using DotApps.d3d4tester.Core;
using Microsoft.Extensions.Configuration;

namespace DotApps.d3d4tester.Config.Options;

/// <summary>Options for rosbot section.</summary>
public sealed class RosbotOptions
{
    [ConfigurationKeyName("pickup_blood_shards")]
    public bool PickupBloodShards { get; set; }

    [ConfigurationKeyName("prevent_stuck")]
    public bool PreventStuck { get; set; }

    [ConfigurationKeyName("blue_portal_priority")]
    public bool BluePortalPriority { get; set; }

    [ConfigurationKeyName("smart_echo")]
    public bool SmartEcho { get; set; }

    [ConfigurationKeyName("smart_echo_wait_seconds")]
    public int SmartEchoWaitSeconds { get; set; } = RosbotConstants.RosbotSmartEchoWaitSecondsDefault;

    [ConfigurationKeyName("startup")]
    public bool Startup { get; set; }

    [ConfigurationKeyName("firstborn_blue_gate_reuse")]
    public bool FirstbornBlueGateReuse { get; set; }

    [ConfigurationKeyName("test_mode")]
    public bool TestMode { get; set; }

    [ConfigurationKeyName("test_timeout_minutes")]
    public int TestTimeoutMinutes { get; set; } = RosbotConstants.RosbotTestTimeoutMinutesDefault;

    [ConfigurationKeyName("timeout_minutes")]
    public int TimeoutMinutes { get; set; } = RosbotConstants.RosbotLogTimeoutMinutesDefault;
}
