namespace DotApps.d3check.Constants;

/// <summary>ROSBOT logs.txt analysis constants. 1:1 Python d3utils.log_analyzer + providor.constants.common.</summary>
public static class RosbotLogConstants
{
    public const string LoginTryTriggerDefault = "Login try";
    public const int PickingEndLookback = 22;
    public const int SystemErrorLookbackLines = 10;
    public const int SystemErrorCooldownLines = 30;
    public const int RecentLinesMax = 22;
    public const int LineBufferMax = 6;
    public const double SmartEchoOcrMaxSeconds = 60.0;
    public const int SmartEchoTimerIntervalMs = 3000;
    public const string PickingEndSentinel = "Picking end";
    public const string EchoingFuryExplorationMarker = "Running: Echoing Fury Exploration";
}
