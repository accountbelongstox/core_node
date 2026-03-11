namespace DotApps.d3check.Constants;

/// <summary>
/// Battle.net client UI timeouts. Sleep mode detection uses AutomationId only (see BattlenetConstants.SleepModeAutomationIdMarkers, uidocs 战网_85BFA152).
/// </summary>
public static class BattlenetUiKeywords
{
    /// <summary>Max seconds to wait for Battle.net to wake from sleep mode before giving up. ROSBOT will not start if timeout.</summary>
    public const int WakeTimeoutSeconds = 60;
}
